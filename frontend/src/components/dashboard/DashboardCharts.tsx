"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Building2, CalendarClock, DollarSign, Inbox, Wrench } from "lucide-react";
import { dashboardApi, LandlordDashboardStats, TenantDashboardStats } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const money = (n: number, currency?: string | null) => formatMoney(n, { currency: currency ?? undefined });

function MiniStat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "primary" | "gold" | "emerald" | "red";
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/12 text-gold",
    emerald: "bg-emerald-500/10 text-emerald-700",
    red: "bg-red-500/10 text-red-700",
  };
  return (
    <div className="rounded-2xl border border-ink/8 glass p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink/8 glass p-6">
      <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const OCCUPANCY_COLORS = ["var(--c-primary)", "var(--c-gold)", "var(--chart-track)"];

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid var(--glass-border)",
  background: "var(--glass-bg-strong)",
  backdropFilter: "blur(16px)",
  color: "var(--c-ink)",
  fontSize: 13,
  boxShadow: "var(--glass-shadow)",
};

export function LandlordAnalytics() {
  const [stats, setStats] = useState<LandlordDashboardStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .landlordStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) return null; // fails silently -- the rest of the dashboard still renders
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading analytics">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-ink/8 glass" />
        ))}
      </div>
    );
  }

const occupancyData = [
  { name: "Rented", value: stats.rentedUnits },
  { name: "Reserved", value: stats.reservedUnits },
  { name: "Vacant", value: stats.availableUnits },
];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat icon={Building2} label="Properties" value={String(stats.totalProperties)} tone="primary" />
        <MiniStat icon={DollarSign} label="Revenue this month" value={money(stats.monthlyRevenue)} tone="emerald" />
        <MiniStat icon={Inbox} label="Pending applications" value={String(stats.pendingApplications)} tone="gold" />
        <MiniStat
          icon={Wrench}
          label="Open maintenance"
          value={String(stats.openMaintenanceRequests)}
          tone={stats.urgentMaintenanceRequests > 0 ? "red" : "primary"}
        />
        <MiniStat icon={CalendarClock} label="Leases ending soon" value={String(stats.leasesExpiringSoon)} tone="gold" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Revenue" subtitle="Successful payments received, last 6 months">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenueSeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--c-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--c-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatMoney(Number(v), { compact: true })}
                  />

                                  <Tooltip
                    formatter={(value) => [money(Number(value ?? 0)), "Revenue"]}
                    contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--chart-grid)" }}
                  />
                  <Bar dataKey="amount" fill="var(--c-primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          {stats.pendingRevenue > 0 && <p className="mt-2 text-xs text-muted">{money(stats.pendingRevenue)} in unpaid invoices outstanding.</p>}
        </div>

        <ChartCard title="Occupancy" subtitle={`${stats.occupancyRate}% of your units are rented`}>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={occupancyData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                  {occupancyData.map((entry, i) => (
                    <Cell key={entry.name} fill={OCCUPANCY_COLORS[i]} />
                  ))}

                  

                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--chart-grid)" }} />
              </PieChart>
            </ResponsiveContainer>

          </div>
         <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs">
  <span className="flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full bg-primary" />
    Rented ({stats.rentedUnits})
  </span>
  <span className="flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full bg-gold" />
    Reserved ({stats.reservedUnits})
  </span>
  <span className="flex items-center gap-1.5">
    <span className="h-2 w-2 rounded-full bg-ink/15" />
    Vacant ({stats.availableUnits})
  </span>
</div>
        </ChartCard>
      </div>

      {stats.urgentMaintenanceRequests > 0 && (
        <Link
          href="/landlord/maintenance"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 hover:bg-red-100"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {stats.urgentMaintenanceRequests} emergency maintenance {stats.urgentMaintenanceRequests === 1 ? "request needs" : "requests need"} attention.
        </Link>
      )}
    </div>
  );
}

export function TenantAnalytics() {
  const [stats, setStats] = useState<TenantDashboardStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .tenantStats()
      .then((s) => { if (!cancelled) setStats(s); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) return null;
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Loading your overview">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-ink/8 glass" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={DollarSign} label="Monthly rent" value={stats.activeLease ? money(stats.activeLease.rentAmount) : "No active lease"} tone="primary" />
        <MiniStat
          icon={CalendarClock}
          label="Lease ends"
          value={stats.activeLease?.leaseEndDate ? `${stats.activeLease.daysUntilLeaseExpiry}d left` : "—"}
          tone={stats.activeLease?.daysUntilLeaseExpiry != null && stats.activeLease.daysUntilLeaseExpiry <= 30 ? "gold" : "primary"}
        />
        <MiniStat icon={DollarSign} label="Next payment due" value={stats.upcomingPayment ? money(stats.upcomingPayment.amount, stats.upcomingPayment.currency) : "None due"} tone={stats.upcomingPayment ? "gold" : "emerald"} />
        <MiniStat icon={Wrench} label="Open maintenance" value={String(stats.openMaintenanceRequests)} tone="primary" />
      </div>

      <ChartCard title="Your rent payments" subtitle="Successful payments, last 6 months">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.paymentSeries} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--c-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--c-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoney(Number(v), { compact: true })} />
                        <Tooltip
                formatter={(value) => [money(Number(value ?? 0)), "Paid"]}
                contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--chart-grid)" }}
              />
              <Bar dataKey="amount" fill="var(--c-primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {stats.upcomingPayment && (
        <Link
          href="/dashboard/payments"
          className="flex items-center gap-2 rounded-2xl border border-gold/30 bg-gold/8 px-4 py-3 text-sm text-gold-ink hover:bg-gold/12"
        >
          <DollarSign className="h-4 w-4 shrink-0" />
          {money(stats.upcomingPayment.amount, stats.upcomingPayment.currency)} due for {stats.upcomingPayment.propertyTitle}
          {stats.upcomingPayment.dueDate ? ` on ${new Date(stats.upcomingPayment.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}.
        </Link>
      )}
    </div>
  );
}