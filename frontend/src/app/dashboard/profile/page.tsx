"use client";

import { errorMessage } from "@/lib/errors";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Camera,
  Mail,
  Phone,
  ShieldCheck,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, FullProfile, LandlordVerification } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { ProfileImageUpload } from "@/components/profile/ProfileImageUpload";
import { PersonalInfoForm } from "@/components/profile/PersonalInfoForm";
import { ContactDetailsForm } from "@/components/profile/ContactDetailsForm";
import { LandlordVerificationSection } from "@/components/profile/LandlordVerificationSection";
import { InlineBanner } from "@/components/profile/InlineBanner";

type SectionId = "photo" | "personal" | "contact" | "verification";

type SectionDef = {
  id: SectionId;
  label: string;
  blurb: string;
  icon: LucideIcon;
};

const BASE_SECTIONS: SectionDef[] = [
  {
    id: "photo",
    label: "Profile photo",
    blurb: "Shown on your account and anywhere your profile appears.",
    icon: Camera,
  },
  {
    id: "personal",
    label: "Personal information",
    blurb: "Your name and a short introduction.",
    icon: UserCircle2,
  },
  {
    id: "contact",
    label: "Contact details",
    blurb: "How we and other RentEase members can reach you.",
    icon: Phone,
  },
];

const VERIFICATION_SECTION: SectionDef = {
  id: "verification",
  label: "Landlord verification",
  blurb: "Confirm your identity so tenants can trust your listings.",
  icon: ShieldCheck,
};

/* ─── Helpers ────────────────────────────────────────────────────────── */

function initialsOf(name: string | null | undefined, fallback: string): string {
  const src = (name ?? fallback).trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function computeCompletion(profile: FullProfile): {
  pct: number;
  missing: string[];
} {
  const checks: { label: string; done: boolean }[] = [
    { label: "Photo", done: !!profile.profile_image_url },
    { label: "Full name", done: !!profile.full_name?.trim() },
    { label: "Bio", done: !!profile.bio?.trim() },
    { label: "Phone", done: !!profile.phone?.trim() },
    { label: "City", done: !!profile.city?.trim() },
    { label: "Country", done: !!profile.country?.trim() },
  ];
  const done = checks.filter((c) => c.done).length;
  return {
    pct: Math.round((done / checks.length) * 100),
    missing: checks.filter((c) => !c.done).map((c) => c.label),
  };
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { user, loading: authLoading, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [verification, setVerification] = useState<LandlordVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("photo");

  /* Load profile */
  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await api.getProfile();
        if (cancelled) return;
        setProfile(data.profile);
        setVerification(data.verification);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessage(err, "Failed to load your profile."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  /* Sections list, role-aware */
  const sections = useMemo<SectionDef[]>(() => {
    const list = [...BASE_SECTIONS];
    if (profile?.role === "LANDLORD") list.push(VERIFICATION_SECTION);
    return list;
  }, [profile?.role]);

  /* Scroll-spy — track which section is in view */
  useEffect(() => {
    if (loading || !profile) return;
    const ids = sections.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              (a.target as HTMLElement).offsetTop -
              (b.target as HTMLElement).offsetTop
          );
        if (visible[0]) {
          setActiveSection(visible[0].target.id as SectionId);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading, profile, sections]);

  const completion = useMemo(
    () => (profile ? computeCompletion(profile) : null),
    [profile]
  );

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading your profile…</p>
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

  const isLandlord = user.role === "LANDLORD";
  const eyebrow = isLandlord ? "For landlords" : "For tenants";
  const initials = initialsOf(profile?.full_name, user.email ?? "?");

  return (
    <AppShell user={user} onLogout={logout} eyebrow={eyebrow} title="Your profile">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl glass-night">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        />

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gold/15 ring-2 ring-white/10 sm:h-20 sm:w-20">
                  {profile?.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.profile_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold tracking-wide text-gold sm:text-xl">
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* Name + meta */}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                  {eyebrow}
                </p>
                <h1 className="mt-1.5 truncate text-2xl font-semibold leading-tight tracking-[-0.02em] text-white sm:text-3xl">
                  {profile?.full_name || "Your profile"}
                </h1>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10">
                    <Mail className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">{user.email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-[#a9c0ff] ring-1 ring-primary/25">
                    {isLandlord ? "Landlord" : "Tenant"}
                  </span>
                  {user.is_verified && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                      <BadgeCheck className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Completion ring (desktop) */}
            {completion && (
              <CompletionRing
                pct={completion.pct}
                missing={completion.missing}
              />
            )}
          </div>
        </div>
      </section>

      {/* ─── Mobile completion bar (below hero, phones only) ──────────── */}
      {completion && (
        <div className="mt-4 rounded-2xl border border-ink/8 glass p-4 sm:hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink">Profile completion</span>
            <span className="font-semibold text-primary">{completion.pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-[width] duration-500"
              style={{ width: `${completion.pct}%` }}
            />
          </div>
          {completion.missing.length > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              Add {completion.missing.slice(0, 3).join(", ")}
              {completion.missing.length > 3 ? "…" : ""}
            </p>
          )}
        </div>
      )}

      {loadError && (
        <div className="mt-6">
          <InlineBanner kind="error" message={loadError} />
        </div>
      )}

      {/* ─── Two-column body ──────────────────────────────────────────── */}
      {profile && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          {/* Sidebar nav */}
          <nav
            aria-label="Profile sections"
            className="sticky top-4 z-20 -mx-4 border-b border-ink/8 bg-canvas/85 px-4 py-2.5 backdrop-blur lg:top-20 lg:mx-0 lg:h-fit lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
          >
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
              {sections.map((s) => {
                const active = activeSection === s.id;
                const Icon = s.icon;
                return (
                  <li key={s.id} className="shrink-0 lg:shrink">
                    <a
                      href={`#${s.id}`}
                      className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition lg:w-full lg:whitespace-normal ${
                        active
                          ? "bg-primary/10 text-primary lg:border-l-2 lg:border-primary lg:rounded-l-none lg:rounded-r-[8px]"
                          : "text-muted-2 hover:bg-ink/[0.04] hover:text-ink lg:border-l-2 lg:border-transparent lg:rounded-l-none"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? "text-primary" : "text-muted"
                        }`}
                      />
                      {s.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sections */}
          <div className="min-w-0 space-y-6">
            {/* Photo */}
            <SectionCard
              section={BASE_SECTIONS[0]}
              index={1}
              total={sections.length}
            >
              <ProfileImageUpload
                fullName={profile.full_name}
                imageUrl={profile.profile_image_url}
                onChange={(url) => {
                  setProfile((p) => (p ? { ...p, profile_image_url: url } : p));
                  updateUser({ profile_image_url: url });
                }}
              />
            </SectionCard>

            {/* Personal */}
            <SectionCard
              section={BASE_SECTIONS[1]}
              index={2}
              total={sections.length}
            >
              <PersonalInfoForm
                profile={profile}
                onSaved={(updated) => {
                  setProfile(updated);
                  updateUser({ full_name: updated.full_name });
                }}
              />
            </SectionCard>

            {/* Contact */}
            <SectionCard
              section={BASE_SECTIONS[2]}
              index={3}
              total={sections.length}
            >
              <ContactDetailsForm
                profile={profile}
                onSaved={(updated) => {
                  setProfile(updated);
                  updateUser({ phone: updated.phone });
                }}
              />
            </SectionCard>

            {/* Verification (landlords only) */}
            {profile.role === "LANDLORD" && verification && (
              <SectionCard
                section={VERIFICATION_SECTION}
                index={4}
                total={sections.length}
                accent="gold"
                trailing={
                  verification.status === "VERIFIED" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : verification.status === "PENDING" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/12 px-2.5 py-1 text-xs font-medium text-gold-ink">
                      In review
                    </span>
                  ) : verification.status === "REJECTED" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-700">
                      Needs attention
                    </span>
                  ) : null
                }
              >
                <LandlordVerificationSection
                  verification={verification}
                  onSaved={setVerification}
                />
              </SectionCard>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ─── Completion ring ────────────────────────────────────────────────── */

function CompletionRing({ pct, missing }: { pct: number; missing: string[] }) {
  const size = 84;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="hidden shrink-0 items-center gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:flex">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2455eb" />
              <stop offset="100%" stopColor="#c9972b" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-white">
          {pct}%
        </span>
      </div>
      <div className="max-w-[140px]">
        <p className="text-xs font-medium text-white/90">Profile completion</p>
        <p className="mt-1 text-[11px] leading-snug text-white/50">
          {missing.length === 0
            ? "All set — your profile is complete."
            : `Add ${missing.slice(0, 2).join(", ")}${
                missing.length > 2 ? ` +${missing.length - 2} more` : ""
              }`}
        </p>
      </div>
    </div>
  );
}

/* ─── Section card ───────────────────────────────────────────────────── */

function SectionCard({
  section,
  index,
  total,
  accent = "primary",
  trailing,
  children,
}: {
  section: SectionDef;
  index: number;
  total: number;
  accent?: "primary" | "gold";
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  const Icon = section.icon;
  const accentClasses =
    accent === "gold"
      ? "bg-gold/12 text-gold"
      : "bg-primary/10 text-primary";

  return (
    <section
      id={section.id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-ink/8 glass"
    >
      <header className="border-b border-ink/8 px-6 py-5 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${accentClasses}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-ink">
                  {section.label}
                </h2>
                <span className="text-[11px] font-medium tabular-nums text-muted">
                  {index}/{total}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted">{section.blurb}</p>
            </div>
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
      </header>
      <div className="px-6 py-6 sm:px-8 sm:py-7">{children}</div>
    </section>
  );
}