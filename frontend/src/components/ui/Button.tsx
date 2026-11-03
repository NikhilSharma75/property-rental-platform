import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-btn text-white hover:bg-btn-soft hover:-translate-y-0.5 active:translate-y-0",
  gold:
    "bg-gold text-night hover:brightness-105 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_12px_30px_-12px_rgba(201,151,43,0.65)]",
  outline: "glass border border-ink/15 text-ink hover:border-primary/50 hover:text-primary",
  ghost: "text-ink hover:bg-ink/5",
  danger: "bg-danger text-white hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "rounded-lg px-3 py-1.5 text-xs",
  md: "rounded-xl px-5 py-2.5 text-sm",
  lg: "rounded-2xl px-7 py-3.5 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
