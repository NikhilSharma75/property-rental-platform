import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { tableMock } from "./helpers";

const state = vi.hoisted(() => ({ from: undefined as unknown as (t: string) => unknown, userId: "reporter-1" }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: (t: string) => state.from(t) } }));
vi.mock("../src/middleware/auth.middleware", () => ({
  requireAuth: (req: any, _res: unknown, next: () => void) => { req.user = { sub: state.userId, role: "TENANT" }; next(); },
}));
vi.mock("../src/middleware/role.middleware", () => ({ requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

import { reportRouter } from "../src/routes/report.routes";
import { errorHandler } from "../src/middleware/error.middleware";

const UUID = "33333333-3333-4333-8333-333333333333";
let server: Server;
let base = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/reports", reportRouter);
  app.use(errorHandler);
  await new Promise<void>((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/reports`;
});
afterAll(() => { server.close(); });
beforeEach(() => { state.userId = `reporter-${Math.random()}`; }); // fresh rate-limit bucket per test

const post = (body: unknown) =>
  fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/reports", () => {
  it("rejects a kind that doesn't match the target type", async () => {
    state.from = tableMock({}).from;
    const res = await post({ kind: "LISTING_REPORT", targetType: "REVIEW", targetId: UUID, subject: "Bad one" });
    expect(res.status).toBe(400);
  });

  it("requires a target for listing reports and review flags", async () => {
    state.from = tableMock({}).from;
    const res = await post({ kind: "REVIEW_FLAG", targetType: "REVIEW", subject: "Rude review" });
    expect(res.status).toBe(400);
  });

  it("answers 404 when the target doesn't exist", async () => {
    state.from = tableMock({ properties: [{ data: null }] }).from;
    const res = await post({ kind: "LISTING_REPORT", targetType: "PROPERTY", targetId: UUID, subject: "Fake listing" });
    expect(res.status).toBe(404);
  });

  it("only lets the parties to a lease complain about it", async () => {
    state.from = tableMock({ leases: [{ data: { id: UUID, tenant_id: "someone", landlord_id: "else" } }] }).from;
    const res = await post({ kind: "COMPLAINT", targetType: "LEASE", targetId: UUID, subject: "Not my lease" });
    expect(res.status).toBe(404);
  });

  it("accepts a lease complaint from the tenant on that lease", async () => {
    const db = tableMock({
      leases: [{ data: { id: UUID, tenant_id: state.userId, landlord_id: "landlord" } }],
      reports: [{ data: { id: "r1", status: "OPEN", created_at: "now" } }],
    });
    state.from = db.from;
    const res = await post({ kind: "COMPLAINT", targetType: "LEASE", targetId: UUID, subject: "Heating broken" });
    expect(res.status).toBe(201);
    expect(db.callsFor("reports").find((c) => c.method === "insert")?.args[0]).toMatchObject({ kind: "COMPLAINT", target_type: "LEASE", reporter_id: state.userId });
  });

  it("returns 409 for a duplicate open report (unique index)", async () => {
    state.from = tableMock({
      properties: [{ data: { id: UUID } }],
      reports: [{ error: { code: "23505" } }],
    }).from;
    const res = await post({ kind: "LISTING_REPORT", targetType: "PROPERTY", targetId: UUID, subject: "Scam listing" });
    expect(res.status).toBe(409);
  });

  it("rate-limits per signed-in user, not per IP", async () => {
    state.from = tableMock({ reports: [{ data: { id: "r1", status: "OPEN", created_at: "now" } }] }).from;
    const send = () => post({ kind: "COMPLAINT", subject: "General problem" });
    for (let i = 0; i < 10; i++) expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(429);

    state.userId = "a-different-user"; // same IP, different account: still allowed
    expect((await send()).status).toBe(201);
  });
});
