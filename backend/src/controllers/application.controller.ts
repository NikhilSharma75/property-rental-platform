import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as applicationService from "../services/application.service";

const createApplicationSchema = z.object({
  propertyId: z.string().uuid(),
  // Multi-unit properties require the tenant to pick one available unit. Without this field the
  // controller silently stripped unitId, which made every application to a building fail.
  unitId: z.string().uuid().optional(),
  desiredMoveInDate: z.string().date(),
  leaseDurationMonths: z.coerce.number().int().min(1).max(60),
  monthlyIncome: z.coerce.number().positive().optional(),
  employmentStatus: z.string().max(100).optional(),
  employerName: z.string().max(150).optional(),
  additionalNotes: z.string().max(1000).optional(),
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

export async function createApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createApplicationSchema.parse(req.body);
    const application = await applicationService.createApplication(req.user!.sub, input);
    res.status(201).json({ application });
  } catch (err) { next(err); }
}

export async function uploadDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as { idProof?: Express.Multer.File[]; incomeProof?: Express.Multer.File[]; referenceLetter?: Express.Multer.File[] };
    const documents = await applicationService.addApplicationDocuments(req.params.id as string, req.user!.sub, files);
    res.status(201).json({ documents });
  } catch (err) { next(err); }
}

export async function getApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await applicationService.getApplicationDetail(req.params.id as string, req.user!.sub, req.user!.role);
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await applicationService.listMyApplications(req.user!.sub);
    res.status(200).json({ applications });
  } catch (err) { next(err); }
}

export async function listForLandlord(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "EXPIRED"]).optional(),
      propertyId: z.string().uuid().optional(),
    }).parse(req.query);
    const applications = await applicationService.listLandlordApplications(
      req.user!.sub,
      query.status,
      query.propertyId
    );
    res.status(200).json({ applications });
  } catch (err) { next(err); }
}

export async function withdraw(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await applicationService.withdrawApplication(req.params.id as string, req.user!.sub);
    res.status(200).json({ application });
  } catch (err) { next(err); }
}

export async function review(req: Request, res: Response, next: NextFunction) {
  try {
    const input = reviewSchema.parse(req.body);
    const application = await applicationService.updateApplicationStatus(
      req.params.id as string, req.user!.sub, input.status, input.rejectionReason
    );
    res.status(200).json({ application });
  } catch (err) { next(err); }
}