/**
 * Single source of truth for money / date formatting.
 * Currency comes from NEXT_PUBLIC_CURRENCY (default INR) so the UI is no longer
 * hard-coded to "$". Pass the row's own `currency` when the API returns one.
 */
const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "INR";
const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-IN";

export function formatMoney(
  amount: number | string | null | undefined,
  opts: { currency?: string; decimals?: boolean; compact?: boolean } = {},
): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: opts.currency ?? DEFAULT_CURRENCY,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

export function relativeTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

export function initials(name: string | null | undefined): string {
  return (name ?? "?").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
