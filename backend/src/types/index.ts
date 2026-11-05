export type UserRole = "TENANT" | "LANDLORD" | "ADMIN";
export type VerificationStatus = "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";
export type GovernmentIdType = "PASSPORT" | "NATIONAL_ID" | "DRIVERS_LICENSE";

// Fields that live on `users` but are only relevant to the profile screens
// (kept separate from the auth-critical fields for clarity).
export interface UserProfileFields {
  date_of_birth: string | null;
  bio: string | null;
  alternate_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
}

export interface User extends UserProfileFields {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  phone: string | null;
  profile_image_url: string | null;
  is_verified: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  profile_image_url: string | null;
  is_verified: boolean;
}

// Full profile payload returned by GET /api/profile - everything the
// profile screens need, without password_hash.
export interface FullProfile extends PublicUser, UserProfileFields {
  created_at: string;
}

export interface LandlordVerification {
  id: string;
  user_id: string;
  government_id_type: GovernmentIdType | null;
  government_id_number: string | null;
  government_id_document_path: string | null;
  business_name: string | null;
  business_registration_number: string | null;
  tax_id: string | null;
  proof_of_ownership_path: string | null;
  status: VerificationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Same shape as LandlordVerification, but document paths are swapped for
// short-lived signed URLs before being sent to the client.
export interface LandlordVerificationResponse
  extends Omit<LandlordVerification, "government_id_document_path" | "proof_of_ownership_path"> {
  government_id_document_url: string | null;
  proof_of_ownership_url: string | null;
}

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  email: string;
}

// Lets us attach `req.user` in Express without TypeScript complaining
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export type PropertyType =
  | "APARTMENT" | "HOUSE" | "VILLA" | "STUDIO" | "TOWNHOUSE" | "CONDO" | "OTHER";

     export type PropertyStatus = "DRAFT" | "AVAILABLE" | "RESERVED" | "RENTED" | "ARCHIVED";

   export type UnitStatus = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "UNAVAILABLE";


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

export interface PublicPropertyRow extends Property {
  distance_km: number | null;
  total_count: number;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}


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
}

   export type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";

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
}

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  alerts_enabled: boolean;
  last_checked_at: string | null;
  last_seen_ids: string[];
  last_new_count: number;
  created_at: string;
  updated_at: string;
}

