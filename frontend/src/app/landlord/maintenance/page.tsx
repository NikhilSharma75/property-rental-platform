"use client";

import { errorMessage } from "@/lib/errors";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { maintenanceApi, MaintenanceRequest, MaintenanceStatus } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { CATEGORY_CONFIG, STATUS_CONFIG } from "@/components/maintenance/maintenanceConfig";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";

const COLUMNS: { status: MaintenanceStatus; next?: Exclude<MaintenanceStatus, "SUBMITTED"> }[] = [
  { status: "SUBMITTED", next: "ACKNOWLEDGED" },
  { status: "ACKNOWLEDGED", next: "IN_PROGRESS" },
  { status: "IN_PROGRESS", next: "COMPLETED" },
  { status: "COMPLETED" },
];

export default function LandlordMaintenancePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<MaintenanceRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignValue, setAssignValue] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "LANDLORD") { router.replace("/maintenance"); return; }
    load();
  }, [authLoading, user, router]);

  async function load() {
    setError(null);
    try {
      const { requests } = await maintenanceApi.listForLandlord();
      setRequests(requests);
    } catch (err) {
      setError(errorMessage(err, "Failed to load requests."));
      setRequests([]);
    }
  }

  async function advance(id: string, next: Exclude<MaintenanceStatus, "SUBMITTED">) {
    try {
      await maintenanceApi.updateStatus(id, next);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to update request."));
    }
  }

  async function handleAssign(id: string) {
    if (!assignValue.trim()) return;
    try {
      await maintenanceApi.assign(id, assignValue.trim());
      setAssigningId(null); setAssignValue("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Failed to assign."));
    }
  }

  const grouped = useMemo(() => {
    const g: Record<MaintenanceStatus, MaintenanceRequest[]> = { SUBMITTED: [], ACKNOWLEDGED: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [] };
    (requests ?? []).forEach((r) => g[r.status]?.push(r));
    // emergencies float to the top of their column
    Object.keys(g).forEach((k) => g[k as MaintenanceStatus].sort((a, b) => (a.priority === "EMERGENCY" ? -1 : 0) - (b.priority === "EMERGENCY" ? -1 : 0)));
    return g;
  }, [requests]);

  const emergencyCount = (requests ?? []).filter((r) => r.priority === "EMERGENCY" && r.status !== "COMPLETED" && r.status !== "CANCELLED").length;

  if (authLoading || !user || user.role !== "LANDLORD") {
    return <main className="flex min-h-screen items-center justify-center text-ink"><p className="text-sm text-muted">Loading...</p></main>;
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For landlords" title="Maintenance">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">Maintenance board</h1>
          <p className="mt-2 max-w-lg text-[15px] text-muted-2">Track every request from submission to completion.</p>
        </div>
        {emergencyCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" /> {emergencyCount} emergency {emergencyCount === 1 ? "request" : "requests"} need attention
          </div>
        )}
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {requests === null ? (
        <p className="mt-10 text-sm text-muted">Loading board...</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const cfg = STATUS_CONFIG[col.status];
            const items = grouped[col.status];
            return (
              <div key={col.status} className="rounded-2xl bg-ink/[0.03] p-3 min-h-[200px]">
                <div className="flex items-center justify-between px-1 pb-3">
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: cfg.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </span>
                  <span className="rounded-full bg-surface/80 px-2 py-0.5 text-xs text-muted">{items.length}</span>
                </div>

                <div className="space-y-2.5">
                  {items.map((r) => {
                    const cat = CATEGORY_CONFIG[r.category];
                    const Icon = cat.icon;
                    return (
                      <div
                        key={r.id}
                        className="rounded-xl border glass p-3.5 shadow-sm"
                        style={r.priority === "EMERGENCY" ? { borderColor: "#dc2626", boxShadow: "0 0 0 1px rgba(220,38,38,0.15)" } : { borderColor: "rgba(11,18,32,0.08)" }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: cat.bg, color: cat.color }}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                            <p className="text-xs text-muted truncate">{r.properties?.title}{r.unit_label ? ` · Unit ${r.unit_label}` : ""}</p>
                          </div>
                        </div>

                        <p className="mt-2 text-xs text-muted-2 line-clamp-2">{r.description}</p>
                        {r.users && <p className="mt-2 text-xs text-ink">{r.users.full_name ?? r.users.email}</p>}

                        <div className="mt-2.5 flex items-center justify-between">
                          <PriorityBadge priority={r.priority} />
                        </div>

                        {r.assigned_to && (
                          <p className="mt-2 rounded-lg bg-ink/5 px-2 py-1 text-xs text-ink">🔧 {r.assigned_to}</p>
                        )}

                        {assigningId === r.id ? (
                          <div className="mt-2 flex gap-1.5">
                            <input
                              autoFocus
                              placeholder="Contractor / handyman"
                              className="min-w-0 flex-1 rounded-xl border border-ink/12 px-2 py-1.5 text-xs outline-none focus:border-primary"
                              value={assignValue}
                              onChange={(e) => setAssignValue(e.target.value)}
                            />
                            <button onClick={() => handleAssign(r.id)} className="rounded-xl bg-btn px-2 py-1.5 text-xs text-white">Save</button>
                          </div>
                        ) : (
                          !r.assigned_to && col.status !== "COMPLETED" && (
                            <button onClick={() => { setAssigningId(r.id); setAssignValue(""); }} className="mt-2 text-xs text-primary hover:underline">
                              + Assign
                            </button>
                          )
                        )}

                        <div className="mt-3 flex gap-1.5">
                          {col.next && (
                            <button
                              onClick={() => advance(r.id, col.next!)}
                              className="flex-1 rounded-xl bg-btn px-2 py-1.5 text-xs font-medium text-white hover:bg-btn-soft"
                            >
                              Move to {STATUS_CONFIG[col.next].label} →
                            </button>
                          )}
                          {col.status !== "COMPLETED" && (
                            <button
                              onClick={() => advance(r.id, "CANCELLED")}
                              className="rounded-xl border border-red-200 px-2 py-1.5 text-xs text-red-700 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-1 py-6 text-center text-xs text-muted/60">Nothing here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}