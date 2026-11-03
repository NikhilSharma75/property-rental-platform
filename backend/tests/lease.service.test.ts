import { describe, it, expect, vi, beforeEach } from "vitest";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({
  from: undefined as unknown as (t: string) => unknown,
  rpc: vi.fn(),
}));
vi.mock("../src/config/supabase", () => ({
  supabaseAdmin: { from: (t: string) => state.from(t), rpc: (...a: unknown[]) => state.rpc(...a) },
}));
vi.mock("../src/services/notification.service", () => ({
  notifyLeaseCreated: vi.fn(() => Promise.resolve()),
  notifyLeaseActivated: vi.fn(() => Promise.resolve()),
  notifyReservationReleased: vi.fn(() => Promise.resolve()),
}));

import { addMonthsClamped, createLease, updateLeaseStatus, signLease } from "../src/services/lease.service";

const LANDLORD = "landlord-1";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86_400_000));
const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const input = (over: Record<string, unknown> = {}) => ({
  applicationId: "app-1", rentAmount: 1000, securityDeposit: 1000,
  leaseStartDate: daysFromNow(3), leaseDurationMonths: 12, ...over,
});

const app = (over: Record<string, unknown> = {}) => ({
  data: { id: "app-1", status: "APPROVED", property_id: "p1", tenant_id: "t1", unit_id: null, expires_at: future, ...over },
});
const prop = (over: Record<string, unknown> = {}) => ({
  data: { id: "p1", landlord_id: LANDLORD, title: "Flat", status: "RESERVED", ...over },
});

/** Happy path for a single-unit property: approval left the property RESERVED. */
function db(over: Record<string, unknown[]> = {}) {
  return tableMock({
    rental_applications: [app()],
    properties: [prop()],
    users: [{ data: { id: "t1", role: "TENANT", is_suspended: false } }],
    leases: [{ count: 0 }, { count: 0 }, { data: { id: "lease-1" } }],
    ...(over as any),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({ data: null, error: null });
});

describe("addMonthsClamped", () => {
  it("clamps to the last day of a shorter month", () => {
    expect(iso(addMonthsClamped(new Date("2027-01-31T00:00:00Z"), 1))).toBe("2027-02-28");
    expect(iso(addMonthsClamped(new Date("2028-01-31T00:00:00Z"), 1))).toBe("2028-02-29");
  });
  it("handles year rollover", () => {
    expect(iso(addMonthsClamped(new Date("2026-11-15T00:00:00Z"), 3))).toBe("2027-02-15");
  });
});

describe("createLease", () => {
  it("answers 404 for another landlord's application, before checking status", async () => {
    state.from = db({ rental_applications: [app({ status: "PENDING" })], properties: [prop({ landlord_id: "other" })] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires an APPROVED application", async () => {
    state.from = db({ rental_applications: [app({ status: "PENDING" })] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("refuses an expired approval", async () => {
    state.from = db({ rental_applications: [app({ expires_at: past })] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("needs the single-unit property to still be RESERVED", async () => {
    state.from = db({ properties: [prop({ status: "AVAILABLE" })] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("won't create a lease on an archived property", async () => {
    state.from = db({ properties: [prop({ status: "ARCHIVED" })] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("won't create a lease for a suspended tenant", async () => {
    state.from = db({ users: [{ data: { id: "t1", role: "TENANT", is_suspended: true } }] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  describe("multi-unit buildings", () => {
    const unitApp = app({ unit_id: "u1" });
    const building = prop({ status: "AVAILABLE" });

    it("needs the unit RESERVED for THIS application", async () => {
      state.from = db({
        rental_applications: [unitApp], properties: [building],
        units: [{ data: { id: "u1", status: "AVAILABLE", reserved_application_id: null } }],
      }).from;
      await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });

      state.from = db({
        rental_applications: [unitApp], properties: [building],
        units: [{ data: { id: "u1", status: "RESERVED", reserved_application_id: "someone-else" } }],
      }).from;
      await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
    });

    it("saves unit_id on the lease when the reservation matches", async () => {
      const t = db({
        rental_applications: [unitApp], properties: [building],
        units: [{ data: { id: "u1", status: "RESERVED", reserved_application_id: "app-1" } }],
      });
      state.from = t.from;
      await createLease(LANDLORD, input());
      const row = t.callsFor("leases").find((c) => c.method === "insert")?.args[0];
      expect(row).toMatchObject({ unit_id: "u1", property_id: "p1" });
    });
  });

  it("blocks a second live lease", async () => {
    state.from = db({ leases: [{ count: 0 }, { count: 1 }] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("turns a unique-index violation (two requests racing) into a 409", async () => {
    state.from = db({ leases: [{ count: 0 }, { count: 0 }, { error: { code: "23505" } }] }).from;
    await expect(createLease(LANDLORD, input())).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects start dates far in the past or more than a year ahead", async () => {
    state.from = db().from;
    await expect(createLease(LANDLORD, input({ leaseStartDate: "2020-01-01" }))).rejects.toMatchObject({ statusCode: 400 });
    await expect(createLease(LANDLORD, input({ leaseStartDate: daysFromNow(500) }))).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("updateLeaseStatus", () => {
  const lease = (status: string, over: Record<string, unknown> = {}) => ({
    data: {
      id: "l1", landlord_id: LANDLORD, property_id: "p1", application_id: "app-1", tenant_id: "t1",
      status, signed_by_tenant: true, signed_by_landlord: true, ...over,
    },
  });
  const updated = (status: string) => ({ data: { id: "l1", status } });

  it("only the owning landlord can change a lease", async () => {
    state.from = tableMock({ leases: [lease("ACTIVE")] }).from;
    await expect(updateLeaseStatus("l1", "other", "TERMINATED")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects invalid transitions", async () => {
    state.from = tableMock({ leases: [lease("TERMINATED")] }).from;
    await expect(updateLeaseStatus("l1", LANDLORD, "ACTIVE")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("won't activate an unsigned lease", async () => {
    state.from = tableMock({ leases: [lease("DRAFT", { signed_by_tenant: false })] }).from;
    await expect(updateLeaseStatus("l1", LANDLORD, "ACTIVE")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("terminating releases the unit/property through the database function", async () => {
    state.from = tableMock({ leases: [lease("ACTIVE"), updated("TERMINATED")] }).from;
    await updateLeaseStatus("l1", LANDLORD, "TERMINATED");
    expect(state.rpc).toHaveBeenCalledWith("release_lease_target", { p_lease: "l1" });
  });

  it("activating marks the target occupied", async () => {
    state.from = tableMock({ leases: [lease("DRAFT"), updated("ACTIVE")] }).from;
    await updateLeaseStatus("l1", LANDLORD, "ACTIVE");
    expect(state.rpc).toHaveBeenCalledWith("mark_lease_occupied", { p_lease: "l1" });
  });

  it("cancelling a draft releases the application hold", async () => {
    state.from = tableMock({
      leases: [lease("DRAFT"), updated("CANCELLED")],
      properties: [{ data: { title: "Flat" } }],
    }).from;
    await updateLeaseStatus("l1", LANDLORD, "CANCELLED");
    expect(state.rpc).toHaveBeenCalledWith("release_application_hold", { p_app: "app-1", p_new_status: "REJECTED" });
  });

  it("returns 409 when someone else changed the lease first (guarded update)", async () => {
    state.from = tableMock({ leases: [lease("ACTIVE"), { data: null }] }).from;
    await expect(updateLeaseStatus("l1", LANDLORD, "TERMINATED")).rejects.toMatchObject({ statusCode: 409 });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("reports a 500 when availability couldn't be refreshed", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    state.from = tableMock({ leases: [lease("ACTIVE"), updated("TERMINATED")] }).from;
    await expect(updateLeaseStatus("l1", LANDLORD, "TERMINATED")).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("signLease", () => {
  const draft = (tenantSigned: boolean, landlordSigned: boolean) => ({
    data: {
      id: "l1", tenant_id: "t1", landlord_id: LANDLORD, property_id: "p1", status: "DRAFT",
      signed_by_tenant: tenantSigned, signed_by_landlord: landlordSigned,
    },
  });

  it("the second signature activates the lease and marks it occupied", async () => {
    state.from = tableMock({
      leases: [draft(false, true), { data: null }, draft(true, true), { data: { id: "l1", status: "ACTIVE" } }],
      properties: [{ data: { title: "Flat" } }],
    }).from;
    const out = await signLease("l1", "t1");
    expect(out).toMatchObject({ status: "ACTIVE" });
    expect(state.rpc).toHaveBeenCalledWith("mark_lease_occupied", { p_lease: "l1" });
  });

  it("a stranger can't sign", async () => {
    state.from = tableMock({ leases: [draft(false, false)] }).from;
    await expect(signLease("l1", "stranger")).rejects.toMatchObject({ statusCode: 403 });
  });
});
