"use client";

import { useState } from "react";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
import { PropertySearchParams, PropertyType } from "@/lib/api";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "HOUSE", label: "House" },
  { value: "VILLA", label: "Villa" },
  { value: "STUDIO", label: "Studio" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "CONDO", label: "Condo" },
  { value: "OTHER", label: "Other" },
];

export default function PropertyFilters({
  filters,
  onChange,
  onUseMyLocation,
}: {
  filters: PropertySearchParams;
  onChange: (next: PropertySearchParams) => void;
  onUseMyLocation: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  function set<K extends keyof PropertySearchParams>(key: K, value: PropertySearchParams[K]) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  function clearAll() {
    onChange({ page: 1, limit: filters.limit, sort: filters.sort });
  }

  const activeCount = [
    filters.city, filters.propertyType, filters.minPrice, filters.maxPrice,
    filters.minBedrooms, filters.minBathrooms, filters.lat,
  ].filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-sm border-b border-ink/8">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2.5">
        {/* search */}
        <div className="flex items-center gap-2 rounded-xl border border-ink/12 bg-canvas px-3 py-2 flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-muted shrink-0" />
          <input
            className="bg-transparent outline-none text-sm w-full placeholder:text-muted"
            placeholder="Search by title, address, or city..."
            value={filters.search ?? ""}
            onChange={(e) => set("search", e.target.value || undefined)}
          />
        </div>

        {/* city */}
        <input
          className="rounded-xl border border-ink/12 bg-canvas px-3 py-2 text-sm w-36 outline-none focus:border-primary"
          placeholder="City"
          value={filters.city ?? ""}
          onChange={(e) => set("city", e.target.value || undefined)}
        />

        {/* type */}
        <select
          className="rounded-xl border border-ink/12 bg-canvas px-3 py-2 text-sm outline-none focus:border-primary"
          value={filters.propertyType ?? ""}
          onChange={(e) => set("propertyType", (e.target.value || undefined) as PropertyType | undefined)}
        >
          <option value="">Any type</option>
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* location */}
        <button
          onClick={onUseMyLocation}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
            filters.lat !== undefined
              ? "border-gold bg-gold-soft text-ink"
              : "border-ink/12 bg-canvas text-muted hover:text-ink"
          }`}
        >
          <MapPin className="h-4 w-4" /> Near me
        </button>

        {/* more filters toggle */}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-xl border border-ink/12 bg-canvas px-3 py-2 text-sm text-ink hover:border-primary"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-gold text-night text-[10px] font-bold h-4 w-4 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-sm text-muted hover:text-danger"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {moreOpen && (
        <div className="max-w-7xl mx-auto px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-ink/8 pt-3">
          <div>
            <label className="text-xs font-medium text-muted">Min price</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.minPrice ?? ""}
              onChange={(e) => set("minPrice", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Max price</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.maxPrice ?? ""}
              onChange={(e) => set("maxPrice", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Min bedrooms</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.minBedrooms ?? ""}
              onChange={(e) => set("minBedrooms", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted">Min bathrooms</label>
            <input
              type="number"
              className="mt-1 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.minBathrooms ?? ""}
              onChange={(e) => set("minBathrooms", e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>

          {filters.lat !== undefined && (
            <div>
              <label className="text-xs font-medium text-muted">Radius (km)</label>
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-ink/12 px-3 py-2 text-sm outline-none focus:border-primary"
                value={filters.radiusKm ?? ""}
                onChange={(e) => set("radiusKm", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}