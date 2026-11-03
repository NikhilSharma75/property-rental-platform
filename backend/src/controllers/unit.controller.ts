import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as units from "../services/unit.service";

const uuid = z.string().uuid();
const body = z.object({
  unitLabel: z.string().trim().min(1).max(40),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().min(0).max(20),
  areaSqft: z.number().min(0).nullable().optional(),
  rentAmount: z.number().min(0),
  depositAmount: z.number().min(0).nullable().optional(),
});
const patch = body.partial().extend({ status: z.enum(["AVAILABLE", "UNAVAILABLE"]).optional() });



const h = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

export const list = h(async (req, res) => {
  res.json({ units: await units.listUnits(req.user!.sub, uuid.parse(req.params.id)) });
});
export const create = h(async (req, res) => {
  res.status(201).json({ unit: await units.createUnit(req.user!.sub, uuid.parse(req.params.id), body.parse(req.body)) });
});
export const update = h(async (req, res) => {
  res.json({ unit: await units.updateUnit(req.user!.sub, uuid.parse(req.params.id), uuid.parse(req.params.unitId), patch.parse(req.body)) });
});
export const remove = h(async (req, res) => {
  await units.deleteUnit(req.user!.sub, uuid.parse(req.params.id), uuid.parse(req.params.unitId));
  res.json({ message: "Unit deleted." });
});