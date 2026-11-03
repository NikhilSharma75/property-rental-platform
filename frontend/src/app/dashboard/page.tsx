"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  FileText,
  Heart,
  Inbox,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCircle2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { favoriteApi, type PublicProperty } from "@/lib/api";
import { LandlordAnalytics, TenantAnalytics } from "@/components/dashboard/DashboardCharts";
import { formatMoney } from "@/lib/format";

/* ─── Role configuration ─────────────────────────────────────────────── */

type Role = "TENANT" | "LANDLORD" | "ADMIN";

type QuickAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: "primary" | "gold" | "neutral";
};

type RoleConfig = {
  eyebrow: string;
  hero: string;
  primaryCta: { label: string; href: string; description: string; icon: LucideIcon };
  quickActions: QuickAction[];
};

const CONFIG: Record<Role, RoleConfig> = {
  TENANT: {
    eyebrow: "For tenants",
    hero: "Find a place that feels like home — track every application in one place.",
    primaryCta: {
      label: "Browse properties",
      href: "/properties",
      description: "Search available rentals, filter by city, price, and distance.",
      icon: Search,
    },
    quickActions: [
      { label: "My applications", description: "Track status & documents", href: "/applications", icon: FileText, tone: "primary" },
      { label: "Saved homes", description: "Your favorited listings", href: "/dashboard#favorites", icon: Heart, tone: "gold" },
      { label: "Edit profile", description: "Photo, contact & bio", href: "/dashboard/profile", icon: UserCircle2, tone: "neutral" },
    ],
  },
  LANDLORD: {
    eyebrow: "For landlords",
    hero: "Everything about your listings, applications, and tenants — all in one place.",
    primaryCta: {
      label: "Manage properties",
      href: "/dashboard/properties",
      description: "Add, edit, or archive your listings. Photos, pricing, availability.",
      icon: Building2,
    },
    quickActions: [
      { label: "Applications", description: "Review new requests", href: "/landlord/applications", icon: Inbox, tone: "primary" },
      { label: "Add a property", description: "List a new rental", href: "/dashboard/properties/new", icon: Plus, tone: "gold" },
      { label: "Edit profile", description: "Account & verification", href: "/dashboard/profile", icon: UserCircle2, tone: "neutral" },
    ],
  },

  ADMIN: {
    eyebrow: "For admins",
    hero: "Platform health, verification queue, and everything in between.",
    primaryCta: {
      label: "Open admin tools",
      href: "/admin",
      description: "Users, landlord verifications, listings, and flagged content.",
      icon: ShieldCheck,
    },
    quickActions: [
      { label: "Verifications", description: "Review landlord requests", href: "/admin/verifications", icon: ShieldCheck, tone: "primary" },
      { label: "Users", description: "Manage accounts", href: "/admin/users", icon: UserCircle2, tone: "gold" },
      { label: "Reports", description: "Platform activity", href: "/admin/reports", icon: TrendingUp, tone: "neutral" },
    ],
  },
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function initialsOf(name: string | null | undefined, fallback: string): string {
  const src = (name ?? fallback).trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const [favorites, setFavorites] = useState<PublicProperty[] | null>(null);
  const [favError, setFavError] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "TENANT") return;
    let cancelled = false;
    favoriteApi
      .list()
      .then((r) => { if (!cancelled) setFavorites(r.properties); })
      .catch(() => { if (!cancelled) { setFavError(true); setFavorites([]); } });
    return () => { cancelled = true; };
  }, [user]);

  async function removeFavorite(id: string) {
    const prev = favorites;
    setFavorites((list) => (list ? list.filter((p) => p.id !== id) : list)); // optimistic
    try {
      await favoriteApi.remove(id);
    } catch {
      setFavorites(prev); // revert on failure
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading your dashboard…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center text-ink">
        <p className="max-w-sm text-muted">
          Your session expired. Please log in again to continue.
        </p>
      </main>
    );
  }

  const copy = CONFIG[(user.role as Role) ?? "TENANT"] ?? CONFIG.TENANT;
  const firstName = (user.full_name ?? user.email ?? "there").split(" ")[0];
  const initials = initialsOf(user.full_name, user.email ?? "?");

  return (
    <AppShell user={user} onLogout={logout} eyebrow={copy.eyebrow} title="Overview">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl glass-night">
        {/* blueprint grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* gold glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                {copy.eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl">
                {greeting()}, {firstName}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-[15px]">
                {copy.hero}
              </p>
            </div>

            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold/15 ring-2 ring-white/10">
                <span className="text-sm font-semibold tracking-wide text-gold">
                  {initials}
                </span>
              </div>
              {user.is_verified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={copy.primaryCta.href}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(36,85,235,0.9)] transition hover:bg-primary-dark"
            >
              <copy.primaryCta.icon className="h-4 w-4" />
              {copy.primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Edit profile
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Main content ─────────────────────────────────────────────── */}
      <div className="mt-6 space-y-5">
        {/* Primary action card */}
        <section className="relative overflow-hidden rounded-2xl border border-ink/8 glass p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-2xl"
          />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <copy.primaryCta.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">
                {copy.primaryCta.label}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-2">
                {copy.primaryCta.description}
              </p>
            </div>
            <Link
              href={copy.primaryCta.href}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-btn px-5 py-2.5 text-sm font-medium text-white transition hover:bg-btn-soft sm:self-auto"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Quick actions */}
        <section className="rounded-2xl border border-ink/8 glass p-6 sm:p-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Jump back in
            </h2>
            <span className="text-xs text-muted">Your shortcuts</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {copy.quickActions.map((a) => (
              <QuickActionCard key={a.href} action={a} />
            ))}
          </div>
        </section>

        {/* Analytics */}
        {user.role === "LANDLORD" && <LandlordAnalytics />}
        {user.role === "TENANT" && <TenantAnalytics />}

        {/* Favourites (tenants only) */}
        {user.role === "TENANT" && (
          <section id="favorites" className="scroll-mt-24 rounded-2xl border border-ink/8 glass p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
                <Heart className="h-4 w-4 text-gold" />
                Favourite properties
              </h2>
              {favorites && favorites.length > 0 && (
                <span className="text-xs text-muted">{favorites.length} saved</span>
              )}
            </div>

            {favorites === null ? (
              <p className="text-sm text-muted">Loading your favourites…</p>
            ) : favError ? (
              <p className="text-sm text-muted">Couldn&apos;t load your favourites. Please refresh.</p>
            ) : favorites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/15 p-8 text-center">
                <Heart className="mx-auto h-6 w-6 text-muted" />
                <p className="mt-3 text-sm text-muted-2">You haven&apos;t saved any properties yet.</p>
                <Link
                  href="/properties"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline"
                >
                  Browse properties <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {favorites.map((p) => (
                  <div
                    key={p.id}
                    className="group relative overflow-hidden rounded-2xl border border-ink/8 glass transition hover:shadow-[0_10px_24px_-14px_rgba(11,18,32,0.25)]"
                  >
                    <Link href={`/properties/${p.id}`} className="block">
                      <div className="aspect-[4/3] overflow-hidden bg-ink/5">
                        {p.images.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-muted">
                            No photo available
                          </div>
                        )}

                      </div>

                      <div className="space-y-2 p-4">
                        <h3 className="line-clamp-1 font-semibold text-ink">{p.title}</h3>
                        <p className="flex items-center gap-1 text-sm text-muted">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {p.city}{p.state ? `, ${p.state}` : ""}
                          </span>
                        </p>

                        <div className="flex items-center gap-4 text-xs text-muted-2">
                          <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {p.bedrooms} bedrooms</span>
                          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms} bathrooms</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-ink/8 pt-2">
                          <span>
                            <span className="text-lg font-bold text-ink">{formatMoney(p.rent_amount)}</span>
                            <span className="text-xs text-muted">/mo</span>
                          </span>
                          {p.status !== "AVAILABLE" && (
                            <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                              {p.status === "RENTED" ? "Rented" : "Unavailable"}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                    <button
                      onClick={() => removeFavorite(p.id)}
                      aria-label="Remove from favourites"
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface/95 text-ink/60 shadow transition hover:text-red-600 active:scale-90"
                    >
                      <X className="h-4 w-4" />

                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;

  const toneClasses: Record<QuickAction["tone"], string> = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/12 text-gold",
    neutral: "bg-ink/[0.05] text-ink",
  };




  return (
    <Link
      href={action.href}
      className="group flex flex-col gap-3 rounded-2xl border border-ink/8 glass p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_24px_-14px_rgba(11,18,32,0.25)]"
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses[action.tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium text-ink">
          {action.label}
          <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </span>

        <span className="mt-0.5 block truncate text-xs text-muted">
          {action.description}
        </span>
      </span>




    </Link>
  );
}
