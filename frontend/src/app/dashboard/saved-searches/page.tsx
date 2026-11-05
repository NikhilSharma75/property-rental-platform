"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import { savedSearchApi, SavedSearch, SavedSearchFilters } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useRequireRole } from "@/lib/useRequireRole";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatMoney } from "@/lib/format";

function filtersToQuery(filters: SavedSearchFilters): string {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  return qs.toString();
}

function summarize(filters: SavedSearchFilters): string {
  const parts: string[] = [];
  if (filters.minBedrooms) parts.push(`${filters.minBedrooms}+ bed`);
  if (filters.city) parts.push(filters.city);
  if (filters.propertyType) parts.push(filters.propertyType.toLowerCase());
  if (filters.maxPrice) parts.push(`up to ${formatMoney(filters.maxPrice)}`);
  if (filters.amenities?.length) parts.push(filters.amenities.join(", "));
  return parts.join(" · ") || "Any listing";
}

export default function SavedSearchesPage() {
  const { user, logout, ready } = useRequireRole(["TENANT"]);

  const { data, error, loading, reload } = useAsync(
    () => (ready ? savedSearchApi.list() : Promise.resolve({ savedSearches: [] as SavedSearch[] })),
    [ready]
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedSearch | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  async function toggle(search: SavedSearch) {
    setBusyId(search.id);
    setActionError(null);
    try {
      await savedSearchApi.update(search.id, { alertsEnabled: !search.alerts_enabled });
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update search.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusyId(deleting.id);
    setActionError(null);
    try {
      await savedSearchApi.remove(deleting.id);
      setDeleting(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete search.");
    } finally {
      setBusyId(null);
    }
  }

  const searches = data?.savedSearches ?? [];

  return (
    <AppShell user={user} onLogout={logout} eyebrow="Tenant" title="Saved searches">
      <PageHeader
        eyebrow="Alerts"
        title="Saved searches"
        description="Save a filter combination and get notified when new listings match."
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && searches.length === 0 && (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title="No saved searches yet"
          description="Apply filters on Browse, then use “Save this search”."
          action={
            <Link href="/properties">
              <Button>Browse listings</Button>
            </Link>
          }
        />
      )}

      <div className="space-y-4">
        {searches.map((search) => (
          <article key={search.id} className="glass card-edge rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">{search.name}</h2>
                <p className="mt-1 text-sm text-muted">{summarize(search.filters)}</p>
              </div>
              <div className="flex items-center gap-2">
                {search.last_new_count > 0 && (
                  <Pill tone="warning">{search.last_new_count} new</Pill>
                )}
                <Pill tone={search.alerts_enabled ? "success" : "neutral"}>
                  {search.alerts_enabled ? "Alerts on" : "Alerts off"}
                </Pill>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/8 pt-4">
              <Link
                href={`/properties?${filtersToQuery(search.filters)}`}
                className="rounded-xl bg-btn px-4 py-2 text-sm font-medium text-white hover:bg-btn-soft"
              >
                View matches
              </Link>

              <button
                type="button"
                disabled={busyId === search.id}
                onClick={() => toggle(search)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-sm font-medium text-ink hover:bg-ink/5 disabled:opacity-50"
              >
                {search.alerts_enabled ? (
                  <BellOff className="h-4 w-4" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                {search.alerts_enabled ? "Turn off alerts" : "Turn on alerts"}
              </button>

              <button
                type="button"
                disabled={busyId === search.id}
                onClick={() => setDeleting(search)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-danger hover:bg-danger/8 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleting}
        tone="danger"
        icon={<Trash2 className="h-5 w-5" />}
        title={`Delete “${deleting?.name ?? "this search"}”?`}
        description="You will stop receiving alerts for this search."
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </AppShell>
  );
}

