"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, PropertyInput } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { PropertyForm } from "@/components/properties/PropertyForm";

export default function NewPropertyPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role !== "LANDLORD") router.replace("/dashboard");
  }, [authLoading, user, router]);

  if (authLoading || !user || user.role !== "LANDLORD") {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  async function handleSubmit(input: PropertyInput) {
    setSubmitting(true);
    try {
      const { property } = await api.createProperty(input);
      router.push(`/dashboard/properties/${property.id}/edit`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user} onLogout={logout} eyebrow="For landlords" title="Add property">
      <p className="text-sm font-medium text-gold">For landlords</p>
      <h1 className="mt-1 text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">Add a property</h1>
      <p className="mt-2 max-w-lg text-[15px] text-muted-2">You can add photos once the listing is created.</p>

      <div className="mt-8 max-w-2xl rounded-2xl border border-ink/8 glass p-6 sm:p-8">
        <PropertyForm mode="create" onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </AppShell>
  );
}