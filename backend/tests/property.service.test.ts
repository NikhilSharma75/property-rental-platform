import { describe, it, expect, vi, beforeEach } from "vitest";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({ from: undefined as unknown as (t: string) => unknown }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: (t: string) => state.from(t) } }));

import { createProperty, updateProperty, deleteProperty } from "../src/services/property.service";

const L = "landlord-1";
const input = (over: Record<string, unknown> = {}) =>
  ({ title: "Flat", propertyType: "APARTMENT", addressLine1: "1 Main St", city: "Pune", bedrooms: 1, bathrooms: 1, rentAmount: 1000, ...over }) as any;

beforeEach(() => vi.clearAllMocks());

describe("createProperty", () => {
  it("lets any landlord save a draft without checking verification", async () => {
    const db = tableMock({ properties: [{ data: { id: "p1", status: "DRAFT" } }] });
    state.from = db.from;
    await expect(createProperty(L, input())).resolves.toMatchObject({ status: "DRAFT" });
    expect(db.callsFor("landlord_verifications")).toHaveLength(0);
  });

  it.each([
    ["no verification record", null],
    ["NOT_SUBMITTED", { status: "NOT_SUBMITTED" }],
    ["PENDING", { status: "PENDING" }],
    ["REJECTED", { status: "REJECTED" }],
  ])("blocks publishing when verification is %s", async (_label, row) => {
    const db = tableMock({ landlord_verifications: [{ data: row }], properties: [{ data: { id: "p1" } }] });
    state.from = db.from;
    await expect(createProperty(L, input({ status: "AVAILABLE" }))).rejects.toMatchObject({ statusCode: 403 });
    expect(db.wasCalled("properties", "insert")).toBe(false);
  });

  it("allows publishing for a VERIFIED landlord", async () => {
    const db = tableMock({
      landlord_verifications: [{ data: { status: "VERIFIED" } }],
      properties: [{ data: { id: "p1", status: "AVAILABLE" } }],
    });
    state.from = db.from;
    await expect(createProperty(L, input({ status: "AVAILABLE" }))).resolves.toMatchObject({ status: "AVAILABLE" });
  });

  it("refuses to create a property directly as RENTED or ARCHIVED", async () => {
    state.from = tableMock({}).from;
    await expect(createProperty(L, input({ status: "RENTED" }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(createProperty(L, input({ status: "ARCHIVED" }))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("stores map coordinates so distance search can work", async () => {
    const db = tableMock({ properties: [{ data: { id: "p1", status: "DRAFT" } }] });
    state.from = db.from;
    await createProperty(L, input({ latitude: 19.076, longitude: 72.8777 }));
    const row = db.callsFor("properties").find((c) => c.method === "insert")?.args[0] as Record<string, unknown>;
    expect(row.latitude).toBe(19.076);
    expect(row.longitude).toBe(72.8777);
  });
});

describe("updateProperty publishing", () => {
  const draft = { data: { id: "p1", landlord_id: L, status: "DRAFT" } };
  const available = { data: { id: "p1", landlord_id: L, status: "AVAILABLE" } };

  it("blocks DRAFT -> AVAILABLE for an unverified landlord and writes nothing", async () => {
    const db = tableMock({ properties: [draft], landlord_verifications: [{ data: { status: "PENDING" } }] });
    state.from = db.from;
    await expect(updateProperty(L, "p1", { status: "AVAILABLE" })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.wasCalled("properties", "update")).toBe(false);
  });

  it("allows DRAFT -> AVAILABLE for a verified landlord", async () => {
    state.from = tableMock({
      properties: [draft, available],
      landlord_verifications: [{ data: { status: "VERIFIED" } }],
    }).from;
    await expect(updateProperty(L, "p1", { status: "AVAILABLE" })).resolves.toMatchObject({ status: "AVAILABLE" });
  });

  it("doesn't re-check verification when an already-published listing is just edited", async () => {
    const db = tableMock({ properties: [available, available] });
    state.from = db.from;
    await updateProperty(L, "p1", { status: "AVAILABLE", title: "New title" });
    expect(db.callsFor("landlord_verifications")).toHaveLength(0);
  });

  it("lets an unverified landlord move a listing back to DRAFT", async () => {
    const db = tableMock({ properties: [available, draft] });
    state.from = db.from;
    await expect(updateProperty(L, "p1", { status: "DRAFT" })).resolves.toMatchObject({ status: "DRAFT" });
    expect(db.callsFor("landlord_verifications")).toHaveLength(0);
  });

  it("saves an edit to a RESERVED property without changing its status", async () => {
    const reserved = { data: { id: "p1", landlord_id: L, status: "RESERVED" } };
    const db = tableMock({ properties: [reserved, reserved] });
    state.from = db.from;
    await expect(updateProperty(L, "p1", { status: "RESERVED", title: "New title" })).resolves.toMatchObject({ status: "RESERVED" });
    expect(db.wasCalled("properties", "update")).toBe(true);
  });

  it("won't let a landlord release a reservation by changing the status", async () => {
    const reserved = { data: { id: "p1", landlord_id: L, status: "RESERVED" } };
    const db = tableMock({ properties: [reserved] });
    state.from = db.from;
    await expect(updateProperty(L, "p1", { status: "AVAILABLE" })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.wasCalled("properties", "update")).toBe(false);
  });

  it("stores updated coordinates", async () => {
    const draft = { data: { id: "p1", landlord_id: L, status: "DRAFT" } };
    const db = tableMock({ properties: [draft, draft] });
    state.from = db.from;
    await updateProperty(L, "p1", { latitude: 28.61, longitude: 77.2 });
    const patch = db.callsFor("properties").find((c) => c.method === "update")?.args[0] as Record<string, unknown>;
    expect(patch.latitude).toBe(28.61);
    expect(patch.longitude).toBe(77.2);
  });
});

describe("deleteProperty (archive)", () => {
  it("won't archive a property that is reserved for an approved applicant", async () => {
    const db = tableMock({
      properties: [{ data: { id: "p1", landlord_id: L, status: "RESERVED" } }],
      leases: [{ count: 0 }],
      rental_applications: [{ count: 1 }],
      units: [{ count: 0 }],
    });
    state.from = db.from;
    await expect(deleteProperty(L, "p1")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.wasCalled("properties", "update")).toBe(false);
  });

  it("archives when there is no lease and no approved reservation", async () => {
    const db = tableMock({
      properties: [{ data: { id: "p1", landlord_id: L, status: "AVAILABLE" } }],
      leases: [{ count: 0 }],
      rental_applications: [{ count: 0 }],
      units: [{ count: 0 }],
    });
    state.from = db.from;
    await expect(deleteProperty(L, "p1")).resolves.toBe("ARCHIVED");
    expect(db.wasCalled("properties", "update")).toBe(true);
  });
});