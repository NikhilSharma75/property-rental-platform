import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as savedSearchService from "../services/saved-search.service";

const propertyTypeEnum = z.enum([
  "APARTMENT", "HOUSE", "VILLA", "STUDIO", "TOWNHOUSE", "CONDO", "OTHER",
]);

const filtersSchema = z
  .object({
    search: z.string().trim().max(150).optional(),
    city: z.string().trim().max(100).optional(),
    propertyType: propertyTypeEnum.optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    minBedrooms: z.coerce.number().int().min(0).max(50).optional(),
    minBathrooms: z.coerce.number().min(0).max(50).optional(),
    amenities: z.array(z.string().trim().max(40)).max(20).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(0).max(1000).optional(),
  })
  .strict();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: filtersSchema,
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    alertsEnabled: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.alertsEnabled !== undefined, {
    message: "Provide a name or alertsEnabled.",
  });

const idSchema = z.string().uuid();

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const savedSearches = await savedSearchService.listSavedSearches(req.user!.sub);
    res.status(200).json({ savedSearches });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body);
    const savedSearch = await savedSearchService.createSavedSearch(req.user!.sub, body);
    res.status(201).json({ savedSearch });
  } catch (err) { next(err); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    const body = updateSchema.parse(req.body);
    const savedSearch = await savedSearchService.updateSavedSearch(req.user!.sub, id, body);
    res.status(200).json({ savedSearch });
  } catch (err) { next(err); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = idSchema.parse(req.params.id);
    await savedSearchService.deleteSavedSearch(req.user!.sub, id);
    res.status(200).json({ message: "Saved search deleted." });
  } catch (err) { next(err); }
}

