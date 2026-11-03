import { describe, it, expect, vi, afterEach } from "vitest";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({ from: undefined as unknown as (t: string) => unknown }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: (t: string) => state.from(t) } }));

import { getLiveStatus, invalidateUserStatus, pruneStatusCache, statusCacheSize } from "../src/services/user-status.service";

const active = { data: { role: "TENANT", is_suspended: false } };

afterEach(() => vi.useRealTimers());

describe("user status cache", () => {
  it("answers from the cache within the TTL", async () => {
    const db = tableMock({ users: [active] });
    state.from = db.from;
    await getLiveStatus("cache-1");
    await getLiveStatus("cache-1");
    expect(db.invocations.filter((i) => i.table === "users")).toHaveLength(1);
  });

  it("reads the database again after an invalidation (e.g. right after a suspension)", async () => {
    const db = tableMock({ users: [active] });
    state.from = db.from;
    await getLiveStatus("cache-2");
    invalidateUserStatus("cache-2");
    await getLiveStatus("cache-2");
    expect(db.invocations.filter((i) => i.table === "users")).toHaveLength(2);
  });

  it("reports a suspended user as inactive", async () => {
    state.from = tableMock({ users: [{ data: { role: "TENANT", is_suspended: true } }] }).from;
    await expect(getLiveStatus("cache-3")).resolves.toMatchObject({ active: false });
  });

  it("returns null for an unknown user and doesn't cache it", async () => {
    state.from = tableMock({ users: [{ data: null }] }).from;
    const before = statusCacheSize();
    await expect(getLiveStatus("cache-4")).resolves.toBeNull();
    expect(statusCacheSize()).toBe(before);
  });

  it("removes expired entries when pruned", async () => {
    state.from = tableMock({ users: [active] }).from;
    await getLiveStatus("cache-5");
    expect(statusCacheSize()).toBeGreaterThan(0);
    pruneStatusCache(Date.now() + 60_000); // a minute later: everything is past its TTL
    expect(statusCacheSize()).toBe(0);
  });

  it("never grows beyond its cap, however many users call the API", async () => {
    state.from = tableMock({ users: [active] }).from;
    for (let i = 0; i < 5_100; i++) await getLiveStatus(`bulk-${i}`);
    expect(statusCacheSize()).toBeLessThanOrEqual(5_000);
  });
});

