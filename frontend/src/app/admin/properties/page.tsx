"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink } from "lucide-react";
import { adminApi, AdminProperty } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useClampPage } from "@/lib/useClampPage";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import Pagination from "@/components/properties/Pagination";
import { SearchInput, Select } from "@/components/admin/SearchInput";

const TONE = {
  DRAFT: "neutral",
  AVAILABLE: "success",
  RESERVED: "warning",
  RENTED: "primary",
  ARCHIVED: "warning",
} as const;

/** Statuses an admin can set by hand. RESERVED is controlled by approved applications, so it is never offered here. */
const MANUAL_STATUSES = ["DRAFT", "AVAILABLE", "RENTED", "ARCHIVED"] as const;

export default function AdminPropertiesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => adminApi.properties({ search, status, page }), [search, status, page]);
  useClampPage(data?.totalPages, page, setPage);

  async function change(p: AdminProperty, next: AdminProperty["status"]) {
    setBusyId(p.id);
    setActionError(null);
    try {
      await adminApi.setPropertyStatus(p.id, next);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed.");
      await reload(); // snap the dropdown back to the real status
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Properties" description="Every listing on the platform. Archive anything that breaks the rules." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search title or city" onSearch={(q) => { setSearch(q); setPage(1); }} />
        <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[
            { value: "", label: "All statuses" },
            { value: "AVAILABLE", label: "Available" },
            { value: "RESERVED", label: "Reserved" },
            { value: "RENTED", label: "Rented" },
            { value: "DRAFT", label: "Draft" },
            { value: "ARCHIVED", label: "Archived" },
          ]} />
      </div>

      {actionError && <div className="mb-4"><ErrorState title="Action failed" message={actionError} /></div>}
      {error && data && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !loading && !data?.items.length ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No properties found" />
      ) : (
        <div className={`glass card-edge overflow-x-auto rounded-3xl transition-opacity ${loading && data ? "opacity-60" : ""}`} aria-busy={loading}>
          <table className="tbl">
            <thead><tr><th>Listing</th><th>Landlord</th><th>Rent</th><th>Status</th><th>Created</th><th className="text-right">Moderate</th></tr></thead>
            <tbody>
              {loading && !data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6}><div className="skeleton h-8 rounded-lg" /></td></tr>)}
              {data?.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/properties/${p.id}`} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-primary">
                      {p.title} <ExternalLink className="h-3 w-3 opacity-50" aria-hidden />
                    </Link>
                    <p className="text-xs text-muted">{p.city}</p>
                  </td>
                  <td className="text-muted-2">{p.landlord?.full_name ?? p.landlord?.email ?? "—"}</td>
                  <td className="tabular-nums">{formatMoney(p.rent_amount)}</td>
                  <td><Pill tone={TONE[p.status]}>{p.status}</Pill></td>
                  <td className="whitespace-nowrap text-muted-2">{formatDate(p.created_at)}</td>
                  <td className="text-right">
                    <select
                      aria-label={`Change status of ${p.title}`} disabled={busyId === p.id} value={p.status}
                      onChange={(e) => change(p, e.target.value as AdminProperty["status"])}
                      className="rounded-lg border border-ink/12 bg-surface px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50"
                    >
                      {/* Show the real status for a reserved property, but never let the admin pick it. */}
                      {p.status === "RESERVED" && <option value="RESERVED" disabled>RESERVED</option>}
                      {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
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