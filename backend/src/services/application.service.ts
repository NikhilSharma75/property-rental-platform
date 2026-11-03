import { LIST_HARD_CAP } from "../config/limits";
import { supabaseAdmin } from "../config/supabase";
import { ApplicationStatus, RentalApplication } from "../types";
import * as storageService from "./storage.service";
import * as messagingService from "./messaging.service";
import * as notificationService from "./notification.service";
import { mapRpcError } from "../utils/rpcErrors";

const APPLICATION_HOLD_DAYS = 14; // how long a PENDING application stays valid
const APPROVAL_HOLD_DAYS = 7; // how long an APPROVED application holds the unit before a lease must be created/signed

export interface ApplicationInput {
  propertyId: string;
  desiredMoveInDate: string;
  leaseDurationMonths: number;
  monthlyIncome?: number;
  employmentStatus?: string;
  employerName?: string;
  additionalNotes?: string;
  unitId?: string;
}

const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export async function createApplication(tenantId: string, input: ApplicationInput): Promise<RentalApplication> {
  // property must exist and be available
  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, status, landlord_id, title")
    .eq("id", input.propertyId)
    .maybeSingle();

  if (propertyError) throw httpError(propertyError.message, 500);
  if (!property) throw httpError("Property not found.", 404);
  if (property.status !== "AVAILABLE") {
    throw httpError("This property is not currently accepting applications.", 409);
  }
  if (property.landlord_id === tenantId) {
    throw httpError("You cannot apply to your own property.", 400);
  }

  // Multi-unit buildings: the tenant must pick one AVAILABLE unit.
  const { count: unitCount, error: unitCountError } = await supabaseAdmin
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("property_id", property.id);
  if (unitCountError) throw httpError(unitCountError.message, 500);

  let unitId: string | null = null;
  if ((unitCount ?? 0) > 0) {
    if (!input.unitId) throw httpError("Choose a unit to apply for.", 400);
    const { data: unit, error: unitError } = await supabaseAdmin
      .from("units")
      .select("id, status")
      .eq("id", input.unitId)
      .eq("property_id", property.id)
      .maybeSingle();
    if (unitError) throw httpError(unitError.message, 500);
    if (!unit) throw httpError("That unit doesn't belong to this property.", 400);
    if (unit.status !== "AVAILABLE") throw httpError("That unit is not available.", 409);
    unitId = unit.id;
  } else if (input.unitId) {
    throw httpError("This property has no units.", 400);
  }

  const { data, error } = await supabaseAdmin
    .from("rental_applications")
    .insert({
      property_id: input.propertyId,
      unit_id: unitId,
      tenant_id: tenantId,
      desired_move_in_date: input.desiredMoveInDate,
      lease_duration_months: input.leaseDurationMonths,
      monthly_income: input.monthlyIncome ?? null,
      employment_status: input.employmentStatus ?? null,
      employer_name: input.employerName ?? null,
      additional_notes: input.additionalNotes ?? null,
      expires_at: new Date(Date.now() + APPLICATION_HOLD_DAYS * 86_400_000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") { // unique_violation — duplicate pending application
      throw httpError("You already have a pending application for this property or unit.", 409);
    }
    throw httpError(error.message, 500);
  }
  notificationService.notifyApplicationSubmitted(property.landlord_id, tenantId, property.title).catch(() => {});
  return data as RentalApplication;
}

export async function addApplicationDocuments(
  applicationId: string,
  tenantId: string,
  files: { idProof?: Express.Multer.File[]; incomeProof?: Express.Multer.File[]; referenceLetter?: Express.Multer.File[] }
) {
  const app = await getApplicationOrThrow(applicationId);
  if (app.tenant_id !== tenantId) {
    throw httpError("You can only upload documents to your own application.", 403);
  }

  const uploads = [
    ...(files.idProof ?? []),
    ...(files.incomeProof ?? []),
    ...(files.referenceLetter ?? []),
  ];

  const results = [];
  for (const file of uploads) {
    const doc = await storageService.uploadDocument({
      ownerId: tenantId,
      category: "APPLICATION_DOCUMENT",
      relatedId: applicationId,
      file,
    });
    results.push(doc);
  }
  return results;
}

async function getApplicationOrThrow(id: string): Promise<RentalApplication> {
  const { data, error } = await supabaseAdmin
    .from("rental_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw httpError(error.message, 500);
  if (!data) throw httpError("Application not found.", 404);
  return data as RentalApplication;
}

export async function getApplicationDetail(applicationId: string, requesterId: string, requesterRole: string) {
  const app = await getApplicationOrThrow(applicationId);

  // authorization: the tenant who applied, OR the landlord who owns the property, OR admin
  if (requesterRole !== "ADMIN" && app.tenant_id !== requesterId) {
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("landlord_id")
      .eq("id", app.property_id)
      .maybeSingle();
    if (!property || property.landlord_id !== requesterId) {
      throw httpError("You do not have access to this application.", 403);
    }
  }

  const docs = await storageService.listDocuments({ category: "APPLICATION_DOCUMENT", relatedId: applicationId });
  const documentsWithUrls = await Promise.all(
    docs.map(async (d) => ({ ...d, url: await storageService.getSignedUrl(d) }))
  );

  return { application: app, documents: documentsWithUrls };
}

export async function listMyApplications(tenantId: string): Promise<RentalApplication[]> {
  const { data, error } = await supabaseAdmin
    .from("rental_applications")
    .select("*, properties(title, city, rent_amount, images)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (error) throw httpError(error.message, 500);
  return (data ?? []) as any;
}

export async function listLandlordApplications(
  landlordId: string,
  status?: ApplicationStatus,
  propertyId?: string
): Promise<any[]> {
  let query = supabaseAdmin
    .from("rental_applications")
    .select("*, properties!inner(title, city, landlord_id, rent_amount, images), users!rental_applications_tenant_id_fkey(full_name, email, phone)")
    .eq("properties.landlord_id", landlordId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);

  if (status) query = query.eq("status", status);
  if (propertyId) query = query.eq("property_id", propertyId);

  const { data, error } = await query;
  if (error) throw httpError(error.message, 500);
  return data ?? [];
}

export async function withdrawApplication(applicationId: string, tenantId: string): Promise<RentalApplication> {
  const app = await getApplicationOrThrow(applicationId);
  if (app.tenant_id !== tenantId) {
    throw httpError("You can only withdraw your own application.", 403);
  }
  if (app.status !== "PENDING" && app.status !== "APPROVED") {
    throw httpError("Only pending or approved applications can be withdrawn.", 409);
  }

  // One atomic database function: cancels any draft lease, frees the unit/property, marks WITHDRAWN.
  const { error } = await supabaseAdmin.rpc("release_application_hold", {
    p_app: applicationId,
    p_new_status: "WITHDRAWN",
  });
  if (error) throw mapRpcError(error.message);

  // Only an APPROVED application held a reservation, so only then is there anything to tell the landlord.
  if (app.status === "APPROVED") {
    const { data: property } = await supabaseAdmin
      .from("properties").select("title, landlord_id").eq("id", app.property_id).maybeSingle();
    if (property) {
      notificationService
        .notifyReservationReleased(app.tenant_id, property.landlord_id, property.title, "TENANT_WITHDREW", applicationId)
        .catch(() => {});
    }
  }

  return getApplicationOrThrow(applicationId);
}

export async function updateApplicationStatus(
  applicationId: string,
  landlordId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string
): Promise<RentalApplication> {
  const app = await getApplicationOrThrow(applicationId);

  const { data: property, error: propertyError } = await supabaseAdmin
    .from("properties")
    .select("id, landlord_id, status, title")
    .eq("id", app.property_id)
    .single();

  if (propertyError || !property) throw httpError("Property not found.", 404);
  if (property.landlord_id !== landlordId) {
    throw httpError("You do not manage this property.", 403);
  }
  if (app.status !== "PENDING") {
    throw httpError("Only pending applications can be reviewed.", 409);
  }

  // ---- REJECT -------------------------------------------------------------
  if (status === "REJECTED") {
    if (!rejectionReason) throw httpError("A rejection reason is required.", 400);

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("rental_applications")
      .update({
        status: "REJECTED",
        rejection_reason: rejectionReason,
        reviewed_by: landlordId,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", applicationId)
      .eq("status", "PENDING") // guard: only if it is still pending (stops a double-review race)
      .select()
      .maybeSingle();

    if (error) throw httpError("Failed to update application.", 500);
    if (!data) throw httpError("Only pending applications can be reviewed.", 409);

    // Tell the tenant their application was declined, with the landlord's reason.
    notificationService
      .notifyApplicationRejected(app.tenant_id, property.title, rejectionReason, applicationId)
      .catch(() => {});

    return data as RentalApplication;
  }

  // ---- APPROVE ------------------------------------------------------------
  // One atomic database function: locks the application, reserves the unit/property,
  // marks the application APPROVED and rejects competing pending applications.
  const { data, error } = await supabaseAdmin.rpc("approve_application", {
    p_app: applicationId,
    p_landlord: landlordId,
    p_hold_days: APPROVAL_HOLD_DAYS,
  });
  if (error) throw mapRpcError(error.message);

  const updated = (Array.isArray(data) ? data[0] : data) as RentalApplication | null;
  if (!updated) throw httpError("Failed to update application.", 500);

  // Opening the conversation is a convenience, not part of the approval itself: if it fails,
  // the tenant must still get their approval instead of a 500 for an already-committed change.
  try {
    await messagingService.getOrCreateConversation(app.tenant_id, landlordId, app.property_id, app.id);
  } catch (err) {
    console.error("Application approved, but the conversation could not be created:", (err as Error).message);
  }
  notificationService.notifyApplicationApproved(app.tenant_id, property.title, applicationId).catch(() => {});

  return updated;
}
