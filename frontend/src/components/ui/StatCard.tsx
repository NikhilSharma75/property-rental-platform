import type { ReactNode } from "react";

const TONES = {
  primary: "bg-primary/12 text-primary",
  gold: "bg-gold/15 text-gold-ink",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
} as const;

export function StatCard({
  label, value, hint, icon, tone = "primary", loading,
}: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode;
  tone?: keyof typeof TONES; loading?: boolean;
}) {
  return (
    <div className="glass card-edge rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-muted-2">{label}</p>
        {icon && <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</span>}
      </div>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-24 rounded-lg" />
      ) : (
        <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</p>
      )}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
