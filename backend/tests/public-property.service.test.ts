import { describe, it, expect, vi } from "vitest";
import { mockSupabase } from "./helpers";

const state = vi.hoisted(() => ({ from: undefined as unknown as (t: string) => unknown }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: (t: string) => state.from(t) } }));

import { getPublicProperty } from "../src/services/public-property.service";





describe("getPublicProperty", () => {
   it("only looks up AVAILABLE, RESERVED or RENTED listings (so favorites of reserved/rented homes still open)", async () => {
    const { from, calls } = mockSupabase({ data: { id: "p1", status: "RENTED", images: null }, error: null });
    state.from = from;
    const property = await getPublicProperty("p1");
    const statusFilter = calls.find((c) => c.method === "in");
    expect(statusFilter?.args).toEqual(["status", ["AVAILABLE", "RESERVED", "RENTED"]]);
    expect(property?.images).toEqual([]);
  });


  
  it("returns null when nothing matches (draft / archived / unknown id)", async () => {
    state.from = mockSupabase({ data: null, error: null }).from;
    expect(await getPublicProperty("missing")).toBeNull();
  });
});

