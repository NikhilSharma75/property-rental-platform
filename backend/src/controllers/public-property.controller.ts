import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as publicPropertyService from "../services/public-property.service";

const num = () => z.coerce.number().optional();

const searchQuerySchema = z.object({
  search: z.string().trim().max(150).optional(),
  city: z.string().trim().max(100).optional(),
  propertyType: z.enum(["APARTMENT", "HOUSE", "VILLA", "STUDIO", "TOWNHOUSE", "CONDO", "OTHER"]).optional(),
  minPrice: num(),
  maxPrice: num(),
  minBedrooms: num(),
  minBathrooms: num(),
  amenities: z.string().trim().optional(), // comma-separated
  lat: num(),
  lng: num(),
  radiusKm: num(),
  sort: z.enum(["newest", "oldest", "price_asc", "price_desc", "distance"]).optional(),
  page: num(),
  limit: num(),
});

export async function listPublicProperties(req: Request, res: Response, next: NextFunction) {
  try {
    const q = searchQuerySchema.parse(req.query);
    const result = await publicPropertyService.searchProperties({
      ...q,
      amenities: q.amenities ? q.amenities.split(",").map((a) => a.trim()).filter(Boolean) : undefined,
    });
    const properties = await publicPropertyService.attachFavoriteFlags(result.properties, req.user?.sub);
    res.status(200).json({ ...result, properties });
  } catch (err) { next(err); }
}

export async function getPublicProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const property = await publicPropertyService.getPublicProperty(id);
    if (!property) return res.status(404).json({ message: "Property not found." });
    const [withFlag] = await publicPropertyService.attachFavoriteFlags([property], req.user?.sub);
    res.status(200).json({ property: withFlag });
  } catch (err) { next(err); }
}

export async function listAvailableUnits(req: Request, res: Response, next: NextFunction) {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const property = await publicPropertyService.getPublicProperty(id);
    if (!property) return res.status(404).json({ message: "Property not found." });
    res.status(200).json(await publicPropertyService.listUnitsForApplying(id));
  } catch (err) { next(err); }
}
