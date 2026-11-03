import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { rateLimit } from "../middleware/rateLimit.middleware";
import { supabaseAdmin } from "../config/supabase";

const fail = (m: string, statusCode: number) => Object.assign(new Error(m), { statusCode });
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

/** Which target types each report kind may point at. */
const KIND_TARGETS: Record<string, string[]> = {
  LISTING_REPORT: ["PROPERTY"],
  REVIEW_FLAG: ["REVIEW"],
  COMPLAINT: ["USER", "PROPERTY", "LEASE", "OTHER"],
};

/** Confirms the target exists (and, for leases, that the reporter is a party to it). */
async function assertTargetValid(reporterId: string, targetType: string, targetId: string) {
  if (targetType === "PROPERTY") {
    const { data } = await supabaseAdmin.from("properties").select("id").eq("id", targetId).maybeSingle();
    if (!data) throw fail("That property could not be found.", 404);
  } else if (targetType === "REVIEW") {
    const { data } = await supabaseAdmin.from("reviews").select("id").eq("id", targetId).maybeSingle();
    if (!data) throw fail("That review could not be found.", 404);
  } else if (targetType === "USER") {
    if (targetId === reporterId) throw fail("You can't report your own account.", 400);
    const { data } = await supabaseAdmin.from("users").select("id").eq("id", targetId).maybeSingle();
    if (!data) throw fail("That user could not be found.", 404);
  } else if (targetType === "LEASE") {
    const { data } = await supabaseAdmin.from("leases").select("id, tenant_id, landlord_id").eq("id", targetId).maybeSingle();
    // Not a party looks the same as "doesn't exist", so lease IDs can't be probed.
    if (!data || (data.tenant_id !== reporterId && data.landlord_id !== reporterId)) throw fail("That lease could not be found.", 404);
  }
}

/** POST /api/reports - any signed-in user files a complaint / flags a review / reports a listing. */
export const reportRouter = Router();
reportRouter.use(requireAuth);
reportRouter.post(
  "/",
  // Keyed by user id, not IP: people behind one office/campus network don't share a limit, and one person can't dodge it with several IPs.
  rateLimit({ windowMs: 60 * 60_000, max: 10, keyPrefix: "report", key: (req) => req.user?.sub }),
  wrap(async (req, res) => {
    const b = z.object({
      kind: z.enum(["COMPLAINT", "REVIEW_FLAG", "LISTING_REPORT"]),
      targetType: z.enum(["USER", "PROPERTY", "REVIEW", "LEASE", "OTHER"]).optional(),
      targetId: z.string().uuid().optional(),
      subject: z.string().trim().min(3).max(150),
      details: z.string().trim().max(2000).optional(),
    }).parse(req.body);

    const reporterId = req.user!.sub;

    // Kind and target must agree, and anything other than a general complaint must name a real target.
    const allowed = KIND_TARGETS[b.kind];
    const targetType = b.targetType ?? (b.kind === "COMPLAINT" ? "OTHER" : undefined);
    if (!targetType || !allowed.includes(targetType)) throw fail("That report doesn't match what it is about.", 400);
    if (targetType === "OTHER") {
      if (b.targetId) throw fail("A general complaint can't point at a specific item.", 400);
    } else {
      if (!b.targetId) throw fail("Choose what you are reporting.", 400);
      await assertTargetValid(reporterId, targetType, b.targetId);
    }

    const { data, error } = await supabaseAdmin.from("reports").insert({
      kind: b.kind, target_type: targetType, target_id: b.targetId ?? null,
      subject: b.subject, details: b.details ?? null, reporter_id: reporterId,
    }).select("id, status, created_at").single();
    // 23505 = reports_one_open_per_reporter_target (migration 006)
    if (error?.code === "23505") throw fail("You already have an open report about this. An admin will get to it.", 409);
    if (error || !data) throw fail("Could not submit your report.", 500);
    res.status(201).json({ report: data });
  }),
);

/** Reviews: tenants who actually held a lease on the property can review it once. */
export const reviewRouter = Router();
reviewRouter.get("/property/:propertyId", wrap(async (req, res) => {
  const propertyId = z.string().uuid().parse(req.params.propertyId);
  const { data, error } = await supabaseAdmin
    .from("reviews").select("id, rating, body, created_at, author_id")
    .eq("property_id", propertyId).eq("is_hidden", false).order("created_at", { ascending: false }).limit(50);
  if (error) throw fail(error.message, 500);
  const ids = [...new Set((data ?? []).map((r) => r.author_id))];
  const { data: users } = ids.length ? await supabaseAdmin.from("users").select("id, full_name").in("id", ids) : { data: [] as any[] };
  const names = new Map((users ?? []).map((u: any) => [u.id, (u.full_name ?? "Tenant").split(" ")[0]]));
  res.json({ reviews: (data ?? []).map((r) => ({ id: r.id, rating: r.rating, body: r.body, created_at: r.created_at, author_name: names.get(r.author_id) ?? "Tenant" })) });
}));

reviewRouter.post("/", requireAuth, requireRole("TENANT"), rateLimit({ windowMs: 60 * 60_000, max: 10, keyPrefix: "review", key: (req) => req.user?.sub }), wrap(async (req, res) => {
  const b = z.object({
    propertyId: z.string().uuid(), rating: z.coerce.number().int().min(1).max(5), body: z.string().trim().max(2000).optional(),
  }).parse(req.body);

  const { data: lease } = await supabaseAdmin.from("leases").select("id")
    .eq("property_id", b.propertyId).eq("tenant_id", req.user!.sub)
    .in("status", ["ACTIVE", "EXPIRED", "TERMINATED"]).limit(1).maybeSingle();
  if (!lease) throw fail("Only tenants who have leased this property can review it.", 403);

  const { data, error } = await supabaseAdmin.from("reviews")
    .insert({ property_id: b.propertyId, author_id: req.user!.sub, lease_id: lease.id, rating: b.rating, body: b.body ?? null })
    .select("id, rating, body, created_at").single();
  if (error) throw fail(error.code === "23505" ? "You have already reviewed this property." : "Could not save review.", error.code === "23505" ? 409 : 500);
  res.status(201).json({ review: data });
}));
