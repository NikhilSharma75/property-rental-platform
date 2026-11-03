const TONES = {
  neutral: "bg-ink/6 text-muted-2 border-ink/10",
  primary: "bg-primary/10 text-primary border-primary/25",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-gold/12 text-gold-ink border-gold/35",
  danger: "bg-danger/10 text-danger border-danger/25",
} as const;

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${TONES[tone]}`}>
      {children}
    </span>
  );
}
