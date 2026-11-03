"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Inbox, Loader2, MapPin, RefreshCw, Search, X } from "lucide-react";
import {
  applicationApi,
  leaseApi,
  ApplicationStatus,
  ApplicationWithProperty,
  LeaseWithProperty,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/format";

type TabValue = ApplicationStatus | "ALL";


const TABS: { value: TabValue; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "EXPIRED", label: "Expired" },
  { value: "ALL", label: "All" },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/* ---------- helpers ---------- */

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") {
    return images[0];
  }
  return null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Dates arrive as yyyy-mm-dd. Parse as UTC so the day never shifts with the viewer's timezone.
function formatDate(s: string): string {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function initials(name: string | null, email: string): string {
  const src = (name ?? email).trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}



/* ---------- page ---------- */

export default function LandlordApplicationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [tab, setTab] = useState<TabValue>("PENDING");
  const [apps, setApps] = useState<ApplicationWithProperty[] | null>(null);
  const [leasedIds, setLeasedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const [approvingApp, setApprovingApp] = useState<ApplicationWithProperty | null>(null);
  const [rejectingApp, setRejectingApp] = useState<ApplicationWithProperty | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load(showSpinner = true) {
    if (showSpinner) setApps(null);
    else setRefreshing(true);
    setError(null);
    try {
      const [appRes, leaseRes] = await Promise.all([
        applicationApi.listForLandlord(),
        // Used only to show "Create lease" vs "View lease" on approved applications.
        leaseApi.listForLandlord().catch(() => ({ leases: [] as LeaseWithProperty[] })),
      ]);
      setApps(appRes.applications);
      setLeasedIds(
        new Set(leaseRes.leases.map((l) => l.application_id).filter((id): id is string => Boolean(id)))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications.");
      setApps((prev) => prev ?? []);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/landlord/applications");
      return;
    }
    if (user.role !== "LANDLORD" && user.role !== "ADMIN") {
      router.push("/");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches data on mount; the loader sets its loading state before awaiting
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const counts = useMemo(() => {
    const base: Record<TabValue, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0, EXPIRED: 0, ALL: 0 };
    if (!apps) return base;
    for (const a of apps) {
      base[a.status] += 1;
      base.ALL += 1;
    }
    return base;
  }, [apps]);

  // Pending applications come first, longest-waiting on top. Everything else is newest first.
  const visible = useMemo(() => {
    if (!apps) return null;
    const q = query.trim().toLowerCase();
    return apps
      .filter((a) => tab === "ALL" || a.status === tab)
      .filter((a) => {
        if (!q) return true;
        const hay = [a.properties?.title, a.properties?.city, a.users?.full_name, a.users?.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const ap = a.status === "PENDING" ? 0 : 1;
        const bp = b.status === "PENDING" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const at = new Date(a.created_at).getTime();
        const bt = new Date(b.created_at).getTime();
        return a.status === "PENDING" ? at - bt : bt - at;
      });
  }, [apps, tab, query]);

  async function confirmApprove() {
    if (!approvingApp) return;
    const app = approvingApp;
    setActingId(app.id);
    try {
      await applicationApi.review(app.id, { status: "APPROVED" });
      setApprovingApp(null);
      await load(false); // refetch: approving auto-rejects other pending applications for the property
    } catch (e) {
      setApprovingApp(null);
      setError(e instanceof Error ? e.message : "Failed to approve.");
    } finally {
      setActingId(null);
    }
  }

  async function confirmReject(reason: string) {
    if (!rejectingApp) return;
    const app = rejectingApp;
    setActingId(app.id);
    try {
      await applicationApi.review(app.id, { status: "REJECTED", rejectionReason: reason });
      setRejectingApp(null);
      await load(false);
    } catch (e) {
      setRejectingApp(null);
      setError(e instanceof Error ? e.message : "Failed to reject.");
    } finally {
      setActingId(null);
    }
  }

  if (authLoading || !user || (user.role !== "LANDLORD" && user.role !== "ADMIN")) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  const pending = counts.PENDING;
  let summary = "Applications appear here as tenants apply to your listings.";
  if (apps && pending > 0) {
    summary = `${pending} ${pending === 1 ? "application is" : "applications are"} waiting for your review.`;
  } else if (apps && apps.length > 0) {
    summary = "You're all caught up. Nothing is waiting for your review.";
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For landlords" title="Applications">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">
            Applications
          </h1>
          <p className="mt-2 max-w-lg text-[15px] text-muted-2">{summary}</p>
        </div>
        <button
          onClick={() => load(false)}
          disabled={refreshing}
          aria-label="Refresh applications"
          className={`rounded-xl border border-ink/15 bg-surface/80 p-2.5 text-muted-2 hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Filters and search */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter applications">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                aria-pressed={active}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${focusRing} ${
                  active ? "bg-btn text-white" : "border border-ink/15 text-muted-2 hover:bg-ink/5"
                }`}
              >
                {t.label}
                <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-muted"}`}>
                  {counts[t.value]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search applications"
            placeholder="Search property or applicant"
            className="w-full rounded-xl border border-ink/15 bg-surface/70 py-2.5 pl-9 pr-8 text-sm text-ink outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-ink/5 hover:text-ink ${focusRing}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {visible === null && (
        <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading applications">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-ink/8 glass p-5">
              <div className="flex gap-4">
                <div className="h-24 w-32 rounded-lg bg-ink/8" />
                <div className="flex-1">
                  <div className="h-5 w-48 rounded bg-ink/8" />
                  <div className="mt-2 h-4 w-28 rounded bg-ink/6" />
                  <div className="mt-5 h-4 w-56 rounded bg-ink/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {visible && visible.length === 0 && (
        <EmptyState tab={tab} query={query} onClear={() => setQuery("")} />
      )}

      {/* List */}
      {visible && visible.length > 0 && (
        <div className="mt-6 space-y-5">
          {visible.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              hasLease={leasedIds.has(a.id)}
              acting={actingId === a.id}
              onApprove={() => setApprovingApp(a)}
              onReject={() => setRejectingApp(a)}
            />
          ))}
        </div>
      )}

      {approvingApp && (
        <ApproveDialog
          applicant={approvingApp.users?.full_name ?? approvingApp.users?.email ?? "this applicant"}
          property={approvingApp.properties?.title ?? "this property"}
          busy={actingId === approvingApp.id}
          onCancel={() => setApprovingApp(null)}
          onConfirm={confirmApprove}
        />
      )}

      {rejectingApp && (
        <RejectDialog
          applicant={rejectingApp.users?.full_name ?? rejectingApp.users?.email ?? "this applicant"}
          busy={actingId === rejectingApp.id}
          onCancel={() => setRejectingApp(null)}
          onConfirm={confirmReject}
        />
      )}
    </AppShell>
  );
}

/* ---------- application card ---------- */

function ApplicationCard({
  app,
  hasLease,
  acting,
  onApprove,
  onReject,
}: {
  app: ApplicationWithProperty;
  hasLease: boolean;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const img = firstImage(app.properties?.images);
  const applicantName = app.users?.full_name ?? app.users?.email ?? "Applicant";
  const isPending = app.status === "PENDING";

  const rent = app.properties?.rent_amount;
  const ratio = app.monthly_income && rent ? app.monthly_income / rent : null;

  return (
    <article
      className={`rounded-xl border glass p-5 ${
        isPending ? "border-ink/8 border-l-4 border-l-gold" : "border-ink/8"
      }`}
    >
      <div className="flex gap-4">
        <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-canvas">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted/60">
              <Home className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold leading-snug text-ink">
                {app.properties?.title ?? "Property"}
              </h2>
              {app.properties?.city && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {app.properties.city}
                </p>
              )}
            </div>
            <div className="shrink-0">
              <StatusBadge status={app.status} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary"
              aria-hidden="true"
            >
              {initials(app.users?.full_name ?? null, app.users?.email ?? "")}
            </span>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-ink">{applicantName}</p>
              <p className="flex flex-wrap gap-x-4 text-xs text-muted">
                {app.users?.full_name && app.users?.email && <span>{app.users.email}</span>}
                {app.users?.phone && <span>{app.users.phone}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Wants to move in</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatDate(app.desired_move_in_date)}</dd>
        </div>
        <div>
          <dt className="text-muted">Lease length</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {app.lease_duration_months} {app.lease_duration_months === 1 ? "month" : "months"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Monthly income</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink">
            {app.monthly_income != null ? (
              <>
                {formatMoney(app.monthly_income)}
                {ratio != null && rent != null && (
                  <span className="block text-xs font-normal text-muted">
                    {ratio.toFixed(1)}× the {formatMoney(rent)} rent
                  </span>
                )}
              </>
            ) : (
              <span className="font-normal text-muted">Not given</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Applied</dt>
          <dd className="mt-0.5 font-medium text-ink">{timeAgo(app.created_at)}</dd>
        </div>
      </dl>

      {app.status === "REJECTED" && app.rejection_reason && (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">Reason you gave:</span> {app.rejection_reason}
        </p>
      )}

      <footer className="mt-5 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-4">
        {isPending && (
          <>
            <button
              onClick={onApprove}
              disabled={acting}
              className={`inline-flex items-center gap-2 rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50 ${focusRing}`}
            >
              {acting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={acting}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 ${focusRing}`}
            >
              Reject
            </button>
          </>
        )}

        {app.status === "APPROVED" && (
          <Link
            href="/landlord/leases"
            className={`rounded-xl px-5 py-2.5 text-sm font-medium ${focusRing} ${
              hasLease
                ? "border border-ink/15 text-ink hover:bg-ink/5"
                : "bg-btn text-white hover:bg-btn-soft"
            }`}
          >
            {hasLease ? "View lease" : "Create lease"}
          </Link>
        )}

        <Link
          href={`/applications/${app.id}`}
          className={`ml-auto rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft ${focusRing}`}
        >
          View details
        </Link>
      </footer>
    </article>
  );
}

/* ---------- empty state ---------- */

function EmptyState({ tab, query, onClear }: { tab: TabValue; query: string; onClear: () => void }) {
  const searching = query.trim().length > 0;

  return (
    <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 glass px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas">
        <Inbox className="h-6 w-6 text-muted" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[15px] font-medium text-ink">
        {searching
          ? "No applications match your search"
          : tab === "ALL"
          ? "No applications yet"
          : `No ${tab.toLowerCase()} applications`}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted">
        {searching
          ? "Try a different name, email, or property."
          : tab === "PENDING"
          ? "You're all caught up. Nothing is waiting for your review."
          : "Applications will appear here as tenants submit them."}
      </p>
      {searching && (
        <button
          onClick={onClear}
          className={`mt-5 rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5 ${focusRing}`}
        >
          Clear search
        </button>
      )}
    </div>
  );
}

/* ---------- dialogs ---------- */

function Modal({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-xl glass-strong p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title" className="text-lg font-semibold text-ink">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function ApproveDialog({
  applicant,
  property,
  busy,
  onCancel,
  onConfirm,
}: {
  applicant: string;
  property: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Approve this application?" busy={busy} onClose={onCancel}>
      <p className="mt-2 text-sm text-muted-2">
        You&apos;re approving <span className="font-medium text-ink">{applicant}</span> for{" "}
        <span className="font-medium text-ink">{property}</span>.
      </p>
      <p className="mt-3 rounded-lg bg-canvas px-4 py-3 text-sm text-muted-2">
        The property will be marked as rented, and any other pending applications for it will be rejected automatically.
        You can create the lease straight after.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium text-muted-2 hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          autoFocus
          className={`inline-flex items-center gap-2 rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50 ${focusRing}`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Approve application
        </button>
      </div>
    </Modal>
  );
}

function RejectDialog({
  applicant,
  busy,
  onCancel,
  onConfirm,
}: {
  applicant: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    if (!reason.trim()) {
      setErr("Please give a reason.");
      return;
    }
    onConfirm(reason.trim());
  }


  return (
    <Modal title="Reject this application?" busy={busy} onClose={onCancel}>
      <p className="mt-2 text-sm text-muted-2">
        Telling <span className="font-medium text-ink">{applicant}</span> why helps them with future applications.

      </p>
      <label htmlFor="reject-reason" className="mt-4 block text-sm font-medium text-ink">
        Reason
      </label>
      <textarea
        id="reject-reason"
        rows={4}
        maxLength={500}
        autoFocus
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setErr(null);
        }}
        placeholder="For example: the unit has already been rented to another applicant."
        className="mt-1.5 w-full rounded-xl border border-ink/15 px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-red-600">{err}</span>
        <span className="tabular-nums text-muted">{reason.length}/500</span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium text-muted-2 hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-xl bg-[#dc2626] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#b91c1c] disabled:opacity-50 ${focusRing}`}
        >

          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Reject application
        </button>

      </div>
    </Modal>
  );
}