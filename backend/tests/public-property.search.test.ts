import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => state.rpc(...a) } }));

import { searchProperties } from "../src/services/public-property.service";

beforeEach(() => vi.clearAllMocks());

describe("searchProperties", () => {
  it("passes every filter to the database function and maps distance", async () => {
    state.rpc.mockResolvedValue({
      data: [{ id: "p1", images: null, out_distance_km: 4.2, out_total_count: 1 }],
      error: null,
    });
    const result = await searchProperties({
      search: "sea", city: "Mumbai", minPrice: 1000, maxPrice: 9000,
      minBedrooms: 2, minBathrooms: 1, amenities: ["Parking"],
      lat: 19.07, lng: 72.87, radiusKm: 10, sort: "distance", page: 1, limit: 12,
    });
    expect(state.rpc).toHaveBeenCalledWith("search_properties", expect.objectContaining({
      p_search: "sea", p_city: "Mumbai", p_min_price: 1000, p_max_price: 9000,
      p_min_bedrooms: 2, p_min_bathrooms: 1, p_amenities: ["Parking"],
      p_lat: 19.07, p_lng: 72.87, p_radius_km: 10, p_sort: "distance",
    }));
    expect(result.properties[0]).toMatchObject({ id: "p1", images: [], distance_km: 4.2 });
    expect(result.total).toBe(1);
  });

  it("recovers the real total when the requested page is past the end", async () => {
    state.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ out_total_count: 5 }], error: null });

    const result = await searchProperties({ page: 3, limit: 2 });

    expect(state.rpc).toHaveBeenCalledTimes(2);
    expect(state.rpc.mock.calls[1][1]).toMatchObject({ p_page: 1, p_limit: 1 });
    expect(result).toMatchObject({ total: 5, totalPages: 3, page: 3 });
    expect(result.properties).toEqual([]);
  });

  it("surfaces a database error", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(searchProperties({})).rejects.toMatchObject({ statusCode: 500 });
  });
});
