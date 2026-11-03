"use client";

import { useState } from "react";
import { Flag, MessageSquareWarning, RotateCcw, Star } from "lucide-react";
import { adminApi, AdminReport, ReportKind } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Select, SearchInput } from "@/components/admin/SearchInput";
import Pagination from "@/components/properties/Pagination";

const KIND: Record<ReportKind, { label: string; icon: React.ReactNode }> = {
  COMPLAINT: { label: "Complaint", icon: <MessageSquareWarning className="h-4 w-4" /> },
  REVIEW_FLAG: { label: "Flagged review", icon: <Star className="h-4 w-4" /> },
  LISTING_REPORT: { label: "Listing report", icon: <Flag className="h-4 w-4" /> },
};
const TONE = { OPEN: "danger", INVESTIGATING: "warning", RESOLVED: "success", DISMISSED: "neutral" } as const;
const MIN_NOTE = 5;
const MAX_NOTE = 1000;

type Next = "INVESTIGATING" | "RESOLVED" | "DISMISSED";

export default function AdminReportsPage() {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () => adminApi.reports({ kind, status, search, page }),
    [kind, status, search, page],
  );

  async function act(r: AdminReport, next: Next) {
    const note = (notes[r.id] ?? "").trim();
    if (next !== "INVESTIGATING" && note.length < MIN_NOTE) {
      setSuccess(null);
      setActionError(`Add a resolution note (at least ${MIN_NOTE} characters) before ${next === "RESOLVED" ? "resolving" : "dismissing"}.`);
      return;
    }
    setActionError(null); setSuccess(null); setBusyId(r.id);
    try {
      await adminApi.resolveReport(r.id, next, note || undefined);
      setNotes((n) => { const copy = { ...n }; delete copy[r.id]; return copy; });
      setSuccess(next === "INVESTIGATING" ? "Report moved to investigating." : `Report ${next.toLowerCase()}.`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyId(null);
      await reload(); // always refresh so a stale card (409) corrects itself
    }
  }

  const filtered = !!(kind || search || status !== "OPEN");

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Reports & moderation" description="Complaints, flagged reviews and listing reports in one queue."
        actions={<>
          <SearchInput placeholder="Search subject or details" onSearch={(q) => { setSearch(q); setPage(1); }} />
          <Select label="Type" value={kind} onChange={(v) => { setKind(v); setPage(1); }}
            options={[{ value: "", label: "All types" }, { value: "COMPLAINT", label: "Complaints" }, { value: "REVIEW_FLAG", label: "Flagged reviews" }, { value: "LISTING_REPORT", label: "Listing reports" }]} />
          <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            options={[{ value: "", label: "All statuses" }, { value: "OPEN", label: "Open" }, { value: "INVESTIGATING", label: "Investigating" }, { value: "RESOLVED", label: "Resolved" }, { value: "DISMISSED", label: "Dismissed" }]} />
        </>} />

      {actionError && <div role="alert" className="mb-4 rounded-2xl border border-danger/25 bg-danger/8 px-5 py-3 text-sm text-danger">{actionError}</div>}
      {success && <div role="status" className="mb-4 rounded-2xl border border-success/25 bg-success/8 px-5 py-3 text-sm text-success">{success}</div>}

      {error && !data ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="space-y-4"><div className="skeleton h-40 rounded-3xl" /><div className="skeleton h-40 rounded-3xl" /></div>
      ) : !data?.items.length ? (
        <EmptyState icon={<Flag className="h-6 w-6" />} title="Nothing to review"
          description={filtered ? "No reports match these filters." : "The queue is clear. New reports will appear here."} />
      ) : (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {error && <ErrorState message={error} onRetry={reload} />}
          <p className="text-xs text-muted">{data.total} report{data.total === 1 ? "" : "s"}</p>
          {data.items.map((r) => {
            const open = r.status === "OPEN" || r.status === "INVESTIGATING";
            const busy = busyId === r.id;
            const note = notes[r.id] ?? "";
            return (
              <article key={r.id} className="glass card-edge rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-danger/10 text-danger">{KIND[r.kind].icon}</span>
                    {KIND[r.kind].label}
                    <Pill tone={TONE[r.status]}>{r.status}</Pill>
                  </div>
                  <span className="text-xs text-muted">{relativeTime(r.created_at)}{r.reporter ? ` · by ${r.reporter.full_name ?? r.reporter.email}` : ""}</span>
                </div>
                <h2 className="mt-3 font-semibold text-ink">{r.subject}</h2>
                {r.target_label && (
                  <p className="text-xs text-muted">
                    Regarding:{" "}
                    {r.target_href
                      ? <a href={r.target_href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{r.target_label}</a>
                      : r.target_label}
                  </p>
                )}
                {/* Plain text only: user-submitted content is never injected as HTML */}
                {r.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-2">{r.details}</p>}

                {open && (
                  <div className="mt-4 space-y-3 border-t border-ink/8 pt-4">
                    <label className="field-label" htmlFor={`note-${r.id}`}>Resolution note <span className="text-muted">(required to resolve or dismiss; the reporter will see it)</span></label>
                    <textarea id={`note-${r.id}`} className="field-input" rows={3} maxLength={MAX_NOTE} value={note}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                    <p className="text-right text-xs text-muted">{note.length}/{MAX_NOTE}</p>
                    <div className="flex flex-wrap gap-2">
                      {r.status === "OPEN" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r, "INVESTIGATING")}>Start investigating</Button>}
                      <Button size="sm" loading={busy} onClick={() => act(r, "RESOLVED")}>Mark resolved</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(r, "DISMISSED")}>Dismiss</Button>
                    </div>
                  </div>
                )}

                {!open && (
                  <div className="mt-4 space-y-3 border-t border-ink/8 pt-4">
                    {r.resolution && <p className="whitespace-pre-wrap rounded-xl bg-success/8 px-3 py-2 text-sm text-success">Resolution: {r.resolution}</p>}
                    <p className="text-xs text-muted">
                      {r.status === "RESOLVED" ? "Resolved" : "Dismissed"}{r.resolved_at ? ` ${relativeTime(r.resolved_at)}` : ""}
                      {r.resolver ? ` by ${r.resolver.full_name ?? r.resolver.email}` : ""}
                    </p>
                    <Button size="sm" variant="outline" loading={busy} onClick={() => act(r, "INVESTIGATING")}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {data && data.totalPages > 1 && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}