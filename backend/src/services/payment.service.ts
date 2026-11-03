import { LIST_HARD_CAP } from "../config/limits";
import Stripe from "stripe";
import { supabaseAdmin } from "../config/supabase";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import { Payment, PaymentStatus, PaymentType, Lease } from "../types";
import * as notificationService from "./notification.service";
import { activateLeaseIfReady } from "./lease.service";

export interface CreatePaymentInput {
  leaseId: string;
  type: PaymentType;
  amount: number;
  description?: string;
  period?: string;
  dueDate?: string;
}

async function getLeaseOrThrow(id: string): Promise<Lease> {
  const { data, error } = await supabaseAdmin.from("leases").select("*").eq("id", id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) throw Object.assign(new Error("Lease not found."), { statusCode: 404 });
  return data as Lease;
}

async function getPaymentOrThrow(id: string): Promise<Payment> {
  const { data, error } = await supabaseAdmin.from("payments").select("*").eq("id", id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) throw Object.assign(new Error("Payment not found."), { statusCode: 404 });
  return data as Payment;
}

function assertAccess(payment: Payment, userId: string, role: string) {
  if (role !== "ADMIN" && payment.tenant_id !== userId && payment.landlord_id !== userId) {
    throw Object.assign(new Error("You do not have access to this payment."), { statusCode: 403 });
  }
}

export async function createInvoice(landlordId: string, input: CreatePaymentInput): Promise<Payment> {
  const lease = await getLeaseOrThrow(input.leaseId);
  if (lease.landlord_id !== landlordId) {
    throw Object.assign(new Error("You do not manage this lease."), { statusCode: 403 });
  }

  // Rent and other invoices need an ACTIVE lease. The security deposit is the exception: it has to be paid
  // while the lease is still a DRAFT, because the lease can't activate until it is.
  const isDeposit = input.type === "DEPOSIT";
  if (lease.status !== "ACTIVE" && !(isDeposit && lease.status === "DRAFT")) {
    throw Object.assign(
      new Error("Invoices can only be created for active leases (a security deposit can also be invoiced on a draft lease)."),
      { statusCode: 409 }
    );
  }
  if (isDeposit) {
    const required = Math.round(Number(lease.security_deposit) * 100);
    if (required <= 0) {
      throw Object.assign(new Error("This lease has no security deposit."), { statusCode: 400 });
    }
    if (Math.round(input.amount * 100) !== required) {
      throw Object.assign(
        new Error(`A deposit invoice must equal the lease's security deposit (${lease.security_deposit}).`),
        { statusCode: 400 }
      );
    }
  }

  // One live invoice per deposit / per period.
  const period = input.period ?? (isDeposit ? "deposit" : undefined);
  if (period) {
    const { count: dupes } = await supabaseAdmin
      .from("payments").select("id", { count: "exact", head: true })
      .eq("lease_id", lease.id).eq("type", input.type).eq("period", period)
      .not("status", "in", "(CANCELLED,FAILED,REFUNDED)");
    if ((dupes ?? 0) > 0) {
      throw Object.assign(
        new Error(`An invoice for ${input.type.toLowerCase()} (${period}) already exists on this lease.`),
        { statusCode: 409 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("payments")
    .insert({
      lease_id: lease.id,
      property_id: lease.property_id,
      tenant_id: lease.tenant_id,
      landlord_id: landlordId,
      type: input.type,
      description: input.description ?? null,
      period: period ?? null,
      amount: input.amount,
      currency: env.defaultCurrency,
      due_date: input.dueDate ?? null,
      created_by: landlordId,
    })
    .select()
    .single();

  if (error || !data) throw Object.assign(new Error("Failed to create invoice."), { statusCode: 500 });

  const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", lease.property_id).maybeSingle();
  notificationService
    .notifyInvoiceCreated(lease.tenant_id, property?.title ?? "your property", input.amount, input.dueDate ?? null, env.defaultCurrency)
    .catch(() => {});

  return data as Payment;
}

export async function getPaymentDetail(id: string, userId: string, role: string): Promise<Payment> {
  const payment = await getPaymentOrThrow(id);
  assertAccess(payment, userId, role);
  return payment;
}

export async function listMineTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*, properties(title, city)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return data ?? [];
}

export async function listMineLandlord(landlordId: string) {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*, properties(title, city), users!payments_tenant_id_fkey(full_name, email, phone)")
    .eq("landlord_id", landlordId)
    .order("created_at", { ascending: false })
    .limit(LIST_HARD_CAP);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return data ?? [];
}

export async function listForLease(leaseId: string, userId: string, role: string) {
  const lease = await getLeaseOrThrow(leaseId);
  if (role !== "ADMIN" && lease.tenant_id !== userId && lease.landlord_id !== userId) {
    throw Object.assign(new Error("You do not have access to this lease."), { statusCode: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return data ?? [];
}

const PAYABLE_STATUSES: PaymentStatus[] = ["PENDING", "FAILED", "PROCESSING"];

export async function createCheckoutSession(paymentId: string, tenantId: string): Promise<string> {
  const payment = await getPaymentOrThrow(paymentId);
  if (payment.tenant_id !== tenantId) {
    throw Object.assign(new Error("You are not the tenant on this invoice."), { statusCode: 403 });
  }
  if (!PAYABLE_STATUSES.includes(payment.status)) {
    throw Object.assign(new Error(`This invoice cannot be paid while it is ${payment.status}.`), { statusCode: 409 });
  }

  // A deposit only makes sense while the lease is still going ahead. Unpaid rent on an ended lease is
  // different (the tenant may still owe it), so only deposits are blocked here.
  if (payment.type === "DEPOSIT") {
    const lease = await getLeaseOrThrow(payment.lease_id);
    if (lease.status !== "DRAFT" && lease.status !== "ACTIVE") {
      throw Object.assign(new Error("This lease is no longer active, so the deposit can't be paid."), { statusCode: 409 });
    }
  }

  // Abandoned checkout? Settle or expire the old Stripe session first so the tenant can retry without paying twice.
  if (payment.status === "PROCESSING" && payment.stripe_checkout_session_id) {
    const old = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id);
    if (old.payment_status === "paid") {
      const intentId = typeof old.payment_intent === "string" ? old.payment_intent : old.payment_intent?.id ?? null;
      await markSucceeded(payment.id, intentId);
      throw Object.assign(new Error("This invoice was already paid."), { statusCode: 409 });
    }
    if (old.status === "open") await stripe.checkout.sessions.expire(old.id).catch(() => {});
  }

  const { data: tenant } = await supabaseAdmin.from("users").select("email").eq("id", tenantId).maybeSingle();

  const label = payment.type === "RENT" ? "Rent payment" : payment.type === "DEPOSIT" ? "Security deposit" : "Payment";
  const description = payment.description ? `${label} — ${payment.description}` : label;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: tenant?.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: payment.currency,
          unit_amount: Math.round(Number(payment.amount) * 100),
          product_data: { name: description },
        },
      },
    ],
    metadata: { paymentId: payment.id },
    payment_intent_data: { metadata: { paymentId: payment.id } },
    success_url: `${env.frontendUrl}/dashboard/payments?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.frontendUrl}/dashboard/payments?checkout=cancelled`,
  });

  await supabaseAdmin
    .from("payments")
    .update({ stripe_checkout_session_id: session.id, status: "PROCESSING", updated_at: new Date().toISOString() })
    .eq("id", payment.id);

  if (!session.url) throw Object.assign(new Error("Stripe did not return a checkout URL."), { statusCode: 502 });
  return session.url;
}

export async function cancelInvoice(id: string, landlordId: string): Promise<Payment> {
  const payment = await getPaymentOrThrow(id);
  if (payment.landlord_id !== landlordId) {
    throw Object.assign(new Error("You do not manage this invoice."), { statusCode: 403 });
  }
  if (payment.status === "SUCCEEDED") {
    throw Object.assign(new Error("A paid invoice cannot be cancelled."), { statusCode: 409 });
  }
  const { data, error } = await supabaseAdmin
    .from("payments")
    .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw Object.assign(new Error("Failed to cancel invoice."), { statusCode: 500 });
  return data as Payment;
}

function receiptNumberFor(payment: Payment): string {
  return `RCPT-${payment.id.slice(0, 8).toUpperCase()}`;
}

async function markSucceeded(paymentId: string, paymentIntentId: string | null) {
  const payment = await getPaymentOrThrow(paymentId);
  if (payment.status === "SUCCEEDED") {
    // Stripe can deliver the same event twice. A deposit whose lease activation failed on the
    // first attempt (e.g. a transient DB error) still gets another chance here.
    if (payment.type === "DEPOSIT") {
      activateLeaseIfReady(payment.lease_id).catch((err) =>
        console.error("Could not activate lease after the deposit payment:", err)
      );
    }
    return;
  }

  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "SUCCEEDED",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
      receipt_number: receiptNumberFor(payment),
      failure_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  // If this write fails we must NOT send a "payment succeeded" notice. Throwing makes Stripe retry the webhook.
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });

  const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", payment.property_id).maybeSingle();
  notificationService
    .notifyPaymentSucceeded(payment.tenant_id, payment.landlord_id, property?.title ?? "your property", Number(payment.amount), payment.currency)
    .catch(() => {});

  // A paid deposit may be the last thing a signed lease was waiting for.
  if (payment.type === "DEPOSIT") {
    activateLeaseIfReady(payment.lease_id).catch((err) =>
      console.error("Could not activate lease after the deposit payment:", err)
    );
  }
}

async function markFailed(paymentId: string, reason: string | null) {
  const payment = await getPaymentOrThrow(paymentId);
  if (payment.status === "SUCCEEDED") return; // never downgrade a completed payment
  await supabaseAdmin
    .from("payments")
    .update({ status: "FAILED", failure_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
  const { data: property } = await supabaseAdmin.from("properties").select("title").eq("id", payment.property_id).maybeSingle();
  notificationService
    .notifyPaymentFailed(payment.tenant_id, property?.title ?? "your property", Number(payment.amount), reason ?? "Payment failed.", payment.currency)
    .catch(() => {});
}

export async function syncFromStripe(paymentId: string, userId: string, role: string): Promise<Payment> {
  const payment = await getPaymentOrThrow(paymentId);
  assertAccess(payment, userId, role);

  if (!payment.stripe_checkout_session_id) {
    throw Object.assign(new Error("This invoice has no checkout session to check yet."), { statusCode: 409 });
  }
  if (payment.status === "SUCCEEDED") {
    return payment; // already settled, nothing to reconcile
  }
  const session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id, {
    expand: ["payment_intent"],
  });

  if (session.payment_status === "paid") {
    const intentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    await markSucceeded(paymentId, intentId);
  } else if (session.status === "expired") {
    await markFailed(paymentId, "Checkout session expired.");
  } else if (
    session.payment_intent &&
    typeof session.payment_intent !== "string" &&
    session.payment_intent.last_payment_error
  ) {
    await markFailed(paymentId, session.payment_intent.last_payment_error.message ?? "Card payment failed.");
  }

  return getPaymentOrThrow(paymentId);
}

async function findPaymentIdBySessionId(sessionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId ?? (await findPaymentIdBySessionId(session.id));
      if (!paymentId) break;
      if (session.payment_status === "paid") {
        const intentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
        await markSucceeded(paymentId, intentId);
      }
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId ?? (await findPaymentIdBySessionId(session.id));
      if (!paymentId) break;
      await markFailed(
        paymentId,
        event.type === "checkout.session.expired" ? "Checkout session expired." : "Payment failed."
      );
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (!paymentId) break;
      await markFailed(paymentId, intent.last_payment_error?.message ?? "Card payment failed.");
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (!intentId) break;
      const { data } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("stripe_payment_intent_id", intentId)
        .maybeSingle();
      if (!data) break;
      await supabaseAdmin
        .from("payments")
        .update({ status: "REFUNDED", updated_at: new Date().toISOString() })
        .eq("id", data.id);
      break;
    }
    default:
      break;
  }
}

