import { transporter, emailFrom, mailerConfigured } from "../config/mailer";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import * as templates from "./email-templates";
import * as inApp from "./in-app-notification.service";

async function getUser(id: string): Promise<{ full_name: string | null; email: string } | null> {
  const { data } = await supabaseAdmin.from("users").select("full_name, email").eq("id", id).maybeSingle();
  return data ?? null;
}

async function send(to: string, content: templates.EmailContent) {
  if (!mailerConfigured || !transporter) {
    console.log(`[email:skip] would send "${content.subject}" to ${to} (SMTP not configured)`);
    return;
  }
  try {
    await transporter.sendMail({ from: emailFrom, to, subject: content.subject, html: content.html, text: content.text });
  } catch (err) {
    console.error(`Failed to send email "${content.subject}" to ${to}:`, (err as Error).message);
  }
}

const CURRENCY = env.defaultCurrency;
const LOCALE = env.defaultLocale;
/** Formats an amount in the invoice's own currency (falls back to DEFAULT_CURRENCY). */
const money = (n: number, currency: string = CURRENCY) =>
  new Intl.NumberFormat(LOCALE, { style: "currency", currency: (currency || CURRENCY).toUpperCase() }).format(Number(n));
const dateStr = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// ─── Applications ────────────────────────────────────────────────────────
export async function notifyApplicationSubmitted(landlordId: string, tenantId: string, propertyTitle: string) {
  const [landlord, tenant] = await Promise.all([getUser(landlordId), getUser(tenantId)]);
  if (!landlord) return;
  const tenantName = tenant?.full_name ?? "A tenant";
  await send(landlord.email, templates.applicationSubmittedEmail(propertyTitle, tenantName, `${env.frontendUrl}/landlord/applications`));
  await inApp.notifyUser(
    landlordId,
    "APPLICATION_SUBMITTED",
    `New application for ${propertyTitle}`,
    `${tenantName} applied to rent ${propertyTitle}.`,
    "/landlord/applications"
  );
}

export async function notifyApplicationApproved(tenantId: string, propertyTitle: string, applicationId: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  await send(tenant.email, templates.applicationApprovedEmail(propertyTitle, `${env.frontendUrl}/applications/${applicationId}`));
  await inApp.notifyUser(
    tenantId,
    "APPLICATION_APPROVED",
    `Application approved — ${propertyTitle}`,
    "Your landlord will follow up with a lease shortly.",
    `/applications/${applicationId}`
  );
}

export async function notifyApplicationRejected(tenantId: string, propertyTitle: string, reason: string, applicationId: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  await send(tenant.email, templates.applicationRejectedEmail(propertyTitle, reason, `${env.frontendUrl}/applications/${applicationId}`));
  await inApp.notifyUser(
    tenantId,
    "APPLICATION_REJECTED",
    `Application not approved — ${propertyTitle}`,
    reason || undefined,
    `/applications/${applicationId}`
  );
}

// ─── Leases ──────────────────────────────────────────────────────────────
export async function notifyLeaseCreated(tenantId: string, propertyTitle: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  await send(tenant.email, templates.leaseReadyToSignEmail(propertyTitle, `${env.frontendUrl}/leases`));
  await inApp.notifyUser(tenantId, "LEASE_READY", `Lease ready to sign — ${propertyTitle}`, undefined, "/leases");
}

export async function notifyLeaseActivated(tenantId: string, landlordId: string, propertyTitle: string) {
  const [tenant, landlord] = await Promise.all([getUser(tenantId), getUser(landlordId)]);
  if (tenant) {
    await send(tenant.email, templates.leaseActivatedEmail(propertyTitle, `${env.frontendUrl}/leases`));
    await inApp.notifyUser(tenantId, "LEASE_ACTIVATED", `Lease now active — ${propertyTitle}`, undefined, "/leases");
  }
  if (landlord) {
    await send(landlord.email, templates.leaseActivatedEmail(propertyTitle, `${env.frontendUrl}/landlord/leases`));
    await inApp.notifyUser(landlordId, "LEASE_ACTIVATED", `Lease now active — ${propertyTitle}`, undefined, "/landlord/leases");
  }
}




export async function notifyLeaseExpiring(tenantId: string, landlordId: string, propertyTitle: string, endDate: string, daysLeft: number) {
  const [tenant, landlord] = await Promise.all([getUser(tenantId), getUser(landlordId)]);
  const readableDate = dateStr(endDate);
  const body = `Ends ${readableDate} (${daysLeft} days from now).`;
  if (tenant) {
    await send(tenant.email, templates.leaseExpiringEmail(propertyTitle, readableDate, daysLeft, `${env.frontendUrl}/leases`));
    await inApp.notifyUser(tenantId, "LEASE_EXPIRING", `Lease ending soon — ${propertyTitle}`, body, "/leases");
  }
  if (landlord) {
    await send(landlord.email, templates.leaseExpiringEmail(propertyTitle, readableDate, daysLeft, `${env.frontendUrl}/landlord/leases`));
    await inApp.notifyUser(landlordId, "LEASE_EXPIRING", `Lease ending soon — ${propertyTitle}`, body, "/landlord/leases");
  }
}

export async function notifyApprovalExpired(
  tenantId: string,
  landlordId: string,
  propertyTitle: string,
  applicationId: string
) {
  await inApp.notifyUser(
    tenantId,
    "APPROVAL_EXPIRED",
    `Your approval for ${propertyTitle} expired`,
    "No lease was signed in time, so it was released. You can apply again.",
    `/applications/${applicationId}`
  );
  await inApp.notifyUser(
    landlordId,
    "APPROVAL_EXPIRED",
    `Approval expired — ${propertyTitle}`,
    "The lease wasn't signed in time, so it is available again.",
    "/landlord/applications"
  );
}

export async function notifyReservationReleased(
  tenantId: string,
  landlordId: string,
  propertyTitle: string,
  reason: "TENANT_WITHDREW" | "LEASE_CANCELLED",
  applicationId: string
) {
  if (reason === "TENANT_WITHDREW") {
    await inApp.notifyUser(
      landlordId,
      "RESERVATION_RELEASED",
      `Reservation released — ${propertyTitle}`,
      "The tenant withdrew, so it is available again.",
      "/landlord/applications"
    );
  } else {
    await inApp.notifyUser(
      tenantId,
      "RESERVATION_RELEASED",
      `Reservation released — ${propertyTitle}`,
      "The landlord cancelled the draft lease, so your reservation was released.",
      `/applications/${applicationId}`
    );
  }
}

export async function notifyLeaseEnded(tenantId: string, landlordId: string, propertyTitle: string) {
  await inApp.notifyUser(
    tenantId,
    "LEASE_ENDED",
    `Your lease for ${propertyTitle} has ended`,
    undefined,
    "/leases"
  );
  await inApp.notifyUser(
    landlordId,
    "LEASE_ENDED",
    `Lease ended — ${propertyTitle}`,
    "It is available again.",
    "/landlord/leases"
  );
}

// ─── Payments ────────────────────────────────────────────────────────────
export async function notifyInvoiceCreated(tenantId: string, propertyTitle: string, amount: number, dueDate: string | null, currency?: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  const dueLabel = dueDate ? dateStr(dueDate) : "no fixed date";
  const formatted = money(amount, currency);
  await send(tenant.email, templates.invoiceCreatedEmail(propertyTitle, formatted, dueLabel, `${env.frontendUrl}/dashboard/payments`));
  await inApp.notifyUser(tenantId, "INVOICE_CREATED", `New invoice: ${formatted}`, `${propertyTitle} — due ${dueLabel}.`, "/dashboard/payments");
}

export async function notifyRentReminder(tenantId: string, propertyTitle: string, amount: number, dueDate: string, currency?: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  const dueLabel = dateStr(dueDate);
  const formatted = money(amount, currency);
  await send(tenant.email, templates.rentReminderEmail(propertyTitle, formatted, dueLabel, `${env.frontendUrl}/dashboard/payments`));
  await inApp.notifyUser(tenantId, "RENT_REMINDER", `Payment reminder: ${formatted} due`, `${propertyTitle} — due ${dueLabel}.`, "/dashboard/payments");
}

export async function notifyPaymentSucceeded(tenantId: string, landlordId: string, propertyTitle: string, amount: number, currency?: string) {
  const [tenant, landlord] = await Promise.all([getUser(tenantId), getUser(landlordId)]);
  const formatted = money(amount, currency);
  if (tenant) {
    await send(tenant.email, templates.paymentSucceededEmail(propertyTitle, formatted, false, `${env.frontendUrl}/dashboard/payments`));
    await inApp.notifyUser(tenantId, "PAYMENT_SUCCEEDED", `Payment successful: ${formatted}`, propertyTitle, "/dashboard/payments");
  }
  if (landlord) {
    await send(landlord.email, templates.paymentSucceededEmail(propertyTitle, formatted, true, `${env.frontendUrl}/dashboard/payments`));
    await inApp.notifyUser(landlordId, "PAYMENT_SUCCEEDED", `Payment received: ${formatted}`, propertyTitle, "/dashboard/payments");
  }
}

export async function notifyPaymentFailed(tenantId: string, propertyTitle: string, amount: number, reason: string, currency?: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  const formatted = money(amount, currency);
  await send(tenant.email, templates.paymentFailedEmail(propertyTitle, formatted, reason, `${env.frontendUrl}/dashboard/payments`));
  await inApp.notifyUser(tenantId, "PAYMENT_FAILED", `Payment failed: ${formatted}`, reason || propertyTitle, "/dashboard/payments");
}

// ─── Maintenance ─────────────────────────────────────────────────────────
export async function notifyMaintenanceCreated(landlordId: string, propertyTitle: string, title: string, priority: string) {
  const landlord = await getUser(landlordId);
  if (!landlord) return;
  await send(landlord.email, templates.maintenanceCreatedEmail(propertyTitle, title, priority, `${env.frontendUrl}/landlord/maintenance`));
  await inApp.notifyUser(landlordId, "MAINTENANCE_CREATED", `New maintenance request: ${title}`, `${propertyTitle} — ${priority} priority.`, "/landlord/maintenance");
}

export async function notifyMaintenanceStatusUpdated(tenantId: string, propertyTitle: string, title: string, status: string) {
  const tenant = await getUser(tenantId);
  if (!tenant) return;
  const statusLabel = status.replace("_", " ").toLowerCase();
  await send(tenant.email, templates.maintenanceStatusUpdatedEmail(propertyTitle, title, status, `${env.frontendUrl}/maintenance`));
  await inApp.notifyUser(tenantId, "MAINTENANCE_STATUS_UPDATED", `Maintenance update: ${title}`, `Now ${statusLabel}.`, "/maintenance");
}

// ─── Account ─────────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(userId: string, token: string) {
  const user = await getUser(userId);
  if (!user) return;
  await send(user.email, templates.passwordResetEmail(`${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`));
}
