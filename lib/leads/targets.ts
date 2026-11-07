/**
 * Proposed pilot targets: the ONE place they are defined. Overview, Analytics and the insight engine all read from here, so no page can show a
 * different number. These are proposals for a real pilot (the case asks for targets), not results and not forecasts; the baselines next to
 * them are always measured from the supplied quarter of leads.
 */
export type Unit = "pct" | "days" | "count" | "inr";
export interface Target { id: "conversion" | "days" | "chases" | "cac" | "churn"; label: string; unit: Unit; better: "higher" | "lower"; target: number; lever: string }

export const TARGETS: readonly Target[] = [
  { id: "conversion", label: "Lead → activation", unit: "pct", better: "higher", target: 15, lever: "Advisor + instant quote at the steepest drop in the funnel" },
  { id: "days", label: "Days lead → activation", unit: "days", better: "lower", target: 7, lever: "Near-instant KYC, self-booked install slots, AirFiber where fibre isn't feasible" },
  { id: "chases", label: "Status chases per customer", unit: "count", better: "lower", target: 1, lever: "Live tracker + proactive WhatsApp/Telegram updates" },
  { id: "cac", label: "CAC per activation", unit: "inr", better: "lower", target: 7500, lever: "Digital-only for micro; field force re-sorted to multi-site and manufacturers" },
  { id: "churn", label: "6-month churn", unit: "pct", better: "lower", target: 10, lever: "Correct-first-time bundles (rules engine) + at-risk check-ins" },
];

export const fmtUnit = (n: number, u: Unit) => (u === "pct" ? `${n}%` : u === "days" ? `${n}` : u === "inr" ? `₹${Math.round(n).toLocaleString("en-IN")}` : `${n}`);

export interface Totals { conversion: number; avgDaysToActivate: number; avgChases: number; cac: number; churn6m: number }
const baselineOf = (id: Target["id"], t: Totals) => ({ conversion: t.conversion, days: t.avgDaysToActivate, chases: t.avgChases, cac: t.cac, churn: t.churn6m })[id];

/** Each target next to the measured baseline, with the distance still to cover (0 = met). */
export function evaluateTargets(totals: Totals) {
  return TARGETS.map((t) => {
    const baseline = baselineOf(t.id, totals);
    const gap = t.better === "higher" ? Math.max(0, (t.target - baseline) / t.target) : Math.max(0, (baseline - t.target) / Math.max(baseline, 1e-9));
    return { ...t, baseline, gap, met: gap === 0, baselineText: fmtUnit(baseline, t.unit), targetText: `${t.better === "lower" ? "≤ " : ""}${fmtUnit(t.target, t.unit)}` };
  });
}
