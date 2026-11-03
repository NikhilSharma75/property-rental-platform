"use client";

import { errorMessage } from "@/lib/errors";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, Property, PropertyInput } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { ImageManager } from "@/components/properties/ImageManager";
import { InlineBanner } from "@/components/profile/InlineBanner";

export default function EditPropertyPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const propertyId = params.id;

  const [property, setProperty] = useState<Property | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "LANDLORD") { router.replace("/dashboard"); return; }

    let cancelled = false;
    (async () => {
      try {
        const { property } = await api.getProperty(propertyId);
        if (!cancelled) setProperty(property);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load this property."));
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, router, propertyId]);

  async function handleSubmit(input: PropertyInput) {
    setSubmitting(true);
    setSaved(false);
    try {
      const { property: updated } = await api.updateProperty(propertyId, input);
      setProperty(updated);
      setSaved(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Archive this property? It will no longer be public. Your records are kept, and you can restore it from the properties list.")) return;
    setDeleting(true);
    try {
      await api.deleteProperty(propertyId);
      router.push("/dashboard/properties");
    } catch (err) {
      setLoadError(errorMessage(err, "Failed to archive property."));
      setDeleting(false);
    }
  }

  if (authLoading || !user || user.role !== "LANDLORD") {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For landlords" title="Edit property">
      <p className="text-sm font-medium text-gold">For landlords</p>
      <h1 className="mt-1 text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">
        {property ? property.title : "Edit property"}
      </h1>

      {loadError && <div className="mt-6 max-w-2xl"><InlineBanner kind="error" message={loadError} /></div>}

      {property && (
        <div className="mt-8 max-w-2xl space-y-8">
          <section className="rounded-2xl border border-ink/8 glass p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ink">Photos</h2>
            <p className="mt-1 text-sm text-muted">Up to 8 photos. The first photo is used as the cover.</p>
            <div className="mt-5">
              <ImageManager propertyId={property.id} images={property.images} onChange={(images) => setProperty((p) => (p ? { ...p, images } : p))} />
            </div>
          </section>

          <section className="rounded-2xl border border-ink/8 glass p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-ink">Details</h2>
            <div className="mt-5">
              {saved && <div className="mb-5"><InlineBanner kind="success" message="Property updated." /></div>}
              <PropertyForm mode="edit" initial={property} onSubmit={handleSubmit} submitting={submitting} />
            </div>
          </section>

          <section className="rounded-2xl border border-danger/20 glass p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-danger">Danger zone</h2>
            <p className="mt-1 text-sm text-muted">
              Archiving removes the listing from public view but keeps its leases, payments and applications. You can restore it later.
            </p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="mt-4 rounded-xl border border-danger/30 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/8 disabled:opacity-50"
            >
              {deleting ? "Archiving…" : "Archive this property"}
            </button>
          </section>
        </div>
      )}
    </AppShell>
  );
}