import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as profileService from "../services/profile.service";

const nullableString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v));

/** YYYY-MM-DD, and a real calendar date (rejects things like 2026-02-31 that Postgres would choke on). */
const dateOnly = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v))
  .refine((v) => {
    if (v === null) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const [y, m, d] = v.split("-").map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
  }, { message: "Use a valid date (YYYY-MM-DD)." });

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: nullableString(30),
  alternatePhone: nullableString(30),
  dateOfBirth: dateOnly,
  bio: nullableString(500),
  addressLine1: nullableString(150),
  addressLine2: nullableString(150),
  city: nullableString(100),
  state: nullableString(100),
  postalCode: nullableString(20),
  country: nullableString(100),
});

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const profile = await profileService.getFullProfile(userId);

    if (profile.role === "LANDLORD") {
      const verification = await profileService.getLandlordVerification(userId);
      return res.status(200).json({ profile, verification });
    }

    res.status(200).json({ profile, verification: null });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateProfileSchema.parse(req.body);
    const profile = await profileService.updateProfile(req.user!.sub, body);
    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadProfileImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file was provided." });
    }
    const profile = await profileService.setProfileImage(req.user!.sub, req.file);
    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function deleteProfileImage(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await profileService.removeProfileImage(req.user!.sub);
    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function getVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const verification = await profileService.getLandlordVerification(req.user!.sub);
    res.status(200).json({ verification });
  } catch (err) {
    next(err);
  }
}

const verificationSchema = z.object({
  governmentIdType: z.enum(["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE"]),
  governmentIdNumber: z.string().trim().min(3).max(60),
  businessName: nullableString(150),
  businessRegistrationNumber: nullableString(80),
  taxId: nullableString(80),
});

export async function submitVerification(req: Request, res: Response, next: NextFunction) {
  try {
    const body = verificationSchema.parse(req.body);
    const files = req.files as
      | { governmentIdDocument?: Express.Multer.File[]; proofOfOwnership?: Express.Multer.File[] }
      | undefined;

    const verification = await profileService.submitLandlordVerification(req.user!.sub, body, {
      governmentIdDocument: files?.governmentIdDocument?.[0],
      proofOfOwnership: files?.proofOfOwnership?.[0],
    });

    res.status(200).json({ verification });
  } catch (err) {
    next(err);
  }
}
