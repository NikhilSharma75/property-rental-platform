import type { ReactNode } from "react";
import { BadgeCheck, CreditCard, MessageSquare, Wrench } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const POINTS = [
  { icon: BadgeCheck, text: "Verified landlords and listings" },
  { icon: CreditCard, text: "Rent, deposits and receipts in one place" },
  { icon: Wrench, text: "Maintenance tracked until it's done" },
  { icon: MessageSquare, text: "Real-time chat with your landlord or tenant" },
];

/** Shared split-screen layout for login / register / password-reset. No WebGL - loads instantly. */
export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="glass-night relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="bp-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative"><Logo dark /></div>
        <div className="relative">
          <h2 className="max-w-md text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.03em]">
            Renting, <span className="gold-text">without the chasing.</span>
          </h2>
          <ul className="mt-10 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-white/80">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-gold"><Icon className="h-[18px] w-[18px]" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} RentEase</p>
      </aside>

      <main className="relative flex items-center justify-center px-5 py-12">
        <div className="absolute left-5 top-5 lg:hidden"><Logo /></div>
        <div className="absolute right-5 top-5"><ThemeToggle /></div>
        <div className="glass-strong card-edge w-full max-w-md rounded-3xl p-8 sm:p-10">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
