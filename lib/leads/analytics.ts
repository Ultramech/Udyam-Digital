import "server-only";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getProduct } from "@/lib/catalogue";
import { churnRisk } from "./churn";

/**
 * Business analytics over the supplied quarter of leads (smb_leads.csv), filterable by segment, city tier, source, language
 * and month. Every number is computed from the file; CAC = acquisition cost of ALL leads in the slice ÷ activations in it.
 */
type Raw = Record<string, string>;
let rows: Raw[] | null = null;
const data = () => (rows ??= parse(readFileSync(join(process.cwd(), "data", "smb_leads.csv")), { columns: true }) as Raw[]);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const STAGES = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"];

export interface Filters { segment?: string; tier?: string; source?: string; language?: string; month?: string }

export function filterOptions() {
  const r = data();
  const uniq = (k: string) => [...new Set(r.map((x) => x[k]))].filter(Boolean).sort();
  return { segment: uniq("segment"), tier: uniq("city_tier"), source: uniq("lead_source"), language: uniq("preferred_language"), month: [...new Set(r.map((x) => x.created_date.slice(0, 7)))].sort() };
}

export function analytics(f: Filters) {
  const all = data().filter((r) => (!f.segment || r.segment === f.segment) && (!f.tier || r.city_tier === f.tier) && (!f.source || r.lead_source === f.source)
    && (!f.language || r.preferred_language === f.language) && (!f.month || r.created_date.startsWith(f.month)));
  const act = all.filter((r) => r.outcome === "Activated");
  const reached = (r: Raw) => STAGES.indexOf(r.stage_reached);
  const funnel = STAGES.map((s, i) => ({ stage: s, leads: all.filter((r) => reached(r) >= i).length }))
    .map((x, i, a) => ({ ...x, fromPrevious: i ? pct(x.leads, a[i - 1].leads) : null }));
  const cost = all.reduce((s, r) => s + (Number(r.acquisition_cost_inr) || 0), 0);
  const churned = act.filter((r) => r.churned_within_6_months === "Y");
  const retained = act.filter((r) => r.churned_within_6_months === "N");
  const monthly = act.map((r) => Number(r.monthly_bundle_value_inr) || 0);
  const nps = act.map((r) => r.nps_score).filter((x) => x !== "").map(Number);
  const promoters = nps.filter((n) => n >= 9).length, detractors = nps.filter((n) => n <= 6).length;

  // revenue by product: each bundle's monthly value split across its products by catalogue (list-minimum) weight
  const byProduct = new Map<string, { revenue: number; customers: number }>();
  for (const r of act) {
    const items = r.bundle_products.split(";").filter(Boolean).map((b) => { const [id, q] = b.split("x"); return { id, w: getProduct(id).priceMin * (Number(q) || 1) }; });
    const W = items.reduce((s, i) => s + i.w, 0) || 1;
    for (const i of items) { const cur = byProduct.get(i.id) ?? { revenue: 0, customers: 0 }; cur.revenue += (Number(r.monthly_bundle_value_inr) || 0) * (i.w / W); cur.customers++; byProduct.set(i.id, cur); }
  }
  // churn by bundle composition (product set, quantities ignored)
  const byBundle = new Map<string, { n: number; churned: number; value: number[] }>();
  for (const r of act) {
    const k = [...new Set(r.bundle_products.split(";").map((b) => b.split("x")[0]))].sort().join(" + ");
    const cur = byBundle.get(k) ?? { n: 0, churned: 0, value: [] };
    cur.n++; if (r.churned_within_6_months === "Y") cur.churned++; cur.value.push(Number(r.monthly_bundle_value_inr) || 0);
    byBundle.set(k, cur);
  }
  const drops = new Map<string, number>();
  for (const r of all) if (r.drop_reason) drops.set(r.drop_reason, (drops.get(r.drop_reason) ?? 0) + 1);

  // retention: highest-risk retained/churned customers by the at-activation model, with the actual outcome shown for honesty
  const scored = act.map((r) => ({ id: r.lead_id, business: r.business_name, segment: r.segment, source: r.lead_source, monthly: Number(r.monthly_bundle_value_inr) || 0, churned: r.churned_within_6_months === "Y", risk: churnRisk(r as never) }))
    .sort((a, b) => b.risk.probability - a.risk.probability);
  const bands = (["high", "medium", "low"] as const).map((b) => { const g = scored.filter((s) => s.risk.band === b); return { band: b, customers: g.length, actualChurn: pct(g.filter((s) => s.churned).length, g.length) }; });

  return {
    n: all.length,
    totals: {
      leads: all.length, activations: act.length, conversion: pct(act.length, all.length),
      avgDaysToActivate: +mean(act.map((r) => Number(r.days_lead_to_activation))).toFixed(1),
      avgChases: +mean(act.map((r) => Number(r.customer_follow_up_calls))).toFixed(1),
      cac: act.length ? Math.round(cost / act.length) : 0,
      mrrActivated: monthly.reduce((s, v) => s + v, 0),
      mrrRetained: retained.reduce((s, r) => s + (Number(r.monthly_bundle_value_inr) || 0), 0),
      arpa: Math.round(mean(monthly)),
      avgSetup: Math.round(mean(act.map((r) => Number(r.one_time_setup_inr) || 0))),
      churn6m: pct(churned.length, act.length), retainedCustomers: retained.length,
      paybackMonths: act.length && mean(monthly) ? +((cost / act.length) / mean(monthly)).toFixed(1) : null,
    },
    funnel,
    nps: { responses: nps.length, promoters, passives: nps.length - promoters - detractors, detractors, score: nps.length ? Math.round(((promoters - detractors) / nps.length) * 100) : null },
    revenueByProduct: [...byProduct.entries()].map(([id, v]) => ({ id, name: getProduct(id).csvName, revenue: Math.round(v.revenue), customers: v.customers })).sort((a, b) => b.revenue - a.revenue),
    churnByBundle: [...byBundle.entries()].map(([k, v]) => ({ bundle: k, customers: v.n, churn: pct(v.churned, v.n), avgMonthly: Math.round(mean(v.value)) })).filter((b) => b.customers >= 5).sort((a, b) => b.customers - a.customers).slice(0, 10),
    dropReasons: [...drops.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    retention: { bands, top: scored.slice(0, 15) },
  };
}

/** Proposed pilot targets (from the plan), next to the baseline measured in this file. Targets are proposals, not results. */
export function pilotTargets() {
  const t = analytics({}).totals;
  return [
    { metric: "Lead → activation", baseline: `${t.conversion}%`, target: "15%", lever: "Advisor + instant quote at the steepest drop (needs assessed → quote accepted)" },
    { metric: "Days lead → activation", baseline: `${t.avgDaysToActivate}`, target: "≤ 7 (3 for SIM/AirFiber)", lever: "Near-instant KYC, self-booked install slots, AirFiber where fibre isn't feasible" },
    { metric: "Status chases per customer", baseline: `${t.avgChases}`, target: "≤ 1", lever: "Live tracker + proactive WhatsApp/Telegram updates" },
    { metric: "CAC per activation", baseline: `₹${t.cac.toLocaleString("en-IN")}`, target: "₹7,500", lever: "Digital-only for micro; field force re-sorted to multi-site and manufacturers" },
    { metric: "6-month churn", baseline: `${t.churn6m}%`, target: "≤ 10%", lever: "Correct-first-time bundles (rules engine) + at-risk check-ins" },
  ];
}
