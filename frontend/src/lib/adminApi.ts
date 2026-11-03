import { request } from "./api";

export interface Paged<T> { items: T[]; total: number; page: number; limit: number; totalPages: number }

export interface AdminStats {
  totalUsers: number; tenants: number; landlords: number; suspendedUsers: number;
  totalProperties: number; activeListings: number; pendingVerifications: number;
  openReports: number; pendingApplications: number; activeLeases: number; monthlyVolume: number;
  signupsSeries: { month: string; tenants: number; landlords: number }[];
  volumeSeries: { month: string; amount: number }[];
  recentActivity: { id: string; type: string; message: string; created_at: string }[];
}

export interface AdminUser {
  id: string; full_name: string | null; email: string; phone: string | null;
  role: "TENANT" | "LANDLORD" | "ADMIN"; is_verified: boolean; is_suspended: boolean;
  suspended_reason: string | null; created_at: string;
}

export interface AdminProperty {
  id: string; title: string; city: string; status: "DRAFT" | "AVAILABLE" | "RESERVED" | "RENTED" | "ARCHIVED";
  rent_amount: number; created_at: string; landlord: { id: string; full_name: string | null; email: string } | null;
}

export interface AdminVerification {
  id: string; user_id: string; status: "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
  government_id_type: string | null; business_name: string | null; submitted_at: string | null;
  has_government_id_document: boolean; has_proof_of_ownership_document: boolean;
  user: { full_name: string | null; email: string };
}



export type ReportKind = "COMPLAINT" | "REVIEW_FLAG" | "LISTING_REPORT";
export type ReportStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
export interface AdminReport {
  id: string; kind: ReportKind; status: ReportStatus;
  subject: string; details: string | null; created_at: string; updated_at: string; resolved_at: string | null;
  reporter: { full_name: string | null; email: string } | null;
  resolver: { full_name: string | null; email: string } | null;
  target_label: string | null; target_href: string | null; resolution: string | null;
}



export interface AdminApplication {
  id: string; status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "EXPIRED"; created_at: string;
  desired_move_in_date: string | null; monthly_income: number | null; rejection_reason: string | null;
  property_id: string; property_title: string | null; property_city: string | null;
  tenant: { full_name: string | null; email: string } | null;
  landlord: { full_name: string | null; email: string } | null;
}
export interface AdminReview {
  id: string; rating: number; body: string | null; is_hidden: boolean; hidden_reason: string | null;
  created_at: string; property_id: string; property_title: string | null;
  author: { full_name: string | null; email: string } | null;
}
export interface AuditEntry {
  id: string; action: string; target_type: string | null; target_id: string | null;
  meta: Record<string, unknown>; created_at: string; actor: { full_name: string | null; email: string } | null;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const adminApi = {
  stats: () => request<AdminStats>("/admin/stats"),

  users: (p: { search?: string; role?: string; status?: string; page?: number }) =>
    request<Paged<AdminUser>>(`/admin/users${qs({ ...p, limit: 15 })}`),
  setSuspended: (id: string, suspended: boolean, reason?: string) =>
    request<{ user: AdminUser }>(`/admin/users/${id}/suspension`, {
      method: "PATCH", body: JSON.stringify({ suspended, reason }),
    }),

  properties: (p: { search?: string; status?: string; page?: number }) =>
    request<Paged<AdminProperty>>(`/admin/properties${qs({ ...p, limit: 15 })}`),
  setPropertyStatus: (id: string, status: AdminProperty["status"]) =>
    request<{ property: AdminProperty }>(`/admin/properties/${id}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),

    verifications: (p: { status?: string; page?: number }) =>
    request<Paged<AdminVerification>>(`/admin/verifications${qs({ ...p, limit: 15 })}`),
  reviewVerification: (id: string, status: "VERIFIED" | "REJECTED", rejectionReason?: string) =>
    request<{ verification: AdminVerification }>(`/admin/verifications/${id}`, {
      method: "PATCH", body: JSON.stringify({ status, rejectionReason }),
    }),

  /** Creates a short-lived signed link for ONE document. Each call is recorded in the audit log. */
  verificationDocument: (id: string, kind: "government-id" | "proof-of-ownership") =>
    request<{ url: string; expiresInSeconds: number }>(`/admin/verifications/${id}/documents/${kind}`),

  applications: (p: { status?: string; search?: string; page?: number }) =>
    request<Paged<AdminApplication>>(`/admin/applications${qs({ ...p, limit: 15 })}`),

  reviews: (p: { hidden?: string; page?: number }) =>
    request<Paged<AdminReview>>(`/admin/reviews${qs({ ...p, limit: 15 })}`),
  setReviewHidden: (id: string, hidden: boolean, reason?: string) =>
    request<{ review: { id: string; is_hidden: boolean } }>(`/admin/reviews/${id}/visibility`, {
      method: "PATCH", body: JSON.stringify({ hidden, reason }),
    }),

   audit: (p: { page?: number; action?: string; targetType?: string; since?: string; until?: string }) =>
    request<Paged<AuditEntry>>(`/admin/audit${qs({ ...p, limit: 25 })}`),

  reports: (p: { kind?: string; status?: string; search?: string; page?: number }) =>
    request<Paged<AdminReport>>(`/admin/reports${qs(p)}`),
  resolveReport: (id: string, status: "INVESTIGATING" | "RESOLVED" | "DISMISSED", resolution?: string) =>
    request<{ report: AdminReport }>(`/admin/reports/${id}`, {
      method: "PATCH", body: JSON.stringify({ status, resolution }),
    }),
};



/** Units belong to a property (a building with many rentable units). */
export interface Unit {
  id: string; property_id: string; unit_label: string; floor: number | null;
  bedrooms: number; bathrooms: number; area_sqft: number | null;
  rent_amount: number; deposit_amount: number | null;
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "UNAVAILABLE";
  tenant: { full_name: string | null; email: string } | null;
}



export interface UnitInput {
  unitLabel: string; floor?: number | null; bedrooms: number; bathrooms: number;
  areaSqft?: number | null; rentAmount: number; depositAmount?: number | null;
}
export const unitApi = {
  list: (propertyId: string) => request<{ units: Unit[] }>(`/properties/${propertyId}/units`),
  create: (propertyId: string, body: UnitInput) =>
    request<{ unit: Unit }>(`/properties/${propertyId}/units`, { method: "POST", body: JSON.stringify(body) }),
  update: (propertyId: string, unitId: string, body: Partial<UnitInput> & { status?: Unit["status"] }) =>
    request<{ unit: Unit }>(`/properties/${propertyId}/units/${unitId}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (propertyId: string, unitId: string) =>
    request<{ message: string }>(`/properties/${propertyId}/units/${unitId}`, { method: "DELETE" }),
};