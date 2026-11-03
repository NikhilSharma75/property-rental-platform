"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import FavoriteButton from "@/components/properties/FavoriteButton";
import { ApplyModal } from "@/components/applications/ApplyModal";
import { PropertyReviews } from "@/components/reviews/PropertyReviews";

import { formatMoney } from "@/lib/format";
import { ArrowLeft, Flag } from "lucide-react";
import { PropertyStatusBadge } from "@/components/properties/PropertyStatusBadge";
import { publicPropertyApi, PublicProperty, leaseApi } from "@/lib/api";
import { ReportDialog } from "@/components/reports/ReportDialog";

export default function PropertyDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [applyOpen, setApplyOpen] = useState(false);
const [reportOpen, setReportOpen] = useState(false);
const [hasLease, setHasLease] = useState(false);

// Only tenants who held a lease here can review (the API enforces it too; this just hides a form that would fail).
useEffect(() => {
  if (user?.role !== "TENANT") return;
  let cancelled = false;
  leaseApi.listMine()
    .then(({ leases }) => {
      if (!cancelled) setHasLease(leases.some((l) => l.property_id === params.id && ["ACTIVE", "EXPIRED", "TERMINATED"].includes(l.status)));
    })
    .catch(() => { if (!cancelled) setHasLease(false); });
  return () => { cancelled = true; };
}, [user?.role, params.id]);



  useEffect(() => {
    let cancelled = false;
    publicPropertyApi
      .getById(params.id)
      .then((res) => { if (!cancelled) { setError(null); setProperty(res.property); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load property."); });
    return () => { cancelled = true; };
  }, [params.id]);

  const canReview = user?.role === "TENANT" && hasLease;
  const loading = !error && property?.id !== params.id;

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/properties");
  }

  const backButton = (
    <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {backButton}
        <div className="skeleton aspect-video rounded-2xl" />
        <div className="skeleton h-6 w-1/2 rounded-lg" />
      </div>
    );
  }
  if (error || !property) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {backButton}
        <div className="rounded-2xl glass border border-ink/8 p-6">
          <p className="font-semibold text-ink">{error ?? "Property not found."}</p>
          <p className="mt-1 text-sm text-muted">This listing may have been removed or is no longer public.</p>
          <button onClick={() => router.push("/properties")} className="mt-4 rounded-xl bg-btn px-4 py-2 text-sm font-medium text-white hover:bg-btn-soft">
            Browse listings
          </button>
        </div>
      </div>
    );
  }

  const isAvailable = property.status === "AVAILABLE";
  const isTenant = user?.role === "TENANT";
  const canApply = isAvailable && isTenant;
  const mustSignIn = isAvailable && !user;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {backButton}
      <div>
        <div className="aspect-video rounded-2xl overflow-hidden bg-ink/5 relative">
          {property.images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={property.images[activeImage]} alt={property.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted">No photos</div>
          )}
          <FavoriteButton
            propertyId={property.id}
            initialFavorited={property.is_favorited}
            className="absolute top-3 right-3"
          />
        </div>
        {property.images.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto">
            {property.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img}
                src={img}
                onClick={() => setActiveImage(i)}
                className={`h-16 w-16 object-cover rounded-xl cursor-pointer border-2 ${i === activeImage ? "border-primary" : "border-transparent"}`}
                alt=""
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">{property.title}</h1>
          <PropertyStatusBadge status={property.status} />
        </div>
        <p className="text-muted">
          {property.address_line1}, {property.city}{property.state ? `, ${property.state}` : ""}
        </p>
        {user && (
  <button onClick={() => setReportOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger">
    <Flag className="h-4 w-4" /> Report this listing
  </button>
)}
      </div>

      <div className="flex flex-wrap gap-6 border-y border-ink/10 py-4">
        <div>
          <p className="text-sm text-muted">Rent</p>
          <p className="font-semibold text-ink">{formatMoney(property.rent_amount)}/mo</p>
        </div>
        <div>
          <p className="text-sm text-muted">Bedrooms</p>
          <p className="font-semibold text-ink">{property.bedrooms}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Bathrooms</p>
          <p className="font-semibold text-ink">{property.bathrooms}</p>
        </div>
        {property.area_sqft && (
          <div>
            <p className="text-sm text-muted">Area</p>
            <p className="font-semibold text-ink">{property.area_sqft} sqft</p>
          </div>
        )}
        <div>
          <p className="text-sm text-muted">Type</p>
          <p className="font-semibold text-ink">{property.property_type}</p>
        </div>
      </div>

      {/* ─── Apply CTA ──────────────────────────────────────────────────── */}
      {canApply && (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Interested in this property?</p>
            <p className="text-sm text-muted">Submit a rental application — it takes a couple of minutes.</p>
          </div>
          <button
            onClick={() => setApplyOpen(true)}
            className="rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft"
          >
            Apply now
          </button>
        </div>
      )}

      {mustSignIn && (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">Interested in this property?</p>
            <p className="text-sm text-muted">Sign in as a tenant to submit an application.</p>
          </div>
          <button
            onClick={() => router.push(`/login?redirect=/properties/${property.id}`)}
            className="rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white hover:bg-btn-soft"
          >
            Sign in to apply
          </button>
        </div>
      )}

      {!isAvailable && (
        <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 text-sm text-muted">
          {property.status === "RENTED" ? "This property is currently rented and not accepting applications. You can keep it in your favorites to check back later." : "This property is not currently accepting applications."}
        </div>
      )}

      {property.description && (
        <div>
          <h2 className="font-semibold text-ink mb-1">Description</h2>
          <p className="text-ink/80 whitespace-pre-line">{property.description}</p>
        </div>
      )}

      {property.amenities.length > 0 && (
        <div>
          <h2 className="font-semibold text-ink mb-2">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((a) => (
              <span key={a} className="text-sm bg-primary-soft text-primary rounded-full px-3 py-1">{a}</span>
            ))}
          </div>
        </div>
      )}

<PropertyReviews propertyId={property.id} canReview={canReview} />

{reportOpen && (
  <ReportDialog open kind="LISTING_REPORT" targetType="PROPERTY" targetId={property.id}
    title="Report this listing" description="Tell us what's wrong, for example a scam, wrong details or an unsafe property."
    defaultSubject={`Problem with listing: ${property.title}`.slice(0, 150)}
    onClose={() => setReportOpen(false)} />
)}


      {applyOpen && (
        <ApplyModal
          propertyId={property.id}
          propertyTitle={property.title}
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          onSubmitted={(id) => {
            setApplyOpen(false);
            router.push(`/applications/${id}`);
          }}
        />
      )}
    </div>
  );
}