import { randomUUID } from "crypto";
import { supabaseAdmin } from "../config/supabase";
import {
  FullProfile,
  GovernmentIdType,
  LandlordVerification,
  LandlordVerificationResponse,
  User,
} from "../types";

const PROFILE_IMAGE_BUCKET = "profile-images";
const VERIFICATION_BUCKET = "verification-documents";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour



function toFullProfile(user: User): FullProfile {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    profile_image_url: user.profile_image_url,
    is_verified: user.is_verified,
    date_of_birth: user.date_of_birth,
    bio: user.bio,
    alternate_phone: user.alternate_phone,
    address_line1: user.address_line1,
    address_line2: user.address_line2,
    city: user.city,
    state: user.state,
    postal_code: user.postal_code,
    country: user.country,
    created_at: user.created_at,
  };
}

async function fetchUserOrThrow(userId: string): Promise<User> {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) {
    throw Object.assign(new Error("User not found."), { statusCode: 404 });
  }
  return user as User;
}

export async function getFullProfile(userId: string): Promise<FullProfile> {
  const user = await fetchUserOrThrow(userId);
  return toFullProfile(user);
}

export interface ProfileUpdateInput {
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

export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<FullProfile> {
  const patch: Record<string, unknown> = {};

  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.alternatePhone !== undefined) patch.alternate_phone = input.alternatePhone;
  if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.addressLine1 !== undefined) patch.address_line1 = input.addressLine1;
  if (input.addressLine2 !== undefined) patch.address_line2 = input.addressLine2;
  if (input.city !== undefined) patch.city = input.city;
  if (input.state !== undefined) patch.state = input.state;
  if (input.postalCode !== undefined) patch.postal_code = input.postalCode;
  if (input.country !== undefined) patch.country = input.country;

  if (Object.keys(patch).length === 0) {
    return getFullProfile(userId);
  }
  patch.updated_at = new Date().toISOString();

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();

  if (error || !user) {
    throw Object.assign(new Error(error?.message ?? "Failed to update profile."), {
      statusCode: 500,
    });
  }

  return toFullProfile(user as User);
}

function extensionFor(mimetype: string): string {
  switch (mimetype) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}

export async function setProfileImage(
  userId: string,
  file: Express.Multer.File
): Promise<FullProfile> {
  const user = await fetchUserOrThrow(userId);
  const path = `${userId}/avatar-${randomUUID()}.${extensionFor(file.mimetype)}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(PROFILE_IMAGE_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

  if (uploadError) {
    throw Object.assign(new Error(`Failed to upload image: ${uploadError.message}`), {
      statusCode: 500,
    });
  }

  const { data: publicUrl } = supabaseAdmin.storage.from(PROFILE_IMAGE_BUCKET).getPublicUrl(path);

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("users")
    .update({ profile_image_url: publicUrl.publicUrl })
    .eq("id", userId)
    .select()
    .single();

  if (updateError || !updated) {
    throw Object.assign(new Error("Failed to save the uploaded image."), { statusCode: 500 });
  }

  // Best-effort cleanup of the previous image so the bucket doesn't grow unbounded.
  if (user.profile_image_url) {
    const previousPath = user.profile_image_url.split(`${PROFILE_IMAGE_BUCKET}/`)[1];
    if (previousPath) {
      await supabaseAdmin.storage.from(PROFILE_IMAGE_BUCKET).remove([previousPath]).catch(() => {});
    }
  }

  return toFullProfile(updated as User);
}

export async function removeProfileImage(userId: string): Promise<FullProfile> {
  const user = await fetchUserOrThrow(userId);

  if (user.profile_image_url) {
    const previousPath = user.profile_image_url.split(`${PROFILE_IMAGE_BUCKET}/`)[1];
    if (previousPath) {
      await supabaseAdmin.storage.from(PROFILE_IMAGE_BUCKET).remove([previousPath]).catch(() => {});
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("users")
    .update({ profile_image_url: null })
    .eq("id", userId)
    .select()
    .single();

  if (error || !updated) {
    throw Object.assign(new Error("Failed to remove profile image."), { statusCode: 500 });
  }

  return toFullProfile(updated as User);
}

async function signPath(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(VERIFICATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

async function toVerificationResponse(
  record: LandlordVerification
): Promise<LandlordVerificationResponse> {
  const [governmentIdUrl, proofOfOwnershipUrl] = await Promise.all([
    signPath(record.government_id_document_path),
    signPath(record.proof_of_ownership_path),
  ]);

  const { government_id_document_path, proof_of_ownership_path, ...rest } = record;
  return {
    ...rest,
    government_id_document_url: governmentIdUrl,
    proof_of_ownership_url: proofOfOwnershipUrl,
  };
}

const EMPTY_VERIFICATION: Omit<LandlordVerification, "id" | "user_id" | "created_at" | "updated_at"> = {
  government_id_type: null,
  government_id_number: null,
  government_id_document_path: null,
  business_name: null,
  business_registration_number: null,
  tax_id: null,
  proof_of_ownership_path: null,
  status: "NOT_SUBMITTED",
  rejection_reason: null,
  submitted_at: null,
  reviewed_at: null,
};

export async function getLandlordVerification(
  userId: string
): Promise<LandlordVerificationResponse> {
  const { data: record } = await supabaseAdmin
    .from("landlord_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!record) {
    return toVerificationResponse({
      id: "",
      user_id: userId,
      created_at: "",
      updated_at: "",
      ...EMPTY_VERIFICATION,
    });
  }

  return toVerificationResponse(record as LandlordVerification);
}

export interface VerificationSubmitInput {
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
  businessName?: string | null;
  businessRegistrationNumber?: string | null;
  taxId?: string | null;
}

export async function submitLandlordVerification(
  userId: string,
  input: VerificationSubmitInput,
  files: {
    governmentIdDocument?: Express.Multer.File;
    proofOfOwnership?: Express.Multer.File;
  }
): Promise<LandlordVerificationResponse> {
  const { data: existing } = await supabaseAdmin
    .from("landlord_verifications")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    government_id_type: input.governmentIdType,
    government_id_number: input.governmentIdNumber,
    business_name: input.businessName ?? null,
    business_registration_number: input.businessRegistrationNumber ?? null,
    tax_id: input.taxId ?? null,
    status: "PENDING",
    rejection_reason: null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
  };
  

  if (files.governmentIdDocument) {
    const file = files.governmentIdDocument;
    const path = `${userId}/gov-id-${randomUUID()}.${extensionFor(file.mimetype)}`;
    const { error } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) {
      throw Object.assign(new Error(`Failed to upload ID document: ${error.message}`), {
        statusCode: 500,
      });
    }
    patch.government_id_document_path = path;
  } else if (!existing?.government_id_document_path) {
    throw Object.assign(new Error("A government ID document is required."), { statusCode: 400 });
  }

  if (files.proofOfOwnership) {
    const file = files.proofOfOwnership;
    const path = `${userId}/proof-of-ownership-${randomUUID()}.${extensionFor(file.mimetype)}`;
    const { error } = await supabaseAdmin.storage
      .from(VERIFICATION_BUCKET)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) {
      throw Object.assign(new Error(`Failed to upload proof of ownership: ${error.message}`), {
        statusCode: 500,
      });
    }
    patch.proof_of_ownership_path = path;
  }

  const { data: saved, error } = existing
    ? await supabaseAdmin
        .from("landlord_verifications")
        .update(patch)
        .eq("user_id", userId)
        .select()
        .single()
    : await supabaseAdmin
        .from("landlord_verifications")
        .insert({ user_id: userId, ...patch })
        .select()
        .single();

  if (error || !saved) {
    throw Object.assign(new Error(error?.message ?? "Failed to submit verification."), {
      statusCode: 500,
    });
  }

  return toVerificationResponse(saved as LandlordVerification);
}
