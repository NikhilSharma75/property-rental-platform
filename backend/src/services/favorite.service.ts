import { LIST_HARD_CAP } from "../config/limits";
import { supabaseAdmin } from "../config/supabase";

export async function addFavorite(userId: string, propertyId: string) {
  const { error } = await supabaseAdmin
    .from("favorites")
    .upsert({ user_id: userId, property_id: propertyId }, { onConflict: "user_id,property_id" });
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
}

export async function removeFavorite(userId: string, propertyId: string) {
  const { error } = await supabaseAdmin
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("property_id", propertyId);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
}

export async function listFavorites(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("favorites")
    .select("property_id, created_at, properties(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });

  return (data ?? [])
    // skip favorites whose property was deleted, or is no longer publicly viewable (draft/archived)
    .filter((row: any) => row.properties && ["AVAILABLE", "RESERVED", "RENTED"].includes(row.properties.status))
    .map((row: any) => ({
      ...row.properties,
      images: Array.isArray(row.properties.images) ? row.properties.images : [],
      amenities: Array.isArray(row.properties.amenities) ? row.properties.amenities : [],
      distance_km: null,
      is_favorited: true,
      favorited_at: row.created_at,
    }));
}

