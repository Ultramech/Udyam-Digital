import { plainName } from "@/lib/catalogue/plain";
import type { PricedLine } from "@/lib/rules/pricing";

/**
 * Honest bill comparison (MASTER_PLAN D11). Bills include GST, so the plan is compared incl. GST too. When the plan costs more, we say so
 * and name what it adds — never an invented saving.
 */
export interface BillFacts { provider: string | null; monthlyTotal: number | null; services: string[] }
export interface BillComparison {
  read: boolean; currentMonthly: number | null; planMonthlyInclGst: number; difference: number | null;
  verdict: "cheaper" | "same" | "costlier" | "unknown"; adds: string[]; provider: string | null; services: string[];
}

export function compareBill(bill: BillFacts, planMonthly: number, gstMonthly: number, lines: Pick<PricedLine, "productId">[]): BillComparison {
  const plan = planMonthly + gstMonthly;
  const cur = bill.monthlyTotal && bill.monthlyTotal >= 50 && bill.monthlyTotal <= 10_000_000 ? Math.round(bill.monthlyTotal) : null;
  const have = bill.services.join(" ").toLowerCase();
  const adds = [...new Set(lines.map((l) => l.productId))]
    .filter((id) => !(id === "P07" && /mobile|sim|postpaid|prepaid/.test(have)) && !(["P01", "P02", "P03", "P04"].includes(id) && /broadband|fibre|fiber|internet|wifi/.test(have)))
    .map((id) => plainName(id, "en"));
  if (cur == null) return { read: false, currentMonthly: null, planMonthlyInclGst: plan, difference: null, verdict: "unknown", adds, provider: bill.provider, services: bill.services };
  const diff = plan - cur;
  return { read: true, currentMonthly: cur, planMonthlyInclGst: plan, difference: diff, verdict: Math.abs(diff) <= Math.max(50, cur * 0.02) ? "same" : diff < 0 ? "cheaper" : "costlier", adds, provider: bill.provider, services: bill.services };
}
