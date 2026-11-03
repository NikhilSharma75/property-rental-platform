import { LIST_HARD_CAP } from "../config/limits";
import { supabaseAdmin } from "../config/supabase";
import { MaintenanceRequest, MaintenanceStatus } from "../types";
import * as storageService from "./storage.service";
import * as notificationService from "./notification.service";

export interface MaintenanceInput {
  propertyId: string;
  category: string;
  priority: string;
  title: string;
  description: string;
}

const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  SUBMITTED: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

async function getOrThrow(id: string): Promise<MaintenanceRequest> {
  const { data, error } = await supabaseAdmin.from("maintenance_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) throw Object.assign(new Error("Maintenance request not found."), { statusCode: 404 });
  return data as MaintenanceRequest;
}

export async function createRequest(tenantId: string, input: MaintenanceInput): Promise<MaintenanceRequest> {
  const { data: lease, error: leaseError } = await supabaseAdmin
    .from("leases")
    .select("id, landlord_id")
    .eq("property_id", input.propertyId)
    .eq("tenant_id", tenantId)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (leaseError) throw Object.assign(new Error(leaseError.message), { statusCode: 500 });
  if (!lease) throw Object.assign(new Error("You need an active lease on this property to file a maintenance request."), { statusCode: 403 });

  const { data, error } = await supabaseAdmin
    .from("maintenance_requests")
    .insert({
      property_id: input.propertyId,
      tenant_id: tenantId,
      landlord_id: lease.landlord_id,
      lease_id: lease.id,
      category: input.category,
      priority: input.priority,
      title: input.title,
      description: input.description,
    })
    .select()
    .single();

  if (error || !data) throw Object.assign(new Error("Failed to create request."), { statusCode: 500 });

    const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", input.propertyId).maybeSingle();
  notificationService.notifyMaintenanceCreated(lease.landlord_id, property?.title ?? "your property", input.title, input.priority).catch(() => {});
  return data as MaintenanceRequest;
}

export async function addPhotos(id: string, tenantId: string, files: Express.Multer.File[]) {
  const req = await getOrThrow(id);
  if (req.tenant_id !== tenantId) throw Object.assign(new Error("Not your request."), { statusCode: 403 });
  const results = [];
  for (const file of files) {
    results.push(await storageService.uploadDocument({ ownerId: tenantId, category: "MAINTENANCE_ATTACHMENT", relatedId: id, file }));
  }
  return results;
}

export async function getDetail(id: string, requesterId: string, role: string) {
  const req = await getOrThrow(id);
  if (role !== "ADMIN" && req.tenant_id !== requesterId && req.landlord_id !== requesterId) {
    throw Object.assign(new Error("You do not have access to this request."), { statusCode: 403 });
  }
  const photos = await storageService.listDocuments({ category: "MAINTENANCE_ATTACHMENT", relatedId: id });
  const withUrls = await Promise.all(photos.map(async (p) => ({ ...p, url: await storageService.getSignedUrl(p) })));
  return { request: req, photos: withUrls };
}

/** Maintenance requests only carry lease_id, so look up each lease's unit label in one extra query. */
async function attachUnitLabels<T extends { lease_id: string | null }>(rows: T[]) {
  const leaseIds = [...new Set(rows.map((r) => r.lease_id).filter(Boolean) as string[])];
  if (leaseIds.length === 0) return rows.map((r) => ({ ...r, unit_label: null as string | null }));
  const { data } = await supabaseAdmin.from("leases").select("id, units(unit_label)").in("id", leaseIds);
  const labels = new Map((data ?? []).map((l: any) => [l.id as string, (l.units?.unit_label ?? null) as string | null]));
  return rows.map((r) => ({ ...r, unit_label: r.lease_id ? labels.get(r.lease_id) ?? null : null }));
}

export async function listMineTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("maintenance_requests")
    .select("*, properties(title, city, images)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return attachUnitLabels(data ?? []);
}

export async function listForLandlord(landlordId: string, status?: MaintenanceStatus) {
  let query = supabaseAdmin
    .from("maintenance_requests")
    .select("*, properties(title, city), users!maintenance_requests_tenant_id_fkey(full_name, email, phone)")
    .eq("landlord_id", landlordId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return attachUnitLabels(data ?? []);
}




export async function updateStatus(id: string, landlordId: string, status: MaintenanceStatus, notes?: string) {
  const req = await getOrThrow(id);
  if (req.landlord_id !== landlordId) throw Object.assign(new Error("You do not manage this request."), { statusCode: 403 });
  if (!ALLOWED_TRANSITIONS[req.status].includes(status)) {
    throw Object.assign(new Error(`Cannot move from ${req.status} to ${status}.`), { statusCode: 409 });
  }
  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (notes) update.landlord_notes = notes;
  if (status === "COMPLETED") update.resolved_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin.from("maintenance_requests").update(update).eq("id", id).select().single();
  if (error || !data) throw Object.assign(new Error("Failed to update request."), { statusCode: 500 });

  const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", data.property_id).maybeSingle();
  notificationService.notifyMaintenanceStatusUpdated(data.tenant_id, property?.title ?? "your property", data.title, status).catch(() => {});

  return data as MaintenanceRequest;
}



export async function assign(id: string, landlordId: string, assignedTo: string) {
  const req = await getOrThrow(id);
  if (req.landlord_id !== landlordId) throw Object.assign(new Error("You do not manage this request."), { statusCode: 403 });
  const { data, error } = await supabaseAdmin
    .from("maintenance_requests")
    .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error || !data) throw Object.assign(new Error("Failed to assign request."), { statusCode: 500 });
  return data as MaintenanceRequest;
}

export async function cancel(id: string, tenantId: string) {
  const req = await getOrThrow(id);
  if (req.tenant_id !== tenantId) throw Object.assign(new Error("Not your request."), { statusCode: 403 });
  if (req.status !== "SUBMITTED") throw Object.assign(new Error("Only a submitted request can be cancelled."), { statusCode: 409 });
  const { data, error } = await supabaseAdmin
    .from("maintenance_requests").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error || !data) throw Object.assign(new Error("Failed to cancel request."), { statusCode: 500 });
  return data as MaintenanceRequest;
}