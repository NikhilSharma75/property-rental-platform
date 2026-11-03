"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationBell } from "./NotificationBell";

interface AppShellUser {
  full_name: string;
  role: string;
  profile_image_url: string | null;
}

export function AppShell({
  user,
  onLogout,
  eyebrow,
  title,
  children,
}: {
  user: AppShellUser;
  onLogout: () => void;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = user.full_name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-0 lg:gap-4 lg:p-4">
        {/* Desktop sidebar: floating glass panel */}
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[236px] shrink-0 overflow-hidden rounded-3xl border border-ink/8 shadow-[0_20px_60px_-30px_rgba(11,18,32,0.45)] lg:block">
          <Sidebar role={user.role} onLogout={onLogout} />
        </aside>

        {/* Mobile drawer -- always mounted, slides in/out via transform so it animates */}
        <div
          className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
          aria-hidden={!mobileOpen}
        >
          <button
            aria-label="Close menu"
            className={`absolute inset-0 bg-night/50 backdrop-blur-sm transition-opacity duration-300 ${
              mobileOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setMobileOpen(false)}
            tabIndex={mobileOpen ? 0 : -1}
          />
          <div
            className={`absolute inset-y-0 left-0 w-[280px] max-w-[84vw] overflow-hidden border-r border-ink/10 shadow-2xl transition-transform duration-300 ease-out ${
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar
              role={user.role}
              onLogout={onLogout}
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar: frosted glass bar */}
          <header className="glass-strong sticky top-0 z-30 border-b border-ink/8 lg:top-4 lg:rounded-2xl lg:border">
            <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
              <button
                className="rounded-xl p-1.5 text-ink hover:bg-ink/5 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden">
                <Logo href="/dashboard" size="sm" />
              </div>

              {(eyebrow || title) && (
                <div className="hidden min-w-0 lg:block">
                  {eyebrow && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">{eyebrow}</p>
                  )}
                  {title && <p className="truncate text-[15px] font-semibold text-ink">{title}</p>}
                </div>
              )}

              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <NotificationBell />
                <Link
                  href="/dashboard/profile"
                  className="flex items-center gap-2.5 rounded-full border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-ink/10 hover:bg-ink/5"
                >
                  {user.profile_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.profile_image_url}
                      alt={`${user.full_name}'s profile photo`}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/30"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-xs font-semibold text-white">
                      {initials}
                    </span>
                  )}
                  <span className="hidden text-sm font-medium text-ink sm:block">
                    {user.full_name.split(" ")[0]}
                  </span>
                </Link>
              </div>
            </div>
          </header>

          <main id="main" className="flex-1 px-4 py-6 sm:px-2 sm:py-8 lg:px-2">{children}</main>
        </div>
      </div>
    </div>
  );
}
