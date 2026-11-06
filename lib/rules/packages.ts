import type { ProductId } from "@/lib/catalogue";
import { DECLINABLE, recommend } from "./recommend";
import { priceLines } from "./pricing";
import type { BusinessProfile, Line, Need, Recommendation } from "./types";

/**
 * Basic / Recommended / Premium, side by side. Pure: every option is produced by the same rules engine
 * (lean / normal / full builds), so all three are eligible, dependency-valid and priced from the catalogue.
 * Coverage is computed from the owner's stated needs only — the comparison never claims a need the owner didn't state.
 */
export type PackageId = "basic" | "recommended" | "premium";

/** Which catalogue products satisfy each need. Derived from the engine's own declinable map, plus speed/phones. */
export const NEED_PRODUCTS: Record<Need, ProductId[]> = {
  ...(Object.fromEntries(Object.entries(DECLINABLE)) as Record<Need, ProductId[]>),
  fast_internet: ["P02", "P03", "P05", "P06"],
  sim_only: ["P07", "P08"],
};

export interface PackageOption {
  id: PackageId;
  lines: Line[];
  monthly: number;
  setup: number;
  firstPayment: number;
  contractMonths: number;
  services: number;
  covered: Need[];
  missed: Need[];
  /** Products this option has that Recommended doesn't (Premium) or that Recommended has and this doesn't (Basic). */
  adds: ProductId[];
  drops: ProductId[];
  /** Monthly difference vs Recommended (pre-GST). */
  delta: number;
  /** The quote currently holds exactly these lines. */
  current: boolean;
}

const key = (lines: Line[]) => lines.map((l) => `${l.productId}:${l.siteIndex ?? "a"}:${l.qty}`).sort().join("|");
const ids = (lines: Line[]) => [...new Set(lines.map((l) => l.productId))];

export function statedNeeds(profile: BusinessProfile): Need[] {
  const declined = new Set(profile.declined ?? []);
  return profile.needs.filter((n) => !declined.has(n));
}

export function coverage(lines: Line[], needs: Need[]): { covered: Need[]; missed: Need[] } {
  const have = new Set(ids(lines));
  const covered: Need[] = [], missed: Need[] = [];
  for (const n of needs) ((NEED_PRODUCTS[n] ?? []).some((p) => have.has(p)) ? covered : missed).push(n);
  return { covered, missed };
}

export function packages(profile: BusinessProfile, currentLines: Line[], rec: Recommendation = recommend(profile)): PackageOption[] {
  if (!rec.lines.length) return [];
  const needs = statedNeeds(profile);
  const lighter = rec.alternatives.find((a) => a.id === "lighter")?.lines ?? rec.lines;
  const fuller = rec.alternatives.find((a) => a.id === "fuller")?.lines ?? rec.lines;
  const base = priceLines(rec.lines).monthly;
  const recIds = new Set(ids(rec.lines));
  const cur = key(currentLines);
  return ([["basic", lighter], ["recommended", rec.lines], ["premium", fuller]] as const).map(([id, lines]) => {
    const p = priceLines(lines);
    const mine = new Set(ids(lines));
    return {
      id, lines, monthly: p.monthly, setup: p.setup, firstPayment: p.firstPayment, contractMonths: p.contractMonths,
      services: mine.size, ...coverage(lines, needs),
      adds: [...mine].filter((x) => !recIds.has(x)), drops: [...recIds].filter((x) => !mine.has(x)),
      delta: p.monthly - base, current: key(lines) === cur,
    };
  });
}
