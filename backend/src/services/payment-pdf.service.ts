import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../config/supabase";
import { Payment, PaymentType } from "../types";

const TYPE_LABEL: Record<PaymentType, string> = {
  RENT: "Rent payment",
  DEPOSIT: "Security deposit",
  OTHER: "Payment",
};

function money(n: number, currency: string): string {
  const amount = Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency.toUpperCase() === "USD" ? `$${amount}` : `${currency.toUpperCase()} ${amount}`;
}

function longDate(d: string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

async function loadContext(payment: Payment) {
  const [{ data: property }, { data: tenant }, { data: landlord }] = await Promise.all([
    supabaseAdmin
      .from("properties")
      .select("title, address_line1, city, state, postal_code")
      .eq("id", payment.property_id)
      .maybeSingle(),
    supabaseAdmin.from("users").select("full_name, email").eq("id", payment.tenant_id).maybeSingle(),
    supabaseAdmin.from("users").select("full_name, email").eq("id", payment.landlord_id).maybeSingle(),
  ]);
  return { property, tenant, landlord };
}

export async function buildInvoicePdf(payment: Payment): Promise<Buffer> {
  const { property, tenant, landlord } = await loadContext(payment);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Invoice ${payment.id}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const heading = (text: string) => {
      doc.moveDown(1).font("Helvetica-Bold").fontSize(12).fillColor("#111").text(text.toUpperCase());
      doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor("#ccc").stroke();
      doc.moveDown(0.6).font("Helvetica").fontSize(10.5);
    };
    const row = (label: string, value: string) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
    };

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text("Invoice", { align: "center" });
    doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor("#666")
      .text(`Invoice ID: ${payment.id}  |  Status: ${payment.status}`, { align: "center" });
    doc.fillColor("#111").fontSize(10.5);

    heading("Billed to");
    row("Tenant", `${tenant?.full_name ?? "N/A"} (${tenant?.email ?? "N/A"})`);
    row("From", `${landlord?.full_name ?? "N/A"} (${landlord?.email ?? "N/A"})`);

    heading("Property");
    const address = [property?.address_line1, property?.city, property?.state, property?.postal_code]
      .filter(Boolean).join(", ");
    row("Property", property?.title ?? "N/A");
    if (address) row("Address", address);

    heading("Charge");
    row("Type", TYPE_LABEL[payment.type]);
    if (payment.period) row("Period", payment.period);
    if (payment.description) row("Description", payment.description);
    row("Amount due", money(payment.amount, payment.currency));
    row("Due date", longDate(payment.due_date));
    row("Status", payment.status);

    doc.moveDown(2).fontSize(8.5).fillColor("#888").text(`Generated on ${new Date().toUTCString()}.`, { align: "center" });
    doc.end();
  });
}

export async function buildReceiptPdf(payment: Payment): Promise<Buffer> {
  const { property, tenant, landlord } = await loadContext(payment);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Receipt ${payment.receipt_number ?? payment.id}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const heading = (text: string) => {
      doc.moveDown(1).font("Helvetica-Bold").fontSize(12).fillColor("#111").text(text.toUpperCase());
      doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor("#ccc").stroke();
      doc.moveDown(0.6).font("Helvetica").fontSize(10.5);
    };
    const row = (label: string, value: string) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value);
    };

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text("Payment Receipt", { align: "center" });
    doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor("#666")
      .text(`Receipt No: ${payment.receipt_number ?? "N/A"}`, { align: "center" });
    doc.fillColor("#111").fontSize(10.5);

    heading("Paid by");
    row("Tenant", `${tenant?.full_name ?? "N/A"} (${tenant?.email ?? "N/A"})`);
    row("Paid to", `${landlord?.full_name ?? "N/A"} (${landlord?.email ?? "N/A"})`);

    heading("Property");
    row("Property", property?.title ?? "N/A");
    if (property?.city) row("City", property.city);

    heading("Payment");
    row("Type", TYPE_LABEL[payment.type]);
    if (payment.period) row("Period", payment.period);
    row("Amount paid", money(payment.amount, payment.currency));
    row("Paid on", longDate(payment.paid_at));
    row("Payment method", "Card, via Stripe");
    row("Status", "Paid");

    doc.moveDown(2).fontSize(8.5).fillColor("#888").text(`Generated on ${new Date().toUTCString()}.`, { align: "center" });
    doc.end();
  });
}

