import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockSupabase } from "./helpers";

const state = vi.hoisted(() => ({ from: undefined as unknown as (t: string) => unknown }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: (t: string) => state.from(t) } }));

import { listFavorites } from "../src/services/favorite.service";

const row = (status: string | null, id = "p1") => ({
  property_id: id,
  created_at: "2026-01-01T00:00:00Z",
  properties: status === null ? null : { id, title: "Home", status, images: null, amenities: null },
});

describe("listFavorites", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps AVAILABLE and RENTED listings but hides DRAFT, ARCHIVED and deleted ones", async () => {
    const { from } = mockSupabase({
      data: [row("AVAILABLE", "a"), row("RENTED", "b"), row("DRAFT", "c"), row("ARCHIVED", "d"), row(null, "e")],
      error: null,
    });
    state.from = from;
    const result = await listFavorites("user-1");
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("normalises missing arrays and flags every item as favorited", async () => {
    state.from = mockSupabase({ data: [row("AVAILABLE")], error: null }).from;
    const [p] = await listFavorites("user-1");
    expect(p.images).toEqual([]);
    expect(p.amenities).toEqual([]);
    expect(p.is_favorited).toBe(true);
    expect(p.distance_km).toBeNull();
  });

  it("throws a 500 when the database errors", async () => {
    state.from = mockSupabase({ data: null, error: { message: "boom" } }).from;
    await expect(listFavorites("user-1")).rejects.toMatchObject({ statusCode: 500 });
  });
});
