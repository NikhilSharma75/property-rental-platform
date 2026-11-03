import { Request, Response, NextFunction } from "express";
import * as dashboardService from "../services/dashboard.service";

export async function landlordStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getLandlordStats(req.user!.sub);
    res.status(200).json(stats);
  } catch (err) { next(err); }
}

export async function tenantStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getTenantStats(req.user!.sub);
    res.status(200).json(stats);
  } catch (err) { next(err); }
}