import PDFDocument from "pdfkit";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { Lease } from "../types";

// PDFKit's built-in Helvetica has no glyph for symbols such as ₹, so PDFs use the ISO code.
const money = (n: number) =>
  `${env.defaultCurrency.toUpperCase()} ${Number(n).toLocaleString(env.defaultLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const longDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

async function loadParties(lease: Lease) {
  const [{ data: property }, { data: tenant }, { data: landlord }, { data: unit }] = await Promise.all([
    supabaseAdmin.from("properties").select("*").eq("id", lease.property_id).maybeSingle(),
    supabaseAdmin.from("users").select("full_name, email, phone").eq("id", lease.tenant_id).maybeSingle(),
    supabaseAdmin.from("users").select("full_name, email, phone").eq("id", lease.landlord_id).maybeSingle(),
    lease.unit_id
      ? supabaseAdmin.from("units").select("unit_label, floor").eq("id", lease.unit_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { property, tenant, landlord, unit };
}

export async function buildLeasePdf(lease: Lease): Promise<Buffer> {
  const { property, tenant, landlord, unit } = await loadParties(lease);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Lease Agreement ${lease.id}` } });
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

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111").text("Residential Lease Agreement", { align: "center" });
    doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor("#666")
      .text(`Lease ID: ${lease.id}  |  Status: ${lease.status}`, { align: "center" });
    doc.fillColor("#111").fontSize(10.5);

    heading("Parties");
    row("Landlord", `${landlord?.full_name ?? "N/A"} (${landlord?.email ?? "N/A"})`);
    row("Tenant", `${tenant?.full_name ?? "N/A"} (${tenant?.email ?? "N/A"})`);

    heading("Property");
    const address = [property?.address_line1, property?.address_line2, property?.city, property?.state, property?.postal_code]
      .filter(Boolean).join(", ");
    row("Property", property?.title ?? "N/A");
    if (unit) row("Unit", unit.floor != null ? `${unit.unit_label} (floor ${unit.floor})` : unit.unit_label);
    if (address) row("Address", address);

    heading("Lease Terms");
    row("Start date", longDate(lease.lease_start_date));
    row("End date", longDate(lease.lease_end_date));
    row("Duration", `${lease.lease_duration_months} month(s)`);
    row("Monthly rent", money(lease.rent_amount));
    row("Security deposit", money(lease.security_deposit));

    if (lease.terms) {
      heading("Additional Terms");
      doc.text(lease.terms, { align: "left" });
    }

    heading("Signatures");
    row("Landlord", lease.signed_by_landlord ? `Signed electronically (${landlord?.full_name ?? ""})` : "Not yet signed");
    row("Tenant", lease.signed_by_tenant ? `Signed electronically (${tenant?.full_name ?? ""})` : "Not yet signed");

    doc.moveDown(2).fontSize(8.5).fillColor("#888")
      .text(`Generated on ${new Date().toUTCString()}.`, { align: "center" });
    doc.end();
  });
}