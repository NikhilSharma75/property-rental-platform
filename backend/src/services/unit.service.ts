// 
import { supabaseAdmin } from "../config/supabase";

const fail = (m: string, statusCode: number) => Object.assign(new Error(m), { statusCode });
const COLS = "id, property_id, unit_label, floor, bedrooms, bathrooms, area_sqft, rent_amount, deposit_amount, status";
const LIVE = ["DRAFT", "ACTIVE"];

/** Statuses a landlord may set by hand. RESERVED and OCCUPIED are only ever set by the database functions. */
const MANUAL_STATUSES = ["AVAILABLE", "UNAVAILABLE"] as const;
type ManualStatus = (typeof MANUAL_STATUSES)[number];

async function assertOwns(landlordId: string, propertyId: string) {
  const { data, error } = await supabaseAdmin.from("properties").select("id")
    .eq("id", propertyId).eq("landlord_id", landlordId).maybeSingle();
  if (error) throw fail(error.message, 500);
  if (!data) throw fail("Property not found.", 404);
}

/** Tenant of each unit's live (draft or active) lease, so the landlord can see who holds a reserved/occupied unit. */
async function occupancy(unitIds: string[]) {
  const map = new Map<string, { full_name: string | null; email: string }>();
  if (!unitIds.length) return map;
  const { data } = await supabaseAdmin.from("leases")
    .select("unit_id, users!leases_tenant_id_fkey(full_name, email)")
    .in("unit_id", unitIds).in("status", LIVE);
  for (const l of (data ?? []) as any[]) if (l.unit_id) map.set(l.unit_id, l.users);
  return map;
}

// Status is stored in the database now (AVAILABLE / RESERVED / OCCUPIED / UNAVAILABLE); it is no longer derived here.
const shape = (u: any, tenant?: { full_name: string | null; email: string }) => ({
  ...u, tenant: tenant ?? null,
});

export async function listUnits(landlordId: string, propertyId: string) {
  await assertOwns(landlordId, propertyId);
  const { data, error } = await supabaseAdmin.from("units").select(COLS)
    .eq("property_id", propertyId).order("unit_label", { ascending: true }).limit(500);
  if (error) throw fail(error.message, 500);
  const occ = await occupancy((data ?? []).map((u) => u.id));
  return (data ?? []).map((u) => shape(u, occ.get(u.id)));
}

export interface UnitBody {
  unitLabel: string; floor?: number | null; bedrooms: number; bathrooms: number;
  areaSqft?: number | null; rentAmount: number; depositAmount?: number | null;
}
const toRow = (b: Partial<UnitBody>) => {
  const r: Record<string, unknown> = {};
  if (b.unitLabel !== undefined) r.unit_label = b.unitLabel;
  if (b.floor !== undefined) r.floor = b.floor;
  if (b.bedrooms !== undefined) r.bedrooms = b.bedrooms;
  if (b.bathrooms !== undefined) r.bathrooms = b.bathrooms;
  if (b.areaSqft !== undefined) r.area_sqft = b.areaSqft;
  if (b.rentAmount !== undefined) r.rent_amount = b.rentAmount;
  if (b.depositAmount !== undefined) r.deposit_amount = b.depositAmount;
  return r;
};

export async function createUnit(landlordId: string, propertyId: string, body: UnitBody) {
  await assertOwns(landlordId, propertyId);
  // New units start as AVAILABLE (the column default).
  const { data, error } = await supabaseAdmin.from("units")
    .insert({ ...toRow(body), property_id: propertyId }).select(COLS).single();
  if (error?.code === "23505") throw fail("This property already has a unit with that label.", 409);
  if (error || !data) throw fail("Could not create the unit.", 500);
  return shape(data);
}

export async function updateUnit(
  landlordId: string, propertyId: string, unitId: string,
  body: Partial<UnitBody> & { status?: ManualStatus },
) {
  await assertOwns(landlordId, propertyId);
  const patch: Record<string, unknown> = { ...toRow(body), updated_at: new Date().toISOString() };

  const changingStatus = body.status !== undefined;
  if (changingStatus) {
    const { data: current, error: currentError } = await supabaseAdmin.from("units").select("status")
      .eq("id", unitId).eq("property_id", propertyId).maybeSingle();
    if (currentError) throw fail("Could not update the unit.", 500);
    if (!current) throw fail("Unit not found.", 404);
    if (current.status === "RESERVED" || current.status === "OCCUPIED") {
      throw fail("This unit is reserved or occupied. Release the reservation or end the lease first.", 409);
    }
    patch.status = body.status;
  }

  let query = supabaseAdmin.from("units").update(patch)
    .eq("id", unitId).eq("property_id", propertyId);
  // Guard against a reservation landing between the read above and this write.
  if (changingStatus) query = query.in("status", [...MANUAL_STATUSES]);

  const { data, error } = await query.select(COLS).maybeSingle();
  if (error?.code === "23505") throw fail("This property already has a unit with that label.", 409);
  if (error) throw fail("Could not update the unit.", 500);
  if (!data) {
    throw changingStatus
      ? fail("This unit was just reserved or occupied, so its status can't be changed.", 409)
      : fail("Unit not found.", 404);
  }
  return shape(data, (await occupancy([unitId])).get(unitId));
}

export async function deleteUnit(landlordId: string, propertyId: string, unitId: string) {
  await assertOwns(landlordId, propertyId);

  const { data: current, error: currentError } = await supabaseAdmin.from("units").select("status")
    .eq("id", unitId).eq("property_id", propertyId).maybeSingle();
  if (currentError) throw fail("Could not delete the unit.", 500);
  if (!current) throw fail("Unit not found.", 404);
  if (current.status === "RESERVED" || current.status === "OCCUPIED") {
    throw fail("This unit is reserved or occupied, so it can't be deleted.", 409);
  }

  const { error } = await supabaseAdmin.from("units").delete().eq("id", unitId).eq("property_id", propertyId);
  // 23503 = foreign key: the unit has lease or application history, which must be kept.
  if (error?.code === "23503") throw fail("This unit has lease or application history, so it can't be deleted.", 409);
  if (error) throw fail("Could not delete the unit.", 500);
}