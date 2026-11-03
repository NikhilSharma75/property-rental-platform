import { LIST_HARD_CAP } from "../config/limits";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { Lease, LeaseStatus } from "../types";
import * as notificationService from "./notification.service";

export interface LeaseInput {
  applicationId: string;
  rentAmount: number;
  securityDeposit: number;
  leaseStartDate: string;
  leaseDurationMonths: number;
  terms?: string;
}

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

const ALLOWED_TRANSITIONS: Record<LeaseStatus, LeaseStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["TERMINATED", "EXPIRED"],
  EXPIRED: [],
  TERMINATED: [],
  CANCELLED: [],
};

const MS_DAY = 86_400_000;
const MAX_PAST_START_DAYS = 7;
const MAX_FUTURE_START_DAYS = 365;

/** start + N months in UTC, clamped to the last day of the target month (Jan 31 + 1 month = Feb 28/29, not Mar 2/3). */
export function addMonthsClamped(start: Date, months: number): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(start.getUTCDate(), lastDay)));
}

async function getLeaseOrThrow(id: string): Promise<Lease> {
  const { data, error } = await supabaseAdmin.from("leases").select("*").eq("id", id).maybeSingle();
  if (error) throw httpError(error.message, 500);
  if (!data) throw httpError("Lease not found.", 404);
  return data as Lease;
}

/** Money is compared in cents so rounding can never cause a false "unpaid". */
const toCents = (n: unknown) => Math.round(Number(n) * 100);

/** True when no deposit is due, or successful DEPOSIT payments cover the lease's security deposit. */
export async function isDepositSettled(lease: { id: string; security_deposit: number | string }): Promise<boolean> {
  const required = toCents(lease.security_deposit);
  if (!(required > 0)) return true;
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("lease_id", lease.id)
    .eq("type", "DEPOSIT")
    .eq("status", "SUCCEEDED");
  if (error) throw httpError(error.message, 500);
  const paid = (data ?? []).reduce((sum, p) => sum + toCents(p.amount), 0);
  return paid >= required;
}

/**
 * Activates a DRAFT lease once BOTH parties have signed AND the deposit is settled.
 * Safe to call from several places (signing, the payment webhook): the update is guarded on status = DRAFT,
 * so it happens only once. Returns the activated lease, or null when it isn't ready (or was already activated).
 */
export async function activateLeaseIfReady(leaseId: string): Promise<Lease | null> {
  const lease = await getLeaseOrThrow(leaseId);
  if (lease.status !== "DRAFT" || !(lease.signed_by_tenant && lease.signed_by_landlord)) return null;
  if (!(await isDepositSettled(lease))) return null;

  const { data: activated, error } = await supabaseAdmin
    .from("leases")
    .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
    .eq("id", leaseId)
    .eq("status", "DRAFT")
    .select()
    .maybeSingle();
  if (error) throw httpError("Failed to activate lease.", 500);
  if (!activated) return null;

  // Reserved -> occupied (unit) or reserved -> rented (single-unit property).
  const { error: occError } = await supabaseAdmin.rpc("mark_lease_occupied", { p_lease: leaseId });
  if (occError) throw httpError("Lease activated, but availability could not be updated.", 500);

  const { data: property } = await supabaseAdmin
    .from("properties").select("title").eq("id", lease.property_id).maybeSingle();
  notificationService
    .notifyLeaseActivated(lease.tenant_id, lease.landlord_id, property?.title ?? "your property")
    .catch(() => {});
  return activated as Lease;
}

export async function createLease(landlordId: string, input: LeaseInput): Promise<Lease> {
  const notFound = () => httpError("Application not found.", 404);

  // 1. Load the application and its property.
  const { data: application, error: appError } = await supabaseAdmin
    .from("rental_applications")
    .select("id, status, property_id, tenant_id, unit_id, expires_at")
    .eq("id", input.applicationId)
    .maybeSingle();
  if (appError) throw httpError(appError.message, 500);
  if (!application) throw notFound();

  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, landlord_id, title, status")
    .eq("id", application.property_id)
    .maybeSingle();
  if (propertyError) throw httpError(propertyError.message, 500);

  // 2. Ownership comes FIRST. "Not yours" looks exactly like "doesn't exist", so IDs can't be probed.
  if (!property || property.landlord_id !== landlordId) throw notFound();

  // 3. State checks.
  if (application.status !== "APPROVED") {
    throw httpError("A lease can only be created from an approved application.", 409);
  }
  if (application.expires_at && new Date(application.expires_at).getTime() < Date.now()) {
    throw httpError("This approval has expired. Ask the tenant to re-apply.", 409);
  }
  if (property.status === "ARCHIVED" || property.status === "DRAFT") {
    throw httpError("This property isn't active. Restore or publish it before creating a lease.", 409);
  }

  // 4. The applicant must still be an active tenant account.
  const { data: tenant } = await supabaseAdmin
    .from("users").select("id, role, is_suspended").eq("id", application.tenant_id).maybeSingle();
  if (!tenant || tenant.role !== "TENANT") throw httpError("The applicant's account is no longer available.", 409);
  if (tenant.is_suspended) throw httpError("The applicant's account is suspended, so a lease can't be created.", 409);

  // 4b. The approval must have reserved this unit / property for THIS application.
  let unitId: string | null = null;
  if (application.unit_id) {
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select("id, status, reserved_application_id")
      .eq("id", application.unit_id)
      .eq("property_id", property.id)
      .maybeSingle();
    if (unitError) throw httpError(unitError.message, 500);
    if (!unit || unit.status !== "RESERVED" || unit.reserved_application_id !== application.id) {
      throw httpError("The reservation for this unit is no longer valid (it may have expired). Ask the tenant to re-apply.", 409);
    }
    unitId = unit.id;
  } else if (property.status !== "RESERVED") {
    throw httpError("The reservation for this property is no longer valid (it may have expired). Ask the tenant to re-apply.", 409);
  }

  // 5. One live lease per application, and per unit (or per property when it has no units).
  //    The unique indexes are the real guarantee; these checks give friendlier messages.
  const live = ["DRAFT", "ACTIVE"];
  const [{ count: forApplication }, { count: forTarget }] = await Promise.all([
    supabaseAdmin.from("leases").select("id", { count: "exact", head: true })
      .eq("application_id", application.id).in("status", live),
    supabaseAdmin.from("leases").select("id", { count: "exact", head: true })
      .eq(unitId ? "unit_id" : "property_id", unitId ?? property.id).in("status", live),
  ]);
  if ((forApplication ?? 0) > 0) throw httpError("A lease already exists for this application.", 409);
  if ((forTarget ?? 0) > 0) {
    throw httpError(
      unitId ? "This unit already has a draft or active lease." : "This property already has a draft or active lease.",
      409
    );
  }

  const startDate = new Date(`${input.leaseStartDate}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime())) throw httpError("Enter a valid lease start date.", 400);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (startDate.getTime() < todayUtc - MAX_PAST_START_DAYS * MS_DAY) {
    throw httpError(`The lease start date can't be more than ${MAX_PAST_START_DAYS} days in the past.`, 400);
  }
  if (startDate.getTime() > todayUtc + MAX_FUTURE_START_DAYS * MS_DAY) {
    throw httpError("The lease start date can't be more than a year from now.", 400);
  }
  const endDate = addMonthsClamped(startDate, input.leaseDurationMonths);

  const { data, error } = await supabaseAdmin
    .from("leases")
    .insert({
      application_id: application.id,
      property_id: property.id,
      ...(unitId ? { unit_id: unitId } : {}),
      tenant_id: application.tenant_id,
      landlord_id: landlordId,
      rent_amount: input.rentAmount,
      security_deposit: input.securityDeposit,
      lease_start_date: input.leaseStartDate,
      lease_end_date: endDate.toISOString().slice(0, 10),
      lease_duration_months: input.leaseDurationMonths,
      terms: input.terms ?? null,
    })
    .select()
    .single();

  // 23505 = unique violation from the live-lease indexes (two requests raced).
  if (error?.code === "23505") {
    throw httpError("A lease already exists for this application, unit or property.", 409);
  }
  if (error || !data) throw httpError("Failed to create lease.", 500);

  // Invoice the security deposit right away. The lease can't activate until it is paid.
  // If this insert fails, the landlord can still create the deposit invoice by hand (allowed on draft leases).
  if (toCents(input.securityDeposit) > 0) {
    const { error: depositError } = await supabaseAdmin.from("payments").insert({
      lease_id: data.id,
      property_id: property.id,
      tenant_id: application.tenant_id,
      landlord_id: landlordId,
      type: "DEPOSIT",
      description: "Security deposit",
      period: "deposit",
      amount: input.securityDeposit,
      currency: env.defaultCurrency,
      due_date: input.leaseStartDate,
      created_by: landlordId,
    });
    if (depositError) {
      console.error("Could not create the deposit invoice for lease", data.id, depositError.message);
    }
  }

  notificationService.notifyLeaseCreated(application.tenant_id, property.title).catch(() => {});
  return data as Lease;
}

export async function getLeaseDetail(id: string, requesterId: string, role: string): Promise<Lease> {
  const lease = await getLeaseOrThrow(id);
  if (role !== "ADMIN" && lease.tenant_id !== requesterId && lease.landlord_id !== requesterId) {
    throw httpError("You do not have access to this lease.", 403);
  }
  return lease;
}

export async function listMyLeasesTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("leases")
    .select("*, properties(title, city, images), units(unit_label)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (error) throw httpError(error.message, 500);
  return data ?? [];
}

export async function listMyLeasesLandlord(landlordId: string) {
  const { data, error } = await supabaseAdmin
    .from("leases")
    .select("*, properties(title, city, images), units(unit_label), users!leases_tenant_id_fkey(full_name, email, phone)")
    .eq("landlord_id", landlordId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (error) throw httpError(error.message, 500);
  return data ?? [];
}

export async function updateLeaseStatus(id: string, landlordId: string, status: LeaseStatus): Promise<Lease> {
  const lease = await getLeaseOrThrow(id);
  if (lease.landlord_id !== landlordId) {
    throw httpError("You do not manage this lease.", 403);
  }
  if (!ALLOWED_TRANSITIONS[lease.status].includes(status)) {
    throw httpError(`Cannot move a lease from ${lease.status} to ${status}.`, 409);
  }
  // A lease only becomes ACTIVE once BOTH parties have signed (signLease does that). Otherwise a landlord
  // could activate a lease - and start invoicing - without the tenant's consent.
  if (status === "ACTIVE" && !(lease.signed_by_tenant && lease.signed_by_landlord)) {
    throw httpError("Both the tenant and the landlord must sign before a lease can be activated.", 409);
  }
  // ...and only once the security deposit has been paid.
  if (status === "ACTIVE" && !(await isDepositSettled(lease))) {
    throw httpError("The security deposit must be paid before the lease can be activated.", 409);
  }

  // Guard on the current status so two simultaneous requests can't both apply the transition.
  const { data, error } = await supabaseAdmin
    .from("leases")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", lease.status)
    .select()
    .maybeSingle();

  if (error) throw httpError("Failed to update lease status.", 500);
  if (!data) throw httpError("This lease was just changed by someone else. Refresh and try again.", 409);

  // Keep unit / property availability in sync with the lease.
  if (status === "ACTIVE") {
    const { error: e } = await supabaseAdmin.rpc("mark_lease_occupied", { p_lease: id });
    if (e) throw httpError("Lease updated, but availability could not be refreshed.", 500);
  } else if (status === "TERMINATED" || status === "EXPIRED") {
    const { error: e } = await supabaseAdmin.rpc("release_lease_target", { p_lease: id });
    if (e) throw httpError("Lease updated, but availability could not be refreshed.", 500);
  } else if (status === "CANCELLED") {
    // Landlord cancelled a draft: free the reservation and close the application.
    const { error: e } = lease.application_id
      ? await supabaseAdmin.rpc("release_application_hold", { p_app: lease.application_id, p_new_status: "REJECTED" })
      : await supabaseAdmin.rpc("release_lease_target", { p_lease: id });
    if (e) throw httpError("Lease cancelled, but availability could not be refreshed.", 500);

    if (lease.application_id) {
      const { data: property } = await supabaseAdmin
        .from("properties").select("title").eq("id", lease.property_id).maybeSingle();
      notificationService
        .notifyReservationReleased(lease.tenant_id, lease.landlord_id, property?.title ?? "your property", "LEASE_CANCELLED", lease.application_id)
        .catch(() => {});
    }
  }

  return data as Lease;
}

export async function signLease(id: string, userId: string): Promise<Lease> {
  const lease = await getLeaseOrThrow(id);
  const isTenant = lease.tenant_id === userId;
  const isLandlord = lease.landlord_id === userId;
  if (!isTenant && !isLandlord) {
    throw httpError("You are not a party to this lease.", 403);
  }
  if (lease.status !== "DRAFT") {
    throw httpError("Only draft leases can be signed.", 409);
  }

  // Step 1: record only MY signature (a single-column write can't clobber the other party's).
  const mine = isTenant ? { signed_by_tenant: true } : { signed_by_landlord: true };
  const { error: signError } = await supabaseAdmin
    .from("leases").update({ ...mine, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "DRAFT");
  if (signError) throw httpError("Failed to sign lease.", 500);

  // Step 2: activate only when everything required is in place (both signatures AND the deposit paid).
  // Otherwise the lease stays DRAFT, and paying the deposit will activate it.
  const activated = await activateLeaseIfReady(id);
  return activated ?? (await getLeaseOrThrow(id));
}

