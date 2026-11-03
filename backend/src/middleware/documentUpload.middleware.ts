import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { CLIENT_UPLOAD_POLICY } from "../config/documentPolicy";
import { DocumentCategory } from "../types";

/** Runs BEFORE multer, so a forbidden request is rejected without buffering a 10 MB file. */
export async function authorizeDocumentUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const category = req.params.category as DocumentCategory;
    // hasOwnProperty guard: a category of "__proto__" must not resolve to Object.prototype.
    const policy = Object.prototype.hasOwnProperty.call(CLIENT_UPLOAD_POLICY, category)
      ? CLIENT_UPLOAD_POLICY[category]
      : undefined;
    if (!policy) return res.status(400).json({ message: "Documents of this type can't be uploaded directly." });
    if (!policy.roles.includes(req.user!.role)) {
      return res.status(403).json({ message: "Your account type can't upload this kind of document." });
    }

    const { count, error } = await supabaseAdmin
      .from("documents").select("id", { count: "exact", head: true })
      .eq("owner_id", req.user!.sub).eq("category", category);
    if (error) throw error;
    if ((count ?? 0) >= policy.maxPerOwner) {
      return res.status(409).json({ message: `You've reached the limit of ${policy.maxPerOwner} documents. Delete one to upload another.` });
    }
    next();
  } catch (err) { next(err); }
  
}

