"use client";

import { useState } from "react";
import Link from "next/link";
import type { SVGProps } from "react";
import { PublicProperty } from "@/lib/api";
import FavoriteButton from "./FavoriteButton";
import { formatMoney } from "@/lib/format";

type IconProps = SVGProps<SVGSVGElement>;

const ChevronLeft = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="m15 18-6-6 6-6" /></svg>;
const ChevronRight = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="m9 18 6-6-6-6" /></svg>;
const BedDouble = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M3 7v10M21 7v10M3 14h18M5 10h5a2 2 0 0 1 2 2v2H3v-2a2 2 0 0 1 2-2ZM14 10h3a4 4 0 0 1 4 4v0H14v-4Z" /></svg>;
const Bath = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M4 12h16M6 12v3a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-3M6 12V6a2 2 0 0 1 4-1l1 1" /></svg>;
const Ruler = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="m3 16 13-13 5 5L8 21H3v-5Z" /><path d="m12 7 2 2m-5 1 2 2m-5 1 2 2" /></svg>;
const MapPin = (props: IconProps) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></svg>;

const TYPE_LABEL: Record<string, string> = {
  APARTMENT: "Apartment",
  HOUSE: "House",
  VILLA: "Villa",
  STUDIO: "Studio",
  TOWNHOUSE: "Townhouse",
  CONDO: "Condo",
  OTHER: "Property",
};

export default function PropertyCard({
  property,
  onFavoriteChange,
}: {
  property: PublicProperty;
  onFavoriteChange?: (favorited: boolean) => void;
}) {
  const [active, setActive] = useState(0);
  const images = property.images;

  function go(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < 2) return;
    setActive((i) => (i + delta + images.length) % images.length);
  }

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group block rounded-[14px] glass glass-hover overflow-hidden border border-ink/8 shadow-[0_2px_10px_-4px_rgba(11,18,32,0.12)] hover:shadow-[0_18px_40px_-16px_rgba(11,18,32,0.28)] hover:-translate-y-1 transition-all duration-300"
    >
      {/* image */}
      <div className="relative aspect-[4/3] bg-ink/5 overflow-hidden">
        {images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[active]}
            alt={property.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted text-sm">
            No photo available
          </div>
        )}

        {/* top gradient for legibility of badges */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* property type badge */}
        <span className="absolute top-3 left-3 rounded-xl bg-night/85 backdrop-blur-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
          {TYPE_LABEL[property.property_type] ?? property.property_type}
        </span>

        <FavoriteButton
          propertyId={property.id}
          initialFavorited={property.is_favorited}
          onChange={onFavoriteChange}
          className="absolute top-3 right-3"
        />

        {/* carousel controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => go(-1, e)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-surface/90 opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow"
            >
              <ChevronLeft className="h-4 w-4 text-ink" />
            </button>
            <button
              onClick={(e) => go(1, e)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-surface/90 opacity-0 group-hover:opacity-100 transition flex items-center justify-center shadow"
            >
              <ChevronRight className="h-4 w-4 text-ink" />
            </button>
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              {active + 1}/{images.length}
            </span>
          </>
        )}

        {property.distance_km !== null && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
            <MapPin className="h-3 w-3" /> {property.distance_km.toFixed(1)} km away
          </span>
        )}
      </div>

      {/* body */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-ink leading-snug line-clamp-2">{property.title}</h3>
        </div>

        <p className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {property.city}{property.state ? `, ${property.state}` : ""}
          </span>
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-2 pt-0.5">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 text-primary" /> {property.bedrooms} bedrooms
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-3.5 w-3.5 text-primary" /> {property.bathrooms} bathrooms
          </span>
          {property.area_sqft && (
            <span className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-primary" /> {property.area_sqft} sqft
            </span>
          )}
        </div>

        {property.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {property.amenities.slice(0, 3).map((a) => (
              <span
                key={a}
                className="rounded-lg bg-primary-soft px-2 py-0.5 text-[10.5px] font-medium text-primary"
              >
                {a}
              </span>
            ))}
            {property.amenities.length > 3 && (
              <span className="text-[10.5px] text-muted self-center">
                +{property.amenities.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-ink/8">
          <div>
            <span className="text-lg font-bold text-ink">
              {formatMoney(property.rent_amount)}
            </span>
            <span className="text-xs text-muted">/mo</span>
          </div>
          <span className="rounded-xl bg-btn px-3 py-1.5 text-xs font-medium text-white group-hover:bg-btn-soft transition-colors">
            View details
          </span>
        </div>
      </div>
    </Link>
  );
}