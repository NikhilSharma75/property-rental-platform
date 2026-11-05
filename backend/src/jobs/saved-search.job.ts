import { supabaseAdmin } from "../config/supabase";
import { SavedSearch } from "../types";
import { searchProperties } from "../services/public-property.service";
import * as inApp from "../services/in-app-notification.service";

function filtersToQuery(filters: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) qs.set(key, value.join(","));
    } else {
      qs.set(key, String(value));
    }
  }
  return qs.toString();
}

export async function checkSavedSearches(): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("saved_searches")
    .select("*")
    .eq("alerts_enabled", true)
    .limit(200);

  if (error) {
    console.error("Saved search job could not load searches:", error.message);
    return;
  }

  for (const row of (data ?? []) as SavedSearch[]) {
    try {
      const result = await searchProperties({
        ...(row.filters as any),
        page: 1,
        limit: 50,
        sort: "newest",
      });

      const currentIds = result.properties.map((p) => p.id);
      const seen = new Set(Array.isArray(row.last_seen_ids) ? row.last_seen_ids : []);
      const newMatches = result.properties.filter((p) => !seen.has(p.id));

      // The first run is a baseline only.
      if (row.last_checked_at && newMatches.length > 0) {
        const preview = newMatches.slice(0, 3).map((p) => p.title).join(", ");
        await inApp.notifyUser(
          row.user_id,
          "SAVED_SEARCH_MATCHES",
          `${newMatches.length} new home${newMatches.length === 1 ? "" : "s"} match “${row.name}”`,
          preview,
          `/properties?${filtersToQuery(row.filters)}`
        );
      }

      await supabaseAdmin
        .from("saved_searches")
        .update({
          last_seen_ids: currentIds,
          last_checked_at: new Date().toISOString(),
          last_new_count: row.last_checked_at ? newMatches.length : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    } catch (err) {
      console.error(`Saved search check failed for ${row.id}:`, (err as Error).message);
    }
  }
}

