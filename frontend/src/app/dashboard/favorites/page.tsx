"use client";

import Link from "next/link";
import { Heart, Search } from "lucide-react";
import { favoriteApi } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useRequireRole } from "@/lib/useRequireRole";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import PropertyCard from "@/components/properties/PropertyCard";

export default function FavoritesPage() {
  const { user, logout, ready } = useRequireRole(["TENANT"]);
  const { data, error, loading, reload, setData } = useAsync(() => favoriteApi.list(), []);

  if (!ready || !user) return <main className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted">Loading…</p></main>;

  return (
    <AppShell user={user} onLogout={logout} eyebrow="Tenant" title="Favorites">
      <PageHeader eyebrow="Saved" title="Your favorites" description="Homes you've shortlisted. Prices and availability update live." />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton aspect-[4/3] rounded-3xl" />)}
        </div>
      )}
      {!loading && !error && !data?.properties.length && (
        <EmptyState icon={<Heart className="h-6 w-6" />} title="No favorites yet"
          description="Tap the heart on any listing to save it here."
          action={<Link href="/properties"><Button><Search className="h-4 w-4" /> Browse listings</Button></Link>} />
      )}
      {!!data?.properties.length && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.properties.map((p) => <PropertyCard
            key={p.id}
            property={p}
            onFavoriteChange={(fav) => {
              if (!fav) setData((d) => (d ? { ...d, properties: d.properties.filter((x) => x.id !== p.id) } : d));
            }}
          />)}
        </div>
      )}
    </AppShell>
  );
}
