import { supabaseAdmin } from "../config/supabase";
import { getIO } from "../realtime/io";
import { invalidateUserStatus } from "./user-status.service";
import * as inApp from "./in-app-notification.service";
import { hasActiveReservation, hasLiveLease } from "./property.service";

const VERIFICATION_BUCKET = "verification-documents";
const DOC_URL_TTL_SECONDS = 5 * 60; // ID documents: short-lived links only
// Each UUID adds ~37 chars to the request URL. Keep the two ID lists small so broad searches can't exceed URL limits.
const SEARCH_ID_CAP = 50;

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });
const toPaged = <T>(items: T[], total: number, page: number, limit: number) => ({
  items, total, page, limit, totalPages: total === 0 ? 0 : Math.ceil(total / limit),
});
function pageArgs(page?: number, limit?: number) {
  const p = Math.max(Math.floor(page ?? 1), 1);
  const l = Math.min(Math.max(Math.floor(limit ?? 15), 1), 50);
  return { p, l, from: (p - 1) * l, to: (p - 1) * l + l - 1 };
}
/** Values interpolated into PostgREST .or() filters must never contain filter syntax. */
const safeTerm = (s?: string) => (s ?? "").replace(/[^\p{L}\p{N}@.+\- ]/gu, "").trim().slice(0, 80);

/**
 * Strict audit: throws when the row can't be written. Call it BEFORE a sensitive change (suspension,
 * verification, archival, ID-document access) so that no such action ever happens without a record.
 */
async function audit(actorId: string, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin.from("audit_log").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, meta });
  if (error) {
    console.error("audit_log insert failed:", error.message);
    throw fail("The action was not performed because it could not be recorded in the audit log. Please try again.", 500);
  }
}

/** Best-effort audit for lower-risk actions (report/review moderation): logs the failure but doesn't block. */
async function auditSoft(actorId: string, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown> = {}) {
  const { error } = await supabaseAdmin.from("audit_log").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, meta });
  if (error) console.error("audit_log insert failed:", error.message);
}

async function usersById(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, { id: string; full_name: string | null; email: string }>();
  const { data } = await supabaseAdmin.from("users").select("id, full_name, email").in("id", unique);
  return new Map((data ?? []).map((u) => [u.id, u]));
}


/* ───────────── Analytics ───────────── */

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const monthLabel = (key: string) => new Date(key + "-01T00:00:00Z").toLocaleString("en", { month: "short", timeZone: "UTC" });
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  return out;
}

const head = (table: string) => supabaseAdmin.from(table).select("id", { count: "exact", head: true });


export async function getStats() {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1)).toISOString();
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString();


  const [
    users, tenants, landlords, suspended, properties, available, pendingVer, openReports, activeLeases,
    pendingApps, signupRows, paidRows, activity,
  ] = await Promise.all([
    head("users"),
    head("users").eq("role", "TENANT"),
    head("users").eq("role", "LANDLORD"),
    head("users").eq("is_suspended", true),
    head("properties"),
    head("properties").eq("status", "AVAILABLE"),
    head("landlord_verifications").eq("status", "PENDING"),
    head("reports").in("status", ["OPEN", "INVESTIGATING"]),
    head("leases").eq("status", "ACTIVE"),
    head("rental_applications").eq("status", "PENDING"),
    // Bounded to 6 months. For large tables replace with a SQL view / rollup table (see ARCHITECTURE_REVIEW).
    supabaseAdmin.from("users").select("role, created_at").gte("created_at", since).limit(20000),
    supabaseAdmin.from("payments").select("amount, paid_at").eq("status", "SUCCEEDED").gte("paid_at", since).limit(20000),
    supabaseAdmin.from("audit_log").select("id, action, meta, created_at").order("created_at", { ascending: false }).limit(8),
  ]);


  const months = lastMonths(6);
  const signups = new Map(months.map((m) => [m, { month: monthLabel(m), tenants: 0, landlords: 0 }]));
  for (const r of signupRows.data ?? []) {
    const row = signups.get(monthKey(new Date(r.created_at)));
    if (!row) continue;
    if (r.role === "TENANT") row.tenants++;
    else if (r.role === "LANDLORD") row.landlords++;
  }
  const volume = new Map(months.map((m) => [m, { month: monthLabel(m), amount: 0 }]));
  let monthlyVolume = 0;
  for (const p of paidRows.data ?? []) {
    if (!p.paid_at) continue;
    const row = volume.get(monthKey(new Date(p.paid_at)));
    if (row) row.amount += Number(p.amount);
    if (p.paid_at >= d30) monthlyVolume += Number(p.amount);
  }

  return {
    totalUsers: users.count ?? 0, tenants: tenants.count ?? 0, landlords: landlords.count ?? 0,
    suspendedUsers: suspended.count ?? 0, totalProperties: properties.count ?? 0, activeListings: available.count ?? 0,
    pendingVerifications: pendingVer.count ?? 0, openReports: openReports.count ?? 0,
    pendingApplications: pendingApps.count ?? 0, activeLeases: activeLeases.count ?? 0, monthlyVolume,
    signupsSeries: [...signups.values()], volumeSeries: [...volume.values()],
    recentActivity: (activity.data ?? []).map((a) => ({
      id: a.id, type: a.action, created_at: a.created_at,
      message: `${String(a.action).replace(/_/g, " ").toLowerCase()}${a.meta && (a.meta as any).label ? ` — ${(a.meta as any).label}` : ""}`,
    })),
  };
}

/* ───────────── Users / landlords / suspension ───────────── */

export async function listUsers(q: { search?: string; role?: string; status?: string; page?: number; limit?: number }) {
  const { p, l, from, to } = pageArgs(q.page, q.limit);
  let query = supabaseAdmin
    .from("users")
    .select("id, full_name, email, phone, role, is_verified, is_suspended, suspended_reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const term = safeTerm(q.search);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  if (q.role) query = query.eq("role", q.role);
  if (q.status === "suspended") query = query.eq("is_suspended", true);
  if (q.status === "active") query = query.eq("is_suspended", false);

  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);
  return toPaged(data ?? [], count ?? 0, p, l);
}

export async function setSuspension(adminId: string, userId: string, suspended: boolean, reason?: string) {
  if (adminId === userId) throw fail("You cannot suspend your own account.", 400);

  const { data: target } = await supabaseAdmin.from("users").select("id, role, email").eq("id", userId).maybeSingle();
  if (!target) throw fail("User not found.", 404);
  if (target.role === "ADMIN") throw fail("Admin accounts cannot be suspended from the panel.", 403);

  const note = reason?.trim() ?? "";
  if (suspended && note.length < 5) throw fail("Give a reason for the suspension (at least 5 characters).", 400);

  await audit(adminId, suspended ? "USER_SUSPENDED" : "USER_RESTORED", "USER", userId, { label: target.email, reason: note || null });

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      is_suspended: suspended,
      suspended_reason: suspended ? note : null,
      suspended_at: suspended ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id, full_name, email, phone, role, is_verified, is_suspended, suspended_reason, created_at")
    .single();
  if (error || !data) throw fail("Failed to update user.", 500);


  invalidateUserStatus(userId);
  if (suspended) {
    // kill every session: refresh tokens + live sockets
    await supabaseAdmin.from("refresh_tokens").update({ revoked: true }).eq("user_id", userId);
    try { getIO().in(`user:${userId}`).disconnectSockets(true); } catch { /* sockets not initialised */ }
  }
  return data;
}

/* ───────────── Properties ───────────── */

export async function listProperties(q: { search?: string; status?: string; page?: number; limit?: number }) {
  const { p, l, from, to } = pageArgs(q.page, q.limit);
  let query = supabaseAdmin
    .from("properties")
    .select("id, title, city, status, rent_amount, landlord_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const term = safeTerm(q.search);
  if (term) query = query.or(`title.ilike.%${term}%,city.ilike.%${term}%`);
  if (q.status) query = query.eq("status", q.status);

  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);
  const owners = await usersById((data ?? []).map((r) => r.landlord_id));
  return toPaged((data ?? []).map((r) => ({ ...r, landlord: owners.get(r.landlord_id) ?? null })), count ?? 0, p, l);
}

export async function setPropertyStatus(adminId: string, propertyId: string, status: string) {
  const { data: current, error: readError } = await supabaseAdmin
    .from("properties").select("id, title, status").eq("id", propertyId).maybeSingle();
  if (readError) throw fail(readError.message, 500);
  if (!current) throw fail("Property not found.", 404);

  if (status === "ARCHIVED" && (await hasLiveLease(propertyId))) {
    throw fail("End or cancel the active lease before archiving this property.", 409);
  }

  if (status === "ARCHIVED" && (await hasActiveReservation(propertyId))) {
    throw fail("This property is reserved for an approved applicant. Release the reservation before archiving it.", 409);
  }

  await audit(adminId, "PROPERTY_STATUS_CHANGED", "PROPERTY", propertyId, { label: current.title, from: current.status, status });

  const { data, error } = await supabaseAdmin
    .from("properties").update({ status, updated_at: new Date().toISOString() }).eq("id", propertyId)
    .select("id, title, city, status, rent_amount, landlord_id, created_at").maybeSingle();
  if (error) throw fail(error.message, 500);
  if (!data) throw fail("Property not found.", 404);
  return data;
}

/* ───────────── Applications (read-only oversight) ───────────── */

export async function listApplications(q: { status?: string; search?: string; page?: number; limit?: number }) {
  const { p, l, from, to } = pageArgs(q.page, q.limit);
  let query = supabaseAdmin
    .from("rental_applications")
    .select("id, status, created_at, desired_move_in_date, monthly_income, rejection_reason, property_id, tenant_id, properties(title, city, landlord_id)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q.status) query = query.eq("status", q.status);

  // Search runs in the database, so paging and totals stay correct. Match properties and tenants first, then filter by their IDs.
  const term = safeTerm(q.search);
  if (term) {
    const [{ data: props }, { data: tenants }] = await Promise.all([
      supabaseAdmin.from("properties").select("id").or(`title.ilike.%${term}%,city.ilike.%${term}%`).limit(SEARCH_ID_CAP),
      supabaseAdmin.from("users").select("id").or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(SEARCH_ID_CAP),
    ]);

    const clauses = [
      props?.length ? `property_id.in.(${props.map((r) => r.id).join(",")})` : null,
      tenants?.length ? `tenant_id.in.(${tenants.map((r) => r.id).join(",")})` : null,
    ].filter(Boolean) as string[];
    if (!clauses.length) return toPaged([], 0, p, l);
    query = query.or(clauses.join(","));
  }

  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);
  const rows = (data ?? []) as any[];
  const people = await usersById(rows.flatMap((r) => [r.tenant_id, r.properties?.landlord_id]));
  const items = rows.map((r) => ({
    id: r.id, status: r.status, created_at: r.created_at, desired_move_in_date: r.desired_move_in_date,
    monthly_income: r.monthly_income, rejection_reason: r.rejection_reason, property_id: r.property_id,
    property_title: r.properties?.title ?? null, property_city: r.properties?.city ?? null,
    tenant: people.get(r.tenant_id) ?? null, landlord: people.get(r.properties?.landlord_id) ?? null,
  }));
  return toPaged(items, count ?? 0, p, l);
}



/* ───────────── Landlord verification ───────────── */

export async function listVerifications(status?: string, page?: number, limit?: number) {
  const { p, l, from, to } = pageArgs(page, limit);
  let query = supabaseAdmin
    .from("landlord_verifications")
    .select(
      "id, user_id, status, government_id_type, business_name, submitted_at, rejection_reason, government_id_document_path, proof_of_ownership_path",
      { count: "exact" }
    )
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);

  const people = await usersById((data ?? []).map((v) => v.user_id));
  // The list never contains document links. Links are created on demand (and audited) by getVerificationDocumentUrl.
  // government_id_number / tax_id are intentionally NOT returned either.
  const items = (data ?? []).map((v) => ({
    id: v.id, user_id: v.user_id, status: v.status, government_id_type: v.government_id_type,
    business_name: v.business_name, submitted_at: v.submitted_at, rejection_reason: v.rejection_reason,
    has_government_id_document: !!v.government_id_document_path,
    has_proof_of_ownership_document: !!v.proof_of_ownership_path,
    user: people.get(v.user_id) ?? { full_name: null, email: "unknown" },
  }));
  return toPaged(items, count ?? 0, p, l);
}

export type VerificationDocumentKind = "government-id" | "proof-of-ownership";

/** Creates a short-lived signed URL for ONE verification document, and records who asked for it. */
export async function getVerificationDocumentUrl(adminId: string, verificationId: string, kind: VerificationDocumentKind) {
  const { data: row, error } = await supabaseAdmin
    .from("landlord_verifications")
    .select("id, user_id, government_id_document_path, proof_of_ownership_path")
    .eq("id", verificationId).maybeSingle();
  if (error) throw fail(error.message, 500);
  if (!row) throw fail("Verification not found.", 404);

  const path = kind === "government-id" ? row.government_id_document_path : row.proof_of_ownership_path;
  if (!path) throw fail("No document was uploaded for this.", 404);

  // Audit first: if we can't record the access, we don't hand out the link.
  await audit(adminId, "VERIFICATION_DOCUMENT_VIEWED", "USER", row.user_id, { verification_id: row.id, document: kind });

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(VERIFICATION_BUCKET).createSignedUrl(path, DOC_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl) throw fail("Could not open this document.", 500);
  return { url: signed.signedUrl, expiresInSeconds: DOC_URL_TTL_SECONDS };
}

export async function reviewVerification(adminId: string, id: string, status: "VERIFIED" | "REJECTED", reason?: string) {
  if (status === "REJECTED" && !reason?.trim()) throw fail("A rejection reason is required.", 400);

  const { data: row } = await supabaseAdmin.from("landlord_verifications").select("id, user_id, status").eq("id", id).maybeSingle();
  if (!row) throw fail("Verification not found.", 404);
  if (row.status !== "PENDING") throw fail("Only pending verifications can be reviewed.", 409);

  await audit(adminId, status === "VERIFIED" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED", "USER", row.user_id, { reason: reason ?? null });

  const { data: updated, error } = await supabaseAdmin
    .from("landlord_verifications")
    .update({ status, rejection_reason: status === "REJECTED" ? reason!.trim() : null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "PENDING")
    .select("id")
    .maybeSingle();
  if (error) throw fail(error.message, 500);
  if (!updated) throw fail("This verification was just reviewed by another admin.", 409);

  await supabaseAdmin.from("users").update({ is_verified: status === "VERIFIED" }).eq("id", row.user_id);
  invalidateUserStatus(row.user_id);

  (inApp.notifyUser as any)(
    row.user_id,
    status === "VERIFIED" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED",
    status === "VERIFIED" ? "You're verified" : "Verification rejected",
    status === "VERIFIED" ? "Your landlord account now shows the verified badge." : `Reason: ${reason}`,
    "/dashboard/profile",
  )?.catch?.(() => {});
  return { id, status };
}

/* ───────────── Reports & complaints ───────────── */

/* ───────────── Reviews ───────────── */

export async function listReviews(q: { hidden?: string; page?: number; limit?: number }) {
  const { p, l, from, to } = pageArgs(q.page, q.limit);
  let query = supabaseAdmin
    .from("reviews")
    .select("id, rating, body, is_hidden, hidden_reason, created_at, author_id, property_id, properties(title)", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to);
  if (q.hidden === "true") query = query.eq("is_hidden", true);
  if (q.hidden === "false") query = query.eq("is_hidden", false);
  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);
  const rows = (data ?? []) as any[];
  const people = await usersById(rows.map((r) => r.author_id));
  return toPaged(rows.map((r) => ({
    id: r.id, rating: r.rating, body: r.body, is_hidden: r.is_hidden, hidden_reason: r.hidden_reason,
    created_at: r.created_at, property_id: r.property_id, property_title: r.properties?.title ?? null,
    author: people.get(r.author_id) ?? null,
  })), count ?? 0, p, l);
}



export async function setReviewHidden(adminId: string, id: string, hidden: boolean, reason?: string) {
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .update({ is_hidden: hidden, hidden_reason: hidden ? reason?.trim() || null : null, hidden_by: hidden ? adminId : null })
    .eq("id", id).select("id, is_hidden").maybeSingle();
  if (error) throw fail(error.message, 500);
  if (!data) throw fail("Review not found.", 404);
  await auditSoft(adminId, hidden ? "REVIEW_HIDDEN" : "REVIEW_RESTORED", "REVIEW", id, { reason: reason ?? null });
  return data;
}


/* ───────────── Audit log ───────────── */

export async function listAudit(q: { page?: number; limit?: number; action?: string; targetType?: string; since?: string; until?: string }) {
  const { p, l, from, to } = pageArgs(q.page, q.limit ?? 25);
  let query = supabaseAdmin
    .from("audit_log").select("id, actor_id, action, target_type, target_id, meta, created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to);
  if (q.action) query = query.eq("action", q.action);
  if (q.targetType) query = query.eq("target_type", q.targetType);
  if (q.since) query = query.gte("created_at", q.since);
  if (q.until) query = query.lte("created_at", q.until);


  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);
  const people = await usersById((data ?? []).map((r) => r.actor_id as string));
  return toPaged((data ?? []).map((r) => ({ ...r, actor: r.actor_id ? people.get(r.actor_id) ?? null : null })), count ?? 0, p, l);
}

type ReportStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";

// Allowed moves. Closed reports can only be reopened (-> INVESTIGATING).
const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  OPEN: ["INVESTIGATING", "RESOLVED", "DISMISSED"],
  INVESTIGATING: ["RESOLVED", "DISMISSED"],
  RESOLVED: ["INVESTIGATING"],
  DISMISSED: ["INVESTIGATING"],
};

export async function listReports(q: { kind?: string; status?: string; search?: string; page?: number; limit?: number }) {
  const { p, l, from, to } = pageArgs(q.page, q.limit);
  let query = supabaseAdmin
    .from("reports")
    .select(
      "id, kind, status, subject, details, resolution, created_at, updated_at, resolved_at, reporter_id, resolved_by, target_type, target_id",
      { count: "exact" },
    )
    .order("created_at", { ascending: false }).range(from, to);
  if (q.kind) query = query.eq("kind", q.kind);
  if (q.status) query = query.eq("status", q.status);
  const term = safeTerm(q.search);
  if (term) query = query.or(`subject.ilike.%${term}%,details.ilike.%${term}%`);

  const { data, count, error } = await query;
  if (error) throw fail(error.message, 500);
  const rows = data ?? [];
  const idsOf = (type: string) => [...new Set(rows.filter((r) => r.target_type === type && r.target_id).map((r) => r.target_id as string))];
  const [people, targets] = await Promise.all([
    usersById(rows.flatMap((r) => [r.reporter_id, r.resolved_by, r.target_type === "USER" ? r.target_id : null]).filter(Boolean) as string[]),
    resolveReportTargets({ property: idsOf("PROPERTY"), review: idsOf("REVIEW"), lease: idsOf("LEASE") }),
  ]);
  return toPaged(rows.map((r) => {
    const t = describeTarget(r.target_type, r.target_id, targets, people);
    return {
      ...r,
      reporter: r.reporter_id ? people.get(r.reporter_id) ?? null : null,
      resolver: r.resolved_by ? people.get(r.resolved_by) ?? null : null,
      target_label: t.label,
      target_href: t.href,
    };
  }), count ?? 0, p, l);
}
type TargetLookup = { property: Map<string, string>; review: Map<string, { propertyId: string; title: string }>; lease: Map<string, { propertyId: string; title: string }> };

async function resolveReportTargets(ids: { property: string[]; review: string[]; lease: string[] }): Promise<TargetLookup> {
  const [props, reviews, leases] = await Promise.all([
    ids.property.length ? supabaseAdmin.from("properties").select("id, title").in("id", ids.property) : { data: [] as any[] },
    ids.review.length ? supabaseAdmin.from("reviews").select("id, property_id, properties(title)").in("id", ids.review) : { data: [] as any[] },
    ids.lease.length ? supabaseAdmin.from("leases").select("id, property_id, properties(title)").in("id", ids.lease) : { data: [] as any[] },
  ]);
  return {
    property: new Map((props.data ?? []).map((r: any) => [r.id, r.title as string])),
    review: new Map((reviews.data ?? []).map((r: any) => [r.id, { propertyId: r.property_id as string, title: (r.properties?.title ?? "Property") as string }])),
    lease: new Map((leases.data ?? []).map((r: any) => [r.id, { propertyId: r.property_id as string, title: (r.properties?.title ?? "Property") as string }])),
  };
}


function describeTarget(
  type: string | null, id: string | null, t: TargetLookup,
  people: Map<string, { id: string; full_name: string | null; email: string }>,
): { label: string | null; href: string | null } {
  if (!type) return { label: null, href: null };
  const short = id ? String(id).slice(0, 8) : "";
  if (type === "PROPERTY" && id) {
    const title = t.property.get(id);
    return { label: title ? `Property · ${title}` : `Property · ${short} (removed)`, href: title ? `/properties/${id}` : null };
  }
  if (type === "REVIEW" && id) {
    const r = t.review.get(id);
    return { label: r ? `Review on ${r.title}` : `Review · ${short} (removed)`, href: r ? `/properties/${r.propertyId}` : null };
  }
  if (type === "LEASE" && id) {
    const r = t.lease.get(id);
    return { label: r ? `Lease for ${r.title}` : `Lease · ${short} (removed)`, href: null };
  }
  if (type === "USER" && id) {
    const u = people.get(id);
    return { label: u ? `User · ${u.full_name ?? u.email}` : `User · ${short} (removed)`, href: null };
  }
  return { label: type === "OTHER" ? "General" : `${type}${short ? ` · ${short}` : ""}`, href: null };
}

export async function resolveReport(adminId: string, id: string, status: Exclude<ReportStatus, "OPEN">, resolution?: string) {
  const note = resolution?.trim() || null;

  const { data: current, error: readErr } = await supabaseAdmin
    .from("reports").select("id, status, subject, reporter_id").eq("id", id).maybeSingle();
  if (readErr) throw fail(readErr.message, 500);
  if (!current) throw fail("Report not found.", 404);


  const from = current.status as ReportStatus;
  if (!REPORT_TRANSITIONS[from]?.includes(status)) {
    throw fail(`A ${from.toLowerCase()} report can't be moved to ${status.toLowerCase()}.`, 409);
  }
  const closing = status === "RESOLVED" || status === "DISMISSED";
  if (closing && (!note || note.length < 5)) throw fail("Add a resolution note (at least 5 characters).", 400);

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("reports")
    .update({
      status,
      resolution: closing ? note : null,
      resolved_by: closing ? adminId : null,
      resolved_at: closing ? now : null,
      updated_at: now,
    })

    .eq("id", id).eq("status", from) // optimistic lock: fails if someone else changed it first
    .select().maybeSingle();
  if (error) throw fail(error.message, 500);
  if (!data) throw fail("This report was just updated by another admin. Refresh and try again.", 409);

  const reopened = !closing && (from === "RESOLVED" || from === "DISMISSED");

  await auditSoft(adminId, reopened ? "REPORT_REOPENED" : `REPORT_${status}`, "REPORT", id, {
  
    label: current.subject, from, to: status, note,
  });

  if (closing && current.reporter_id) {
    inApp.notifyUser(
      current.reporter_id, "REPORT_UPDATED",
      status === "RESOLVED" ? "Your report was resolved" : "Your report was reviewed",
      note ?? undefined,
    ).catch(() => {});
  }
  return data;
}