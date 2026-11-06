import "server-only";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import { bundleName } from "@/lib/i18n/bundles";
import type { BusinessProfile } from "@/lib/rules/types";

/**
 * Segment & channel playbook: answers "which segments first, with what bundle and price" and "what role for the field force
 * and partners" from the supplied quarter of leads. Every figure is computed from smb_leads.csv; the bundle price comes from the
 * same rules engine the advisor uses, for the segment's typical business. Nothing here is a forecast.
 */
type Raw = Record<string, string>;
let rows: Raw[] | null = null;
const data = () => (rows ??= parse(readFileSync(join(process.cwd(), "data", "smb_leads.csv")), { columns: true }) as Raw[]);

const num = (v: string) => Number(v) || 0;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mode = (a: string[]) => { const c = new Map<string, number>(); for (const x of a) c.set(x, (c.get(x) ?? 0) + 1); return [...c.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? ""; };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/** A cell needs this many leads before we draw any conclusion from it. */
export const MIN_CELL = 30;

export interface Cell { leads: number; activations: number; conversion: number; cac: number | null; spend: number; lowSample: boolean }
const cell = (v: Raw[]): Cell => {
  const act = v.filter((r) => r.outcome === "Activated").length;
  const spend = v.reduce((s, r) => s + num(r.acquisition_cost_inr), 0);
  return { leads: v.length, activations: act, conversion: pct(act, v.length), cac: act ? Math.round(spend / act) : null, spend: Math.round(spend), lowSample: v.length < MIN_CELL };
};

const SEGMENT_KEY: Record<string, "micro" | "prof" | "multi" | "mfg"> = {
  "Micro retail & services": "micro", "Professional offices": "prof", "Small multi-site businesses": "multi", "Small manufacturers": "mfg",
};

export function playbook() {
  const all = data();
  const total = cell(all);
  const sources = [...new Set(all.map((r) => r.lead_source))].sort();
  const segNames = [...new Set(all.map((r) => r.segment))];

  const segments = segNames.map((name) => {
    const v = all.filter((r) => r.segment === name);
    const act = v.filter((r) => r.outcome === "Activated");
    const c = cell(v);
    const churned = act.filter((r) => r.churned_within_6_months === "Y").length;
    const arpa = Math.round(mean(act.map((r) => num(r.monthly_bundle_value_inr))));
    const churn = pct(churned, act.length);
    // what one ₹ of acquisition spend brings back in the first year, after the observed 6-month churn (revenue, not margin)
    const firstYearPerRupee = c.cac && arpa ? +((arpa * 12 * (1 - churn / 100)) / c.cac).toFixed(2) : null;

    // the advisor's own plan for this segment's typical business, priced by the rules engine
    const gstShare = pct(v.filter((r) => r.has_gstin === "Y").length, v.length);
    const profile: BusinessProfile = {
      businessType: mode(v.map((r) => r.business_type)), employees: Math.round(median(v.map((r) => num(r.employee_count)))) || 1,
      sites: Math.round(median(v.map((r) => num(r.num_sites)))) || 1, city: mode(v.filter((r) => r.city_tier === "1").map((r) => r.city)) || "Pune",
      gstin: gstShare >= 50 ? { has: true, verified: true, status: "Active" } : { has: false }, needs: [],
    };
    const rec = recommend(profile);
    const pr = rec.lines.length ? priceLines(rec.lines) : null;

    // channel cells for this segment
    const bySource = sources.map((s) => ({ source: s, ...cell(v.filter((r) => r.lead_source === s)) }));
    const usable = bySource.filter((x) => !x.lowSample && x.cac !== null);
    const best = [...usable].sort((a, b) => (a.cac! - b.cac!))[0] ?? null;
    // "reroute" = a channel whose cost per activation is more than double the segment's cheapest well-sampled channel
    const costly = best ? usable.filter((x) => x.cac! > best.cac! * 2).sort((a, b) => b.spend - a.spend) : [];
    return {
      segment: name, key: SEGMENT_KEY[name] ?? "micro", ...c, shareOfLeads: pct(v.length, all.length), arpa, churn,
      avgDays: +mean(act.map((r) => num(r.days_lead_to_activation))).toFixed(1), gstinShare: gstShare,
      medianBought: Math.round(median(act.map((r) => num(r.monthly_bundle_value_inr)))), typicalContract: mode(act.map((r) => r.contract_months)),
      firstYearPerRupee,
      advisor: pr ? { bundle: bundleName(rec.bundleId, "en"), monthly: pr.monthly, contractMonths: pr.contractMonths, basis: `${profile.businessType}, ${profile.employees} staff, ${profile.sites} site${profile.sites > 1 ? "s" : ""}` } : null,
      bestChannel: best ? { source: best.source, cac: best.cac!, conversion: best.conversion, leads: best.leads } : null,
      costlyChannels: costly.map((x) => ({ source: x.source, cac: x.cac!, spend: x.spend, activations: x.activations, conversion: x.conversion })),
      bySource,
    };
  }).sort((a, b) => (b.firstYearPerRupee ?? 0) - (a.firstYearPerRupee ?? 0));

  const channels = sources.map((s) => {
    const v = all.filter((r) => r.lead_source === s);
    const act = v.filter((r) => r.outcome === "Activated");
    return { source: s, ...cell(v), shareOfSpend: pct(v.reduce((x, r) => x + num(r.acquisition_cost_inr), 0), total.spend), churn: pct(act.filter((r) => r.churned_within_6_months === "Y").length, act.length), arpa: Math.round(mean(act.map((r) => num(r.monthly_bundle_value_inr)))) };
  }).sort((a, b) => (a.cac ?? Infinity) - (b.cac ?? Infinity));

  const gst = (flag: string) => cell(all.filter((r) => r.has_gstin === flag));

  // the single biggest line of waste, found by search rather than assumed: the segment x source cell with the most spend per activation
  const waste = segments.flatMap((s) => s.bySource.map((x) => ({ segment: s.segment, ...x }))).filter((x) => !x.lowSample && x.cac !== null)
    .sort((a, b) => b.cac! - a.cac!)[0] ?? null;

  return { total, segments, channels, gstin: { with: gst("Y"), without: gst("N") }, waste, minCell: MIN_CELL };
}
