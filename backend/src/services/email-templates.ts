const BRAND = "RentEase";
const ACCENT = "#2455eb";

function layout(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Helvetica,Arial,sans-serif;color:#0b1220;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#0b1220;padding:20px 28px;">
            <span style="color:#fff;font-size:16px;font-weight:700;letter-spacing:0.02em;">${BRAND}</span>
          </td></tr>
          <tr><td style="padding:28px;">
            <h1 style="margin:0 0 12px;font-size:19px;font-weight:700;">${title}</h1>
            <div style="font-size:14px;line-height:1.6;color:#333;">${bodyHtml}</div>
            ${
              ctaUrl
                ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:${ACCENT};color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;">${ctaLabel ?? "View"}</a>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#999;">You're receiving this because you have an account on ${BRAND}.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// ─── Applications ────────────────────────────────────────────────────────
export function applicationSubmittedEmail(propertyTitle: string, tenantName: string, url: string): EmailContent {
  return {
    subject: `New application for ${propertyTitle}`,
    html: layout(
      "New rental application",
      `<p><strong>${tenantName}</strong> has applied to rent <strong>${propertyTitle}</strong>. Review it to approve or reject.</p>`,
      "Review application",
      url
    ),
    text: `${tenantName} has applied to rent ${propertyTitle}. Review it here: ${url}`,
  };
}

export function applicationApprovedEmail(propertyTitle: string, url: string): EmailContent {
  return {
    subject: `Your application for ${propertyTitle} was approved`,
    html: layout(
      "Application approved",
      `<p>Good news — your application for <strong>${propertyTitle}</strong> has been approved. Your landlord will follow up with a lease shortly, and you can now message them directly.</p>`,
      "View application",
      url
    ),
    text: `Your application for ${propertyTitle} has been approved. ${url}`,
  };
}

export function applicationRejectedEmail(propertyTitle: string, reason: string, url: string): EmailContent {
  return {
    subject: `Update on your application for ${propertyTitle}`,
    html: layout(
      "Application not approved",
      `<p>Your application for <strong>${propertyTitle}</strong> was not approved.</p><p style="margin-top:8px;"><strong>Reason:</strong> ${reason}</p>`,
      "View application",
      url
    ),
    text: `Your application for ${propertyTitle} was not approved. Reason: ${reason}. ${url}`,
  };
}

// ─── Leases ──────────────────────────────────────────────────────────────
export function leaseReadyToSignEmail(propertyTitle: string, url: string): EmailContent {
  return {
    subject: `Lease ready to sign — ${propertyTitle}`,
    html: layout("Lease ready for your signature", `<p>A lease for <strong>${propertyTitle}</strong> is ready. Please review and sign it.</p>`, "Review lease", url),
    text: `A lease for ${propertyTitle} is ready to sign. ${url}`,
  };
}

export function leaseActivatedEmail(propertyTitle: string, url: string): EmailContent {
  return {
    subject: `Your lease for ${propertyTitle} is now active`,
    html: layout("Lease fully signed", `<p>Both parties have signed the lease for <strong>${propertyTitle}</strong>. It's now active.</p>`, "View lease", url),
    text: `Your lease for ${propertyTitle} is now active. ${url}`,
  };
}

export function leaseExpiringEmail(propertyTitle: string, endDate: string, daysLeft: number, url: string): EmailContent {
  return {
    subject: `Lease for ${propertyTitle} ends in ${daysLeft} days`,
    html: layout(
      "Lease ending soon",
      `<p>The lease for <strong>${propertyTitle}</strong> ends on <strong>${endDate}</strong> (${daysLeft} days from now).</p>`,
      "View lease",
      url
    ),
    text: `The lease for ${propertyTitle} ends on ${endDate} (${daysLeft} days from now). ${url}`,
  };
}

// ─── Payments ────────────────────────────────────────────────────────────
export function invoiceCreatedEmail(propertyTitle: string, amount: string, dueDate: string, url: string): EmailContent {
  return {
    subject: `New invoice: ${amount} due ${dueDate}`,
    html: layout("New invoice", `<p>You have a new invoice of <strong>${amount}</strong> for <strong>${propertyTitle}</strong>, due <strong>${dueDate}</strong>.</p>`, "Pay now", url),
    text: `New invoice of ${amount} for ${propertyTitle}, due ${dueDate}. ${url}`,
  };
}

export function rentReminderEmail(propertyTitle: string, amount: string, dueDate: string, url: string): EmailContent {
  return {
    subject: `Reminder: ${amount} due soon for ${propertyTitle}`,
    html: layout("Payment reminder", `<p>This is a reminder that <strong>${amount}</strong> for <strong>${propertyTitle}</strong> is due on <strong>${dueDate}</strong>.</p>`, "Pay now", url),
    text: `Reminder: ${amount} for ${propertyTitle} is due on ${dueDate}. ${url}`,
  };
}

export function paymentSucceededEmail(propertyTitle: string, amount: string, forLandlord: boolean, url: string): EmailContent {
  const body = forLandlord
    ? `<p>A payment of <strong>${amount}</strong> for <strong>${propertyTitle}</strong> has been received.</p>`
    : `<p>Your payment of <strong>${amount}</strong> for <strong>${propertyTitle}</strong> was successful. A receipt is available.</p>`;
  return {
    subject: `Payment received: ${amount} — ${propertyTitle}`,
    html: layout("Payment successful", body, "View payment", url),
    text: `Payment of ${amount} for ${propertyTitle} was successful. ${url}`,
  };
}

export function paymentFailedEmail(propertyTitle: string, amount: string, reason: string, url: string): EmailContent {
  return {
    subject: `Payment failed — ${propertyTitle}`,
    html: layout(
      "Payment failed",
      `<p>Your payment of <strong>${amount}</strong> for <strong>${propertyTitle}</strong> did not go through.</p><p style="margin-top:8px;"><strong>Reason:</strong> ${reason}</p>`,
      "Try again",
      url
    ),
    text: `Your payment of ${amount} for ${propertyTitle} failed. Reason: ${reason}. ${url}`,
  };
}

// ─── Maintenance ─────────────────────────────────────────────────────────
export function maintenanceCreatedEmail(propertyTitle: string, title: string, priority: string, url: string): EmailContent {
  return {
    subject: `New maintenance request: ${title}`,
    html: layout(
      "New maintenance request",
      `<p>A new <strong>${priority}</strong> priority request was filed for <strong>${propertyTitle}</strong>:</p><p style="margin-top:6px;">"${title}"</p>`,
      "View request",
      url
    ),
    text: `New ${priority} priority maintenance request for ${propertyTitle}: ${title}. ${url}`,
  };
}

export function maintenanceStatusUpdatedEmail(propertyTitle: string, title: string, status: string, url: string): EmailContent {
  return {
    subject: `Maintenance update: ${title}`,
    html: layout(
      "Maintenance request updated",
      `<p>Your request "<strong>${title}</strong>" for <strong>${propertyTitle}</strong> is now <strong>${status.replace("_", " ").toLowerCase()}</strong>.</p>`,
      "View request",
      url
    ),
    text: `Your request "${title}" for ${propertyTitle} is now ${status}. ${url}`,
  };
}

// ─── Account ─────────────────────────────────────────────────────────────
export function passwordResetEmail(url: string): EmailContent {
  return {
    subject: "Reset your RentEase password",
    html: layout(
      "Reset your password",
      `<p>We received a request to reset your password. This link works once and expires in 1 hour.</p><p>If you didn't ask for this, you can safely ignore this email.</p>`,
      "Choose a new password",
      url
    ),
    text: `Reset your RentEase password (link valid for 1 hour): ${url}\nIf you didn't request this, ignore this email.`,
  };
}
