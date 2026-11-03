"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useRequireRole } from "@/lib/useRequireRole";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout, ready } = useRequireRole(["ADMIN"]);

  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm tracking-wide text-muted">Checking permissions…</p>
      </main>
    );
  }
  return (
    <AppShell user={user} onLogout={logout} eyebrow="Admin" title="Platform console">
      {children}
    </AppShell>
  );
}
