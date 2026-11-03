"use client";

import { errorMessage } from "@/lib/errors";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { maintenanceApi, leaseApi, MaintenanceRequest, MaintenanceCategory, MaintenancePriority, LeaseWithProperty } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { CATEGORY_CONFIG, PRIORITY_CONFIG, STATUS_ORDER } from "@/components/maintenance/maintenanceConfig";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { MaintenanceStatusBadge } from "@/components/maintenance/StatusBadge";

function FilePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}

export default function TenantMaintenancePage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<MaintenanceRequest[] | null>(null);
  const [activeLeases, setActiveLeases] = useState<LeaseWithProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory | "">("");
  const [priority, setPriority] = useState<MaintenancePriority>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "TENANT") { router.replace("/landlord/maintenance"); return; }
    load();
  }, [authLoading, user, router]);

  async function load() {
    setError(null);
    try {
      const [{ requests }, { leases }] = await Promise.all([maintenanceApi.listMine(), leaseApi.listMine()]);
      setRequests(requests);
      setActiveLeases(leases.filter((l) => l.status === "ACTIVE"));
    } catch (err) {
      setError(errorMessage(err, "Failed to load maintenance requests."));
      setRequests([]);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 5));
  }

  function resetForm() {
    setPropertyId(""); setCategory(""); setPriority("MEDIUM"); setTitle(""); setDescription(""); setFiles([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !category) return;
    setSubmitting(true);
    setError(null);
    try {
      const { request } = await maintenanceApi.create({ propertyId, category, priority, title, description });
      if (files.length) await maintenanceApi.uploadPhotos(request.id, files);
      setPanelOpen(false);
      setJustSubmitted(true);
      resetForm();
      await load();
      setTimeout(() => setJustSubmitted(false), 3000);
    } catch (err) {
      setError(errorMessage(err, "Failed to submit request."));
    } finally {
      setSubmitting(false);
    }
  }

  const openCount = useMemo(() => (requests ?? []).filter((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED").length, [requests]);
  const emergencyCount = useMemo(() => (requests ?? []).filter((r) => r.priority === "EMERGENCY" && r.status !== "COMPLETED" && r.status !== "CANCELLED").length, [requests]);

  if (authLoading || !user || user.role !== "TENANT") {
    return <main className="flex min-h-screen items-center justify-center text-ink"><p className="text-sm text-muted">Loading...</p></main>;
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For tenants" title="Maintenance">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">Maintenance</h1>
          <p className="mt-2 max-w-lg text-[15px] text-muted-2">Report an issue and track it through to completion.</p>
        </div>
        <button
          onClick={() => setPanelOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-btn px-4 py-2.5 text-sm font-medium text-white hover:bg-btn-soft transition-colors shadow-[0_4px_14px_-4px_rgba(11,18,32,0.4)]"
        >
          <Plus className="h-4 w-4" /> New request
        </button>
      </div>

      {/* stat strip */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        <div className="rounded-2xl border border-ink/8 glass px-4 py-3">
          <p className="text-xs text-muted">Open requests</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{requests === null ? "–" : openCount}</p>
        </div>
        <div className="rounded-2xl border border-ink/8 glass px-4 py-3">
          <p className="text-xs text-muted">Total filed</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{requests === null ? "–" : requests.length}</p>
        </div>
        {emergencyCount > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600">Emergencies</p>
            <p className="mt-1 text-2xl font-semibold text-red-700">{emergencyCount}</p>
          </div>
        )}
      </div>

      {justSubmitted && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 max-w-xl">
          <CheckCircle2 className="h-4 w-4" /> Request submitted — your landlord has been notified.
        </div>
      )}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {/* request list */}
      <div className="mt-8 space-y-4">
        {requests === null ? (
          <p className="text-sm text-muted">Loading requests...</p>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 glass p-10 text-center">
            <p className="text-[15px] font-medium text-ink">No maintenance requests yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">Something need fixing? File a request and your landlord will be notified instantly.</p>
          </div>
        ) : (
          requests.map((r) => {
            const cat = CATEGORY_CONFIG[r.category];
            const Icon = cat.icon;
            const stepIndex = STATUS_ORDER.indexOf(r.status);
            return (
              <div key={r.id} className="rounded-2xl border border-ink/8 glass p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: cat.bg, color: cat.color }}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink truncate">{r.title}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={r.priority} />
                        <MaintenanceStatusBadge status={r.status} />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted line-clamp-2">{r.description}</p>
                    <p className="mt-1 text-xs text-muted-2">{r.properties?.title}{r.unit_label ? ` · Unit ${r.unit_label}` : ""} · {cat.label}</p>
                    {r.assigned_to && <p className="mt-1 text-xs text-ink">Assigned to: {r.assigned_to}</p>}
                  </div>
                </div>

                {/* progress rail */}
                {r.status !== "CANCELLED" && (
                  <div className="mt-4 flex items-center gap-1.5">
                    {STATUS_ORDER.map((s, i) => (
                      <div key={s} className="h-1 flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= stepIndex ? "#2455eb" : "#e5e7eb" }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* slide-over panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-night/40 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <form onSubmit={handleSubmit} className="relative flex h-full w-full max-w-md flex-col glass-strong shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-ink/8 px-6 py-5">
              <h2 className="text-lg font-semibold text-ink">New maintenance request</h2>
              <button type="button" onClick={() => setPanelOpen(false)}><X className="h-5 w-5 text-muted" /></button>
            </div>

            <div className="flex-1 space-y-6 px-6 py-6">
              <div>
                <label className="text-sm font-medium text-ink">Property</label>
                <select required className="mt-1.5 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="">Select a property...</option>
                  {activeLeases.map((l) => <option key={l.id} value={l.property_id}>{l.properties?.title ?? "Property"}{l.units?.unit_label ? ` · Unit ${l.units.unit_label}` : ""}</option>)}
                </select>
                {activeLeases.length === 0 && <p className="mt-1.5 text-xs text-red-600">You need an active lease to file a request.</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Category</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(CATEGORY_CONFIG) as MaintenanceCategory[]).map((key) => {
                    const cfg = CATEGORY_CONFIG[key];
                    const Icon = cfg.icon;
                    const active = category === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setCategory(key)}
                        className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-all"
                        style={{
                          borderColor: active ? cfg.color : "rgba(11,18,32,0.1)",
                          backgroundColor: active ? cfg.bg : "white",
                          color: active ? cfg.color : "#475569",
                          transform: active ? "scale(1.03)" : undefined,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Priority</label>
                <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl bg-ink/5 p-1">
                  {(Object.keys(PRIORITY_CONFIG) as MaintenancePriority[]).map((key) => {
                    const cfg = PRIORITY_CONFIG[key];
                    const active = priority === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setPriority(key)}
                        className="rounded-xl px-2 py-1.5 text-xs font-semibold transition-all"
                        style={active ? { backgroundColor: cfg.color, color: "white" } : { color: cfg.color }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Title</label>
                <input required maxLength={150} className="mt-1.5 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="e.g. Kitchen sink leaking" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Description</label>
                <textarea required rows={4} minLength={10} className="mt-1.5 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Describe what's happening, when it started, anything the landlord should know..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium text-ink">Photos (optional, up to 5)</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                  className="mt-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors"
                  style={{ borderColor: dragOver ? "#2455eb" : "rgba(11,18,32,0.15)", backgroundColor: dragOver ? "#eaf0ff" : "transparent" }}
                >
                  <Upload className="mx-auto h-6 w-6 text-muted" />
                  <p className="mt-2 text-sm text-muted">Drag photos here, or</p>
                  <label className="mt-1 inline-block cursor-pointer text-sm font-medium text-primary underline">
                    browse files
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative h-16 w-16 overflow-hidden rounded-xl border border-ink/10">
                        <FilePreview file={f} />
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5">
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-ink/8 px-6 py-4">
              <button
                type="submit"
                disabled={submitting || !propertyId || !category || activeLeases.length === 0}
                className="w-full rounded-xl bg-btn px-4 py-2.5 text-sm font-medium text-white hover:bg-btn-soft disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}