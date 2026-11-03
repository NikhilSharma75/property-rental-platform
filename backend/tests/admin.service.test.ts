import { describe, it, expect, vi, beforeEach } from "vitest";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({
  from: undefined as unknown as (t: string) => unknown,
  signed: { data: { signedUrl: "https://signed.example/doc" }, error: null } as { data: { signedUrl: string } | null; error: unknown },
  liveLease: false,
}));

vi.mock("../src/config/supabase", () => ({
  supabaseAdmin: {
    from: (t: string) => state.from(t),
    storage: { from: () => ({ createSignedUrl: async () => state.signed }) },
  },
}));
vi.mock("../src/realtime/io", () => ({ getIO: () => ({ in: () => ({ disconnectSockets: vi.fn() }) }) }));
vi.mock("../src/services/user-status.service", () => ({ invalidateUserStatus: vi.fn() }));
vi.mock("../src/services/in-app-notification.service", () => ({ notifyUser: vi.fn(() => Promise.resolve()) }));
vi.mock("../src/services/property.service", () => ({
  hasLiveLease: async () => state.liveLease,
  hasActiveReservation: async () => false,
}));

import {
  setSuspension, setPropertyStatus, resolveReport, reviewVerification, getVerificationDocumentUrl, listVerifications,
} from "../src/services/admin.service";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  state.liveLease = false;
  state.signed = { data: { signedUrl: "https://signed.example/doc" }, error: null };
});

describe("setSuspension", () => {
  it("refuses to suspend your own account", async () => {
    state.from = tableMock({}).from;
    await expect(setSuspension(ADMIN, ADMIN, true, "some reason")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("refuses to suspend another admin", async () => {
    state.from = tableMock({ users: [{ data: { id: USER, role: "ADMIN", email: "a@x.com" } }] }).from;
    await expect(setSuspension(ADMIN, USER, true, "some reason")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns 404 for an unknown user", async () => {
    state.from = tableMock({ users: [{ data: null }] }).from;
    await expect(setSuspension(ADMIN, USER, true, "some reason")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires a reason of at least 5 characters, and changes nothing without one", async () => {
    const db = tableMock({ users: [{ data: { id: USER, role: "TENANT", email: "t@x.com" } }] });
    state.from = db.from;
    await expect(setSuspension(ADMIN, USER, true, "no")).rejects.toMatchObject({ statusCode: 400 });
    await expect(setSuspension(ADMIN, USER, true, undefined)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.wasCalled("users", "update")).toBe(false);
    expect(db.wasCalled("audit_log", "insert")).toBe(false);
  });

  it("does NOT suspend when the audit row can't be written", async () => {
    const db = tableMock({
      users: [{ data: { id: USER, role: "TENANT", email: "t@x.com" } }],
      audit_log: [{ error: { message: "db down" } }],
    });
    state.from = db.from;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(setSuspension(ADMIN, USER, true, "abusive messages")).rejects.toMatchObject({ statusCode: 500 });
    expect(db.wasCalled("users", "update")).toBe(false);
  });

  it("writes the audit row before updating the user", async () => {
    const db = tableMock({
      users: [
        { data: { id: USER, role: "TENANT", email: "t@x.com" } },
        { data: { id: USER, is_suspended: true } },
      ],
      audit_log: [{ error: null }],
      refresh_tokens: [{ error: null }],
    });
    state.from = db.from;
    await setSuspension(ADMIN, USER, true, "abusive messages");
    const order = db.invocations.map((i) => i.table);
    expect(order.indexOf("audit_log")).toBeGreaterThan(-1);
    expect(order.indexOf("audit_log")).toBeLessThan(order.lastIndexOf("users"));
    expect(db.wasCalled("refresh_tokens", "update")).toBe(true); // sessions are revoked
  });

  it("lets an admin restore a user without a reason", async () => {
    const db = tableMock({
      users: [
        { data: { id: USER, role: "TENANT", email: "t@x.com" } },
        { data: { id: USER, is_suspended: false } },
      ],
      audit_log: [{ error: null }],
    });
    state.from = db.from;
    await expect(setSuspension(ADMIN, USER, false)).resolves.toBeTruthy();
  });
});

describe("listVerifications", () => {
  it("returns a paged envelope and only the requested page", async () => {
    const db = tableMock({
      landlord_verifications: [{
        data: [{
          id: "v1", user_id: USER, status: "PENDING", government_id_type: "PASSPORT",
          business_name: null, submitted_at: "2026-01-01T00:00:00Z", rejection_reason: null,
          government_id_document_path: "u/gov.pdf", proof_of_ownership_path: null,
        }],
        count: 12,
      }],
      users: [{ data: [{ id: USER, full_name: "Landlord", email: "l@x.com" }] }],
    });
    state.from = db.from;
    const result = await listVerifications("PENDING", 2, 5);
    expect(result).toMatchObject({ page: 2, limit: 5, total: 12, totalPages: 3 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].has_government_id_document).toBe(true);
    const range = db.callsFor("landlord_verifications").find((c) => c.method === "range")?.args;
    expect(range).toEqual([5, 9]);
  });
});

describe("setPropertyStatus", () => {
  it("won't archive a property that has a draft or active lease", async () => {
    state.liveLease = true;
    const db = tableMock({ properties: [{ data: { id: "p1", title: "Flat", status: "RENTED" } }] });
    state.from = db.from;
    await expect(setPropertyStatus(ADMIN, "p1", "ARCHIVED")).rejects.toMatchObject({ statusCode: 409 });
    expect(db.wasCalled("properties", "update")).toBe(false);
    expect(db.wasCalled("audit_log", "insert")).toBe(false);
  });

  it("archives when there is no live lease and records it first", async () => {
    const db = tableMock({
      properties: [
        { data: { id: "p1", title: "Flat", status: "AVAILABLE" } },
        { data: { id: "p1", title: "Flat", status: "ARCHIVED" } },
      ],
      audit_log: [{ error: null }],
    });
    state.from = db.from;
    await expect(setPropertyStatus(ADMIN, "p1", "ARCHIVED")).resolves.toMatchObject({ status: "ARCHIVED" });
    const order = db.invocations.map((i) => i.table);
    expect(order.indexOf("audit_log")).toBeLessThan(order.lastIndexOf("properties"));
  });

  it("returns 404 for an unknown property", async () => {
    state.from = tableMock({ properties: [{ data: null }] }).from;
    await expect(setPropertyStatus(ADMIN, "nope", "DRAFT")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("resolveReport transitions", () => {
  const report = (status: string) => ({ data: { id: "r1", status, subject: "Bad listing", reporter_id: null } });

  it("rejects moving a closed report straight to another closed state", async () => {
    state.from = tableMock({ reports: [report("RESOLVED")] }).from;
    await expect(resolveReport(ADMIN, "r1", "DISMISSED", "long enough note")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("requires a resolution note (5+ characters) to resolve or dismiss", async () => {
    state.from = tableMock({ reports: [report("OPEN")] }).from;
    await expect(resolveReport(ADMIN, "r1", "RESOLVED", "ok")).rejects.toMatchObject({ statusCode: 400 });
    await expect(resolveReport(ADMIN, "r1", "DISMISSED", undefined)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows OPEN -> INVESTIGATING without a note, and reopening a closed report", async () => {
    const updated = { data: { id: "r1", status: "INVESTIGATING" } };
    state.from = tableMock({ reports: [report("OPEN"), updated], audit_log: [{ error: null }] }).from;
    await expect(resolveReport(ADMIN, "r1", "INVESTIGATING")).resolves.toMatchObject({ status: "INVESTIGATING" });

    state.from = tableMock({ reports: [report("RESOLVED"), updated], audit_log: [{ error: null }] }).from;
    await expect(resolveReport(ADMIN, "r1", "INVESTIGATING")).resolves.toBeTruthy();
  });

  it("reports a conflict when another admin changed the report first", async () => {
    state.from = tableMock({ reports: [report("OPEN"), { data: null }] }).from;
    await expect(resolveReport(ADMIN, "r1", "INVESTIGATING")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("returns 404 for an unknown report", async () => {
    state.from = tableMock({ reports: [{ data: null }] }).from;
    await expect(resolveReport(ADMIN, "r1", "RESOLVED", "long enough note")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("verification review and document access", () => {
  it("requires a reason to reject", async () => {
    state.from = tableMock({}).from;
    await expect(reviewVerification(ADMIN, "v1", "REJECTED", "  ")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("only reviews PENDING verifications", async () => {
    state.from = tableMock({ landlord_verifications: [{ data: { id: "v1", user_id: USER, status: "VERIFIED" } }] }).from;
    await expect(reviewVerification(ADMIN, "v1", "VERIFIED")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not approve when the audit row fails", async () => {
    const db = tableMock({
      landlord_verifications: [{ data: { id: "v1", user_id: USER, status: "PENDING" } }],
      audit_log: [{ error: { message: "down" } }],
    });
    state.from = db.from;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(reviewVerification(ADMIN, "v1", "VERIFIED")).rejects.toMatchObject({ statusCode: 500 });
    expect(db.wasCalled("landlord_verifications", "update")).toBe(false);
    expect(db.wasCalled("users", "update")).toBe(false);
  });

  it("logs VERIFICATION_DOCUMENT_VIEWED before handing out a signed link", async () => {
    const db = tableMock({
      landlord_verifications: [{ data: { id: "v1", user_id: USER, government_id_document_path: "u/id.pdf", proof_of_ownership_path: null } }],
      audit_log: [{ error: null }],
    });
    state.from = db.from;
    const out = await getVerificationDocumentUrl(ADMIN, "v1", "government-id");
    expect(out.url).toBe("https://signed.example/doc");
    const insert = db.callsFor("audit_log").find((c) => c.method === "insert");
    expect(insert?.args[0]).toMatchObject({ actor_id: ADMIN, action: "VERIFICATION_DOCUMENT_VIEWED", target_id: USER });
  });

  it("hands out no link when the audit row can't be written", async () => {
    state.from = tableMock({
      landlord_verifications: [{ data: { id: "v1", user_id: USER, government_id_document_path: "u/id.pdf", proof_of_ownership_path: null } }],
      audit_log: [{ error: { message: "down" } }],
    }).from;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(getVerificationDocumentUrl(ADMIN, "v1", "government-id")).rejects.toMatchObject({ statusCode: 500 });
  });

  it("returns 404 when that document was never uploaded", async () => {
    state.from = tableMock({
      landlord_verifications: [{ data: { id: "v1", user_id: USER, government_id_document_path: null, proof_of_ownership_path: null } }],
    }).from;
    await expect(getVerificationDocumentUrl(ADMIN, "v1", "proof-of-ownership")).rejects.toMatchObject({ statusCode: 404 });
  });
});
