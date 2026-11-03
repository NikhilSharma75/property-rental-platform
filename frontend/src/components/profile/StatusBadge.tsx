"use client";

import type { VerificationStatus } from "@/lib/api";

const CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string }> = {
  NOT_SUBMITTED: {
    label: "Not submitted",
    color: "var(--color-muted)",
    bg: "color-mix(in srgb, var(--color-muted) 12%, transparent)",
  },
  PENDING: {
    label: "Pending review",
    color: "var(--color-gold)",
    bg: "color-mix(in srgb, var(--color-gold) 16%, transparent)",
  },
  VERIFIED: {
    label: "Verified",
    color: "var(--color-success)",
    bg: "color-mix(in srgb, var(--color-success) 14%, transparent)",
  },
  REJECTED: {
    label: "Needs attention",
    color: "var(--color-danger)",
    bg: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
  },
};

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const cfg = CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}
