"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Inbox,
  Search,
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  XCircle,
  ArrowRight,
  RefreshCw,
  X,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  applicationApi,
  ApplicationStatus,
  ApplicationWithProperty,
} from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMoney } from "@/lib/format";

type TabValue = ApplicationStatus | "ALL";

const TABS: { value: TabValue; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "EXPIRED", label: "Expired" },
];

const STRIPE: Record<ApplicationStatus, string> = {
  PENDING: "bg-gold",
  APPROVED: "bg-[#10b981]",
  REJECTED: "bg-[#ef4444]",
  WITHDRAWN: "bg-slate-300",
  EXPIRED: "bg-slate-300",
};

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
  return new Date(iso).toLocaleDateString();
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [tab, setTab] = useState<TabValue>("ALL");
  const [apps, setApps] = useState<ApplicationWithProperty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  async function load(showSpinner = true) {
    if (showSpinner) setApps(null);
    else setRefreshing(true);
    setError(null);
    try {
      const { applications } = await applicationApi.listMine();
      setApps(applications);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load your applications.");
      setApps([]);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/applications");
      return;
    }
    if (user.role !== "TENANT") {
      router.replace("/dashboard");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches data on mount; the loader sets its loading state before awaiting
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const counts = useMemo(() => {
    const base: Record<TabValue, number> = {
      ALL: 0,
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      EXPIRED: 0,
    };
    if (!apps) return base;
    for (const a of apps) {
      base[a.status] += 1;
      base.ALL += 1;
    }
    return base;
  }, [apps]);

  const visible = useMemo(() => {
    if (!apps) return null;
    const q = query.trim().toLowerCase();
    return apps
      .filter((a) => tab === "ALL" || a.status === tab)
      .filter((a) => {
        if (!q) return true;
        const hay = [a.properties?.title, a.properties?.city].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [apps, tab, query]);

  async function withdraw(app: ApplicationWithProperty) {
    const message =
      app.status === "APPROVED"
        ? "Withdraw this approved application? The unit will be released and any draft lease will be cancelled. This can't be undone."
        : "Withdraw this application? This can't be undone.";
    if (!confirm(message)) return;
    setWithdrawingId(app.id);
    try {
      await applicationApi.withdraw(app.id);
      await load(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to withdraw.");
    } finally {
      setWithdrawingId(null);
    }
  }

  if (authLoading || !user || user.role !== "TENANT") {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For tenants" title="My Applications">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">
            Your applications
          </h1>
          <p className="mt-2 max-w-lg text-[15px] text-muted-2">
            Track every rental application you&apos;ve submitted, from review to move-in.
          </p>
        </div>
        <button
          onClick={() => load(false)}
          disabled={refreshing}
          aria-label="Refresh"
          className="rounded-xl border border-ink/10 bg-surface/80 p-2 text-muted-2 transition hover:border-ink/20 hover:text-ink disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs + search */}
      <div className="mt-7 flex flex-col gap-3 border-b border-ink/8 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.value;
            const n = counts[t.value];
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  active ? "bg-btn text-white shadow-sm" : "text-muted-2 hover:bg-ink/5"
                }`}
              >
                {t.label}
                <span
                  className={`min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-ink/8 text-muted-2"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by property or city..."
            className="w-full rounded-xl border border-ink/10 bg-surface/70 py-2 pl-9 pr-8 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {visible === null && (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-ink/8 glass" />
          ))}
        </div>
      )}

      {/* Empty */}
      {visible && visible.length === 0 && (
        <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 glass px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/5">
            <Inbox className="h-6 w-6 text-muted" />
          </div>
          <p className="mt-4 font-medium text-ink">
            {query.trim()
              ? "No applications match your search"
              : tab === "ALL"
              ? "No applications yet"
              : `No ${tab.toLowerCase()} applications`}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {query.trim()
              ? "Try a different property name or city."
              : tab === "ALL"
              ? "Once you apply to a property, it'll show up here."
              : "Nothing in this category right now."}
          </p>
          {tab === "ALL" && !query.trim() && (
            <Link
              href="/properties"
              className="mt-5 inline-block rounded-xl bg-btn px-4 py-2 text-sm text-white hover:bg-btn-soft"
            >
              Browse listings
            </Link>
          )}
        </div>
      )}

      {/* List */}
      {visible && visible.length > 0 && (
        <div className="mt-6 space-y-3">
          {visible.map((a) => (
            <ApplicationRow
              key={a.id}
              app={a}
              withdrawing={withdrawingId === a.id}
              onWithdraw={() => withdraw(a)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function ApplicationRow({
  app,
  withdrawing,
  onWithdraw,
}: {
  app: ApplicationWithProperty;
  withdrawing: boolean;
  onWithdraw: () => void;
}) {
  const img = firstImage(app.properties?.images);
  // Pending applications can be withdrawn, and so can approved ones that don't have an active lease yet
  // (the server releases the unit and cancels any draft lease).
  const canWithdraw = app.status === "PENDING" || app.status === "APPROVED";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-ink/8 glass transition hover:border-primary/40 hover:shadow-[0_10px_30px_-16px_rgba(11,18,32,0.25)]">
      <span className={`absolute inset-y-0 left-0 w-1 ${STRIPE[app.status]}`} aria-hidden />

      <div className="flex flex-col gap-4 py-4 pl-4 pr-4 sm:flex-row sm:items-center sm:pl-5">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-ink/5">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-wide text-muted">
                No photo
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-ink">
                  {app.properties?.title ?? "Property"}
                </h3>
                {app.properties?.city && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3" />
                    {app.properties.city}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <StatusBadge status={app.status} />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Meta
                icon={Calendar}
                label={`Move-in ${new Date(app.desired_move_in_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`}
              />
              <Meta icon={Briefcase} label={`${app.lease_duration_months} month lease`} />
              {app.properties?.rent_amount != null && (
                <Meta icon={DollarSign} label={`${formatMoney(app.properties.rent_amount)}/mo`} />
              )}
            </div>

            <p className="mt-2 text-[11px] uppercase tracking-wide text-muted/70">
              Applied {timeAgo(app.created_at)}
            </p>

            {app.status === "APPROVED" && app.expires_at && (
              <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Reserved for you until {new Date(app.expires_at).toLocaleDateString()}. The lease must be signed
                before then.
              </p>
            )}

            {app.status === "REJECTED" && app.rejection_reason && (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                {app.rejection_reason}
              </p>
            )}

            {app.status === "EXPIRED" && (
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                This application expired before it was completed. You can apply again if the property is still
                available.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-36 sm:flex-col sm:items-stretch sm:border-l sm:border-ink/8 sm:pl-4">
          {canWithdraw && (
            <button
              onClick={onWithdraw}
              disabled={withdrawing}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 glass px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:flex-none"
            >
              {withdrawing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Withdraw
            </button>
          )}
          <Link
            href={`/applications/${app.id}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink/10 glass px-3 py-2 text-xs font-semibold text-ink transition hover:border-primary/40 hover:text-primary sm:flex-none"
          >
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function Meta({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-xl bg-ink/5 px-2 py-1 text-[11px] font-medium text-muted-2">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}