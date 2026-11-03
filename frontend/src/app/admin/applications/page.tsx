"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useClampPage } from "@/lib/useClampPage";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import Pagination from "@/components/properties/Pagination";
import { SearchInput, Select } from "@/components/admin/SearchInput";

const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "danger", WITHDRAWN: "neutral", EXPIRED: "neutral" } as const;

export default function AdminApplicationsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => adminApi.applications({ status, search, page }), [status, search, page]);
  useClampPage(data?.totalPages, page, setPage);

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Applications" description="Read-only oversight of every rental application. Decisions stay with the landlord." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search property or tenant" onSearch={(q) => { setSearch(q); setPage(1); }} />
        <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "", label: "All statuses" }, { value: "PENDING", label: "Pending" }, { value: "APPROVED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }, { value: "WITHDRAWN", label: "Withdrawn" }, { value: "EXPIRED", label: "Expired" }]} />
      </div>

      {error && data && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !loading && !data?.items.length ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="No applications found"
          description={search || status ? "No applications match these filters." : undefined} />
      ) : (
        <div className={`glass card-edge overflow-x-auto rounded-3xl transition-opacity ${loading && data ? "opacity-60" : ""}`} aria-busy={loading}>
          <table className="tbl">
            <thead><tr><th>Property</th><th>Tenant</th><th>Landlord</th><th>Income</th><th>Move-in</th><th>Status</th><th>Applied</th></tr></thead>
            <tbody>
              {loading && !data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={7}><div className="skeleton h-8 rounded-lg" /></td></tr>)}
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td><p className="font-medium text-ink">{a.property_title ?? "—"}</p><p className="text-xs text-muted">{a.property_city}</p></td>
                  <td className="text-muted-2">{a.tenant?.full_name ?? a.tenant?.email ?? "—"}</td>
                  <td className="text-muted-2">{a.landlord?.full_name ?? a.landlord?.email ?? "—"}</td>
                  <td className="tabular-nums">{a.monthly_income ? formatMoney(a.monthly_income) : "—"}</td>
                  <td className="whitespace-nowrap text-muted-2">{formatDate(a.desired_move_in_date)}</td>
                  <td><Pill tone={TONE[a.status]}>{a.status}</Pill></td>
                  <td className="whitespace-nowrap text-muted-2">{formatDate(a.created_at)}</td>
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