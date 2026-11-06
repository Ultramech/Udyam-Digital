import "server-only";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { get, list, newId, put, update } from "@/lib/db/store";
import { priceLines } from "@/lib/rules/pricing";
import { bundleName } from "@/lib/i18n/bundles";
import type { Conversation, Lead } from "@/lib/store/types";
import type { AdvisorTurn } from "@/lib/advisor/orchestrator";
import { scoreLead, type Score } from "./propensity";
import type { LeadRow } from "./features";

// ---- people (demo directory) -----------------------------------------------------------------------
export const OWNERS = [
  { id: "R01", name: "Anita Rao", kind: "rep", region: "West", cities: ["Mumbai", "Pune", "Nashik", "Nagpur", "Surat", "Ahmedabad", "Vadodara", "Indore", "Bhopal"] },
  { id: "R02", name: "Vikram Nair", kind: "rep", region: "South", cities: ["Bengaluru", "Chennai", "Hyderabad", "Kochi", "Mysuru", "Coimbatore", "Visakhapatnam"] },
  { id: "R03", name: "Meera Kapoor", kind: "rep", region: "North", cities: ["Delhi", "Jaipur", "Lucknow", "Ludhiana", "Patna", "Kolkata"] },
  { id: "P01", name: "Shree Connect (partner)", kind: "partner", region: "Tier-2 installs", cities: [] },
] as const;
export const ownerName = (id?: string) => OWNERS.find((o) => o.id === id)?.name ?? "Unassigned";
export function autoOwner(city: string, segment: string): string {
  if (segment === "micro") return "P01"; // micro retail is partner-assisted
  return (OWNERS.find((o) => o.kind === "rep" && (o.cities as readonly string[]).includes(city)) ?? OWNERS[0]).id;
}

// ---- historical dataset (read-only, with propensity) -----------------------------------------------
export interface HistLead {
  id: string; origin: "historical"; business: string; segment: string; city: string; source: string; stage: string; outcome: string;
  dropReason: string; hasGstin: boolean; turnover: string; monthlyValue: number; expectedValue: number; score: Score; priority: number;
  winback: boolean; nextAction: string; language: string; employees: number; sites: number; createdDate: string;
}
const FIXABLE = new Set([
  "Owner had no time for a visit", "Visit not scheduled by sales", "Quote too complex to understand", "Quote took too long to arrive", "Installation delayed beyond 21 days",
  "Missing GST or Udyam document", "Found paperwork too long", "Authorised signatory not available", "Document details did not match", "Site not feasible for fibre", "First payment failed",
]);

export function nextActionForDrop(reason: string, segment: string): string {
  if (/Quote too complex|Quote took too long|no time for a visit|Visit not scheduled/.test(reason)) return "SEND_PLAN_LINK";
  if (/Missing GST|Document details|signatory|paperwork/i.test(reason)) return "REQUEST_KYC_DOC";
  if (/Installation delayed|not feasible/.test(reason)) return "CHECK_FEASIBILITY";
  if (/payment failed/.test(reason)) return "SEND_PAYMENT_LINK";
  if (/Price too high|cheaper/.test(reason)) return "OFFER_BUDGET_PLAN";
  if (segment === "Small multi-site businesses" || segment === "Small manufacturers") return "ASSIGN_FIELD_REP";
  return "SCHEDULE_CALLBACK";
}

let hist: HistLead[] | null = null;
export function historicalLeads(): HistLead[] {
  if (hist) return hist;
  const raw = parse(readFileSync(join(process.cwd(), "data", "smb_leads.csv")), { columns: true }) as (LeadRow & Record<string, string>)[];
  const act = raw.filter((r) => r.outcome === "Activated");
  const avg = new Map<string, number>();
  for (const s of new Set(raw.map((r) => r.segment))) {
    const v = act.filter((r) => r.segment === s).map((r) => Number(r.monthly_bundle_value_inr));
    avg.set(s, v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0);
  }
  hist = raw.map((r) => {
    const score = scoreLead(r);
    const ev = avg.get(r.segment) ?? 0;
    return {
      id: r.lead_id, origin: "historical", business: r.business_name, segment: r.segment, city: r.city, source: r.lead_source, stage: r.stage_reached,
      outcome: r.outcome, dropReason: r.drop_reason, hasGstin: r.has_gstin === "Y", turnover: r.annual_turnover_band,
      monthlyValue: Number(r.monthly_bundle_value_inr) || 0, expectedValue: ev, score, priority: Math.round(score.probability * ev),
      winback: r.outcome !== "Activated" && FIXABLE.has(r.drop_reason), nextAction: r.outcome === "Activated" ? "COMPLETE_INSTALL_DONE" : nextActionForDrop(r.drop_reason, r.segment),
      language: r.preferred_language, employees: Number(r.employee_count), sites: Number(r.num_sites), createdDate: r.created_date,
    } satisfies HistLead;
  });
  return hist;
}

// ---- live leads -----------------------------------------------------------------------------------------
export async function upsertLeadFromTurn(conv: Conversation, turn: AdvisorTurn): Promise<Lead | null> {
  const rec = turn.recommendation;
  if (!rec || !turn.profile) return null;
  const level = rec.escalation.level;
  if (level === "none") return conv.leadId ? get<Lead>("lead", conv.leadId) : null;
  const monthly = rec.lines.length ? priceLines(rec.lines).monthly : 0;
  const existing = conv.leadId ? await get<Lead>("lead", conv.leadId) : null;
  const owner = autoOwner(turn.profile.city, rec.segment);
  const lead: Lead = {
    id: existing?.id ?? newId("LD"), origin: "live", createdAt: existing?.createdAt ?? Date.now(), conversationId: conv.id, quoteId: existing?.quoteId, orderId: existing?.orderId,
    businessName: existing?.businessName, phone: existing?.phone, profile: turn.profile, facts: turn.facts, bundleId: rec.lines.length ? rec.bundleId : undefined, monthly,
    level, reasons: rec.escalation.reasons, status: existing?.status ?? "assigned", ownerId: existing?.ownerId ?? owner, attribution: conv.attribution,
    notes: existing?.notes ?? [], callbacks: existing?.callbacks ?? [], assistCredit: existing?.assistCredit,
  };
  await put("lead", lead.id, lead);
  return lead;
}

export const liveLeads = () => list<Lead>("lead", { limit: 500 });
export const getLead = (id: string) => get<Lead>("lead", id);
export const patchLead = (id: string, fn: (l: Lead) => Lead) => update<Lead>("lead", id, fn);

/** One concrete next step per lead (shown in the ops console). */
export function nextBestAction(l: Lead, ctx?: { kycStatus?: string; orderStage?: string }): string {
  if (l.status === "converted") return ctx?.kycStatus === "review" ? "REVIEW_KYC" : "COMPLETE_INSTALL";
  if (l.reasons.includes("REQUESTED_HUMAN") || l.reasons.includes("OUT_OF_AREA") || l.reasons.includes("MANY_SITES")) return "SCHEDULE_CALLBACK";
  if (l.reasons.includes("MFG_FIELD_LED") || l.reasons.includes("DEDICATED_LINE")) return "ASSIGN_FIELD_REP";
  if (l.reasons.includes("MULTI_SITE_HIGH_VALUE")) return l.quoteId ? "SEND_PLAN_LINK" : "ASSIGN_FIELD_REP";
  return l.quoteId ? "SEND_PLAN_LINK" : "SCHEDULE_CALLBACK";
}

/** Concise rep-ready summary built from structured facts (no free-form generation, so it can't invent anything). */
export function leadSummary(l: Lead, monthlyNow?: number): string[] {
  const p = l.profile;
  const who = `${p.businessType ?? "Business"} in ${p.city}, ${p.employees} people, ${p.sites} location${p.sites > 1 ? "s" : ""}, ${p.gstin.has ? "has GST" : "no GST"}.`;
  const needs = p.needs.length ? `Wants: ${p.needs.join(", ").replace(/_/g, " ")}.` : "Needs not specified — default plan suggested.";
  const monthly = monthlyNow ?? l.monthly;
  const rec = l.bundleId ? `Advisor suggested “${bundleName(l.bundleId, "en")}” at about ₹${monthly.toLocaleString("en-IN")}/month + GST.` : "No automatic plan could be built.";
  const why = `Needs a person because: ${l.reasons.join(", ").toLowerCase().replace(/_/g, " ") || "n/a"}.`;
  return [who, needs, rec, why];
}
