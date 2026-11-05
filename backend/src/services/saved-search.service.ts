import { supabaseAdmin } from "../config/supabase";
import { SavedSearch } from "../types";
import { searchProperties } from "./public-property.service";

const MAX_SAVED_SEARCHES = 20;
const MAX_MATCHES_PER_CHECK = 50;

const fail = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

export interface SavedSearchInput {
  name: string;
  filters: Record<string, unknown>;
}



export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw fail(error.message, 500);
  return (data ?? []) as SavedSearch[];
}

export async function createSavedSearch(
  userId: string,
  input: SavedSearchInput
): Promise<SavedSearch> {
  const { count, error: countError } = await supabaseAdmin
    .from("saved_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw fail(countError.message, 500);
  if ((count ?? 0) >= MAX_SAVED_SEARCHES) {
    throw fail(`You can save up to ${MAX_SAVED_SEARCHES} searches.`, 409);
  }

  // Snapshot current matches so anything published after this point counts as "new".
  let initialIds: string[] = [];
  try {
    const snapshot = await searchProperties({
      ...(input.filters as any),
      page: 1,
      limit: MAX_MATCHES_PER_CHECK,
      sort: "newest",
    });
    initialIds = snapshot.properties.map((p) => p.id);
  } catch (err) {
    console.error("Could not snapshot saved search matches:", (err as Error).message);
  }

  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .insert({
      user_id: userId,
      name: input.name,
      filters: input.filters,
      alerts_enabled: true,
      last_checked_at: new Date().toISOString(),
      last_seen_ids: initialIds,
      last_new_count: 0,
    })
    .select()
    .single();

  if (error || !data) throw fail(error?.message ?? "Failed to save search.", 500);
  return data as SavedSearch;
}

export async function updateSavedSearch(
  userId: string,
  id: string,
  input: { name?: string; alertsEnabled?: boolean }
): Promise<SavedSearch> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.alertsEnabled !== undefined) patch.alerts_enabled = input.alertsEnabled;

  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) throw fail(error.message, 500);
  if (!data) throw fail("Saved search not found.", 404);
  return data as SavedSearch;
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw fail(error.message, 500);
  if (!data) throw fail("Saved search not found.", 404);
}