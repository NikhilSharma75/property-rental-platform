"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, FileText, ArrowLeft, XCircle } from "lucide-react";
import { applicationApi, DocumentRecord, RentalApplication } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReviewApplicationPanel } from "@/components/applications/ReviewApplicationPanel";
import { formatMoney } from "@/lib/format";

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [app, setApp] = useState<RentalApplication | null>(null);
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const appId = params?.id;
  const load = useCallback(async () => {
    if (!appId) return;
    try {
      setLoading(true);
      const { application, documents } = await applicationApi.get(appId);
      setApp(application);
      setDocs(documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load application.");
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push(`/login?redirect=/applications/${params?.id}`); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches data on mount; the loader sets its loading state before awaiting
    load();
  }, [user, authLoading, load, router, params?.id]);

  async function handleWithdraw() {
    if (!app) return;
    if (!confirm("Withdraw this application? This cannot be undone.")) return;
    setWithdrawing(true);
    try {
      const { application } = await applicationApi.withdraw(app.id);
      setApp(application);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to withdraw.");
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-16 text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </main>
    );
  }

  if (error || !app) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? "Application not found."}
        </div>
      </main>
    );
  }

  const isTenant = user?.id === app.tenant_id;
  const canWithdraw = isTenant && app.status === "PENDING";
  const canReview = !isTenant && app.status === "PENDING";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Application</h1>
          <p className="mt-1 text-sm text-slate-500">#{app.id.slice(0, 8)}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <section className="rounded-2xl border border-slate-200 glass p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Details</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Row label="Move-in date" value={new Date(app.desired_move_in_date).toLocaleDateString()} />
          <Row label="Lease duration" value={`${app.lease_duration_months} months`} />
          {app.monthly_income != null && <Row label="Monthly income" value={formatMoney(app.monthly_income)} />}
          {app.employment_status && <Row label="Employment" value={app.employment_status} />}
          {app.employer_name && <Row label="Employer" value={app.employer_name} />}
          <Row label="Submitted" value={new Date(app.created_at).toLocaleString()} />
          {app.reviewed_at && <Row label="Reviewed" value={new Date(app.reviewed_at).toLocaleString()} />}
        </dl>
        {app.additional_notes && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{app.additional_notes}</p>
          </div>
        )}
        {app.status === "REJECTED" && app.rejection_reason && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <strong>Rejection reason:</strong> {app.rejection_reason}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 glass p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Documents ({docs.length})
        </h2>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-ink hover:border-primary/50 hover:text-primary"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  {d.file_name}
                  <span className="ml-auto text-xs text-slate-400">
                    {(d.file_size_bytes / 1024).toFixed(0)} KB
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canReview && (
        <ReviewApplicationPanel application={app} onReviewed={(updated) => setApp(updated)} />
      )}

      {canWithdraw && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Withdraw application
          </button>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

