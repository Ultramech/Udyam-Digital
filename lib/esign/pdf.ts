import "server-only";
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { priceLines } from "@/lib/rules/pricing";
import { plainName } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import type { Order, Quote } from "@/lib/store/types";
import { estimateSchedule } from "@/lib/rules/pricing";

/**
 * Order form (PDF) + signature certificate. Standard PDF fonts only cover Latin text, so every string is passed through `safe()`:
 * characters outside WinAnsi become "?" rather than crashing. The document is always English (the contract language); the signing
 * screen the owner sees is in their language.
 */
const safe = (s: string) => s.replace(/₹/g, "Rs.").replace(/[^\x20-\x7E -ÿ]/g, "?");
const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;
export const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export interface Certificate {
  signedAtIso: string; signerPhoneMasked: string; ip: string; userAgent: string; docHash: string; method: string;
}

export async function buildOrderForm(o: Order): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Order form ${o.id}`); doc.setProducer("Udyam Digital"); doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0)); // fixed dates => deterministic bytes => stable hash
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]); let y = 800;
  const text = (p: PDFPage, t: string, x: number, yy: number, f: PDFFont = font, size = 10) => p.drawText(safe(t), { x, y: yy, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  const line = (p: PDFPage, yy: number) => p.drawLine({ start: { x: 40, y: yy }, end: { x: 555, y: yy }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
  const need = (h: number) => { if (y - h < 60) { page = doc.addPage([595, 842]); y = 800; } };

  text(page, "Accel Business", 40, y, bold, 18); y -= 20;
  text(page, "Order form and service agreement summary", 40, y, font, 11); y -= 26;
  const meta: [string, string][] = [
    ["Order", o.id], ["Customer", o.businessName], ["Mobile (verified)", o.phone ? `${o.phone.slice(0, 2)}******${o.phone.slice(-2)}` : "-"],
    ["Plan", bundleName(o.bundleId, "en")], ["Contract", `${o.totals.contractMonths} months`], ["Order date", o.stageDates.RECEIVED],
  ];
  for (const [k, v] of meta) { text(page, k, 40, y, bold); text(page, v, 170, y); y -= 15; }
  y -= 8; line(page, y); y -= 16;
  text(page, "Services", 40, y, bold); text(page, "Qty", 380, y, bold); text(page, "Per month", 430, y, bold); text(page, "One-time", 500, y, bold); y -= 6; line(page, y); y -= 14;
  for (const l of priceLines(o.lines).lines) {
    need(16);
    text(page, `${plainName(l.productId, "en")}${l.siteIndex != null ? ` (site ${l.siteIndex + 1})` : ""}`, 40, y); text(page, String(l.qty), 385, y);
    text(page, rs(l.monthly), 430, y); text(page, l.setup ? rs(l.setup) : "-", 500, y); y -= 14;
  }
  y -= 4; line(page, y); y -= 16;
  const tot: [string, string, boolean][] = [
    ["Monthly charge", rs(o.totals.monthly), false], ["GST on monthly (18%)", rs(o.totals.gstMonthly), false], ["One-time setup", rs(o.totals.setup), false],
    ["GST on setup (18%)", rs(o.totals.gstSetup), false], ["Total payable today", rs(o.totals.firstPayment), true],
  ];
  for (const [k, v, b] of tot) { need(16); text(page, k, 300, y, b ? bold : font); text(page, v, 470, y, b ? bold : font); y -= 15; }
  y -= 14;
  const terms = [
    "1. Prices are the monthly rates shown above plus GST at 18%. The total payable today covers the first month and one-time setup.",
    `2. The minimum contract is ${o.totals.contractMonths} months for the services listed. Services without a lock-in can be changed at any time.`,
    "3. Installation and activation dates are estimates and are shown in the order tracker. Any delay and its reason will be shown there.",
    "4. Your documents are used only to verify your business for this order. You can withdraw consent or ask for deletion from your account.",
    "5. By signing with a one-time code sent to your verified mobile number, you agree to this order. This is an electronic signature under",
    "    the Information Technology Act, 2000. A signature certificate with the document hash is attached on the next page.",
  ];
  need(terms.length * 14 + 20); text(page, "Terms", 40, y, bold); y -= 15;
  for (const t of terms) { text(page, t, 40, y, font, 9); y -= 13; }
  return doc.save({ useObjectStreams: false });
}

/** Appends the signature certificate page to the exact bytes the signer saw; the original document hash is quoted on it. */
export async function appendCertificate(original: Uint8Array, c: Certificate, orderId: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(original);
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold), mono = await doc.embedFont(StandardFonts.Courier);
  const p = doc.addPage([595, 842]); let y = 790;
  p.drawText("Electronic signature certificate", { x: 40, y, size: 16, font: bold }); y -= 28;
  const rows: [string, string, PDFFont][] = [
    ["Order", orderId, font], ["Signed at (UTC)", c.signedAtIso, font], ["Signer mobile (verified)", c.signerPhoneMasked, font], ["Method", c.method, font],
    ["Signer IP address", safe(c.ip), font], ["Device", safe(c.userAgent.slice(0, 90)), font],
  ];
  for (const [k, v, f] of rows) { p.drawText(k, { x: 40, y, size: 10, font: bold }); p.drawText(v, { x: 200, y, size: 10, font: f }); y -= 16; }
  y -= 8; p.drawText("SHA-256 of the order form that was shown and agreed to:", { x: 40, y, size: 10, font: bold }); y -= 15;
  p.drawText(c.docHash.slice(0, 32), { x: 40, y, size: 10, font: mono }); y -= 13; p.drawText(c.docHash.slice(32), { x: 40, y, size: 10, font: mono }); y -= 26;
  for (const t of ["The signer confirmed this order with a one-time code sent by SMS to the mobile number above, within minutes of viewing the document.",
    "Changing any byte of the order form changes its hash, so this certificate no longer matches. Verify by hashing pages 1 onward of this file."]) { p.drawText(t, { x: 40, y, size: 9, font }); y -= 13; }
  doc.setModificationDate(new Date(0));
  return doc.save({ useObjectStreams: false });
}

/** A plain quote PDF for sharing with a partner, spouse or CA. Indicative prices from the rules engine; no personal identifiers. */
export async function buildQuotePdf(q: Quote): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Quote ${q.id}`); doc.setProducer("Udyam Digital");
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); let y = 800;
  const text = (t: string, x: number, f: PDFFont = font, size = 10) => page.drawText(safe(t), { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
  const pr = priceLines(q.lines), sc = estimateSchedule(q.lines);
  text("Accel Business", 40, bold, 18); y -= 20; text("Quote (indicative)", 40, font, 11); y -= 24;
  for (const [k, v] of [["Quote", q.id], ["Plan", bundleName(q.bundleId, "en")], ["Business", `${q.profile.businessType ?? "Business"}, ${q.profile.city}`], ["Locations", String(q.profile.sites)], ["Contract", `${pr.contractMonths} months`], ["Expected live", sc.date]] as [string, string][]) {
    text(k, 40, bold); text(v, 170); y -= 15;
  }
  y -= 10; text("Services", 40, bold); text("Qty", 380, bold); text("Per month", 430, bold); text("One-time", 500, bold); y -= 16;
  for (const l of pr.lines) {
    if (y < 120) break;
    text(`${plainName(l.productId, "en")}${l.siteIndex != null && q.profile.sites > 1 ? ` (location ${l.siteIndex + 1})` : ""}`, 40); text(String(l.qty), 385); text(rs(l.monthly), 430); text(l.setup ? rs(l.setup) : "-", 500); y -= 14;
  }
  y -= 10;
  for (const [k, v, b] of [["Monthly charge", rs(pr.monthly), false], ["GST on monthly (18%)", rs(pr.gstMonthly), false], ["One-time setup", rs(pr.setup), false], ["GST on setup (18%)", rs(pr.gstSetup), false], ["Payable at order", rs(pr.firstPayment), true]] as [string, string, boolean][]) {
    text(k, 300, b ? bold : font); text(v, 470, b ? bold : font); y -= 15;
  }
  y -= 16;
  for (const t of ["Indicative prototype quote based on the lower end of list prices; not a confirmed commercial offer.", "Eligibility and prices come from the product catalogue rules. Final price is confirmed at checkout after KYC."]) { text(t, 40, font, 8.5); y -= 12; }
  return doc.save();
}
