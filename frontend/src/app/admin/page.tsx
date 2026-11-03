"use client";

import { Building2, FileText, Flag, IndianRupee, ScrollText, ShieldCheck, Users, UserX } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { useAsync } from "@/lib/useAsync";
import { formatMoney, relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/EmptyState";

const axis = { fontSize: 12, fill: "var(--c-muted)" };
const tip = {
  contentStyle: {
    background: "var(--glass-bg-strong)", border: "1px solid var(--glass-border)",
    borderRadius: 12, backdropFilter: "blur(12px)", color: "var(--c-ink)", fontSize: 12,
  },
};

export default function AdminOverviewPage() {
  const { data, error, loading, reload } = useAsync(() => adminApi.stats(), []);

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Platform overview"
        description="Users, listings, money movement and moderation queues across the whole platform." />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={loading} label="Total users" value={data?.totalUsers.toLocaleString()} hint={data ? `${data.tenants} tenants · ${data.landlords} landlords` : undefined} icon={<Users className="h-[18px] w-[18px]" />} />
        <StatCard loading={loading} label="Active listings" value={data?.activeListings.toLocaleString()} hint={data ? `${data.totalProperties} properties in total` : undefined} icon={<Building2 className="h-[18px] w-[18px]" />} tone="gold" />
        <StatCard loading={loading} label="Payment volume (30d)" value={data ? formatMoney(data.monthlyVolume, { compact: true }) : ""} icon={<IndianRupee className="h-[18px] w-[18px]" />} tone="success" />
        <StatCard loading={loading} label="Active leases" value={data?.activeLeases.toLocaleString()} icon={<ScrollText className="h-[18px] w-[18px]" />} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/verifications" className="block">
          <StatCard loading={loading} label="Pending verifications" value={data?.pendingVerifications} hint="Landlords awaiting review" icon={<ShieldCheck className="h-[18px] w-[18px]" />} tone="gold" />
        </Link>
        <Link href="/admin/reports" className="block">
          <StatCard loading={loading} label="Open reports" value={data?.openReports} hint="Complaints & flagged content" icon={<Flag className="h-[18px] w-[18px]" />} tone="danger" />
        </Link>
        <Link href="/admin/applications" className="block">
          <StatCard loading={loading} label="Pending applications" value={data?.pendingApplications} hint="Awaiting landlord decision" icon={<FileText className="h-[18px] w-[18px]" />} />
        </Link>
        <Link href="/admin/users?status=suspended" className="block">
          <StatCard loading={loading} label="Suspended accounts" value={data?.suspendedUsers} icon={<UserX className="h-[18px] w-[18px]" />} tone="danger" />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="glass card-edge rounded-3xl p-6" aria-label="Signups per month">
          <h2 className="text-sm font-semibold text-ink">Signups per month</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.signupsSeries ?? []}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                <Tooltip {...tip} cursor={{ fill: "var(--chart-grid)" }} />
                <Bar dataKey="tenants" stackId="s" fill="var(--c-primary)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="landlords" stackId="s" fill="var(--c-gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" /> Tenants</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-gold" /> Landlords</span>
          </p>
        </section>

        <section className="glass card-edge rounded-3xl p-6" aria-label="Payment volume">
          <h2 className="text-sm font-semibold text-ink">Payment volume</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.volumeSeries ?? []}>
                <defs>
                  <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => formatMoney(v as number, { compact: true })} />
                <Tooltip {...tip} formatter={(v) => formatMoney(Number(v))} />
                <Area type="monotone" dataKey="amount" stroke="var(--c-primary)" strokeWidth={2.5} fill="url(#vol)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="glass card-edge mt-6 rounded-3xl p-6" aria-label="Recent activity">
        <h2 className="text-sm font-semibold text-ink">Recent activity</h2>
        <ul className="mt-4 divide-y divide-ink/8">
          {(data?.recentActivity ?? []).slice(0, 8).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-ink">{a.message}</span>
              <span className="shrink-0 text-xs text-muted">{relativeTime(a.created_at)}</span>
            </li>
          ))}
          {!loading && !data?.recentActivity?.length && <li className="py-6 text-center text-sm text-muted">Nothing yet.</li>}
        </ul>
      </section>
    </div>
  );
}
