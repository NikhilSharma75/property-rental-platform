"use client";

import { errorMessage } from "@/lib/errors";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { leaseApi, LeaseWithProperty } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { LeaseStatusBadge } from "@/components/leases/LeaseStatusBadge";
import { formatMoney } from "@/lib/format";
import { ReportDialog } from "@/components/reports/ReportDialog";

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
  onReport,
}: {
  lease: LeaseWithProperty;
  signing: boolean;
  downloading: boolean;
  onSign: () => void;
  onDownload: () => void;
  onReport: () => void;
}) {
  // Same rule the API enforces: reviews need a lease that has actually started (ACTIVE, EXPIRED or TERMINATED).
  const canReview = lease.status === "ACTIVE" || lease.status === "EXPIRED" || lease.status === "TERMINATED";
  const needsSignature = lease.status === "DRAFT" && !lease.signed_by_tenant;
  const showTimeline = lease.status === "DRAFT" || lease.status === "ACTIVE" || lease.status === "EXPIRED";

  return (
    <article
      className={`rounded-xl border glass p-6 ${
        needsSignature ? "border-ink/8 border-l-4 border-l-gold" : "border-ink/8"
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

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div>
          <p className="text-4xl font-semibold tabular-nums tracking-tight text-ink">
            {money(lease.rent_amount)}
            <span className="ml-1.5 text-base font-normal text-muted">a month</span>
          </p>
        </div>
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
            <SignatureStep signed={lease.signed_by_tenant} signedText="You've signed" pendingText="You haven't signed yet" />
            <SignatureStep signed={lease.signed_by_landlord} signedText="Landlord has signed" pendingText="Waiting on your landlord" />
          </div>
        </div>
      )}

      <footer className="mt-6 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-5">
        {needsSignature && (
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
            href="/maintenance"
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft ${focusRing}`}
          >
            <WrenchIcon />
            Request maintenance
          </Link>
        )}

        {canReview && (
          <Link
            href={`/properties/${lease.property_id}#reviews`}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary-soft ${focusRing}`}
          >
            Review property
          </Link>
        )}

        <button
          type="button"
          onClick={onReport}
          className={`ml-auto rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink ${focusRing}`}
        >
          Report a problem
        </button>
      </footer>
    </article>
  );
}

/* ---------- page ---------- */

export default function MyLeasesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [leases, setLeases] = useState<LeaseWithProperty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reporting, setReporting] = useState<LeaseWithProperty | null>(null);

  async function load() {
    setError(null);
    try {
      const { leases } = await leaseApi.listMine();
      setLeases(leases);
    } catch (err) {
      setError(errorMessage(err, "Failed to load leases."));
      setLeases([]);
    }
  }

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "TENANT") { router.replace("/landlord/leases"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches data on mount; the loader sets its loading state before awaiting
    load();
  }, [authLoading, user, router]);

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

  // Leases that need the tenant's signature come first, then active ones, then everything else.
  const sorted = useMemo(() => {
    const rank = (l: LeaseWithProperty) =>
      l.status === "DRAFT" && !l.signed_by_tenant ? 0 : l.status === "ACTIVE" ? 1 : l.status === "DRAFT" ? 2 : 3;
    return [...(leases ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [leases]);

  const needsSignatureCount = sorted.filter((l) => l.status === "DRAFT" && !l.signed_by_tenant).length;

  let summary = "Leases your landlord creates for you will appear here.";
  if (needsSignatureCount > 0) {
    summary = `${needsSignatureCount} ${needsSignatureCount === 1 ? "lease is" : "leases are"} waiting for your signature.`;
  } else if (sorted.length > 0) {
    summary = "Nothing needs your signature. You can download a copy of any lease below.";
  }

  if (authLoading || !user || user.role !== "TENANT") {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For tenants" title="My Leases">
      <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">
        Your leases
      </h1>
      <p className="mt-2 max-w-lg text-[15px] text-muted-2">{summary}</p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
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
          <p className="text-[15px] font-medium text-ink">No leases yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Once a landlord approves your application and creates a lease, it will show up here.
          </p>
          <Link
            href="/applications"
            className={`mt-5 inline-block rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink hover:bg-ink/5 ${focusRing}`}
          >
            View my applications
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {sorted.map((lease) => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              signing={signingId === lease.id}
              downloading={downloadingId === lease.id}
              onSign={() => handleSign(lease.id)}
              onDownload={() => handleDownload(lease.id)}
              onReport={() => setReporting(lease)}
            />
          ))}
        </div>
      )}

      {reporting && (
        <ReportDialog
          open
          kind="COMPLAINT"
          targetType="LEASE"
          targetId={reporting.id}
          title="Report a problem with this lease"
          description="Tell us what went wrong. An admin will review it and you'll be notified when it's resolved."
          defaultSubject={reporting.properties?.title ? `Problem with ${reporting.properties.title}` : ""}
          onClose={() => setReporting(null)}
        />
      )}
    </AppShell>
  );
}