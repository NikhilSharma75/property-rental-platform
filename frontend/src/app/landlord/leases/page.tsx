"use client";

import { errorMessage } from "@/lib/errors";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { leaseApi, applicationApi, LeaseWithProperty, ApplicationWithProperty } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { LeaseStatusBadge } from "@/components/leases/LeaseStatusBadge";
import { formatMoney } from "@/lib/format";

const DAY = 86_400_000;

// Lease dates arrive as yyyy-mm-dd. Parse as UTC so the day never shifts with the viewer's timezone.
function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}



function formatDate(s: string): string {
  return parseDate(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const money = (n: number) => formatMoney(n);

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const inputCls =
  "w-full rounded-xl border border-ink/15 bg-surface/70 px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

/* ---------- small icons ---------- */

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 3.5a3.5 3.5 0 00-3.3 4.7L3.5 13.9a1.5 1.5 0 002.1 2.1l5.7-5.7a3.5 3.5 0 004.7-3.3l-2.2 2.2-2-.5-.5-2 2.2-2.2z" />
    </svg>
  );
}

/* ---------- lease term timeline ---------- */

function TermTimeline({ lease }: { lease: LeaseWithProperty }) {
  const start = parseDate(lease.lease_start_date).getTime();
  const end = parseDate(lease.lease_end_date).getTime();
  const [now] = useState(() => Date.now());
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

  let caption: string;
  if (now < start) {
    const days = Math.ceil((start - now) / DAY);
    caption = days <= 1 ? "Starts tomorrow" : `Starts in ${days} days`;
  } else if (now > end) {
    caption = "Term ended";
  } else {
    const days = Math.ceil((end - now) / DAY);
    caption = days === 1 ? "1 day left" : `${days} days left`;
  }

  const bar =
    lease.status === "ACTIVE" ? "bg-primary" : lease.status === "DRAFT" ? "bg-gold" : "bg-ink/25";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span>{formatDate(lease.lease_start_date)}</span>
        <span className="font-medium text-ink">{caption}</span>
        <span>{formatDate(lease.lease_end_date)}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Lease term progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8"
      >
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- signature status ---------- */

function SignatureStep({ signed, signedText, pendingText }: { signed: boolean; signedText: string; pendingText: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          signed ? "bg-[#059669] text-white" : "border-2 border-gold/70 glass"
        }`}
        aria-hidden="true"
      >
        {signed && <CheckIcon />}
      </span>
      <span className={`text-sm ${signed ? "text-ink" : "text-muted-2"}`}>{signed ? signedText : pendingText}</span>
    </div>
  );
}

/* ---------- lease card ---------- */

function LeaseCard({
  lease,
  signing,
  downloading,
  onSign,
  onDownload,
  onStatusChange,
}: {
  lease: LeaseWithProperty;
  signing: boolean;
  downloading: boolean;
  onSign: () => void;
  onDownload: () => void;
  onStatusChange: (status: "TERMINATED" | "CANCELLED") => void;
}) {
  const needsMySignature = lease.status === "DRAFT" && !lease.signed_by_landlord;
  const showTimeline = lease.status === "DRAFT" || lease.status === "ACTIVE" || lease.status === "EXPIRED";
  const tenantName = lease.users?.full_name || lease.users?.email;

  return (
    <article
      className={`rounded-xl border glass p-6 ${
        needsMySignature ? "border-ink/8 border-l-4 border-l-gold" : "border-ink/8"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold leading-snug text-ink">{lease.properties?.title ?? "Property"}</h2>
          {lease.properties?.city && <p className="mt-0.5 text-sm text-muted">{lease.properties.city}</p>}
          {lease.units?.unit_label && <p className="mt-0.5 text-sm text-muted">Unit {lease.units.unit_label}</p>}
        </div>
        <LeaseStatusBadge status={lease.status} />
      </header>

      {lease.users && (
        <div className="mt-4 text-sm">
          <p className="font-medium text-ink">{tenantName}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 text-muted">
            {lease.users.full_name && <span>{lease.users.email}</span>}
            {lease.users.phone && <span>{lease.users.phone}</span>}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
          {money(lease.rent_amount)}
          <span className="ml-1.5 text-base font-normal text-muted">a month</span>
        </p>
        <dl className="flex gap-8 text-sm">
          <div>
            <dt className="text-muted">Deposit</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-ink">{money(lease.security_deposit)}</dd>
          </div>
          <div>
            <dt className="text-muted">Length</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {lease.lease_duration_months} {lease.lease_duration_months === 1 ? "month" : "months"}
            </dd>
          </div>
        </dl>
      </div>

      {showTimeline && (
        <div className="mt-6">
          <TermTimeline lease={lease} />
        </div>
      )}

      {lease.status === "DRAFT" && (
        <div className="mt-6 rounded-lg bg-canvas px-4 py-3.5">
          <p className="text-sm font-medium text-ink">Signatures needed to activate this lease</p>
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:gap-10">
            <SignatureStep signed={lease.signed_by_landlord} signedText="You've signed" pendingText="You haven't signed yet" />
            <SignatureStep signed={lease.signed_by_tenant} signedText="Tenant has signed" pendingText="Waiting on your tenant" />
          </div>
        </div>
      )}

      <footer className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-5">
        {needsMySignature && (
          <button
            onClick={onSign}
            disabled={signing}
            className={`rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50 ${focusRing}`}
          >
            {signing ? "Signing..." : "Sign lease"}
          </button>
        )}

        <button
          onClick={onDownload}
          disabled={downloading}
          className={`inline-flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50 ${focusRing}`}
        >
          <DownloadIcon />
          {downloading ? "Preparing PDF..." : "Download PDF"}
        </button>

        {lease.status === "ACTIVE" && (
          <Link
            href="/landlord/maintenance"
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft ${focusRing}`}
          >
            <WrenchIcon />
            Maintenance requests
          </Link>
        )}

        {lease.status === "DRAFT" && (
          <button
            onClick={() => onStatusChange("CANCELLED")}
            className={`ml-auto rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 ${focusRing}`}
          >
            Cancel draft
          </button>
        )}
        {lease.status === "ACTIVE" && (
          <button
            onClick={() => onStatusChange("TERMINATED")}
            className={`ml-auto rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 ${focusRing}`}
          >
            Terminate lease
          </button>
        )}
      </footer>
    </article>
  );
}

/* ---------- form field ---------- */

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ---------- page ---------- */

type Filter = "ALL" | "DRAFT" | "ACTIVE" | "ENDED";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ACTIVE", label: "Active" },
  { key: "ENDED", label: "Ended" },
];

function matchesFilter(l: LeaseWithProperty, f: Filter) {
  if (f === "ALL") return true;
  if (f === "ENDED") return l.status === "EXPIRED" || l.status === "TERMINATED" || l.status === "CANCELLED";
  return l.status === f;
}

export default function LandlordLeasesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [leases, setLeases] = useState<LeaseWithProperty[] | null>(null);
  const [approvedApps, setApprovedApps] = useState<ApplicationWithProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");

  const [showForm, setShowForm] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationMonths, setDurationMonths] = useState(12);
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "LANDLORD") { router.replace("/leases"); return; }
    load();
  }, [authLoading, user, router]);

  async function load() {
    setError(null);
    try {
      const [leaseRes, appRes] = await Promise.all([
        leaseApi.listForLandlord(),
        applicationApi.listForLandlord("APPROVED"),
      ]);
      setLeases(leaseRes.leases);
      setApprovedApps(appRes.applications); // show ALL approved apps, not just unleased ones
    } catch (err) {
      setError(errorMessage(err, "Failed to load leases."));
      setLeases([]);
    }
  }

  async function handleSign(id: string) {
    if (!confirm("Sign this lease? Your signature confirms you agree to its terms.")) return;
    setSigningId(id);
    setError(null);
    try {
      await leaseApi.sign(id);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to sign lease."));
    } finally {
      setSigningId(null);
    }
  }

  async function handleDownload(id: string) {
    setDownloadingId(id);
    setError(null);
    try {
      await leaseApi.downloadPdf(id);
    } catch (err) {
      setError(errorMessage(err, "Failed to download lease PDF."));
    } finally {
      setDownloadingId(null);
    }
  }

  const leasedApplicationIds = new Set((leases ?? []).map((l) => l.application_id).filter(Boolean));

  // Picking an application pre-fills the fields the tenant already gave us. The landlord can still edit them.
  function handleSelectApp(id: string) {
    setSelectedAppId(id);
    const app = approvedApps.find((a) => a.id === id);
    if (!app) return;
    if (app.properties?.rent_amount != null) setRentAmount(String(app.properties.rent_amount));
    if (app.desired_move_in_date) setStartDate(app.desired_move_in_date.slice(0, 10));
    if (app.lease_duration_months) setDurationMonths(app.lease_duration_months);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppId) return;
    setSubmitting(true);
    setError(null);
    try {
      await leaseApi.create({
        applicationId: selectedAppId,
        rentAmount: Number(rentAmount),
        securityDeposit: Number(securityDeposit),
        leaseStartDate: startDate,
        leaseDurationMonths: durationMonths,
        terms: terms || undefined,
      });
      setShowForm(false);
      setSelectedAppId(""); setRentAmount(""); setSecurityDeposit(""); setStartDate(""); setDurationMonths(12); setTerms("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to create lease."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: "TERMINATED" | "CANCELLED") {
    const message =
      status === "CANCELLED"
        ? "Cancel this draft lease? The tenant will no longer be able to sign it."
        : "Terminate this lease? This can't be undone, and the property will be marked available again.";
    if (!confirm(message)) return;
    setError(null);
    try {
      await leaseApi.updateStatus(id, status);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to update lease."));
    }
  }

  // Leases needing your signature first, then drafts waiting on the tenant, then active, then the rest.
  const sorted = useMemo(() => {
    const rank = (l: LeaseWithProperty) => {
      if (l.status === "DRAFT" && !l.signed_by_landlord) return 0;
      if (l.status === "DRAFT") return 1;
      if (l.status === "ACTIVE") return 2;
      return 3;
    };
    return [...(leases ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [leases]);

  const visible = sorted.filter((l) => matchesFilter(l, filter));
  const needsMySignatureCount = sorted.filter((l) => l.status === "DRAFT" && !l.signed_by_landlord).length;
  const waitingOnTenantCount = sorted.filter((l) => l.status === "DRAFT" && l.signed_by_landlord && !l.signed_by_tenant).length;

  let summary = "Create a lease from an approved application to get started.";
  if (needsMySignatureCount > 0) {
    summary = `${needsMySignatureCount} ${needsMySignatureCount === 1 ? "lease is" : "leases are"} waiting for your signature.`;
  } else if (waitingOnTenantCount > 0) {
    summary = `${waitingOnTenantCount} ${waitingOnTenantCount === 1 ? "lease is" : "leases are"} signed by you and waiting on the tenant.`;
  } else if (sorted.length > 0) {
    summary = "Nothing needs your attention right now.";
  }

  if (authLoading || !user || user.role !== "LANDLORD") {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For landlords" title="Leases">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">Leases</h1>
          <p className="mt-2 max-w-lg text-[15px] text-muted-2">{summary}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className={`rounded-xl bg-btn px-4 py-2.5 text-sm font-medium text-white hover:bg-btn-soft ${focusRing}`}
        >
          {showForm ? "Close" : "+ Create lease"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <section className="mt-6 rounded-xl border border-ink/10 glass p-6" aria-label="Create lease">
          {approvedApps.length === 0 ? (
            <p className="text-sm text-muted">
              You don&apos;t have any approved applications yet. Approve a tenant&apos;s application first from the{" "}
              <Link href="/landlord/applications" className="text-primary underline">Applications</Link> page.
            </p>
          ) : (
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-ink">New lease</h2>
                <p className="mt-1 text-sm text-muted">
                  Choosing an application fills in the rent, start date and length from the listing and the tenant&apos;s request. You can change them.
                </p>
              </div>

              <Field id="lease-app" label="Approved application">
                <select
                  id="lease-app"
                  required
                  className={inputCls}
                  value={selectedAppId}
                  onChange={(e) => handleSelectApp(e.target.value)}
                >
                  <option value="">Select an application...</option>
                  {approvedApps.map((app) => (
                    <option key={app.id} value={app.id} disabled={leasedApplicationIds.has(app.id)}>
                      {app.properties?.title ?? "Property"} — {app.users?.full_name ?? app.users?.email ?? "Tenant"}
                      {leasedApplicationIds.has(app.id) ? " (already has a lease)" : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="lease-rent" label="Monthly rent">
                  <input id="lease-rent" required type="number" min={0} className={inputCls} value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} />
                </Field>
                <Field id="lease-deposit" label="Security deposit">
                  <input id="lease-deposit" required type="number" min={0} className={inputCls} value={securityDeposit} onChange={(e) => setSecurityDeposit(e.target.value)} />
                </Field>
                <Field id="lease-start" label="Start date">
                  <input id="lease-start" required type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field id="lease-duration" label="Length in months" hint="Between 1 and 60 months.">
                  <input id="lease-duration" required type="number" min={1} max={60} className={inputCls} value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} />
                </Field>
              </div>

              <Field id="lease-terms" label="Additional terms (optional)">
                <textarea id="lease-terms" rows={4} className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} />
              </Field>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting || !selectedAppId}
                  className={`rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50 ${focusRing}`}
                >
                  {submitting ? "Creating..." : "Create lease"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium text-muted-2 hover:bg-ink/5 ${focusRing}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {leases !== null && leases.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter leases">
          {FILTERS.map((f) => {
            const count = sorted.filter((l) => matchesFilter(l, f.key)).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${focusRing} ${
                  active ? "bg-btn text-white" : "border border-ink/15 text-muted-2 hover:bg-ink/5"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 tabular-nums ${active ? "text-white/70" : "text-muted"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {leases === null ? (
        <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading leases">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-ink/8 glass p-6">
              <div className="h-5 w-48 rounded bg-ink/8" />
              <div className="mt-2 h-4 w-24 rounded bg-ink/6" />
              <div className="mt-8 h-9 w-56 rounded bg-ink/8" />
              <div className="mt-8 h-1.5 w-full rounded-full bg-ink/6" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-ink/15 glass p-10 text-center">
          <p className="text-[15px] font-medium text-ink">No leases created yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Approve a tenant&apos;s application, then create a lease from it. It will appear here for you and the tenant to sign.
          </p>
          <Link
            href="/landlord/applications"
            className={`mt-5 inline-block rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5 ${focusRing}`}
          >
            Review applications
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No leases in this view.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {visible.map((lease) => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              signing={signingId === lease.id}
              downloading={downloadingId === lease.id}
              onSign={() => handleSign(lease.id)}
              onDownload={() => handleDownload(lease.id)}
              onStatusChange={(status) => handleStatusChange(lease.id, status)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

