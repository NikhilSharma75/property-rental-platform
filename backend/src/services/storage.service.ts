import { randomUUID } from "crypto";
import { supabaseAdmin } from "../config/supabase";
import { DocumentCategory, DocumentRecord } from "../types";
import { OWNER_DELETABLE } from "../config/documentPolicy";


const BUCKET_BY_CATEGORY: Record<DocumentCategory, string> = {
  USER_DOCUMENT: "user-documents",
  LEASE_DOCUMENT: "lease-documents",
  RECEIPT: "receipts",
  MAINTENANCE_ATTACHMENT: "maintenance-attachments",
  APPLICATION_DOCUMENT: "application-documents",
};

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function extensionFor(mimetype: string): string {
  switch (mimetype) {
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "application/pdf": return "pdf";
    default: return "jpg";
  }
}

export async function uploadDocument(params: {
  ownerId: string;
  category: DocumentCategory;
  relatedId?: string | null;
  file: Express.Multer.File;
}): Promise<DocumentRecord> {
  const { ownerId, category, relatedId, file } = params;
  const bucket = BUCKET_BY_CATEGORY[category];
  const path = `${ownerId}/${category.toLowerCase()}-${randomUUID()}.${extensionFor(file.mimetype)}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

  if (uploadError) {
    throw Object.assign(new Error(`Failed to upload file: ${uploadError.message}`), { statusCode: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("documents")
    .insert({
      owner_id: ownerId,
      category,
      related_id: relatedId ?? null,
      bucket,
      storage_path: path,
      file_name: file.originalname,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
    })
    .select()
    .single();

  if (error || !data) {
    // roll back the uploaded file if the DB write failed
    await supabaseAdmin.storage.from(bucket).remove([path]).catch(() => {});
    throw Object.assign(new Error("Failed to record uploaded document."), { statusCode: 500 });
  }

  return data as DocumentRecord;
}

export async function getSignedUrl(doc: DocumentRecord): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(doc.bucket)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function listDocuments(params: {
  ownerId?: string;
  category?: DocumentCategory;
  relatedId?: string;
}): Promise<DocumentRecord[]> {
  let query = supabaseAdmin.from("documents").select("*").order("uploaded_at", { ascending: false });
  if (params.ownerId) query = query.eq("owner_id", params.ownerId);
  if (params.category) query = query.eq("category", params.category);
  if (params.relatedId) query = query.eq("related_id", params.relatedId);

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return (data ?? []) as DocumentRecord[];
}

export async function deleteDocument(documentId: string, ownerId: string): Promise<void> {
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("owner_id", ownerId) // ownership check baked in
    .maybeSingle();

  if (fetchError) throw Object.assign(new Error(fetchError.message), { statusCode: 500 });
  if (!doc) throw Object.assign(new Error("Document not found."), { statusCode: 404 });
  if (!OWNER_DELETABLE.includes(doc.category as DocumentCategory)) {
    throw Object.assign(new Error("This document can't be deleted."), { statusCode: 403 });
  }

  // Delete the database row FIRST. If that fails nothing has changed. If the file removal fails afterwards we
  // only leave an unreferenced file behind, never a row that points at a missing file.
  const { error: deleteError } = await supabaseAdmin.from("documents").delete().eq("id", documentId).eq("owner_id", ownerId);
  if (deleteError) throw Object.assign(new Error(deleteError.message), { statusCode: 500 });

  const { error: removeError } = await supabaseAdmin.storage.from(doc.bucket).remove([doc.storage_path]);
  if (removeError) console.error("Orphaned storage file after document delete:", doc.bucket, doc.storage_path, removeError.message);
}

