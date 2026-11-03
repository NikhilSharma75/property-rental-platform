"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, DoorOpen, Plus, Trash2 } from "lucide-react";
import { unitApi, Unit } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { useRequireRole } from "@/lib/useRequireRole";
import { formatMoney } from "@/lib/format";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatCard } from "@/components/ui/StatCard";

const TONE = { AVAILABLE: "success", RESERVED: "warning", OCCUPIED: "primary", UNAVAILABLE: "neutral" } as const;
const LABEL = { AVAILABLE: "Available", RESERVED: "Reserved", OCCUPIED: "Occupied", UNAVAILABLE: "Unavailable" } as const;

const blank = { unitLabel: "", floor: "", bedrooms: "1", bathrooms: "1", areaSqft: "", rentAmount: "", depositAmount: "" };

/** RESERVED and OCCUPIED are controlled by applications and leases, so the landlord can't change or delete them here. */
const isLocked = (u: Unit) => u.status === "RESERVED" || u.status === "OCCUPIED";

export default function UnitsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, logout, ready } = useRequireRole(["LANDLORD"]);
  const { data, error, loading, reload } = useAsync(() => unitApi.list(id), [id]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Unit | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const units = data?.units ?? [];
  const occupied = units.filter((u) => u.status === "OCCUPIED").length;
  const reserved = units.filter((u) => u.status === "RESERVED").length;
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v: string) => (v === "" ? null : Number(v));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await unitApi.create(id, {
        unitLabel: form.unitLabel.trim(),
        floor: num(form.floor),
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        areaSqft: num(form.areaSqft),
        rentAmount: Number(form.rentAmount),
        depositAmount: num(form.depositAmount),
      });
      setForm(blank);
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add unit.");
    } finally {
      setSaving(false);
    }
  }

  /** Toggle between AVAILABLE (open for applications) and UNAVAILABLE (e.g. under maintenance). */
  async function toggleAvailability(u: Unit) {
    setTogglingId(u.id);
    setActionError(null);
    try {
      await unitApi.update(id, u.id, { status: u.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE" });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the unit.");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    try {
      await unitApi.remove(id, deleting.id);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the unit.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For landlords" title="Units">
      <Link href="/dashboard/properties" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All properties
      </Link>
      <PageHeader
        eyebrow="Property"
        title="Units"
        description="Track every rentable door in this building: rent, status and who holds it."
        actions={<Button onClick={() => setOpen((o) => !o)}><Plus className="h-4 w-4" /> Add unit</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total units" value={units.length} loading={loading} />
        <StatCard label="Occupied" value={occupied} loading={loading} tone="success" />
        <StatCard label="Reserved" value={reserved} loading={loading} tone="gold" />
        <StatCard
          label="Occupancy"
          value={units.length ? `${Math.round((occupied / units.length) * 100)}%` : "—"}
          loading={loading}
          tone="gold"
        />
      </div>

      {open && (
        <form onSubmit={submit} className="glass card-edge mb-6 grid gap-4 rounded-3xl p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="field-label" htmlFor="u-label">Unit label *</label>
            <input id="u-label" required maxLength={40} className="field-input" placeholder="A-204" value={form.unitLabel} onChange={set("unitLabel")} />
          </div>
          <div>
            <label className="field-label" htmlFor="u-floor">Floor</label>
            <input id="u-floor" type="number" className="field-input" value={form.floor} onChange={set("floor")} />
          </div>
          <div>
            <label className="field-label" htmlFor="u-bd">Bedrooms *</label>
            <input id="u-bd" type="number" min={0} max={20} required className="field-input" value={form.bedrooms} onChange={set("bedrooms")} />
          </div>
          <div>
            <label className="field-label" htmlFor="u-ba">Bathrooms *</label>
            <input id="u-ba" type="number" min={0} max={20} step={0.5} required className="field-input" value={form.bathrooms} onChange={set("bathrooms")} />
          </div>
          <div>
            <label className="field-label" htmlFor="u-area">Area (sq ft)</label>
            <input id="u-area" type="number" min={0} className="field-input" value={form.areaSqft} onChange={set("areaSqft")} />
          </div>
          <div>
            <label className="field-label" htmlFor="u-rent">Monthly rent *</label>
            <input id="u-rent" type="number" min={0} required className="field-input" value={form.rentAmount} onChange={set("rentAmount")} />
          </div>
          <div>
            <label className="field-label" htmlFor="u-dep">Deposit</label>
            <input id="u-dep" type="number" min={0} className="field-input" value={form.depositAmount} onChange={set("depositAmount")} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" loading={saving}>Save unit</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          {formError && (
            <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-4">{formError}</p>
          )}
        </form>
      )}

      {actionError && (
        <p role="alert" className="mb-4 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      )}

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !loading && units.length === 0 ? (
        <EmptyState
          icon={<DoorOpen className="h-6 w-6" />}
          title="No units yet"
          description="Add the first unit to start tracking occupancy and rent per door."
        />
      ) : (
        <div className="glass card-edge overflow-x-auto rounded-3xl">
          <table className="tbl">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Layout</th>
                <th>Rent</th>
                <th>Status</th>
                <th>Tenant</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6}><div className="skeleton h-8 rounded-lg" /></td>
                </tr>
              )}
              {units.map((u) => {
                const locked = isLocked(u);
                const lockedHint = "Release the reservation or end the lease first";
                return (
                  <tr key={u.id}>
                    <td className="font-medium text-ink">
                      {u.unit_label}
                      {u.floor != null && <span className="ml-1.5 text-xs text-muted">Floor {u.floor}</span>}
                    </td>
                    <td className="text-muted-2">
                      {u.bedrooms} bd · {u.bathrooms} ba{u.area_sqft ? ` · ${u.area_sqft} sqft` : ""}
                    </td>
                    <td className="tabular-nums">{formatMoney(u.rent_amount)}</td>
                    <td><Pill tone={TONE[u.status]}>{LABEL[u.status]}</Pill></td>
                    <td className="text-muted-2">{u.tenant?.full_name ?? u.tenant?.email ?? "—"}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={locked || togglingId === u.id}
                          title={locked ? lockedHint : undefined}
                          onClick={() => toggleAvailability(u)}
                        >
                          {u.status === "UNAVAILABLE" ? "Mark available" : "Mark unavailable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger/10"
                          disabled={locked}
                          title={locked ? lockedHint : undefined}
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        icon={<Trash2 className="h-5 w-5" />}
        title={`Delete unit ${deleting?.unit_label}?`}
        description="This can't be undone. Units with lease or application history can't be deleted."
        confirmLabel="Delete unit"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}