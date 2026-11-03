import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as leaseService from "../services/lease.service";
import { buildLeasePdf } from "../services/lease-pdf.service";

const createLeaseSchema = z.object({
  applicationId: z.string().uuid(),
  rentAmount: z.coerce.number().positive(),
  securityDeposit: z.coerce.number().nonnegative(),
  leaseStartDate: z.string().date(),
  leaseDurationMonths: z.coerce.number().int().min(1).max(60),
  terms: z.string().max(5000).optional(),
  unitId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "TERMINATED", "EXPIRED", "CANCELLED"]),
});


export async function createLease(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createLeaseSchema.parse(req.body);
    const lease = await leaseService.createLease(req.user!.sub, input);
    res.status(201).json({ lease });
  } catch (err) { next(err); }
}


export async function getLease(req: Request, res: Response, next: NextFunction) {
  try {
    const lease = await leaseService.getLeaseDetail(req.params.id as string, req.user!.sub, req.user!.role);
    res.status(200).json({ lease });
  } catch (err) { next(err); }
}


export async function listMineTenant(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ leases: await leaseService.listMyLeasesTenant(req.user!.sub) });
  } catch (err) { next(err); }
}


export async function listMineLandlord(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ leases: await leaseService.listMyLeasesLandlord(req.user!.sub) });
  } catch (err) { next(err); }
}



export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = statusSchema.parse(req.body);
    const lease = await leaseService.updateLeaseStatus(req.params.id as string, req.user!.sub, status);
    res.status(200).json({ lease });
  } catch (err) { next(err); }
}



export async function sign(req: Request, res: Response, next: NextFunction) {
  try {
    const lease = await leaseService.signLease(req.params.id as string, req.user!.sub);
    res.status(200).json({ lease });
  } catch (err) { next(err); }
}



export async function downloadPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const lease = await leaseService.getLeaseDetail(req.params.id as string, req.user!.sub, req.user!.role);
    const pdf = await buildLeasePdf(lease);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="lease-${lease.id}.pdf"`);
    res.setHeader("Content-Length", pdf.length.toString());
    res.status(200).end(pdf);
  } catch (err) { next(err); }
}
