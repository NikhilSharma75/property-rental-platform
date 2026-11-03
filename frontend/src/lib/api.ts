export interface PublicUser {
  id: string;
  full_name: string;
  email: string;
  role: "TENANT" | "LANDLORD" | "ADMIN";
  phone: string | null;
  profile_image_url: string | null;
  is_verified: boolean;

}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

let accessToken: string | null = null;
let refreshPromise: Promise<{ user: PublicUser; accessToken: string }> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Ensures only one /auth/refresh request is ever in flight at a time.
 * If five requests 401 at once, they all await the SAME refresh call
 * instead of each firing their own -- which avoids the race where a
 * second refresh call reuses a refresh token the first call already rotated.
 */
function refreshOnce(): Promise<{ user: PublicUser; accessToken: string }> {
  if (!refreshPromise) {
    refreshPromise = api.refresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  // When the body is FormData (file uploads) we must NOT set a Content-Type
  // ourselves - the browser needs to add the multipart boundary.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include", // sends the httpOnly refresh-token cookie
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  

   if (res.status === 401 && retry) {
    const refreshed = await refreshOnce().catch(() => null);
    if (refreshed) {
      setAccessToken(refreshed.accessToken);
      return request<T>(path, options, false);
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

export type VerificationStatus = "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
export type GovernmentIdType = "PASSPORT" | "NATIONAL_ID" | "DRIVERS_LICENSE";

export interface FullProfile {
  id: string;
  full_name: string;
  email: string;
  role: "TENANT" | "LANDLORD" | "ADMIN";
  phone: string | null;
  profile_image_url: string | null;
  is_verified: boolean;
  date_of_birth: string | null;
  bio: string | null;
  alternate_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
}

export interface LandlordVerification {
  id: string;
  user_id: string;
  government_id_type: GovernmentIdType | null;
  government_id_number: string | null;
  government_id_document_url: string | null;
  business_name: string | null;
  business_registration_number: string | null;
  tax_id: string | null;
  proof_of_ownership_url: string | null;
  status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface ProfileUpdateBody {
  fullName?: string;
  phone?: string | null;
  alternatePhone?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface VerificationSubmitBody {
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
  businessName?: string | null;
  businessRegistrationNumber?: string | null;
  taxId?: string | null;
  governmentIdDocument?: File | null;
  proofOfOwnership?: File | null;
}


export type PropertyType =
  | "APARTMENT" | "HOUSE" | "VILLA" | "STUDIO" | "TOWNHOUSE" | "CONDO" | "OTHER";
export type PropertyStatus = "DRAFT" | "AVAILABLE" | "RESERVED" | "RENTED" | "ARCHIVED";

export interface Property {
  id: string;
  landlord_id: string;
  title: string;
  description: string | null;
  property_type: PropertyType;
  status: PropertyStatus;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number | null;
  rent_amount: number;
  deposit_amount: number | null;
  amenities: string[];
  images: string[];
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PropertyInput {
  title: string;
  description?: string | null;
  propertyType: PropertyType;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  bedrooms: number;
  bathrooms: number;
  areaSqft?: number | null;
  rentAmount: number;
  depositAmount?: number | null;
  amenities?: string[];
  status?: PropertyStatus;
  latitude?: number | null;
  longitude?: number | null;
}

export const api = {
  register: (body: {
    fullName: string;
    email: string;
    password: string;
    role: "TENANT" | "LANDLORD";
    phone?: string;
  }) =>
    request<{ user: PublicUser; accessToken: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: PublicUser; accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () => request<{ message: string }>("/auth/logout", { method: "POST" }),

  refresh: () =>
    request<{ user: PublicUser; accessToken: string }>(
      "/auth/refresh",
      { method: "POST" },
      false
    ),

  me: () => request<{ user: PublicUser }>("/auth/me"),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  // API field is `newPassword` (see backend auth.controller resetSchema)
  resetPassword: (body: { token: string; password: string }) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token: body.token, newPassword: body.password }),
    }),

  getProfile: () =>
    request<{ profile: FullProfile; verification: LandlordVerification | null }>("/profile"),

  updateProfile: (body: ProfileUpdateBody) =>
    request<{ profile: FullProfile }>("/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  uploadProfileImage: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    return request<{ profile: FullProfile }>("/profile/image", {
      method: "POST",
      body: form,
    });
  },

  deleteProfileImage: () =>
    request<{ profile: FullProfile }>("/profile/image", { method: "DELETE" }),

  getLandlordVerification: () =>
    request<{ verification: LandlordVerification }>("/profile/verification"),

  submitLandlordVerification: (body: VerificationSubmitBody) => {
    const form = new FormData();
    form.append("governmentIdType", body.governmentIdType);
    form.append("governmentIdNumber", body.governmentIdNumber);
    if (body.businessName) form.append("businessName", body.businessName);
    if (body.businessRegistrationNumber)
      form.append("businessRegistrationNumber", body.businessRegistrationNumber);
    if (body.taxId) form.append("taxId", body.taxId);
    if (body.governmentIdDocument) form.append("governmentIdDocument", body.governmentIdDocument);
    if (body.proofOfOwnership) form.append("proofOfOwnership", body.proofOfOwnership);

    return request<{ verification: LandlordVerification }>("/profile/verification", {
      method: "POST",
      body: form,
    });
  },

  listProperties: () => request<{ properties: Property[] }>("/properties"),

  getProperty: (id: string) => request<{ property: Property }>(`/properties/${id}`),

  createProperty: (body: PropertyInput) =>
    request<{ property: Property }>("/properties", { method: "POST", body: JSON.stringify(body) }),

  updateProperty: (id: string, body: Partial<PropertyInput>) =>
    request<{ property: Property }>(`/properties/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  /** "Delete" archives the property (it is never hard-deleted). Restore it with restoreProperty. */
  deleteProperty: (id: string) =>
    request<{ message: string; result: "ARCHIVED" }>(`/properties/${id}`, { method: "DELETE" }),

  restoreProperty: (id: string) =>
    request<{ property: Property; message: string }>(`/properties/${id}/restore`, { method: "POST" }),

  uploadPropertyImages: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("images", file));
    return request<{ property: Property }>(`/properties/${id}/images`, { method: "POST", body: form });
  },

  removePropertyImage: (id: string, url: string) =>
    request<{ property: Property }>(`/properties/${id}/images`, {
      method: "DELETE",
      body: JSON.stringify({ url }),
    }),
};



export interface PublicProperty {
  id: string;
  landlord_id: string;
  title: string;
  description: string | null;
  property_type: PropertyType;
  status: "DRAFT" | "AVAILABLE" | "RESERVED" | "RENTED" | "ARCHIVED";
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number | null;
  rent_amount: number;
  deposit_amount: number | null;
  amenities: string[];
  images: string[];
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  distance_km: number | null;
  is_favorited: boolean;

}

export interface PropertySearchParams {
  search?: string;
  city?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  amenities?: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "distance";
  page?: number;
  limit?: number;
}

export interface PropertySearchResult {
  properties: PublicProperty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function toQueryString(params: PropertySearchParams): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  return qs.toString();
}

export interface PublicUnit {
  id: string;
  unit_label: string;
  floor: number | null;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number | null;
  rent_amount: number;
  deposit_amount: number | null;
}



export const publicPropertyApi = {
  search: (params: PropertySearchParams) =>
    request<PropertySearchResult>(`/public/properties?${toQueryString(params)}`),

  getById: (id: string) =>
    request<{ property: PublicProperty }>(`/public/properties/${id}`),

  availableUnits: (id: string) =>
    request<{ hasUnits: boolean; units: PublicUnit[] }>(`/public/properties/${id}/units`),
};

export const favoriteApi = {
  list: () => request<{ properties: PublicProperty[] }>("/favorites"),
  add: (propertyId: string) =>
    request<{ message: string }>(`/favorites/${propertyId}`, { method: "POST" }),
  remove: (propertyId: string) =>
    request<{ message: string }>(`/favorites/${propertyId}`, { method: "DELETE" }),
};



// ─── Types ─────────────────────────────────────────────────────────────────
export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";

export type DocumentCategory =
  | "USER_DOCUMENT"
  | "LEASE_DOCUMENT"
  | "RECEIPT"
  | "MAINTENANCE_ATTACHMENT"
  | "APPLICATION_DOCUMENT";


export interface DocumentRecord {
  id: string;
  owner_id: string;
  category: DocumentCategory;
  related_id: string | null;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
  url?: string | null; // present on list responses
}

export interface RentalApplication {
  id: string;
  property_id: string;
  tenant_id: string;
  status: ApplicationStatus;
  desired_move_in_date: string;
  lease_duration_months: number;
  monthly_income: number | null;
  employment_status: string | null;
  employer_name: string | null;
  additional_notes: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
    unit_id: string | null;
  expires_at: string | null;
}

export interface ApplicationWithProperty extends RentalApplication {
  properties?: {
    title: string;
    city: string;
    rent_amount: number;
    images: unknown;
  };

  // landlord list also joins tenant identity:
  users?: { full_name: string | null; email: string; phone: string | null };
}

export interface CreateApplicationInput {
  propertyId: string;
  desiredMoveInDate: string;   // yyyy-mm-dd
  leaseDurationMonths: number;
  monthlyIncome?: number;
  employmentStatus?: string;
  employerName?: string;
  additionalNotes?: string;
  unitId?: string;
}



// ─── Applications ──────────────────────────────────────────────────────────
export const applicationApi = {
  async create(input: CreateApplicationInput) {
    return request<{ application: RentalApplication }>("/applications", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async uploadDocuments(
    id: string,
    files: { idProof?: File; incomeProof?: File; referenceLetter?: File }
  ) {
    const form = new FormData();
    if (files.idProof) form.append("idProof", files.idProof);
    if (files.incomeProof) form.append("incomeProof", files.incomeProof);
    if (files.referenceLetter) form.append("referenceLetter", files.referenceLetter);

    return request<{ documents: DocumentRecord[] }>(
      `/applications/${id}/documents`,
      { method: "POST", body: form } // NOTE: do not set Content-Type manually
    );
  },

  async get(id: string) {
    return request<{ application: RentalApplication; documents: DocumentRecord[] }>(
      `/applications/${id}`
    );
  },

  async listMine() {
    return request<{ applications: ApplicationWithProperty[] }>("/applications/mine");
  },

  async listForLandlord(status?: ApplicationStatus, propertyId?: string) {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (propertyId) qs.set("propertyId", propertyId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ applications: ApplicationWithProperty[] }>(`/applications/landlord${suffix}`);
  },

  async withdraw(id: string) {
    return request<{ application: RentalApplication }>(
      `/applications/${id}/withdraw`,
      { method: "PATCH" }
    );
  },

  async review(id: string, input: { status: "APPROVED" | "REJECTED"; rejectionReason?: string }) {
    return request<{ application: RentalApplication }>(
      `/applications/${id}/review`,
      { method: "PATCH", body: JSON.stringify(input) }
    );


  },
};


// ─── Generic documents ─────────────────────────────────────────────────────
export const documentApi = {
  async upload(category: DocumentCategory, file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ document: DocumentRecord }>(
      `/documents/${category}`,
      { method: "POST", body: form }
    );
  },

  async listMine(category?: DocumentCategory) {
    const qs = category ? `?category=${category}` : "";
    return request<{ documents: DocumentRecord[] }>(`/documents${qs}`);
  },


  
  async remove(id: string) {
    return request<{ message: string }>(`/documents/${id}`, { method: "DELETE" });
  },
};



// ─── Leases ────────────────────────────────────────────────────────────────
export type LeaseStatus = "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED" | "CANCELLED";


export interface Lease {
  id: string;
  application_id: string | null;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  rent_amount: number;
  security_deposit: number;
  lease_start_date: string;
  lease_end_date: string;
  lease_duration_months: number;
  terms: string | null;
  status: LeaseStatus;
  signed_by_tenant: boolean;
  signed_by_landlord: boolean;
  created_at: string;
  updated_at: string;
    unit_id?: string | null;
}

export interface LeaseWithProperty extends Lease {
  properties?: { title: string; city: string; images: unknown };
  units?: { unit_label: string } | null;
  users?: { full_name: string | null; email: string; phone: string | null }; // landlord list joins tenant identity
}



export interface CreateLeaseInput {
  applicationId?: string;
  propertyId?: string;
  tenantId?: string;
  rentAmount: number;
  securityDeposit: number;
  leaseStartDate: string; // yyyy-mm-dd
  leaseDurationMonths: number;
  terms?: string;

}

export const leaseApi = {
  async create(input: CreateLeaseInput) {
    return request<{ lease: Lease }>("/leases", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async get(id: string) {
    return request<{ lease: Lease }>(`/leases/${id}`);
  },

  async listMine() {
    return request<{ leases: LeaseWithProperty[] }>("/leases/mine");
  },

  async listForLandlord() {
    return request<{ leases: LeaseWithProperty[] }>("/leases/landlord");
  },

  async updateStatus(id: string, status: "ACTIVE" | "TERMINATED" | "EXPIRED" | "CANCELLED") {
    return request<{ lease: Lease }>(`/leases/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async sign(id: string) {
    return request<{ lease: Lease }>(`/leases/${id}/sign`, { method: "PATCH" });
  },

  /**
   * Downloads the lease as a PDF and triggers a browser save.
   * Uses fetch directly (not request()) because the response is binary, not JSON.
   */
  async downloadPdf(id: string, retry = true): Promise<void> {
    const res = await fetch(`${API_URL}/leases/${id}/pdf`, {
      credentials: "include",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

     if (res.status === 401 && retry) {
      const refreshed = await refreshOnce().catch(() => null);
      if (refreshed) {
        setAccessToken(refreshed.accessToken);
        return leaseApi.downloadPdf(id, false);
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message ?? "Failed to download lease PDF.");
    }

    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `lease-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

// ─── Maintenance ───────────────────────────────────────────────────────────
export type MaintenanceCategory = "PLUMBING" | "ELECTRICAL" | "HVAC" | "APPLIANCE" | "STRUCTURAL" | "PEST_CONTROL" | "OTHER";
export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
export type MaintenanceStatus = "SUBMITTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface MaintenanceRequest {
  id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  lease_id: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string;
  status: MaintenanceStatus;
  assigned_to: string | null;
  landlord_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  properties?: { title: string; city: string };
  unit_label?: string | null;
  users?: { full_name: string | null; email: string; phone: string | null };
}

export interface CreateMaintenanceInput {
  propertyId: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  title: string;
  description: string;
}

export const maintenanceApi = {
  async create(input: CreateMaintenanceInput) {
    return request<{ request: MaintenanceRequest }>("/maintenance", { method: "POST", body: JSON.stringify(input) });
  },
  async get(id: string) {
    return request<{ request: MaintenanceRequest; photos: DocumentRecord[] }>(`/maintenance/${id}`);
  },
  async uploadPhotos(id: string, files: File[]) {
    const form = new FormData();
    files.forEach((f) => form.append("photos", f));
    return request<{ photos: DocumentRecord[] }>(`/maintenance/${id}/photos`, { method: "POST", body: form });
  },
  async listMine() {
    return request<{ requests: MaintenanceRequest[] }>("/maintenance/mine");
  },
  async listForLandlord(status?: MaintenanceStatus) {
    return request<{ requests: MaintenanceRequest[] }>(`/maintenance/landlord${status ? `?status=${status}` : ""}`);
  },
  async updateStatus(id: string, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", notes?: string) {
    return request<{ request: MaintenanceRequest }>(`/maintenance/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, notes }) });
  },
  async assign(id: string, assignedTo: string) {
    return request<{ request: MaintenanceRequest }>(`/maintenance/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assignedTo }) });
  },
  async cancel(id: string) {
    return request<{ request: MaintenanceRequest }>(`/maintenance/${id}/cancel`, { method: "PATCH" });
  },
};

// ─── Payments ──────────────────────────────────────────────────────────────
export type PaymentType = "RENT" | "DEPOSIT" | "OTHER";
export type PaymentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELLED";

export interface Payment {
  id: string;
  lease_id: string;
  property_id: string;
  tenant_id: string;
  landlord_id: string;
  type: PaymentType;
  description: string | null;
  period: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  due_date: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  receipt_number: string | null;
  paid_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  properties?: { title: string; city: string };
  users?: { full_name: string | null; email: string; phone: string | null }; // landlord list joins tenant identity
}

export interface CreatePaymentInput {
  leaseId: string;
  type: PaymentType;
  amount: number;
  description?: string;
  period?: string;
  dueDate?: string;
}

async function downloadPaymentPdf(path: string, filename: string, retry: boolean): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

   if (res.status === 401 && retry) {
    const refreshed = await refreshOnce().catch(() => null);
    if (refreshed) {
      setAccessToken(refreshed.accessToken);
      return downloadPaymentPdf(path, filename, false);
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "Failed to download PDF.");
  }


  
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const paymentApi = {
  async create(input: CreatePaymentInput) {
    return request<{ payment: Payment }>("/payments", { method: "POST", body: JSON.stringify(input) });
  },
  async listMine() {
    return request<{ payments: Payment[] }>("/payments/mine");
  },
  async listForLandlord() {
    return request<{ payments: Payment[] }>("/payments/landlord");
  },
  async listForLease(leaseId: string) {
    return request<{ payments: Payment[] }>(`/payments/lease/${leaseId}`);
  },
  async get(id: string) {
    return request<{ payment: Payment }>(`/payments/${id}`);
  },
  /** Starts a Stripe Checkout session and sends the browser there to pay. */
  async payNow(id: string) {
    const { url } = await request<{ url: string }>(`/payments/${id}/checkout-session`, { method: "POST" });
    window.location.href = url;
  },
  async cancel(id: string) {
    return request<{ payment: Payment }>(`/payments/${id}/cancel`, { method: "PATCH" });
  },
  async downloadInvoice(id: string, retry = true): Promise<void> {
    return downloadPaymentPdf(`/payments/${id}/invoice`, `invoice-${id}.pdf`, retry);
  },
  
  async downloadReceipt(id: string, retry = true): Promise<void> {
    return downloadPaymentPdf(`/payments/${id}/receipt`, `receipt-${id}.pdf`, retry);
  },

  async sync(id: string) {
  return request<{ payment: Payment }>(`/payments/${id}/sync`, { method: "POST" });
},
};


// ─── Messaging ─────────────────────────────────────────────────────────────
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  landlord_id: string;
  property_id: string | null;
  application_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_id: string | null;
  created_at: string;
  unread_count: number;
  properties?: { title: string; city: string };
  tenant?: { full_name: string | null; email: string; profile_image_url: string | null };
  landlord?: { full_name: string | null; email: string; profile_image_url: string | null };
}

export const conversationApi = {
  async list() {
    return request<{ conversations: Conversation[] }>("/conversations");
  },
  async listMessages(conversationId: string, before?: string) {
    const qs = before ? `?before=${encodeURIComponent(before)}` : "";
    return request<{ messages: Message[] }>(`/conversations/${conversationId}/messages${qs}`);
  },
  async markRead(conversationId: string) {
    return request<{ readAt: string }>(`/conversations/${conversationId}/read`, { method: "POST" });
  },
};

// ─── Notifications ─────────────────────────────────────────────────────────
export type NotificationType =
  | "APPLICATION_SUBMITTED" | "APPLICATION_APPROVED" | "APPLICATION_REJECTED"
  | "LEASE_READY" | "LEASE_ACTIVATED" | "LEASE_EXPIRING"
  | "INVOICE_CREATED" | "RENT_REMINDER" | "PAYMENT_SUCCEEDED" | "PAYMENT_FAILED"
  | "MAINTENANCE_CREATED" | "MAINTENANCE_STATUS_UPDATED"
  | "MESSAGE_RECEIVED";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const notificationApi = {
  async list() {
    return request<{ notifications: AppNotification[]; unreadCount: number }>("/notifications");
  },
  async markRead(id: string) {
    return request<{ ok: true }>(`/notifications/${id}/read`, { method: "PATCH" });
  },
  async markAllRead() {
    return request<{ ok: true }>("/notifications/read-all", { method: "PATCH" });
  },
};



// ─── Dashboard analytics ─────────────────────────────────────────────────
export interface LandlordDashboardStats {
  totalProperties: number;
  activeListings: number;
  rentedProperties: number;
  occupancyRate: number;
  totalUnits: number;
  rentedUnits: number;
  reservedUnits: number;
  availableUnits: number;
  activeLeases: number;
  pendingApplications: number;
  openMaintenanceRequests: number;
  urgentMaintenanceRequests: number;
  leasesExpiringSoon: number;
  monthlyRevenue: number;
  pendingRevenue: number;
  revenueSeries: { month: string; amount: number }[];
}



export interface TenantDashboardStats {
  activeLease: {
    propertyTitle: string;
    city: string | null;
    rentAmount: number;
    leaseEndDate: string;
    daysUntilLeaseExpiry: number | null;
  } | null;
  upcomingPayment: {
    id: string;
    amount: number;
    currency?: string | null;
    dueDate: string | null;
    propertyTitle: string;
  } | null;
  applicationCounts: { pending: number; approved: number; rejected: number };
  openMaintenanceRequests: number;
  paymentSeries: { month: string; amount: number }[];
}

export const dashboardApi = {
  async landlordStats() {
    return request<LandlordDashboardStats>("/dashboard/landlord");
  },
  async tenantStats() {
    return request<TenantDashboardStats>("/dashboard/tenant");
  },
};


// ─── Reports & reviews ─────────────────────────────────────────────────────
export type ReportKindInput = "COMPLAINT" | "REVIEW_FLAG" | "LISTING_REPORT";
export type ReportTargetType = "USER" | "PROPERTY" | "REVIEW" | "LEASE" | "OTHER";

export interface ReportInput {
  kind: ReportKindInput;
  targetType?: ReportTargetType;
  targetId?: string; // must be a UUID
  subject: string;
  details?: string;
}
export interface PublicReview { id: string; rating: number; body: string | null; created_at: string; author_name: string }

export const reportApi = {
  create: (input: ReportInput) =>
    request<{ report: { id: string; status: string; created_at: string } }>("/reports", {
      method: "POST", body: JSON.stringify(input),
    }),
};

export const reviewApi = {
  listForProperty: (propertyId: string) => request<{ reviews: PublicReview[] }>(`/reviews/property/${propertyId}`),
  create: (input: { propertyId: string; rating: number; body?: string }) =>
    request<{ review: PublicReview }>("/reviews", { method: "POST", body: JSON.stringify(input) }),
};