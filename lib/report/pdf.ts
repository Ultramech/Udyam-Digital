import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { plainBenefit, plainName } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { areaLabel, areaWhat, HORIZON, roadmapText } from "@/lib/i18n/maturity";
import { needLabel } from "@/lib/i18n/needs";
import { ruleReason } from "@/lib/i18n/reasons";
import { estimateSchedule, priceLines } from "@/lib/rules/pricing";
import type { quoteView } from "@/lib/store/quotes";

/**
 * The personalised business report: digital maturity, needs, recommended services with prices, the three packages,
 * assumptions and a 6–12 month roadmap. English only (standard PDF fonts are Latin-only); no personal identifiers —
 * business type, city and size only, so it can be forwarded to a partner or CA.
 */
const safe = (s: string) => s.replace(/₹/g, "Rs.").replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "?");
const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
const RED = rgb(0.89, 0, 0), INK = rgb(0.1, 0.1, 0.1), MUTED = rgb(0.42, 0.42, 0.45), LIGHT = rgb(0.92, 0.92, 0.93);

type View = ReturnType<typeof quoteView>;

export async function buildReportPdf(v: View): Promise<Uint8Array> {
  const { quote: q, maturity: m, packages: pk } = v;
  const doc = await PDFDocument.create();
  doc.setTitle(`Business report ${q.id}`); doc.setProducer("Udyam Digital");
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([595, 842]); let y = 800;
  const ensure = (h: number) => { if (y - h < 50) { page = doc.addPage([595, 842]); y = 800; } };
  const text = (t: string, x: number, f: PDFFont = font, size = 10, color = INK) => page.drawText(safe(t), { x, y, size, font: f, color });
  /** word-wrapped paragraph */
  const para = (t: string, x: number, width: number, size = 9.5, f: PDFFont = font, color = INK) => {
    const words = safe(t).split(" "); let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && line) { ensure(14); page.drawText(line, { x, y, size, font: f, color }); y -= size + 3.5; line = w; }
      else line = next;
    }
    if (line) { ensure(14); page.drawText(line, { x, y, size, font: f, color }); y -= size + 3.5; }
  };
  const h2 = (t: string) => { ensure(40); y -= 10; text(t, 40, bold, 13, RED); y -= 18; };

  const pr = priceLines(q.lines), sc = estimateSchedule(q.lines);
  // header
  text("Accel Business", 40, bold, 20, RED); y -= 18;
  text("Your digital business report", 40, bold, 13); y -= 15;
  text(`Report ${q.id} · ${bundleName(q.bundleId, "en")}`, 40, font, 9.5, MUTED); y -= 22;
  for (const [k, val] of [["Business", `${q.profile.businessType ?? "Business"}, ${q.profile.city}`], ["People", String(q.profile.employees)], ["Locations", String(q.profile.sites)], ["GST registered", q.profile.gstin.has ? "Yes" : "No"]] as const) {
    text(k, 40, bold, 9.5); text(val, 150, font, 9.5); y -= 13;
  }

  // maturity
  h2("1. Digital maturity (advisory)");
  text(`Today: ${m.before.total} / 100`, 40, bold, 12, MUTED); text(`With this plan: ${m.after.total} / 100`, 220, bold, 12, RED); y -= 20;
  for (let i = 0; i < m.after.areas.length; i++) {
    ensure(22);
    const a = m.after.areas[i], b = m.before.areas[i].score;
    text(areaLabel(a.area, "en"), 40, bold, 9.5); text(areaWhat(a.area, "en"), 160, font, 8.5, MUTED); text(`${b} -> ${a.score} / 20`, 470, font, 9.5); y -= 7;
    page.drawRectangle({ x: 40, y, width: 515, height: 5, color: LIGHT });
    page.drawRectangle({ x: 40, y, width: (515 * a.score) / 20, height: 5, color: rgb(0.96, 0.6, 0.6) });
    page.drawRectangle({ x: 40, y, width: (515 * b) / 20, height: 5, color: MUTED });
    y -= 14;
  }
  if (m.gaps.length) {
    y -= 4; text("Biggest gaps today", 40, bold, 10); y -= 14;
    for (const g of m.gaps) para(`- ${areaLabel(g.area, "en")}: ${g.fixedBy.length ? `closed by ${g.fixedBy.map((p) => plainName(p, "en")).join(", ")}` : "not addressed by this plan"}${g.couldAdd.length ? `; could add ${g.couldAdd.slice(0, 3).map((p) => plainName(p, "en")).join(", ")}` : ""}.`, 48, 500);
  }

  // needs
  h2("2. What you told us you need");
  const needs = [...new Set([...(pk.find((p) => p.id === "recommended")?.covered ?? []), ...(pk.find((p) => p.id === "recommended")?.missed ?? [])])];
  para(needs.length ? needs.map((n) => needLabel(n, "en")).join(" · ") : "Reliable internet and business phone lines (no extra needs mentioned).", 40, 515);
  for (const w of v.why.slice(0, 4)) para(`- ${ruleReason(w, "en")}`, 48, 500, 9, font, MUTED);

  // services
  h2("3. Recommended services");
  ensure(20); text("Service", 40, bold, 9); text("Qty", 360, bold, 9); text("Per month", 410, bold, 9); text("One-time", 495, bold, 9); y -= 14;
  for (const l of pr.lines) {
    ensure(26);
    text(`${plainName(l.productId, "en")}${l.siteIndex != null && q.profile.sites > 1 ? ` (location ${l.siteIndex + 1})` : ""}`, 40, font, 9); text(String(l.qty), 365, font, 9); text(rs(l.monthly), 410, font, 9); text(l.setup ? rs(l.setup) : "-", 495, font, 9); y -= 11;
    text(plainBenefit(l.productId, "en"), 48, font, 7.5, MUTED); y -= 12;
  }
  y -= 4;
  for (const [k, val, b] of [["Monthly (before GST)", rs(pr.monthly), false], ["GST 18% on monthly", rs(pr.gstMonthly), false], ["One-time setup (incl. GST)", rs(pr.setupInclGst), false], ["First bill", rs(pr.firstPayment), true], ["Contract", `${pr.contractMonths} months`, false], ["Expected live by", sc.date, false]] as [string, string, boolean][]) {
    ensure(14); text(k, 300, b ? bold : font, 9.5); text(val, 470, b ? bold : font, 9.5); y -= 13;
  }

  // packages
  if (pk.length) {
    h2("4. Your three options");
    ensure(16); text("", 40); text("Basic", 250, bold, 9.5); text("Recommended", 340, bold, 9.5); text("Premium", 460, bold, 9.5); y -= 14;
    const row = (label: string, vals: string[]) => { ensure(14); text(label, 40, font, 9); vals.forEach((s, i) => text(s, [250, 340, 460][i], font, 9)); y -= 13; };
    row("Monthly (before GST)", pk.map((p) => rs(p.monthly)));
    row("One-time setup", pk.map((p) => (p.setup ? rs(p.setup) : "Free")));
    row("Services", pk.map((p) => String(p.services)));
    for (const n of needs) row(needLabel(n, "en"), pk.map((p) => (p.covered.includes(n) ? "Yes" : "-")));
  }

  // roadmap
  h2("5. Roadmap (advisory)");
  for (const r of m.roadmap.filter((x) => x.items.length)) {
    ensure(16); text(HORIZON[r.horizon].en, 40, bold, 9.5); y -= 13;
    for (const it of r.items) para(`- ${roadmapText(it.code, it.products, it.params, "en")}`, 48, 500);
  }
  if (v.exclusions.length) {
    h2("Not included, and why");
    for (const e of v.exclusions.slice(0, 6)) para(`- ${ruleReason({ code: e.code, params: e.params, productId: e.productId }, "en")}`, 48, 500, 9);
  }

  // assumptions
  h2("Assumptions");
  for (const t of [
    "Prices are indicative: the lower end of the published catalogue band, GST at 18% shown separately. Not a confirmed commercial offer.",
    "Eligibility, dependencies and prices come from the product catalogue rules engine; the AI assistant only explains them.",
    "The digital score is an advisory estimate, not a certification. Anything you did not mention is assumed not in place today.",
    "Roadmap items are suggestions, not commitments; availability depends on location checks and verification at the time.",
  ]) para(`- ${t}`, 48, 500, 8.5, font, MUTED);
  return doc.save();
}
