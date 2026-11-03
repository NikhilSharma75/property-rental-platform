import { LIST_HARD_CAP } from "../config/limits";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../config/supabase";
import { Property, PropertyStatus, PropertyType } from "../types";

const PROPERTY_IMAGE_BUCKET = "property-images";
const MAX_IMAGES_PER_PROPERTY = 8;

export interface PropertyInput {
  title: string;
  description?: string | null;
  propertyType: PropertyType;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  bedrooms: number;
  bathrooms: number;
  areaSqft?: number | null;
  rentAmount: number;
  depositAmount?: number | null;
  amenities?: string[];
  status?: PropertyStatus;
  latitude?: number | null;
  longitude?: number | null;
}

function toRow(input: Partial<PropertyInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.title !== undefined) row.title = input.title;
  if (input.description !== undefined) row.description = input.description;
  if (input.propertyType !== undefined) row.property_type = input.propertyType;
  if (input.addressLine1 !== undefined) row.address_line1 = input.addressLine1;
  if (input.addressLine2 !== undefined) row.address_line2 = input.addressLine2;
  if (input.city !== undefined) row.city = input.city;
  if (input.state !== undefined) row.state = input.state;
  if (input.postalCode !== undefined) row.postal_code = input.postalCode;
  if (input.country !== undefined) row.country = input.country;
  if (input.bedrooms !== undefined) row.bedrooms = input.bedrooms;
  if (input.bathrooms !== undefined) row.bathrooms = input.bathrooms;
  if (input.areaSqft !== undefined) row.area_sqft = input.areaSqft;
  if (input.rentAmount !== undefined) row.rent_amount = input.rentAmount;
  if (input.depositAmount !== undefined) row.deposit_amount = input.depositAmount;
  if (input.amenities !== undefined) row.amenities = input.amenities;
  if (input.status !== undefined) row.status = input.status;
  if (input.latitude !== undefined) row.latitude = input.latitude;
  if (input.longitude !== undefined) row.longitude = input.longitude;
  return row;
}

function notFound(): never {
  throw Object.assign(new Error("Property not found."), { statusCode: 404 });
}


/** A listing can only go public once the landlord is VERIFIED. Drafts are always allowed. */
async function assertLandlordVerified(landlordId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("landlord_verifications")
    .select("status")
    .eq("user_id", landlordId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (data?.status !== "VERIFIED") {
    throw Object.assign(
      new Error("Your landlord account must be verified before you can publish a listing. You can keep working on drafts in the meantime."),
      { statusCode: 403 }
    );
  }
}



export async function listProperties(landlordId: string): Promise<Property[]> {
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select("*")
    .eq("landlord_id", landlordId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return (data ?? []) as Property[];
}

export async function getProperty(landlordId: string, propertyId: string): Promise<Property> {
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("landlord_id", landlordId)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) notFound();
  return data as Property;
}

export async function createProperty(landlordId: string, input: PropertyInput): Promise<Property> {
  const row = toRow(input);
  row.landlord_id = landlordId;
   if (!row.status) row.status = "DRAFT";
  // New listings start as DRAFT or AVAILABLE only. RESERVED/RENTED come from applications, ARCHIVED from archiving.
  if (row.status !== "DRAFT" && row.status !== "AVAILABLE") {
    throw Object.assign(new Error("A new property can only be created as a draft or as available."), { statusCode: 400 });
  }
  if (row.status === "AVAILABLE") await assertLandlordVerified(landlordId);

  const { data, error } = await supabaseAdmin.from("properties").insert(row).select().single();
  if (error || !data) {
    throw Object.assign(new Error(error?.message ?? "Failed to create property."), { statusCode: 500 });
  }
  return data as Property;
}

const LIVE_LEASE_STATUSES = ["DRAFT", "ACTIVE"];

/** True when the property has a draft or active lease. */
export async function hasLiveLease(propertyId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .in("status", LIVE_LEASE_STATUSES);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return (count ?? 0) > 0;
}

/**
 * True when an approved application is still holding this property/one of its units, or a unit is
 * reserved/occupied. Archiving in that state would strand a tenant who is waiting for a lease.
 */
export async function hasActiveReservation(propertyId: string): Promise<boolean> {
  const [{ count: approved }, { count: busyUnits }] = await Promise.all([
    supabaseAdmin
      .from("rental_applications")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "APPROVED"),
    supabaseAdmin
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .in("status", ["RESERVED", "OCCUPIED"]),
  ]);
  return (approved ?? 0) > 0 || (busyUnits ?? 0) > 0;
}

export async function updateProperty(
  landlordId: string,
  propertyId: string,
  input: Partial<PropertyInput>
): Promise<Property> {
  const patch = toRow(input);
  if (Object.keys(patch).length === 0) return getProperty(landlordId, propertyId);

  // Landlords may only move a listing between DRAFT and AVAILABLE. RESERVED is set by an approval,
  // RENTED by lease activation and ARCHIVED by the archive action - none of those may be set here.
  if (input.status !== undefined) {
    const current = await getProperty(landlordId, propertyId);
    if (current.status === "ARCHIVED") {
      throw Object.assign(new Error("This property is archived. Restore it before changing its status."), { statusCode: 409 });
    }
    if (input.status !== current.status) {
      // RESERVED belongs to an approved application: changing it here would release a tenant's hold
      // without cancelling the application. Withdrawal/expiry (or admin moderation) release it instead.
      if (current.status === "RESERVED") {
        throw Object.assign(
          new Error("This property is reserved for an approved applicant. Withdraw or expire that application before changing its status."),
          { statusCode: 409 }
        );
      }
      if (input.status === "ARCHIVED") {
        throw Object.assign(new Error("Use the archive action to archive a property."), { statusCode: 400 });
      }
      if (input.status === "RESERVED") {
        throw Object.assign(new Error("A property becomes reserved when you approve an application."), { statusCode: 400 });
      }
      if (input.status === "RENTED") {
        throw Object.assign(new Error("A property becomes rented when an application is approved and the lease is activated."), { statusCode: 400 });
      }
      if (input.status === "AVAILABLE") await assertLandlordVerified(landlordId);
      if (current.status === "RENTED" && (await hasLiveLease(propertyId))) {
        throw Object.assign(new Error("End or cancel the active lease before changing this property's status."), { statusCode: 409 });
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("landlord_id", landlordId)
    .select()
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) notFound();
  return data as Property;
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `${PROPERTY_IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

/**
 * Properties are never hard-deleted: leases, payments and applications reference them, and those are
 * financial/legal records. "Delete" archives the listing; the landlord can restore it later.
 */
export async function deleteProperty(landlordId: string, propertyId: string): Promise<"ARCHIVED"> {
  const property = await getProperty(landlordId, propertyId);
  if (property.status === "ARCHIVED") return "ARCHIVED";

  if (await hasLiveLease(propertyId)) {
    throw Object.assign(new Error("End or cancel the active lease before archiving this property."), { statusCode: 409 });
  }
  if (await hasActiveReservation(propertyId)) {
    throw Object.assign(
      new Error("This property is reserved for an approved applicant. Withdraw or expire that application before archiving it."),
      { statusCode: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from("properties")
    .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("landlord_id", landlordId);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return "ARCHIVED";
}

/** Restores an archived property as a DRAFT, so the landlord reviews it before it goes public again. */
export async function restoreProperty(landlordId: string, propertyId: string): Promise<Property> {
  const property = await getProperty(landlordId, propertyId);
  if (property.status !== "ARCHIVED") {
    throw Object.assign(new Error("Only archived properties can be restored."), { statusCode: 409 });
  }
  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({ status: "DRAFT", updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("landlord_id", landlordId)
    .eq("status", "ARCHIVED")
    .select()
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) throw Object.assign(new Error("Only archived properties can be restored."), { statusCode: 409 });
  return data as Property;
}

function extensionFor(mimetype: string): string {
  switch (mimetype) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    default:
      return "jpg";
  }
}



export async function addPropertyImages(
  landlordId: string,
  propertyId: string,
  files: Express.Multer.File[]
): Promise<Property> {
  const property = await getProperty(landlordId, propertyId);

  if (property.images.length + files.length > MAX_IMAGES_PER_PROPERTY) {
    throw Object.assign(new Error(`A property can have at most ${MAX_IMAGES_PER_PROPERTY} photos.`), { statusCode: 400 });
  }

  const newUrls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${landlordId}/${propertyId}/photo-${randomUUID()}.${extensionFor(file.mimetype)}`;
    const { error } = await supabaseAdmin.storage
      .from(PROPERTY_IMAGE_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) throw Object.assign(new Error(`Failed to upload photo: ${error.message}`), { statusCode: 500 });
    const { data: publicUrl } = supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET).getPublicUrl(path);
    newUrls.push(publicUrl.publicUrl);
  }

  const images = [...property.images, ...newUrls];
  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({ images })
    .eq("id", propertyId)
    .eq("landlord_id", landlordId)
    .select()
    .single();

  if (error || !data) throw Object.assign(new Error(error?.message ?? "Failed to save photos."), { statusCode: 500 });
  return data as Property;
}

export async function removePropertyImage(
  landlordId: string,
  propertyId: string,
  imageUrl: string
): Promise<Property> {
  const property = await getProperty(landlordId, propertyId);

  const path = pathFromPublicUrl(imageUrl);
  if (path) {
    await supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]).catch(() => {});
  }

  const images = property.images.filter((url) => url !== imageUrl);
  const { data, error } = await supabaseAdmin
    .from("properties")
    .update({ images })
    .eq("id", propertyId)
    .eq("landlord_id", landlordId)
    .select()
    .single();

  if (error || !data) throw Object.assign(new Error(error?.message ?? "Failed to remove photo."), { statusCode: 500 });
  return data as Property;
}