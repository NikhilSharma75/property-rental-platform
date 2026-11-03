"use client";

import { useState } from "react";
import { EyeOff, Eye, Star } from "lucide-react";
import { adminApi, AdminReview } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useClampPage } from "@/lib/useClampPage";
import { relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/properties/Pagination";
import { Select } from "@/components/admin/SearchInput";

export default function AdminReviewsPage() {
  const [hidden, setHidden] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => adminApi.reviews({ hidden, page }), [hidden, page]);
  useClampPage(data?.totalPages, page, setPage);

  async function setVisibility(r: AdminReview, hide: boolean) {
    setActionError(null);
    setBusyId(r.id);
    try {
      await adminApi.setReviewHidden(r.id, hide, hide ? reason : undefined);
      setTarget(null);
      setReason("");
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Reviews" description="Hide reviews that are abusive, fake or off-topic. Hidden reviews disappear from public pages."
        actions={<Select label="Visibility" value={hidden} onChange={(v) => { setHidden(v); setPage(1); }}
          options={[{ value: "", label: "All reviews" }, { value: "false", label: "Visible" }, { value: "true", label: "Hidden" }]} />} />

      {actionError && <div className="mb-4"><ErrorState title="Action failed" message={actionError} /></div>}
      {error && data && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !loading && !data?.items.length ? (
        <EmptyState icon={<Star className="h-6 w-6" />} title="No reviews yet" description="Tenants can review a property once they've held a lease on it." />
      ) : (
        <div className={`space-y-4 transition-opacity ${loading && data ? "opacity-60" : ""}`} aria-busy={loading}>
          {loading && !data && (<><div className="skeleton h-28 rounded-3xl" /><div className="skeleton h-28 rounded-3xl" /></>)}
          {data?.items.map((r) => (
            <article key={r.id} className="glass card-edge rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex gap-0.5 text-gold" aria-label={`${r.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-current" : "opacity-25"}`} />)}
                  </span>
                  {r.is_hidden && <Pill tone="danger">Hidden</Pill>}
                </div>
                <span className="text-xs text-muted">{relativeTime(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{r.property_title ?? "Property"} · by {r.author?.full_name ?? r.author?.email ?? "unknown"}</p>
              {/* Plain text only - never injected as HTML */}
              {r.body && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{r.body}</p>}
              {r.hidden_reason && <p className="mt-2 text-xs text-danger">Hidden because: {r.hidden_reason}</p>}
              <div className="mt-4 border-t border-ink/8 pt-4">
                {r.is_hidden
                  ? <Button size="sm" variant="outline" loading={busyId === r.id} onClick={() => setVisibility(r, false)}><Eye className="h-3.5 w-3.5" /> Restore</Button>
                  : <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" disabled={busyId === r.id} onClick={() => { setTarget(r); setActionError(null); }}><EyeOff className="h-3.5 w-3.5" /> Hide</Button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} total={data.total} limit={data.limit} disabled={loading} />}

      <ConfirmDialog open={!!target} icon={<EyeOff className="h-5 w-5" />} title="Hide this review?"
        description="It will no longer appear on the property page. You can restore it later." confirmLabel="Hide review"
        onCancel={() => { setTarget(null); setReason(""); }}
        onConfirm={async () => { if (target) await setVisibility(target, true); }}>
        <label className="field-label" htmlFor="hr">Reason (internal)</label>
        <textarea id="hr" className="field-input" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}


