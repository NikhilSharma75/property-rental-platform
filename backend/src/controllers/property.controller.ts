import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as propertyService from "../services/property.service";

const propertyTypeEnum = z.enum(["APARTMENT", "HOUSE", "VILLA", "STUDIO", "TOWNHOUSE", "CONDO", "OTHER"]);
// RESERVED is included so an edit that keeps the current status doesn't fail validation; the
// service still refuses to let a landlord set it (or move away from it) by hand.
const statusEnum = z.enum(["DRAFT", "AVAILABLE", "RESERVED", "RENTED", "ARCHIVED"]);

const nullableString = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v === "" ? null : v));

const createPropertySchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: nullableString(2000),
  propertyType: propertyTypeEnum,
  addressLine1: z.string().trim().min(3).max(150),
  addressLine2: nullableString(150),
  city: z.string().trim().min(1).max(100),
  state: nullableString(100),
  postalCode: nullableString(20),
  country: nullableString(100),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().min(0).max(50),
  areaSqft: z.number().min(0).max(1_000_000).optional().nullable(),
  rentAmount: z.number().min(0),
  depositAmount: z.number().min(0).optional().nullable(),
  amenities: z.array(z.string().trim().max(40)).max(20).optional(),
  status: statusEnum.optional(),
  // Optional map coordinates. They are what powers "near me" / distance sorting.
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

const updatePropertySchema = createPropertySchema.partial();

export async function listProperties(req: Request, res: Response, next: NextFunction) {
  try {
    const properties = await propertyService.listProperties(req.user!.sub);
    res.status(200).json({ properties });
  } catch (err) { next(err); }
}

export async function getProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.getProperty(req.user!.sub, req.params.id as string);
    res.status(200).json({ property });
  } catch (err) { next(err); }
}

export async function createProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createPropertySchema.parse(req.body);
    const property = await propertyService.createProperty(req.user!.sub, body);
    res.status(201).json({ property });
  } catch (err) { next(err); }
}

export async function updateProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updatePropertySchema.parse(req.body);
    const property = await propertyService.updateProperty(req.user!.sub, req.params.id as string, body);
    res.status(200).json({ property });
  } catch (err) { next(err); }
}

export async function deleteProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await propertyService.deleteProperty(req.user!.sub, req.params.id as string);
    res.status(200).json({
      message: "Property archived. It is no longer public, and you can restore it at any time.",
      result,
    });
  } catch (err) { next(err); }
}

export async function restoreProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.restoreProperty(req.user!.sub, req.params.id as string);
    res.status(200).json({ property, message: "Property restored as a draft. Publish it when you're ready." });
  } catch (err) { next(err); }
}

export async function uploadPropertyImages(req: Request, res: Response, next: NextFunction) {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No photos were provided." });
    }
    const property = await propertyService.addPropertyImages(req.user!.sub, req.params.id as string, files);
    res.status(200).json({ property });
  } catch (err) { next(err); }
}

const removeImageSchema = z.object({ url: z.string().url() });

export async function removePropertyImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { url } = removeImageSchema.parse(req.body);
    const property = await propertyService.removePropertyImage(req.user!.sub, req.params.id as string, url);
    res.status(200).json({ property });
  } catch (err) { next(err); }
}

