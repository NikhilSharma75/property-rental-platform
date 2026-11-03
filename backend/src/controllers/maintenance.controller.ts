import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as maintenanceService from "../services/maintenance.service";

const createSchema = z.object({
  propertyId: z.string().uuid(),
  category: z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "STRUCTURAL", "PEST_CONTROL", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "EMERGENCY"]),
  title: z.string().min(3).max(150),
  description: z.string().min(10).max(2000),
});

const statusSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  notes: z.string().max(1000).optional(),
});

const assignSchema = z.object({ assignedTo: z.string().min(2).max(150) });

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createSchema.parse(req.body);
    const request = await maintenanceService.createRequest(req.user!.sub, input);
    res.status(201).json({ request });
  } catch (err) { next(err); }
}

export async function uploadPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    const photos = await maintenanceService.addPhotos(req.params.id as string, req.user!.sub, files);
    res.status(201).json({ photos });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await maintenanceService.getDetail(req.params.id as string, req.user!.sub, req.user!.role);
    res.status(200).json(result);
  } catch (err) { next(err); }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json({ requests: await maintenanceService.listMineTenant(req.user!.sub) });
  } catch (err) { next(err); }
}

export async function listLandlord(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as any;
    res.status(200).json({ requests: await maintenanceService.listForLandlord(req.user!.sub, status) });
  } catch (err) { next(err); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = statusSchema.parse(req.body);
    const request = await maintenanceService.updateStatus(req.params.id as string, req.user!.sub, input.status, input.notes);
    res.status(200).json({ request });
  } catch (err) { next(err); }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  try {
    const { assignedTo } = assignSchema.parse(req.body);
    const request = await maintenanceService.assign(req.params.id as string, req.user!.sub, assignedTo);
    res.status(200).json({ request });
  } catch (err) { next(err); }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const request = await maintenanceService.cancel(req.params.id as string, req.user!.sub);
    res.status(200).json({ request });
  } catch (err) { next(err); }
}
