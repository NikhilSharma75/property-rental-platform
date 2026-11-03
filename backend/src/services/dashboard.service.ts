import { supabaseAdmin } from "../config/supabase";

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

function sixMonthsAgoISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString();
}

export async function getLandlordStats(landlordId: string) {
  const [{ data: properties }, { data: leases }, { count: pendingApplications }, { data: maintenance }, { data: successfulPayments }, { data: outstandingPayments }] =
    await Promise.all([
      supabaseAdmin.from("properties").select("id, status").eq("landlord_id", landlordId),
      supabaseAdmin.from("leases").select("id, status, lease_end_date, rent_amount").eq("landlord_id", landlordId),
      supabaseAdmin
        .from("rental_applications")
        .select("id, properties!inner(landlord_id)", { count: "exact", head: true })
        .eq("properties.landlord_id", landlordId)
        .eq("status", "PENDING"),
      supabaseAdmin.from("maintenance_requests").select("id, status, priority").eq("landlord_id", landlordId),
      supabaseAdmin
        .from("payments")
        .select("amount, paid_at")
        .eq("landlord_id", landlordId)
        .eq("status", "SUCCEEDED")
        .gte("paid_at", sixMonthsAgoISO()),
      supabaseAdmin.from("payments").select("amount").eq("landlord_id", landlordId).in("status", ["PENDING", "FAILED"]),
    ]);

  const totalProperties = properties?.length ?? 0;
  const activeListings = (properties ?? []).filter((p) => p.status === "AVAILABLE").length;
   // Count rentable "doors": each unit of a multi-unit building, plus each single-unit property.
  const propertyIds = (properties ?? []).map((p) => p.id);
  const { data: unitRows } = propertyIds.length
    ? await supabaseAdmin.from("units").select("id, property_id, status").in("property_id", propertyIds)
    : { data: [] as { id: string; property_id: string; status: string }[] };

  const livePropertyIds = new Set((properties ?? []).filter((p) => p.status !== "DRAFT" && p.status !== "ARCHIVED").map((p) => p.id));
  const units = (unitRows ?? []).filter((u) => livePropertyIds.has(u.property_id) && u.status !== "UNAVAILABLE");
  const buildingIds = new Set((unitRows ?? []).map((u) => u.property_id));
  const singles = (properties ?? []).filter((p) => livePropertyIds.has(p.id) && !buildingIds.has(p.id));

  const doorStatuses = [
    ...singles.map((p) => (p.status === "RENTED" ? "OCCUPIED" : p.status)),
    ...units.map((u) => u.status),
  ];
  const totalUnits = doorStatuses.length;
  const rentedUnits = doorStatuses.filter((s) => s === "OCCUPIED").length;
  const reservedUnits = doorStatuses.filter((s) => s === "RESERVED").length;
  const availableUnits = doorStatuses.filter((s) => s === "AVAILABLE").length;
  const rentedProperties = (properties ?? []).filter((p) => p.status === "RENTED").length;
  const occupancyRate = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 1000) / 10 : 0;

  const activeLeases = (leases ?? []).filter((l) => l.status === "ACTIVE").length;
  const sixtyDaysOut = new Date();
  sixtyDaysOut.setUTCDate(sixtyDaysOut.getUTCDate() + 60);
  const leasesExpiringSoon = (leases ?? []).filter(
    (l) => l.status === "ACTIVE" && l.lease_end_date && new Date(l.lease_end_date) <= sixtyDaysOut
  ).length;

  const openMaintenanceRequests = (maintenance ?? []).filter((m) =>
    ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"].includes(m.status)
  ).length;
  const urgentMaintenanceRequests = (maintenance ?? []).filter(
    (m) => m.priority === "EMERGENCY" && ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"].includes(m.status)
  ).length;

  const monthKeys = lastNMonthKeys(6);
  const revenueByMonth = new Map(monthKeys.map((k) => [k, 0]));
  for (const p of successfulPayments ?? []) {
    if (!p.paid_at) continue;
    const key = p.paid_at.slice(0, 7);
    if (revenueByMonth.has(key)) revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(p.amount));
  }
  const revenueSeries = monthKeys.map((key) => ({ month: monthLabel(key), amount: Math.round((revenueByMonth.get(key) ?? 0) * 100) / 100 }));
  const monthlyRevenue = revenueSeries[revenueSeries.length - 1]?.amount ?? 0;
  const pendingRevenue = (outstandingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

   return {
    totalProperties,
    activeListings,
    rentedProperties,
    occupancyRate,
    totalUnits,
    rentedUnits,
    reservedUnits,
    availableUnits,
    activeLeases,
    pendingApplications: pendingApplications ?? 0,
    openMaintenanceRequests,
    urgentMaintenanceRequests,
    leasesExpiringSoon,
    monthlyRevenue,
    pendingRevenue: Math.round(pendingRevenue * 100) / 100,
    revenueSeries,
  };
}

export async function getTenantStats(tenantId: string) {
  const [{ data: leases }, { data: applications }, { data: maintenance }, { data: successfulPayments }, { data: upcomingPayment }] =
    await Promise.all([
      supabaseAdmin
        .from("leases")
        .select("id, status, rent_amount, lease_end_date, property_id, properties(title, city)")
        .eq("tenant_id", tenantId),
      supabaseAdmin.from("rental_applications").select("id, status").eq("tenant_id", tenantId),
      supabaseAdmin.from("maintenance_requests").select("id, status").eq("tenant_id", tenantId),
      supabaseAdmin
        .from("payments")
        .select("amount, paid_at")
        .eq("tenant_id", tenantId)
        .eq("status", "SUCCEEDED")
        .gte("paid_at", sixMonthsAgoISO()),
      supabaseAdmin
        .from("payments")
        .select("id, amount, currency, due_date, properties(title)")
        .eq("tenant_id", tenantId)
        .in("status", ["PENDING", "FAILED"])
        .order("due_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  const activeLease = (leases ?? []).find((l) => l.status === "ACTIVE") ?? null;
  const daysUntilLeaseExpiry = activeLease?.lease_end_date
    ? Math.max(0, Math.round((new Date(activeLease.lease_end_date).getTime() - Date.now()) / 86_400_000))
    : null;

  const applicationCounts = {
    pending: (applications ?? []).filter((a) => a.status === "PENDING").length,
    approved: (applications ?? []).filter((a) => a.status === "APPROVED").length,
    rejected: (applications ?? []).filter((a) => a.status === "REJECTED").length,
  };

  const openMaintenanceRequests = (maintenance ?? []).filter((m) =>
    ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"].includes(m.status)
  ).length;

  const monthKeys = lastNMonthKeys(6);
  const paidByMonth = new Map(monthKeys.map((k) => [k, 0]));
  for (const p of successfulPayments ?? []) {
    if (!p.paid_at) continue;
    const key = p.paid_at.slice(0, 7);
    if (paidByMonth.has(key)) paidByMonth.set(key, (paidByMonth.get(key) ?? 0) + Number(p.amount));
  }
  const paymentSeries = monthKeys.map((key) => ({ month: monthLabel(key), amount: Math.round((paidByMonth.get(key) ?? 0) * 100) / 100 }));

  return {
    activeLease: activeLease
      ? {
          propertyTitle: (activeLease as any).properties?.title ?? "Property",
          city: (activeLease as any).properties?.city ?? null,
          rentAmount: Number(activeLease.rent_amount),
          leaseEndDate: activeLease.lease_end_date,
          daysUntilLeaseExpiry,
        }
      : null,
    upcomingPayment: upcomingPayment
      ? {
          id: (upcomingPayment as any).id,
          amount: Number((upcomingPayment as any).amount),
          currency: (upcomingPayment as any).currency ?? null,
          dueDate: (upcomingPayment as any).due_date,
          propertyTitle: (upcomingPayment as any).properties?.title ?? "Property",
        }
      : null,
    applicationCounts,
    openMaintenanceRequests,
    paymentSeries,
  };
}