"use client";

import { useState } from "react";
import { BadgeCheck, FileSearch, ShieldCheck, XCircle } from "lucide-react";
import { adminApi, AdminVerification } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useClampPage } from "@/lib/useClampPage";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/properties/Pagination";
import { Select } from "@/components/admin/SearchInput";

export default function AdminVerificationsPage() {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<AdminVerification | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => adminApi.verifications({ status, page }), [status, page]);
  useClampPage(data?.totalPages, page, setPage);



  /** Opens one document. The link is created on click (and audited), so nothing sensitive is generated on page load. */
  async function openDocument(v: AdminVerification, kind: "government-id" | "proof-of-ownership") {
    setActionError(null);
    // Open the tab synchronously so popup blockers allow it, then point it at the signed link.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const { url } = await adminApi.verificationDocument(v.id, kind);

      if (tab) tab.location.replace(url); else window.location.assign(url);

    } catch (e) {
      tab?.close();
      setActionError(e instanceof Error ? e.message : "Could not open the document.");
    }
  }


  
  async function review(v: AdminVerification, next: "VERIFIED" | "REJECTED") {
    setActionError(null);
    setBusyId(v.id);
    try {
      await adminApi.reviewVerification(v.id, next, next === "REJECTED" ? reason : undefined);
      setRejecting(null);
      setReason("");
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Landlord verification" description="Check ID and proof of ownership before a landlord earns the verified badge."
        actions={<Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "PENDING", label: "Pending" }, { value: "VERIFIED", label: "Verified" }, { value: "REJECTED", label: "Rejected" }]} />} />

      {actionError && <div className="mb-4"><ErrorState title="Action failed" message={actionError} /></div>}
      {error && data && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !loading && !data?.items.length ? (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Queue is clear" description="No verification requests with this status." />
      ) : (
        <div className={`grid gap-4 transition-opacity lg:grid-cols-2 ${loading && data ? "opacity-60" : ""}`} aria-busy={loading}>
          {loading && !data && (<><div className="skeleton h-48 rounded-3xl" /><div className="skeleton h-48 rounded-3xl" /></>)}
          {data?.items.map((v) => (
            <article key={v.id} className="glass card-edge rounded-3xl p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-ink">{v.user.full_name ?? v.user.email}</h2>
                  <p className="text-xs text-muted">{v.user.email}</p>
                </div>
                <Pill tone={v.status === "VERIFIED" ? "success" : v.status === "REJECTED" ? "danger" : "warning"}>{v.status}</Pill>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted">ID type</dt><dd className="text-ink">{v.government_id_type?.replace("_", " ") ?? "—"}</dd></div>
                <div><dt className="text-xs text-muted">Submitted</dt><dd className="text-ink">{formatDate(v.submitted_at)}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted">Business</dt><dd className="text-ink">{v.business_name ?? "Individual owner"}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {/* Links are created on demand and every open is audit-logged */}
                {v.has_government_id_document && <button type="button" onClick={() => openDocument(v, "government-id")} className="inline-flex items-center gap-1.5 rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"><FileSearch className="h-3.5 w-3.5" /> Government ID</button>}
                {v.has_proof_of_ownership_document && <button type="button" onClick={() => openDocument(v, "proof-of-ownership")} className="inline-flex items-center gap-1.5 rounded-lg border border-ink/12 px-3 py-1.5 text-xs font-medium text-ink hover:border-primary hover:text-primary"><FileSearch className="h-3.5 w-3.5" /> Proof of ownership</button>}
              </div>
              {v.status === "PENDING" && (
                <div className="mt-5 flex gap-2 border-t border-ink/8 pt-4">
                  <Button size="sm" loading={busyId === v.id} onClick={() => review(v, "VERIFIED")}><BadgeCheck className="h-3.5 w-3.5" /> Approve</Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" disabled={busyId === v.id} onClick={() => setRejecting(v)}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} total={data.total} limit={data.limit} disabled={loading} />}

      <ConfirmDialog open={!!rejecting} tone="danger" icon={<XCircle className="h-5 w-5" />}
        title="Reject this verification?" description="The landlord is notified and can resubmit. Give a clear reason."
        confirmLabel="Reject" onCancel={() => { setRejecting(null); setReason(""); }}
        onConfirm={async () => { if (rejecting) await review(rejecting, "REJECTED"); }}>
        <label className="field-label" htmlFor="rej">Reason</label>
        <textarea id="rej" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className="field-input" />
      </ConfirmDialog>
    </div>
  );
}