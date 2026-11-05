// "use client";

// import { useEffect, useState, useCallback } from "react";
// import { publicPropertyApi, PropertySearchParams, PublicProperty } from "@/lib/api";
// import PropertyCard from "@/components/properties/PropertyCard";
// import PropertyFilters from "@/components/properties/PropertyFilters";
// import Pagination from "@/components/properties/Pagination";

// function CardSkeleton() {
//   return (
//     <div className="rounded-2xl glass border border-ink/8 overflow-hidden animate-pulse">
//       <div className="aspect-[4/3] bg-ink/8" />
//       <div className="p-4 space-y-3">
//         <div className="h-4 bg-ink/8 rounded w-3/4" />
//         <div className="h-3 bg-ink/8 rounded w-1/2" />
//         <div className="h-3 bg-ink/8 rounded w-2/3" />
//       </div>
//     </div>
//   );
// }

// export default function PropertiesPage() {
//   const [filters, setFilters] = useState<PropertySearchParams>({ page: 1, limit: 12, sort: "newest" });
//   const [properties, setProperties] = useState<PublicProperty[]>([]);
//   const [total, setTotal] = useState(0);
//   const [totalPages, setTotalPages] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const fetchProperties = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const result = await publicPropertyApi.search(filters);
//       setProperties(result.properties);
//       setTotal(result.total);
//       setTotalPages(result.totalPages);
//     } catch (e) {
//       setError(e instanceof Error ? e.message : "Failed to load properties.");
//     } finally {
//       setLoading(false);
//     }
//   }, [filters]);

//   // Hydrate filters from the URL once (landing-page search box, shared links).
//   const [hydrated, setHydrated] = useState(false);
//   useEffect(() => {
//     const q = new URLSearchParams(window.location.search);
//     const search = q.get("search") ?? undefined;
//     const city = q.get("city") ?? undefined;
//     const propertyType = (q.get("propertyType") as PropertySearchParams["propertyType"]) ?? undefined;
//     // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates filters from the URL once; window is unavailable during SSR
//     if (search || city || propertyType) setFilters((f) => ({ ...f, search, city, propertyType }));
//     setHydrated(true);
//   }, []);

//   useEffect(() => {
//     // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates filters from the URL once; window is unavailable during SSR
//     if (hydrated) fetchProperties();
//   }, [fetchProperties, hydrated]);

//   function useMyLocation() {
//     if (!navigator.geolocation) return;
//     navigator.geolocation.getCurrentPosition((pos) => {
//       setFilters((f) => ({
//         ...f,
//         lat: pos.coords.latitude,
//         lng: pos.coords.longitude,
//         radiusKm: f.radiusKm ?? 25,
//         sort: "distance",
//         page: 1,
//       }));
//     });
//   }

//   return (
//     <div>
//       {/* hero */}
//       <div className="bp-grid bg-night relative overflow-hidden">
//         <div className="absolute inset-0 bg-gradient-to-b from-night/0 via-night/60 to-night" />
//         <div className="relative max-w-7xl mx-auto px-4 py-14 text-center">
//           <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-3">
//             Curated rentals
//           </span>
//           <h1 className="text-3xl sm:text-4xl font-bold text-white">
//             Find your next <span className="gold-text">home</span>
//           </h1>
//           <p className="text-white/60 mt-3 max-w-xl mx-auto text-sm">
//             Search, filter, and compare available properties near you — updated in real time.
//           </p>
//         </div>
//       </div>

//       <PropertyFilters filters={filters} onChange={setFilters} onUseMyLocation={useMyLocation} />

//       <div className="max-w-7xl mx-auto px-4 py-8">
//         <div className="flex items-center justify-between mb-5">
//           <p className="text-sm text-muted">
//             {loading ? "Searching..." : `${total} propert${total === 1 ? "y" : "ies"} found`}
//           </p>
//           <select
//             className="rounded-xl border border-ink/12 bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
//             value={filters.sort ?? "newest"}
//             onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as PropertySearchParams["sort"], page: 1 }))}
//           >
//             <option value="newest">Newest first</option>
//             <option value="oldest">Oldest first</option>
//             <option value="price_asc">Price: low to high</option>
//             <option value="price_desc">Price: high to low</option>
//             {filters.lat !== undefined && <option value="distance">Nearest first</option>}
//           </select>
//         </div>

//         {error && (
//           <div className="rounded-xl border border-danger/20 bg-danger/5 text-danger text-sm px-4 py-3 mb-4">
//             {error}
//           </div>
//         )}

//         {loading && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//             {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
//           </div>
//         )}

//         {!loading && !error && properties.length === 0 && (
//           <div className="text-center py-20">
//             <p className="text-ink font-semibold">No properties match your search</p>
//             <p className="text-muted text-sm mt-1">Try widening your filters or clearing them.</p>
//           </div>
//         )}

//         {!loading && !error && properties.length > 0 && (
//           <>
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
//               {properties.map((p) => (
//                 <PropertyCard key={p.id} property={p} />
//               ))}
//             </div>
//             <Pagination
//               page={filters.page ?? 1}
//               totalPages={totalPages}
//               onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
//             />
//           </>
//         )}
//       </div>
//     </div>
//   );
// }


"use client";

import { useCallback, useEffect, useState } from "react";
import {
  publicPropertyApi,
  PropertySearchParams,
  PublicProperty,
  savedSearchApi,
  SavedSearchFilters,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatMoney } from "@/lib/format";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyFilters from "@/components/properties/PropertyFilters";
import Pagination from "@/components/properties/Pagination";

function CardSkeleton() {
  return (
    <div className="rounded-2xl glass border border-ink/8 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-ink/8" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-ink/8 rounded w-3/4" />
        <div className="h-3 bg-ink/8 rounded w-1/2" />
        <div className="h-3 bg-ink/8 rounded w-2/3" />
      </div>
    </div>
  );
}

function defaultSearchName(f: PropertySearchParams): string {
  const parts: string[] = [];
  if (f.minBedrooms) parts.push(`${f.minBedrooms} BHK`);
  if (f.city) parts.push(f.city);
  if (f.maxPrice) parts.push(`under ${formatMoney(f.maxPrice)}`);
  return parts.join(" ") || "My saved search";
}

function toSavedFilters(f: PropertySearchParams): SavedSearchFilters {
  const copy = { ...f } as Record<string, unknown>;
  delete copy.page;
  delete copy.limit;
  delete copy.sort;
  return copy as SavedSearchFilters;
}

export default function PropertiesPage() {
  const { user } = useAuth();

  const [filters, setFilters] = useState<PropertySearchParams>({
    page: 1,
    limit: 12,
    sort: "newest",
  });
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await publicPropertyApi.search(filters);
      setProperties(result.properties);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Hydrate every filter from the URL once (landing-page search, saved searches, shared links).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const num = (key: string) => {
      const v = q.get(key);
      return v !== null && v !== "" ? Number(v) : undefined;
    };

    const fromUrl: PropertySearchParams = {
      search: q.get("search") ?? undefined,
      city: q.get("city") ?? undefined,
      propertyType:
        (q.get("propertyType") as PropertySearchParams["propertyType"]) ?? undefined,
      minPrice: num("minPrice"),
      maxPrice: num("maxPrice"),
      minBedrooms: num("minBedrooms"),
      minBathrooms: num("minBathrooms"),
      amenities: q.get("amenities")?.split(",").filter(Boolean),
      lat: num("lat"),
      lng: num("lng"),
      radiusKm: num("radiusKm"),
      sort: (q.get("sort") as PropertySearchParams["sort"]) ?? undefined,
      page: num("page"),
    };

    const cleaned = Object.fromEntries(
      Object.entries(fromUrl).filter(([, value]) => value !== undefined)
    ) as PropertySearchParams;

      /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from window.location.search; window is unavailable during SSR */
    if (Object.keys(cleaned).length > 0) {
      setFilters((f) => ({ ...f, ...cleaned }));
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates filters from the URL once; window is unavailable during SSR
    if (hydrated) fetchProperties();
  }, [fetchProperties, hydrated]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setFilters((f) => ({
        ...f,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        radiusKm: f.radiusKm ?? 25,
        sort: "distance",
        page: 1,
      }));
    });
  }

  function openSaveDialog() {
    setSaveName(defaultSearchName(filters));
    setSaveError(null);
    setSaveOpen(true);
  }

  async function handleSaveSearch() {
    const name = saveName.trim();
    if (!name) {
      setSaveError("Give your search a name.");
      return;
    }

    const savedFilters = toSavedFilters(filters);
    const hasFilter = Object.values(savedFilters).some(
      (value) =>
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0)
    );

    if (!hasFilter) {
      setSaveError("Add at least one filter before saving.");
      return;
    }

    try {
      await savedSearchApi.create({ name, filters: savedFilters });
      setSaveOpen(false);
      setSavedNotice("Search saved. You'll be notified when new listings match.");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save search.");
    }
  }

  return (
    <div>
      {/* hero */}
      <div className="bp-grid bg-night relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-night/0 via-night/60 to-night" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 text-center">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-gold mb-3">
            Curated rentals
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Find your next <span className="gold-text">home</span>
          </h1>
          <p className="text-white/60 mt-3 max-w-xl mx-auto text-sm">
            Search, filter, and compare available properties near you — updated in real time.
          </p>
        </div>
      </div>

      <PropertyFilters filters={filters} onChange={setFilters} onUseMyLocation={useMyLocation} />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="text-sm text-muted">
            {loading ? "Searching..." : `${total} propert${total === 1 ? "y" : "ies"} found`}
          </p>

          <div className="flex items-center gap-2">
            {user?.role === "TENANT" && (
              <button
                type="button"
                onClick={openSaveDialog}
                className="rounded-xl border border-ink/15 bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary/40 hover:text-primary"
              >
                Save this search
              </button>
            )}

            <select
              className="rounded-xl border border-ink/12 bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.sort ?? "newest"}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sort: e.target.value as PropertySearchParams["sort"],
                  page: 1,
                }))
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              {filters.lat !== undefined && <option value="distance">Nearest first</option>}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger/5 text-danger text-sm px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {savedNotice && (
          <div className="rounded-xl border border-success/25 bg-success/8 text-success text-sm px-4 py-3 mb-4">
            {savedNotice}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {!loading && !error && properties.length === 0 && (
          <div className="text-center py-20">
            <p className="text-ink font-semibold">No properties match your search</p>
            <p className="text-muted text-sm mt-1">Try widening your filters or clearing them.</p>
          </div>
        )}

        {!loading && !error && properties.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
            <Pagination
              page={filters.page ?? 1}
              totalPages={totalPages}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={saveOpen}
        tone="primary"
        title="Save this search"
        description="We'll notify you when new listings match these filters."
        confirmLabel="Save search"
        onCancel={() => {
          setSaveOpen(false);
          setSaveError(null);
        }}
        onConfirm={handleSaveSearch}
      >
        <label htmlFor="saved-search-name" className="field-label">
          Name
        </label>
        <input
          id="saved-search-name"
          className="field-input"
          value={saveName}
          maxLength={80}
          onChange={(e) => {
            setSaveName(e.target.value);
            setSaveError(null);
          }}
        />
        {saveError && <p className="mt-2 text-sm text-danger">{saveError}</p>}
      </ConfirmDialog>
    </div>
  );
}

