import cron from "node-cron";
import { supabaseAdmin } from "../config/supabase";
import * as notificationService from "../services/notification.service";

const RENT_REMINDER_DAYS_BEFORE = 3;
const LEASE_EXPIRY_REMINDER_DAYS_BEFORE = 30;
const TOKEN_GRACE_DAYS = 7;

function daysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function sendRentReminders() {
  const cutoff = daysFromNow(RENT_REMINDER_DAYS_BEFORE);
  const { data: payments, error } = await supabaseAdmin
    .from("payments")
    .select("id, tenant_id, property_id, amount, currency, due_date")
    .in("status", ["PENDING", "FAILED"])
    .is("rent_reminder_sent_at", null)
    .not("due_date", "is", null)
    .lte("due_date", cutoff);

  if (error) {
    console.error("Rent reminder job failed to query payments:", error.message);
    return;
  }
  if (!payments || payments.length === 0) return;

  for (const payment of payments) {
    const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", payment.property_id).maybeSingle();
    await notificationService.notifyRentReminder(payment.tenant_id, property?.title ?? "your property", Number(payment.amount), payment.due_date, payment.currency);
    await supabaseAdmin.from("payments").update({ rent_reminder_sent_at: new Date().toISOString() }).eq("id", payment.id);
  }
  console.log(`Rent reminders sent: ${payments.length}`);
}

export async function sendLeaseExpiryReminders() {
  const cutoff = daysFromNow(LEASE_EXPIRY_REMINDER_DAYS_BEFORE);
  const { data: leases, error } = await supabaseAdmin
    .from("leases")
    .select("id, tenant_id, landlord_id, property_id, lease_end_date")
    .eq("status", "ACTIVE")
    .is("expiry_reminder_sent_at", null)
    .lte("lease_end_date", cutoff);

  if (error) {
    console.error("Lease expiry reminder job failed to query leases:", error.message);
    return;
  }
  if (!leases || leases.length === 0) return;

  for (const lease of leases) {
    const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", lease.property_id).maybeSingle();
    const daysLeft = Math.max(0, Math.round((new Date(lease.lease_end_date).getTime() - Date.now()) / 86_400_000));
    await notificationService.notifyLeaseExpiring(lease.tenant_id, lease.landlord_id, property?.title ?? "your property", lease.lease_end_date, daysLeft);
    await supabaseAdmin.from("leases").update({ expiry_reminder_sent_at: new Date().toISOString() }).eq("id", lease.id);
  }
  console.log(`Lease expiry reminders sent: ${leases.length}`);
}

/**
 * Releases applications whose hold has lapsed (done by the database function), then tells the tenant and
 * landlord about each APPROVED hold that expired. We read the due approvals BEFORE the function runs, and
 * only notify the ones that really ended up EXPIRED afterwards.
 */
export async function expireStaleApplications() {
  const { data: due } = await supabaseAdmin
    .from("rental_applications")
    .select("id, tenant_id, property_id")
    .eq("status", "APPROVED")
    .lt("expires_at", new Date().toISOString())
    .limit(200);

  const { data, error } = await supabaseAdmin.rpc("expire_stale_applications");
  if (error) {
    console.error("Application expiry job failed:", error.message);
    return;
  }
  if (data) console.log(`Expired applications released: ${data}`);
  if (!due || due.length === 0) return;

  const { data: nowExpired } = await supabaseAdmin
    .from("rental_applications")
    .select("id")
    .in("id", due.map((a) => a.id))
    .eq("status", "EXPIRED");
  const expiredIds = new Set((nowExpired ?? []).map((a) => a.id));

  for (const a of due) {
    if (!expiredIds.has(a.id)) continue;
    const { data: property } = await supabaseAdmin
      .from("properties")
      .select("title, landlord_id")
      .eq("id", a.property_id)
      .maybeSingle();
    if (!property) continue;
    notificationService
      .notifyApprovalExpired(a.tenant_id, property.landlord_id, property.title, a.id)
      .catch(() => {});
  }
}

/** Ends ACTIVE leases whose end date has fully passed, frees the unit/property, and notifies both parties. */
export async function expireEndedLeases() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: leases, error } = await supabaseAdmin
    .from("leases")
    .select("id, tenant_id, landlord_id, property_id")
    .eq("status", "ACTIVE")
    .lt("lease_end_date", today)
    .limit(200);

  if (error) {
    console.error("Lease end job failed to query leases:", error.message);
    return;
  }
  if (!leases || leases.length === 0) return;

  let ended = 0;
  for (const lease of leases) {
    // Only flip it if it's still ACTIVE, so a landlord ending it by hand at the same moment can't double-apply.
    const { data: flipped, error: flipError } = await supabaseAdmin
      .from("leases")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("id", lease.id)
      .eq("status", "ACTIVE")
      .select("id")
      .maybeSingle();
    if (flipError || !flipped) continue;

    const { error: releaseError } = await supabaseAdmin.rpc("release_lease_target", { p_lease: lease.id });
    if (releaseError) {
      // Put it back so the next run retries. Otherwise the unit would stay OCCUPIED forever.
      await supabaseAdmin
        .from("leases")
        .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
        .eq("id", lease.id)
        .eq("status", "EXPIRED");
      console.error("Could not release availability for lease", lease.id, releaseError.message);
      continue;
    }

    ended++;
    const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", lease.property_id).maybeSingle();
    notificationService
      .notifyLeaseEnded(lease.tenant_id, lease.landlord_id, property?.title ?? "your property")
      .catch(() => {});
  }
  if (ended) console.log(`Leases ended: ${ended}`);
}

/** Deletes login and password-reset tokens that expired more than a week ago. They are never needed again. */
export async function cleanupExpiredTokens() {
  const cutoff = new Date(Date.now() - TOKEN_GRACE_DAYS * 86_400_000).toISOString();
  for (const table of ["refresh_tokens", "password_reset_tokens"] as const) {
    const { data, error } = await supabaseAdmin.from(table).delete().lt("expires_at", cutoff).select("id");
    if (error) {
      console.error(`Token cleanup failed for ${table}:`, error.message);
      continue;
    }
    if (data && data.length > 0) console.log(`Expired ${table} deleted: ${data.length}`);
  }
}

/** Wraps a job so two runs of the same job can never overlap, and a crash is logged instead of thrown. */
const running = new Set<string>();
function guarded(name: string, job: () => Promise<void>) {
  return () => {
    if (running.has(name)) {
      console.warn(`${name} is still running, skipping this run.`);
      return;
    }
    running.add(name);
    job()
      .catch((err) => console.error(`${name} crashed:`, err))
      .finally(() => running.delete(name));
  };
}



const tasks: ReturnType<typeof cron.schedule>[] = [];

export function startReminderJobs() {
  if (tasks.length > 0) return; // already started

  // Daily at 08:00 server time. Each reminder is sent once per payment/lease, tracked via the
  // *_reminder_sent_at columns, so a restart or re-run never double-sends.
  tasks.push(
    cron.schedule("0 8 * * *", guarded("Reminders", async () => {
      await sendRentReminders();
      await sendLeaseExpiryReminders();
    })),
     


    // Every 10 minutes: release approvals/applications whose hold has lapsed.
    cron.schedule("*/10 * * * *", guarded("Application expiry", expireStaleApplications)),
    // Daily just after midnight: end ACTIVE leases whose end date has passed.
    cron.schedule("5 0 * * *", guarded("Lease end", expireEndedLeases)),
    // Daily at 03:15: delete long-expired login / reset tokens.
    cron.schedule("15 3 * * *", guarded("Token cleanup", cleanupExpiredTokens)),
  );

  console.log("📅 Jobs scheduled: reminders (08:00), application expiry (every 10 min), lease end (00:05), token cleanup (03:15)");
}



/** Called on shutdown so no job starts while the server is closing. */
export function stopReminderJobs() {
  for (const task of tasks) task.stop();
  tasks.length = 0;
}

