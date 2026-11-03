import { DocumentCategory, UserRole } from "../types";

export interface UploadPolicy {
  roles: UserRole[];      // who may upload this category through the generic endpoint
  mimes: string[];
  maxBytes: number;
  maxPerOwner: number;    // per-user quota for this category
}

const MB = 1024 * 1024;
const IMAGES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Categories a client may upload via POST /api/documents/:category.
 * Everything else is deliberately absent:
 *  - LEASE_DOCUMENT / RECEIPT are produced by the server only (allowing them would let anyone forge one).
 *  - APPLICATION_DOCUMENT / MAINTENANCE_ATTACHMENT only go through their own endpoints, which check the parent record.
 */
export const CLIENT_UPLOAD_POLICY: Partial<Record<DocumentCategory, UploadPolicy>> = {
  USER_DOCUMENT: { roles: ["TENANT", "LANDLORD"], mimes: [...IMAGES, "application/pdf"], maxBytes: 10 * MB, maxPerOwner: 20 },
};

/** Categories an owner may delete. Server-generated records (leases, receipts) and records tied to an application or maintenance request stay put. */
export const OWNER_DELETABLE: DocumentCategory[] = ["USER_DOCUMENT"];

export const ALL_CATEGORIES: [DocumentCategory, ...DocumentCategory[]] = [
  "USER_DOCUMENT", "LEASE_DOCUMENT", "RECEIPT", "MAINTENANCE_ATTACHMENT", "APPLICATION_DOCUMENT",
];