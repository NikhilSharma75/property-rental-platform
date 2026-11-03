import { supabaseAdmin } from "../config/supabase";

/**
 * Access tokens live 15 minutes and carry the role, so a suspended / demoted user would otherwise keep
 * working until expiry. This small TTL cache lets requireAuth check live status without a DB hit per request.
 * It is bounded: expired entries are swept every minute, and the size is capped, so memory can't grow forever.
 * (Per-process cache; with several API instances use Redis, or keep the TTL short.)
 */
const TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;
const SWEEP_EVERY_MS = 60_000;

type Entry = { active: boolean; role: string; at: number };
const cache = new Map<string, Entry>();

/** Drops expired entries and, if the cache is still too big, the oldest ones. */
export function pruneStatusCache(now: number = Date.now()): void {
  for (const [key, entry] of cache) {
    if (now - entry.at >= TTL_MS) cache.delete(key);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function statusCacheSize(): number {
  return cache.size;
}

setInterval(() => pruneStatusCache(), SWEEP_EVERY_MS).unref();

export async function getLiveStatus(userId: string): Promise<{ active: boolean; role: string } | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("role, is_suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const entry: Entry = { active: !data.is_suspended, role: data.role as string, at: Date.now() };
  cache.delete(userId); // re-insert so the newest entries sit at the end of the Map
  cache.set(userId, entry);
  if (cache.size > MAX_ENTRIES) pruneStatusCache();
  return entry;
}

export function invalidateUserStatus(userId: string) {
  cache.delete(userId);
}

