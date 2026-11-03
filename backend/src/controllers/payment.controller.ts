import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import * as paymentService from "../services/payment.service";
import { buildInvoicePdf, buildReceiptPdf } from "../services/payment-pdf.service";

const createInvoiceSchema = z.object({
  leaseId: z.string().uuid(),
  type: z.enum(["RENT", "DEPOSIT", "OTHER"]),
  amount: z.coerce.number().positive(),
  description: z.string().max(300).optional(),
  period: z.string().max(20).optional(),
  dueDate: z.string().date().optional(),
});

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createInvoiceSchema.parse(req.body);
    const payment = await paymentService.createInvoice(req.user!.sub, input);
    res.status(201).json({ payment });
  } catch (err) { next(err); }
}

export async function listMine(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentService.listMineTenant(req.user!.sub);
    res.status(200).json({ payments });
  } catch (err) { next(err); }
}

export async function listForLandlord(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentService.listMineLandlord(req.user!.sub);
    res.status(200).json({ payments });
  } catch (err) { next(err); }
}

export async function listForLease(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await paymentService.listForLease(req.params.leaseId as string, req.user!.sub, req.user!.role);
    res.status(200).json({ payments });
  } catch (err) { next(err); }
}

export async function getPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.getPaymentDetail(req.params.id as string, req.user!.sub, req.user!.role);
    res.status(200).json({ payment });
  } catch (err) { next(err); }
}

export async function createCheckoutSession(req: Request, res: Response, next: NextFunction) {
  try {
    const url = await paymentService.createCheckoutSession(req.params.id as string, req.user!.sub);
    res.status(200).json({ url });
  } catch (err) { next(err); }
}

export async function cancelInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.cancelInvoice(req.params.id as string, req.user!.sub);
    res.status(200).json({ payment });
  } catch (err) { next(err); }
}

export async function downloadInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.getPaymentDetail(req.params.id as string, req.user!.sub, req.user!.role);
    const pdf = await buildInvoicePdf(payment);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${payment.id}.pdf"`);
    res.status(200).end(pdf);
  } catch (err) { next(err); }
}

export async function downloadReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.getPaymentDetail(req.params.id as string, req.user!.sub, req.user!.role);
    if (payment.status !== "SUCCEEDED") {
      return res.status(409).json({ message: "A receipt is only available once this payment has succeeded." });
    }
    const pdf = await buildReceiptPdf(payment);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${payment.receipt_number ?? payment.id}.pdf"`);
    res.status(200).end(pdf);
  } catch (err) { next(err); }
}

export async function syncPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await paymentService.syncFromStripe(req.params.id as string, req.user!.sub, req.user!.role);
    res.status(200).json({ payment });
  } catch (err) { next(err); }
}
/**
 * Mounted directly in app.ts, BEFORE express.json(), with express.raw() —
 * Stripe's signature check needs the exact raw request body, not a parsed object.
 */
export async function handleWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).send("Missing Stripe signature.");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.stripeWebhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", (err as Error).message);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    await paymentService.handleStripeEvent(event);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Error handling Stripe webhook event:", err);
    // 5xx => Stripe retries with backoff. Handlers are idempotent (markSucceeded checks status), so retries are safe;
    // answering 200 here would silently lose a payment on any transient DB error.
    res.status(500).json({ received: false });
  }
}