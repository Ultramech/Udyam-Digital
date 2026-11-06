import { getProduct, CONNECTIVITY, isDependent } from "@/lib/catalogue";
import { GST_RATE, MIN_FIXED_CONTRACT_MONTHS, REFERENCE_DATE } from "@/lib/config";
import type { Line, Totals } from "./types";

/**
 * Pricing policy (documented, deterministic): the INDICATIVE price is the catalogue's lower listed price.
 * A catalogue price range is not a confirmed commercial offer — the UI labels every quote "indicative".
 */
export type PriceBasis = "min" | "max";
export const unitPrice = (productId: string, basis: PriceBasis = "min") => {
  const p = getProduct(productId);
  return basis === "min" ? p.priceMin : p.priceMax;
};

export interface PricedLine extends Line { unitPrice: number; monthly: number; setupUnit: number; setup: number; minContract: number }
export interface Priced extends Totals { lines: PricedLine[]; contractMonths: number }

const rupee = (n: number) => Math.round(n);

export function priceLines(lines: Line[], basis: PriceBasis = "min"): Priced {
  const priced: PricedLine[] = lines.map((l) => {
    const p = getProduct(l.productId);
    const u = unitPrice(l.productId, basis);
    return { ...l, unitPrice: u, monthly: u * l.qty, setupUnit: p.setup, setup: p.setup * l.qty, minContract: p.minContract };
  });
  const monthly = priced.reduce((s, l) => s + l.monthly, 0);
  const setup = priced.reduce((s, l) => s + l.setup, 0);
  const gstMonthly = rupee(monthly * GST_RATE);
  const gstSetup = rupee(setup * GST_RATE);
  return {
    lines: priced, monthly, setup, gstMonthly, gstSetup,
    monthlyInclGst: monthly + gstMonthly, setupInclGst: setup + gstSetup,
    firstPayment: monthly + gstMonthly + setup + gstSetup,
    contractMonths: contractMonths(lines),
  };
}

/** Contract = longest catalogue minimum; any fixed connectivity bundle is at least 12 months (no 6-month bundles). */
export function contractMonths(lines: Line[]): number {
  if (!lines.length) return 0;
  let m = Math.max(...lines.map((l) => getProduct(l.productId).minContract));
  if (lines.some((l) => CONNECTIVITY.includes(l.productId))) m = Math.max(m, MIN_FIXED_CONTRACT_MONTHS);
  return m;
}

// ---- schedule ---------------------------------------------------------------------------------
export function addBusinessDays(startISO: string, days: number): string {
  const d = new Date(`${startISO}T00:00:00Z`);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) left--; // skip Sundays
  }
  return d.toISOString().slice(0, 10);
}

export interface Eta { productId: string; siteIndex: number | null; days: number; date: string }

/** Dependent products are installed after the site's connectivity is live. */
export function estimateSchedule(lines: Line[], startISO: string = REFERENCE_DATE): { days: number; date: string; items: Eta[] } {
  const siteConn = new Map<number, number>();
  for (const l of lines) if (CONNECTIVITY.includes(l.productId)) {
    const s = l.siteIndex ?? 0;
    siteConn.set(s, Math.max(siteConn.get(s) ?? 0, getProduct(l.productId).installDays));
  }
  const items: Eta[] = lines.map((l) => {
    const base = getProduct(l.productId).installDays;
    const after = isDependent(l.productId) ? (siteConn.get(l.siteIndex ?? 0) ?? 0) : 0;
    const days = base + after;
    return { productId: l.productId, siteIndex: l.siteIndex, days, date: addBusinessDays(startISO, days) };
  });
  const days = items.length ? Math.max(...items.map((i) => i.days)) : 0;
  return { days, date: addBusinessDays(startISO, days), items };
}

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
