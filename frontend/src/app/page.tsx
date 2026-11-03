import Link from "next/link";
import {
  ArrowRight, BadgeCheck, BarChart3, Bell, Building2, CreditCard, FileSignature, Heart,
  MapPin, MessageSquare, Search, ShieldCheck, Wrench,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { HeroScene } from "@/components/landing/HeroScene";

const FEATURES = [
  { icon: Search, title: "Smart search", copy: "Filter by price, bedrooms, amenities and distance. Save the ones you love." },
  { icon: FileSignature, title: "Digital leases", copy: "Generate, sign and download lease PDFs. Deposits and terms in one record." },
  { icon: CreditCard, title: "Online rent", copy: "Pay securely, get instant receipts, and never lose a payment trail." },
  { icon: Wrench, title: "Maintenance tracking", copy: "Photo-backed requests with priority and status, from report to resolved." },
  { icon: MessageSquare, title: "Live messaging", copy: "Typing indicators, read receipts and instant notifications." },
  { icon: BarChart3, title: "Dashboards", copy: "Occupancy, revenue and activity at a glance for every role." },
  { icon: ShieldCheck, title: "Verified landlords", copy: "ID and ownership checks before a listing earns its badge." },
  { icon: Bell, title: "Never miss a thing", copy: "In-app and email alerts for applications, rent due dates and lease expiry." },
];

const ROLES = [
  { tag: "Tenants", title: "Find it. Apply. Move in.", points: ["Search and favorite verified listings", "Apply with documents in minutes", "Pay rent and raise repair requests online"] },
  { tag: "Landlords", title: "Run every door from one place.", points: ["List properties with multiple units", "Review applications, issue leases", "See revenue, occupancy and open repairs"] },
  { tag: "Admins", title: "Keep the platform healthy.", points: ["Verify landlords, moderate listings", "Handle complaints and flagged reviews", "Suspend abuse, watch platform analytics"] },
];

const CITIES = ["Jalandhar", "Chandigarh", "Ludhiana", "Amritsar", "Delhi", "Mohali", "Pune", "Bengaluru"];

export default function HomePage() {
  return (
    <div className="min-h-screen text-ink">
      <a href="#content" className="skip-link">Skip to content</a>

      <header className="glass-strong sticky top-0 z-30 border-b border-ink/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-muted-2 md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#roles" className="hover:text-ink">Who it&apos;s for</a>
            <Link href="/properties" className="hover:text-ink">Browse homes</Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="hidden text-sm text-ink/80 transition-colors hover:text-ink sm:block">Log in</Link>
            <Link href="/register"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      <main id="content">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-0 opacity-80" aria-hidden><HeroScene /></div>
          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
            <p className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-surface/60 px-3.5 py-1.5 text-xs font-medium text-muted-2 backdrop-blur">
              <BadgeCheck className="h-3.5 w-3.5 text-gold" /> Verified listings · Online rent · Live chat
            </p>
            <h1 className="mt-6 max-w-3xl text-[clamp(2.5rem,1.6rem+4.4vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              Rent smarter.<br /><span className="grad-text">Manage effortlessly.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-2">
              One platform for tenants, landlords and admins — from first search to lease, rent and repairs.
            </p>

            {/* Native GET form: works without JavaScript, lands on /properties?search=… */}
            <form action="/properties" method="get" role="search"
              className="glass-strong card-edge mt-10 flex max-w-2xl flex-col gap-2 rounded-3xl p-2 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-center gap-3 px-4 py-2.5">
                <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="sr-only">City or area</span>
                <input name="search" type="search" placeholder="Search by city, area or title" maxLength={80}
                  className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/70" />
              </label>
              <Button type="submit" size="lg" className="sm:px-8"><Search className="h-4 w-4" /> Search homes</Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              <span className="text-muted">Popular:</span>
              {CITIES.slice(0, 5).map((c) => (
                <Link key={c} href={`/properties?city=${encodeURIComponent(c)}`}
                  className="rounded-full border border-ink/10 bg-surface/50 px-3 py-1 text-muted-2 transition hover:border-primary/40 hover:text-primary">{c}</Link>
              ))}
            </div>
          </div>
        </section>

        {/* City marquee */}
        <section aria-label="Cities" className="marquee overflow-hidden border-y border-ink/8 py-5">
          <div className="marquee-track flex gap-12 text-sm font-medium text-muted" aria-hidden>
            {[...CITIES, ...CITIES, ...CITIES, ...CITIES].map((c, i) => (
              <span key={i} className="flex items-center gap-2"><Building2 className="h-4 w-4 text-gold" /> {c}</span>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
          <p className="eyebrow">Everything included</p>
          <h2 className="h-section mt-2 max-w-2xl">The whole rental lifecycle, in one place.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="glass glass-hover card-edge rounded-3xl p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-2">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-6xl px-6 pb-24">
          <p className="eyebrow">Built for every role</p>
          <h2 className="h-section mt-2 max-w-2xl">One account type for each side of the lease.</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {ROLES.map((r, i) => (
              <article key={r.tag} className={`rounded-3xl p-8 ${i === 1 ? "glass-night" : "glass card-edge"}`}>
                <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${i === 1 ? "text-gold" : "text-primary"}`}>{r.tag}</span>
                <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.02em]">{r.title}</h3>
                <ul className="mt-6 space-y-3 text-sm">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2.5"><BadgeCheck className={`mt-0.5 h-4 w-4 shrink-0 ${i === 1 ? "text-gold" : "text-success"}`} /><span className={i === 1 ? "text-white/80" : "text-muted-2"}>{p}</span></li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="glass-night relative overflow-hidden rounded-[2rem] px-8 py-16 text-center sm:px-16">
            <h2 className="mx-auto max-w-2xl text-[clamp(1.8rem,1.2rem+2.4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
              Ready to find — or fill — your next home?
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register"><Button variant="gold" size="lg">Create free account <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/properties"><Button variant="outline" size="lg" className="!border-white/25 !text-white">Browse listings</Button></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
          <Logo size="sm" />
          <p className="flex items-center gap-1.5"><Heart className="h-3.5 w-3.5 text-gold" /> © {new Date().getFullYear()} RentEase</p>
        </div>
      </footer>
    </div>
  );
}
