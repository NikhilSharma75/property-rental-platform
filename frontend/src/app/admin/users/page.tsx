"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Users } from "lucide-react";
import { adminApi, AdminUser } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useClampPage } from "@/lib/useClampPage";
import { formatDate, initials } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Pagination from "@/components/properties/Pagination";
import { SearchInput, Select } from "@/components/admin/SearchInput";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("role") ?? "" : "",
  );
  const [status, setStatus] = useState(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("status") ?? "" : "",
  );
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () => adminApi.users({ search, role, status, page }), [search, role, status, page],
  );
  useClampPage(data?.totalPages, page, setPage);

  async function toggle(user: AdminUser) {
    if (!user.is_suspended && reason.trim().length < 5) {
      setReasonError("Give a reason of at least 5 characters. It is saved in the audit log.");
      return;
    }
    setReasonError(null);
    setActionError(null);
    setBusyId(user.id);
    try {
      await adminApi.setSuspended(user.id, !user.is_suspended, user.is_suspended ? undefined : reason);
      setTarget(null);
      setReason("");
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Users" description="Search every account, review their role and verification, and suspend abusive accounts." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput placeholder="Search name or email" onSearch={(q) => { setSearch(q); setPage(1); }} />
        <Select label="Role" value={role} onChange={(v) => { setRole(v); setPage(1); }}
          options={[{ value: "", label: "All roles" }, { value: "TENANT", label: "Tenants" }, { value: "LANDLORD", label: "Landlords" }, { value: "ADMIN", label: "Admins" }]} />
        <Select label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "", label: "Any status" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
      </div>

      {actionError && <div className="mb-4"><ErrorState title="Action failed" message={actionError} /></div>}
      {error && data && <div className="mb-4"><ErrorState message={error} onRetry={reload} /></div>}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !loading && !data?.items.length ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No users match" description="Try a different search or clear the filters." />
      ) : (
        <div className={`glass card-edge overflow-x-auto rounded-3xl transition-opacity ${loading && data ? "opacity-60" : ""}`} aria-busy={loading}>
          <table className="tbl">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th className="text-right">Action</th></tr></thead>
            <tbody>
              {loading && !data && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="skeleton h-8 rounded-lg" /></td></tr>
              ))}
              {data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-xs font-semibold text-white">{initials(u.full_name)}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{u.full_name ?? "—"}</p>
                        <p className="truncate text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Pill tone={u.role === "ADMIN" ? "primary" : "neutral"}>{u.role}</Pill>
                      {u.role === "LANDLORD" && u.is_verified && <Pill tone="success">Verified</Pill>}
                    </div>
                  </td>
                  <td>{u.is_suspended ? <Pill tone="danger">Suspended</Pill> : <Pill tone="success">Active</Pill>}</td>
                  <td className="whitespace-nowrap text-muted-2">{formatDate(u.created_at)}</td>
                  <td className="text-right">
                    {u.role !== "ADMIN" && (
                      u.is_suspended ? (
                        <Button size="sm" variant="outline" loading={busyId === u.id} onClick={() => toggle(u)}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Restore
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" disabled={busyId === u.id}
                          onClick={() => { setTarget(u); setActionError(null); }}>
                          <Ban className="h-3.5 w-3.5" /> Suspend
                        </Button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} total={data.total} limit={data.limit} disabled={loading} />}

      <ConfirmDialog
        open={!!target} tone="danger" icon={<Ban className="h-5 w-5" />}
        title={`Suspend ${target?.full_name ?? "this user"}?`}
        description="They will be signed out and blocked from logging in until restored. Their data is kept."
        confirmLabel="Suspend account"
        onCancel={() => { setTarget(null); setReason(""); setReasonError(null); }}
        onConfirm={async () => { if (target) await toggle(target); }}
      >
        <label className="field-label" htmlFor="reason">Reason (required, shown in the audit log)</label>
        <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} className="field-input" />
        {reasonError && <p role="alert" className="mt-2 text-sm text-danger">{reasonError}</p>}
      </ConfirmDialog>
    </div>
  );
}


