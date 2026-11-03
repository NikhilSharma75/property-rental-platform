import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as admin from "../services/admin.service";

const uuid = z.string().uuid();
const page = z.coerce.number().int().min(1).max(10000).optional();
const handler = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export const stats = handler(async (_req, res) => res.json(await admin.getStats()));



export const listUsers = handler(async (req, res) => {
  const q = z.object({
    search: z.string().max(100).optional(),
    role: z.enum(["TENANT", "LANDLORD", "ADMIN"]).optional().or(z.literal("").transform(() => undefined)),
    status: z.enum(["active", "suspended"]).optional().or(z.literal("").transform(() => undefined)),
    page,
  }).parse(req.query);
  res.json(await admin.listUsers(q));
});




export const setSuspension = handler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { suspended, reason } = z.object({ suspended: z.boolean(), reason: z.string().trim().max(300).optional() }).parse(req.body);
  res.json({ user: await admin.setSuspension(req.user!.sub, id, suspended, reason) });
});



export const listProperties = handler(async (req, res) => {
  const q = z.object({
    search: z.string().max(100).optional(),
  status: z.enum(["DRAFT", "AVAILABLE", "RESERVED", "RENTED", "ARCHIVED"]).optional().or(z.literal("").transform(() => undefined)),
    page,
  }).parse(req.query);
  res.json(await admin.listProperties(q));
});

export const setPropertyStatus = handler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { status } = z.object({ status: z.enum(["DRAFT", "AVAILABLE", "RENTED", "ARCHIVED"]) }).parse(req.body);
  res.json({ property: await admin.setPropertyStatus(req.user!.sub, id, status) });
});

export const listApplications = handler(async (req, res) => {
  const q = z.object({
    search: z.string().max(100).optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "EXPIRED"]).optional().or(z.literal("").transform(() => undefined)),
    page,
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  res.json(await admin.listApplications(q));
});

const emptyToUndefined = z.literal("").transform(() => undefined);

export const listVerifications = handler(async (req, res) => {
  const q = z.object({
    status: z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional().or(emptyToUndefined),
    page,
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }).parse(req.query);
  res.json(await admin.listVerifications(q.status, q.page, q.limit));
});



export const listAudit = handler(async (req, res) => {
  const q = z.object({
    page,
    action: z.string().regex(/^[A-Z_]{3,60}$/).optional().or(emptyToUndefined),
    targetType: z.string().regex(/^[A-Z_]{2,30}$/).optional().or(emptyToUndefined),
    since: z.string().date().optional().or(emptyToUndefined),
    until: z.string().date().optional().or(emptyToUndefined),
  }).parse(req.query);
  res.json(await admin.listAudit({
    page: q.page, action: q.action, targetType: q.targetType,
    since: q.since ? `${q.since}T00:00:00.000Z` : undefined,
    until: q.until ? `${q.until}T23:59:59.999Z` : undefined,
  }));
});

export const reviewVerification = handler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const b = z.object({ status: z.enum(["VERIFIED", "REJECTED"]), rejectionReason: z.string().max(300).optional() }).parse(req.body);
  res.json({ verification: await admin.reviewVerification(req.user!.sub, id, b.status, b.rejectionReason) });
});

export const listReports = handler(async (req, res) => {
  const q = z.object({
    kind: z.enum(["COMPLAINT", "REVIEW_FLAG", "LISTING_REPORT"]).optional().or(z.literal("").transform(() => undefined)),
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]).optional().or(z.literal("").transform(() => undefined)),
    search: z.string().max(100).optional(),
    page,
  }).parse(req.query);
  res.json(await admin.listReports(q));
});

export const resolveReport = handler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const b = z.object({
    status: z.enum(["INVESTIGATING", "RESOLVED", "DISMISSED"]),
    resolution: z.string().trim().max(1000).optional(),
  }).parse(req.body);
  res.json({ report: await admin.resolveReport(req.user!.sub, id, b.status, b.resolution) });
});




export const listReviews = handler(async (req, res) => {
  const q = z.object({ hidden: z.enum(["true", "false"]).optional().or(z.literal("").transform(() => undefined)), page }).parse(req.query);
  res.json(await admin.listReviews(q));
});

export const setReviewHidden = handler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { hidden, reason } = z.object({ hidden: z.boolean(), reason: z.string().max(300).optional() }).parse(req.body);
  res.json({ review: await admin.setReviewHidden(req.user!.sub, id, hidden, reason) });
});

export const getVerificationDocument = handler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const kind = z.enum(["government-id", "proof-of-ownership"]).parse(req.params.kind);
  res.json(await admin.getVerificationDocumentUrl(req.user!.sub, id, kind));
});
