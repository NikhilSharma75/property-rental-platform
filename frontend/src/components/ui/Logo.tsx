import Link from "next/link";

export function Logo({
  size = "md",
  dark = false,
  href = "/",
}: {
  size?: "sm" | "md" | "lg";
  /** Force a light wordmark (for use on always-dark panels). */
  dark?: boolean;
  href?: string | null;
}) {
  const dims = size === "lg" ? "h-10 w-10 text-lg" : size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";
  const wordmarkSize = size === "lg" ? "text-xl" : "text-[16px]";

  const content = (
    <span className="group flex items-center gap-2.5">
      <span
        className={`flex shrink-0 items-center justify-center rounded-2xl font-bold text-night shadow-[0_6px_18px_-6px_rgba(201,151,43,0.8),inset_0_1px_0_rgba(255,255,255,0.45)] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-105 ${dims}`}
        style={{ background: "linear-gradient(135deg, #f0cf84, var(--color-gold) 55%, #a67c1f)" }}
      >
        R
      </span>
      <span
        className={`font-semibold tracking-[-0.02em] ${wordmarkSize} ${dark ? "text-white" : "text-ink"}`}
      >
        Rent<span className="text-gold">Ease</span>
      </span>
    </span>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
