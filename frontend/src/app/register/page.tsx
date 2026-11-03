"use client";

import { errorMessage } from "@/lib/errors";
import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BlueprintScene } from "@/components/three/BlueprintScene";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const ROLE_OPTIONS = [
  {
    value: "TENANT" as const,
    label: "Tenant",
    copy: "Search and rent properties, submit applications, track payments.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 11L12 4l8 7M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "LANDLORD" as const,
    label: "Landlord",
    copy: "List and manage properties, tenants, applications, and leases.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="7" width="7" height="13" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="3" width="7" height="17" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6.5 10h2M6.5 13h2M6.5 16h2M15.5 6h2M15.5 9h2M15.5 12h2M15.5 15h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"TENANT" | "LANDLORD">("TENANT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirectTo") ?? params.get("redirect") ?? undefined;
      await register({ fullName, email, password, role }, redirectTo);
    } catch (err) {
      setError(errorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
            <BlueprintScene variant="ambient" />

      <div className="absolute left-6 top-6 z-10">
        <Logo />
      </div>
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-lg glass-strong rounded-3xl border border-ink/10 p-8 sm:p-10">
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Create your account</h2>
        <p className="mt-1.5 text-sm text-muted">Tell us a bit about yourself to get started.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">I am a</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLE_OPTIONS.map((opt) => {
                const active = role === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setRole(opt.value)}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                      active ? "border-gold bg-gold/15 shadow-[0_8px_24px_-12px_rgba(201,151,43,0.6)]" : "border-ink/12 hover:border-ink/30"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? "bg-gold text-night" : "bg-ink/5 text-muted-2"
                      }`}
                    >
                      {opt.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{opt.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted">{opt.copy}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Full name</label>
            <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-surface/50 px-3.5 py-2.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                placeholder="Jordan Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Email</label>
              <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-surface/50 px-3.5 py-2.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
                  <path d="M3 6.5L12 13L21 6.5M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Password</label>
              <div className="flex items-center gap-2.5 rounded-xl border border-ink/15 bg-surface/50 px-3.5 py-2.5 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
                  <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 11V7a4 4 0 118 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
