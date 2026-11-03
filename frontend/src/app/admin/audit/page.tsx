"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useClampPage } from "@/lib/useClampPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import Pagination from "@/components/properties/Pagination";
import { Select } from "@/components/admin/SearchInput";

const ACTIONS = [
  "USER_SUSPENDED", "USER_RESTORED", "PROPERTY_STATUS_CHANGED", "VERIFICATION_APPROVED", "VERIFICATION_REJECTED",
  "REPORT_INVESTIGATING", "REPORT_RESOLVED", "REPORT_DISMISSED", "REPORT_REOPENED", "REVIEW_HIDDEN", "REVIEW_RESTORED",
];
const TARGETS = ["USER", "PROPERTY", "REPORT", "REVIEW"];
const dateInput = "glass rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary";

function detail(meta: Record<string, unknown>) {
  const m = meta as { label?: string; reason?: string; note?: string; from?: string; to?: string; status?: string };
  return [m.label, m.from && m.to ? `${m.from} → ${m.to}` : m.status, m.reason ?? m.note].filter(Boolean).join(" · ") || "—";
}

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const { data, error, loading, reload } = useAsync(
    () => adminApi.audit({ page, action, targetType, since, until }), [page, action, targetType, since, until],
  );
  useClampPage(data?.totalPages, page, setPage);

  const filtered = !!(action || targetType || since || until);
  const reset = () => { setAction(""); setTargetType(""); setSince(""); setUntil(""); setPage(1); };

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Audit log" description="Every suspension, verification decision and moderation action, with who did it." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select label="Action" value={action} onChange={(v) => { setAction(v); setPage(1); }}
          options={[{ value: "", label: "All actions" }, ...ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, " ").toLowerCase() }))]} />
        <Select label="Target" value={targetType} onChange={(v) => { setTargetType(v); setPage(1); }}
          options={[{ value: "", label: "All targets" }, ...TARGETS.map((t) => ({ value: t, label: t.toLowerCase() }))]} />
        <input type="date" aria-label="From date" className={dateInput} value={since} max={until || undefined}
          onChange={(e) => { setSince(e.target.value); setPage(1); }} />
        <input type="date" aria-label="To date" className={dateInput} value={until} min={since || undefined}
          onChange={(e) => { setUntil(e.target.value); setPage(1); }} />
        {filtered && <Button size="sm" variant="ghost" onClick={reset}>Clear filters</Button>}
      </div>

      {error && data && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !loading && !data?.items.length ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title={filtered ? "No entries match these filters" : "No activity recorded yet"} />
      ) : (
        <div className={`glass card-edge overflow-x-auto rounded-3xl transition-opacity ${loading && data ? "opacity-60" : ""}`} aria-busy={loading}>
          <table className="tbl">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {loading && !data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={5}><div className="skeleton h-8 rounded-lg" /></td></tr>)}
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-muted-2">{new Date(a.created_at).toLocaleString()}</td>
                  <td>{a.actor?.full_name ?? a.actor?.email ?? "—"}</td>
                  <td><Pill tone={/SUSPEND|REJECT|HIDDEN|DISMISS/.test(a.action) ? "danger" : "primary"}>{a.action.replace(/_/g, " ")}</Pill></td>
                  <td className="text-muted-2">{a.target_type ?? "—"}{a.target_id ? ` · ${a.target_id.slice(0, 8)}` : ""}</td>
                  <td className="max-w-xs truncate text-muted" title={detail(a.meta)}>{detail(a.meta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} total={data.total} limit={data.limit} disabled={loading} />}
    </div>
  );
}



