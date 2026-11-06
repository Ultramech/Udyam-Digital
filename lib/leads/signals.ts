import "server-only";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getProduct } from "@/lib/catalogue";
import type { ProductId } from "@/lib/catalogue/types";

/**
 * Signals hidden in the supplied quarter of leads that change a decision, each computed from the files (smb_leads.csv,
 * mock_gstin_registry.csv, product_catalogue rules) — never typed in. Shown on the ops playbook and used in the business case.
 */
type Raw = Record<string, string>;
const read = (f: string) => parse(readFileSync(join(process.cwd(), "data", f)), { columns: true }) as Raw[];
let cache: ReturnType<typeof compute> | null = null;
export const leadSignals = () => (cache ??= compute());

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
const TODAY = "2026-07-15"; // the case's fixed "today"

function compute() {
  const R = read("smb_leads.csv");
  const reg = new Map(read("mock_gstin_registry.csv").map((g) => [g.gstin, g.status]));
  const act = R.filter((r) => r.outcome === "Activated");
  const churn = (rows: Raw[]) => pct(rows.filter((r) => r.churned_within_6_months === "Y").length, rows.length);

  // 1. Partner pay: the cost of a partner lead is paid almost only on activation, scales with bundle value, and is not tied to retention.
  const partner = R.filter((r) => r.lead_source === "Channel partner");
  const pAct = partner.filter((r) => r.outcome === "Activated"), pDrop = partner.filter((r) => r.outcome !== "Activated");
  const field = act.filter((r) => r.lead_source === "Field sales");
  const ratio = (rows: Raw[]) => +median(rows.map((r) => Number(r.acquisition_cost_inr) / (Number(r.monthly_bundle_value_inr) || 1))).toFixed(2);
  const partnerPay = {
    medianCostActivated: median(pAct.map((r) => Number(r.acquisition_cost_inr))), medianCostDropped: median(pDrop.map((r) => Number(r.acquisition_cost_inr))),
    monthsOfRevenuePaid: ratio(pAct), fieldMonthsOfRevenue: ratio(field), maxPayout: Math.max(...pAct.map((r) => Number(r.acquisition_cost_inr))),
    partnerChurn: churn(pAct), restChurn: churn(act.filter((r) => r.lead_source !== "Channel partner")),
  };

  // 2. Lead quality by source: share of a source's leads lost before anyone spoke to them (unreachable / wrong number).
  const dead = new Set(["Unreachable after 3 attempts", "Wrong or invalid number"]);
  const leadQuality = [...new Set(R.map((r) => r.lead_source))].map((s) => {
    const v = R.filter((r) => r.lead_source === s);
    return { source: s, leads: v.length, lostBeforeContact: pct(v.filter((r) => dead.has(r.drop_reason)).length, v.length), conversion: pct(v.filter((r) => r.outcome === "Activated").length, v.length) };
  }).sort((a, b) => b.lostBeforeContact - a.lostBeforeContact);

  // 3. Compliance: activations on a GSTIN the registry says is not Active, and sold bundles that break the catalogue's own rules.
  const badGstin = act.filter((r) => r.gstin && reg.get(r.gstin) && reg.get(r.gstin) !== "Active");
  const ruleBreaks = act.filter((r) => {
    const items = r.bundle_products.split(";").filter(Boolean).map((b) => b.split("x")[0] as ProductId);
    const ids = new Set(items);
    return items.some((id) => {
      let p; try { p = getProduct(id); } catch { return true; }
      return !p.tiers.includes(Number(r.city_tier)) || Number(r.employee_count) < p.minEmployees || Number(r.num_sites) < p.minSites
        || (p.requiresGstin && !(r.gstin && reg.get(r.gstin) === "Active")) || (p.requiresOneOf.length > 0 && !p.requiresOneOf.some((d) => ids.has(d)));
    });
  });
  const compliance = { activations: act.length, nonActiveGstin: badGstin.length, ruleBreakingBundles: ruleBreaks.length, churnRuleBreaking: churn(ruleBreaks), churnClean: churn(act.filter((r) => !ruleBreaks.includes(r))) };

  // 4. Label honesty: a 6-month churn flag cannot have been observed by "today" for anyone activated after mid-January.
  const observableCutoff = "2026-01-15";
  const labels = { activations: act.length, afterToday: act.filter((r) => r.activated_date > TODAY).length, churnNotYetObservable: act.filter((r) => r.activated_date > observableCutoff).length };

  // 5. Language gap: conversion for owners who prefer a regional language vs Hindi/English.
  const hiEn = R.filter((r) => r.preferred_language === "Hindi" || r.preferred_language === "English");
  const byLang = [...new Set(R.map((r) => r.preferred_language))].map((l) => { const v = R.filter((r) => r.preferred_language === l); return { language: l, leads: v.length, conversion: pct(v.filter((r) => r.outcome === "Activated").length, v.length) }; })
    .filter((x) => x.leads >= 80).sort((a, b) => a.conversion - b.conversion);
  const language = { hindiEnglish: pct(hiEn.filter((r) => r.outcome === "Activated").length, hiEn.length), weakest: byLang.slice(0, 3) };

  return { partnerPay, leadQuality, compliance, labels, language };
}
