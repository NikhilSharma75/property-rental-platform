import { describe, it, expect, vi, beforeEach } from "vitest";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({
  from: undefined as unknown as (t: string) => unknown,
  rpc: vi.fn(),
}));
vi.mock("node-cron", () => ({ default: { schedule: vi.fn() } }));
vi.mock("../src/config/supabase", () => ({
  supabaseAdmin: { from: (t: string) => state.from(t), rpc: (...a: unknown[]) => state.rpc(...a) },
}));
vi.mock("../src/services/notification.service", () => ({
  notifyLeaseEnded: vi.fn(() => Promise.resolve()),
  notifyLeaseExpiring: vi.fn(() => Promise.resolve()),
  notifyRentReminder: vi.fn(() => Promise.resolve()),
  notifyApprovalExpired: vi.fn(() => Promise.resolve()),
}));

import { expireEndedLeases, expireStaleApplications } from "../src/jobs/reminders.job";
import * as notifications from "../src/services/notification.service";

const ended = { id: "l1", tenant_id: "t1", landlord_id: "ll1", property_id: "p1" };

beforeEach(() => {
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({ data: null, error: null });
});

describe("expireEndedLeases", () => {
  it("ends the lease, releases the unit and notifies both parties", async () => {
    state.from = tableMock({
      leases: [{ data: [ended] }, { data: { id: "l1" } }],
      properties: [{ data: { title: "Flat" } }],
    }).from;
    await expireEndedLeases();
    expect(state.rpc).toHaveBeenCalledWith("release_lease_target", { p_lease: "l1" });
    expect(notifications.notifyLeaseEnded).toHaveBeenCalledWith("t1", "ll1", "Flat");
  });

  it("does nothing when no active lease has passed its end date", async () => {
    state.from = tableMock({ leases: [{ data: [] }] }).from;
    await expireEndedLeases();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("skips a lease someone else already changed", async () => {
    state.from = tableMock({ leases: [{ data: [ended] }, { data: null }] }).from;
    await expireEndedLeases();
    expect(state.rpc).not.toHaveBeenCalled();
    expect(notifications.notifyLeaseEnded).not.toHaveBeenCalled();
  });

  it("puts the lease back to ACTIVE when the unit can't be released, so the next run retries", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = tableMock({ leases: [{ data: [ended] }, { data: { id: "l1" } }, { data: null }] });
    state.from = t.from;
    await expireEndedLeases();
    const restored = t.callsFor("leases").some(
      (c) => c.method === "update" && (c.args[0] as { status?: string }).status === "ACTIVE",
    );
    expect(restored).toBe(true);
    expect(notifications.notifyLeaseEnded).not.toHaveBeenCalled();
  });
});

describe("expireStaleApplications", () => {
  const due = { id: "a1", tenant_id: "t1", property_id: "p1" };

  it("notifies tenant and landlord about approvals that really expired", async () => {
    state.rpc.mockResolvedValue({ data: 1, error: null });
    state.from = tableMock({
      rental_applications: [{ data: [due] }, { data: [{ id: "a1" }] }],
      properties: [{ data: { title: "Flat", landlord_id: "ll1" } }],
    }).from;
    await expireStaleApplications();
    expect(notifications.notifyApprovalExpired).toHaveBeenCalledWith("t1", "ll1", "Flat", "a1");
  });

  it("doesn't notify for an approval the database function left alone", async () => {
    state.rpc.mockResolvedValue({ data: 0, error: null });
    state.from = tableMock({ rental_applications: [{ data: [due] }, { data: [] }] }).from;
    await expireStaleApplications();
    expect(notifications.notifyApprovalExpired).not.toHaveBeenCalled();
  });

  it("does nothing when no approvals are due", async () => {
    state.from = tableMock({ rental_applications: [{ data: [] }] }).from;
    await expireStaleApplications();
    expect(notifications.notifyApprovalExpired).not.toHaveBeenCalled();
  });
});
