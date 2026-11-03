import { randomUUID } from "crypto";
import { supabaseAdmin } from "../config/supabase";
import { hashPassword, comparePassword } from "../utils/password";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../utils/jwt";
import { env } from "../config/env";
import * as notificationService from "./notification.service";
import { PublicUser, User, UserRole } from "../types";

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    profile_image_url: user.profile_image_url,
    is_verified: user.is_verified,
  };
}



// Real bcrypt hash (cost 12) of a random string, computed once at boot - used only to equalise login timing.
const DUMMY_HASH_PROMISE = hashPassword(randomUUID());

function refreshExpiryDate(): Date {
  const days = parseInt(env.jwtRefreshExpiresIn) || 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export async function registerUser(params: {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}) {
  const { fullName, email, password, role, phone } = params;

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    throw Object.assign(new Error("An account with this email already exists."), {
      statusCode: 409,
    });
  }

  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .insert({
      full_name: fullName,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      role,
      phone: phone ?? null,
    })
    .select()
    .single();

  if (error || !user) {
    // Two registrations for the same email can race past the check above; the unique index wins.
    if (error?.code === "23505") {
      throw Object.assign(new Error("An account with this email already exists."), { statusCode: 409 });
    }
    throw Object.assign(new Error(error?.message ?? "Failed to create user."), {
      statusCode: 500,
    });
  }

  return issueSession(user as User);
}

export async function loginUser(email: string, password: string) {
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  // Always run bcrypt, even for unknown emails, so response time doesn't reveal which accounts exist.
  const valid = await comparePassword(password, user?.password_hash ?? (await DUMMY_HASH_PROMISE));
  if (error || !user || !valid) {
    throw Object.assign(new Error("Invalid email or password."), { statusCode: 401 });
  }

  // Only reveal suspension to someone who proved they own the account.
  if (user.is_suspended) {
    throw Object.assign(new Error("This account has been suspended."), {
      statusCode: 403,
    });
  }

  return issueSession(user as User);
}

async function issueSession(user: User) {
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken(user.id);

  await supabaseAdmin.from("refresh_tokens").insert({
    id: randomUUID(),
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: refreshExpiryDate().toISOString(),
  });

  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function rotateRefreshToken(oldRefreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw Object.assign(new Error("Invalid or expired refresh token."), { statusCode: 401 });
  }

  const oldHash = hashToken(oldRefreshToken);
  const { data: stored } = await supabaseAdmin
    .from("refresh_tokens")
    .select("*")
    .eq("token_hash", oldHash)
    .eq("revoked", false)
    .maybeSingle();

  if (!stored) {
    // A token that verifies but is already revoked is being REPLAYED (stolen, or a racing client).
    // Kill every session for that user so the thief's copy dies too.
    const { data: used } = await supabaseAdmin.from("refresh_tokens").select("id").eq("token_hash", oldHash).eq("revoked", true).maybeSingle();
    if (used) await supabaseAdmin.from("refresh_tokens").update({ revoked: true }).eq("user_id", payload.sub);
    throw Object.assign(new Error("Refresh token not recognized or already used."), {
      statusCode: 401,
    });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", payload.sub)
    .maybeSingle();

  if (!user || user.is_suspended) {
    throw Object.assign(new Error("Account not available."), { statusCode: 403 });
  }

  // Atomic claim: only one concurrent request can flip revoked false -> true.
  const { data: claimed } = await supabaseAdmin
    .from("refresh_tokens").update({ revoked: true }).eq("id", stored.id).eq("revoked", false).select("id");
  if (!claimed || claimed.length === 0) {
    throw Object.assign(new Error("Refresh token not recognized or already used."), { statusCode: 401 });
  }

  return issueSession(user as User);
}

export async function logoutUser(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await supabaseAdmin
    .from("refresh_tokens")
    .update({ revoked: true })
    .eq("token_hash", tokenHash);
}


export async function requestPasswordReset(email: string) {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!user) return; // don't reveal whether the email exists

  const resetToken = randomUUID();
  const expires = new Date();
  expires.setHours(expires.getHours() + 1);

  await supabaseAdmin.from("password_reset_tokens").insert({
    id: randomUUID(),
    user_id: user.id,
    token_hash: hashToken(resetToken),
    expires_at: expires.toISOString(),
  });

  // invalidate older unused links, then email the new one (the token itself is never logged or returned)
  await supabaseAdmin.from("password_reset_tokens").update({ used: true }).eq("user_id", user.id).eq("used", false).neq("token_hash", hashToken(resetToken));
  notificationService
    .sendPasswordResetEmail(user.id, resetToken)
    .catch((e) => console.error("Failed to send reset email:", (e as Error).message));
}


export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  
  const { data: record } = await supabaseAdmin
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("used", false)
    .maybeSingle();
    
  if (!record || new Date(record.expires_at) < new Date()) {
    throw Object.assign(new Error("Reset link is invalid or has expired."), {
      statusCode: 400,
    });
  }

  // Burn the token first (atomically) so two concurrent requests can't both use it.
  const { data: burned } = await supabaseAdmin
    .from("password_reset_tokens").update({ used: true }).eq("id", record.id).eq("used", false).select("id");
  if (!burned || burned.length === 0) {
    throw Object.assign(new Error("Reset link is invalid or has expired."), { statusCode: 400 });
  }



  const passwordHash = await hashPassword(newPassword);
  await supabaseAdmin
    .from("users")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("id", record.user_id);

  await supabaseAdmin
    .from("refresh_tokens")
    .update({ revoked: true })
    .eq("user_id", record.user_id);
}