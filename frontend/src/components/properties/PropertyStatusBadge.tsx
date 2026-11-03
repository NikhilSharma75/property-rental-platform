"use client";

import type { PropertyStatus } from "@/lib/api";

const CONFIG: Record<PropertyStatus, { label: string; color: string; bg: string }> = {
  RESERVED: { label: "Reserved", color: "var(--color-gold-ink)", bg: "color-mix(in srgb, var(--color-gold-ink) 14%, white)" },
  DRAFT: { label: "Draft", color: "var(--color-muted)", bg: "color-mix(in srgb, var(--color-muted) 12%, white)" },
  AVAILABLE: { label: "Available", color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 14%, white)" },
  RENTED: { label: "Rented", color: "var(--color-primary)", bg: "color-mix(in srgb, var(--color-primary) 12%, white)" },
  ARCHIVED: { label: "Archived", color: "var(--color-danger)", bg: "color-mix(in srgb, var(--color-danger) 10%, white)" },
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  const cfg = CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}