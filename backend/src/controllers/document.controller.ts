import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as storageService from "../services/storage.service";
import { ALL_CATEGORIES, CLIENT_UPLOAD_POLICY } from "../config/documentPolicy";
import { DocumentCategory } from "../types";

const uploadCategories = Object.keys(CLIENT_UPLOAD_POLICY) as [DocumentCategory, ...DocumentCategory[]];
const categoryParamSchema = z.object({ category: z.enum(uploadCategories) });
const listQuerySchema = z.object({ category: z.enum(ALL_CATEGORIES).optional() });

export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { category } = categoryParamSchema.parse({ category: req.params.category });
    const policy = CLIENT_UPLOAD_POLICY[category]!;
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    if (!policy.mimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "That file type isn't allowed for this kind of document." });
    }
    if (req.file.size > policy.maxBytes) {
      return res.status(400).json({ message: `File is too large (max ${Math.round(policy.maxBytes / 1024 / 1024)} MB).` });
    }

    const doc = await storageService.uploadDocument({ ownerId: req.user!.sub, category, file: req.file });
    res.status(201).json({ document: doc });
  } catch (err) { next(err); }
}

export async function listMyDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const { category } = listQuerySchema.parse(req.query);
    const docs = await storageService.listDocuments({ ownerId: req.user!.sub, category });
    const withUrls = await Promise.all(docs.map(async (d) => ({ ...d, url: await storageService.getSignedUrl(d) })));
    res.status(200).json({ documents: withUrls });
  } catch (err) { next(err); }
}

export async function deleteDocument(req: Request, res: Response, next: NextFunction) {
  try {
    await storageService.deleteDocument(req.params.id as string, req.user!.sub);
    res.status(200).json({ message: "Document deleted." });
  } catch (err) { next(err); }
}