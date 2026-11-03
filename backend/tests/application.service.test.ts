import { describe, it, expect, vi, beforeEach } from "vitest";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({
  from: undefined as unknown as (t: string) => unknown,
  rpc: vi.fn(),
}));
vi.mock("../src/config/supabase", () => ({
  supabaseAdmin: { from: (t: string) => state.from(t), rpc: (...a: unknown[]) => state.rpc(...a) },
}));
vi.mock("../src/services/storage.service", () => ({}));
vi.mock("../src/services/messaging.service", () => ({
  getOrCreateConversation: vi.fn(() => Promise.resolve({})),
}));
vi.mock("../src/services/notification.service", () => ({
  notifyApplicationSubmitted: vi.fn(() => Promise.resolve()),
  notifyApplicationApproved: vi.fn(() => Promise.resolve()),
  notifyApplicationRejected: vi.fn(() => Promise.resolve()),
  notifyReservationReleased: vi.fn(() => Promise.resolve()),
}));

import { updateApplicationStatus, withdrawApplication, listLandlordApplications } from "../src/services/application.service";
import * as notifications from "../src/services/notification.service";

const L = "landlord-1";
const appRow = (status: string) => ({ data: { id: "app-1", tenant_id: "t1", property_id: "p1", status } });
const propRow = (landlord = L) => ({ data: { id: "p1", landlord_id: landlord, status: "AVAILABLE", title: "Flat" } });

beforeEach(() => vi.clearAllMocks());

describe("approving an application", () => {
  it("reserves through the atomic database function", async () => {
    state.rpc.mockResolvedValue({ data: [{ id: "app-1", status: "APPROVED" }], error: null });
    state.from = tableMock({ rental_applications: [appRow("PENDING")], properties: [propRow()] }).from;
    await expect(updateApplicationStatus("app-1", L, "APPROVED")).resolves.toMatchObject({ status: "APPROVED" });
    expect(state.rpc).toHaveBeenCalledWith("approve_application", { p_app: "app-1", p_landlord: L, p_hold_days: 7 });
  });

  it("when two approvals race, the loser gets a 409", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "NOT_AVAILABLE" } });
    state.from = tableMock({ rental_applications: [appRow("PENDING")], properties: [propRow()] }).from;
    await expect(updateApplicationStatus("app-1", L, "APPROVED")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("maps an expired application to 409", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "APP_EXPIRED" } });
    state.from = tableMock({ rental_applications: [appRow("PENDING")], properties: [propRow()] }).from;
    await expect(updateApplicationStatus("app-1", L, "APPROVED")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("only the property's landlord can review", async () => {
    state.from = tableMock({ rental_applications: [appRow("PENDING")], properties: [propRow("someone-else")] }).from;
    await expect(updateApplicationStatus("app-1", L, "APPROVED")).rejects.toMatchObject({ statusCode: 403 });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("only pending applications can be reviewed", async () => {
    state.from = tableMock({ rental_applications: [appRow("APPROVED")], properties: [propRow()] }).from;
    await expect(updateApplicationStatus("app-1", L, "APPROVED")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejecting needs a reason", async () => {
    state.from = tableMock({ rental_applications: [appRow("PENDING")], properties: [propRow()] }).from;
    await expect(updateApplicationStatus("app-1", L, "REJECTED")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("notifies the tenant with the reason when an application is rejected", async () => {
    state.from = tableMock({
      rental_applications: [appRow("PENDING"), { data: { id: "app-1", status: "REJECTED" } }],
      properties: [propRow()],
    }).from;
    await updateApplicationStatus("app-1", L, "REJECTED", "Not a fit");
    expect(notifications.notifyApplicationRejected).toHaveBeenCalledWith("t1", "Flat", "Not a fit", "app-1");
  });

  it("rejecting is guarded against a double review", async () => {
    state.from = tableMock({ rental_applications: [appRow("PENDING"), { data: null }], properties: [propRow()] }).from;
    await expect(updateApplicationStatus("app-1", L, "REJECTED", "Not a fit")).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("listLandlordApplications", () => {
  it("filters by property when a propertyId is given", async () => {
    const db = tableMock({ rental_applications: [{ data: [] }] });
    state.from = db.from;
    await listLandlordApplications(L, "PENDING", "p1");
    const filters = db.callsFor("rental_applications").filter((c) => c.method === "eq");
    expect(filters.map((c) => c.args)).toEqual(
      expect.arrayContaining([
        ["properties.landlord_id", L],
        ["status", "PENDING"],
        ["property_id", "p1"],
      ])
    );
  });
});

describe("withdrawing an application", () => {
  it("releases the hold and tells the landlord when an approved application is withdrawn", async () => {
    state.rpc.mockResolvedValue({ data: null, error: null });
    state.from = tableMock({
      rental_applications: [appRow("APPROVED")],
      properties: [{ data: { title: "Flat", landlord_id: L } }],
    }).from;
    await withdrawApplication("app-1", "t1");
    expect(state.rpc).toHaveBeenCalledWith("release_application_hold", { p_app: "app-1", p_new_status: "WITHDRAWN" });
    expect(notifications.notifyReservationReleased).toHaveBeenCalledWith("t1", L, "Flat", "TENANT_WITHDREW", "app-1");
  });

  it("does not notify when a merely pending application is withdrawn", async () => {
    state.rpc.mockResolvedValue({ data: null, error: null });
    state.from = tableMock({ rental_applications: [appRow("PENDING")] }).from;
    await withdrawApplication("app-1", "t1");
    expect(notifications.notifyReservationReleased).not.toHaveBeenCalled();
  });

  it("refuses other people's applications", async () => {
    state.from = tableMock({ rental_applications: [appRow("PENDING")] }).from;
    await expect(withdrawApplication("app-1", "not-the-tenant")).rejects.toMatchObject({ statusCode: 403 });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("refuses already-closed applications", async () => {
    state.from = tableMock({ rental_applications: [appRow("REJECTED")] }).from;
    await expect(withdrawApplication("app-1", "t1")).rejects.toMatchObject({ statusCode: 409 });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
