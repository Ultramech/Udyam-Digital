import { CATALOGUE, type ProductId, type Segment } from "@/lib/catalogue";
import { eligibility } from "@/lib/rules/eligibility";
import { deriveSegment } from "@/lib/rules/normalise";
import type { BusinessProfile, Counterfactual, Line } from "@/lib/rules/types";

/**
 * Digital maturity — an ADVISORY score out of 100, not a certification.
 *
 * Five areas, 20 points each. Points come only from catalogue products a business has (or, "before", from what the owner told
 * us about their current setup: their internet type and the mobile phone every owner has). Anything not mentioned is assumed
 * absent, and the UI says so. The same function scores "before" and "with this plan", so the uplift is apples to apples.
 */
export type Area = "connectivity" | "reach" | "cloud" | "security" | "operations";
export const AREAS: Area[] = ["connectivity", "reach", "cloud", "security", "operations"];

/** Points a product contributes to an area. Several products in one area add up to the 20-point cap. */
const POINTS: Record<ProductId, [Area, number][]> = {
  P01: [["connectivity", 14]], P02: [["connectivity", 16]], P03: [["connectivity", 17]], P04: [["connectivity", 13]],
  P05: [["connectivity", 18]], P06: [["connectivity", 19]],
  P09: [["connectivity", 6]], P11: [["connectivity", 2]],
  P07: [["reach", 6]], P08: [["reach", 7]], P12: [["reach", 6]], P13: [["reach", 4]], P14: [["reach", 5]], P15: [["reach", 7]], P18: [["reach", 4], ["cloud", 2]],
  P16: [["cloud", 9]], P17: [["cloud", 8]], P19: [["cloud", 4], ["operations", 8]],
  P20: [["security", 8]], P21: [["security", 8]], P22: [["security", 4]], P23: [["security", 6], ["operations", 3]],
  P10: [["operations", 9]], P24: [["operations", 9]], P25: [["operations", 8]],
};

/** What the owner's current internet is worth, before Accel. Their own phone always counts a little toward reach. */
const CURRENT_INTERNET: Record<string, number> = { none: 0, hotspot: 5, home_bb: 9, mixed: 9, biz_bb: 13, leased: 17 };
const OWNER_PHONE_REACH = 3;

/** Areas that matter less for a segment are weighted down, so a kirana isn't marked down for having no machine sensors. */
const WEIGHT: Record<Segment, Record<Area, number>> = {
  micro: { connectivity: 1.2, reach: 1.2, cloud: 0.9, security: 0.8, operations: 0.9 },
  prof: { connectivity: 1.1, reach: 0.9, cloud: 1.2, security: 1.2, operations: 0.6 },
  multi: { connectivity: 1.1, reach: 0.9, cloud: 0.8, security: 1.0, operations: 1.2 },
  mfg: { connectivity: 1.2, reach: 0.6, cloud: 0.8, security: 1.1, operations: 1.3 },
};

export interface AreaScore { area: Area; score: number; products: ProductId[] }
export interface Maturity {
  segment: Segment;
  before: { total: number; areas: AreaScore[] };
  after: { total: number; areas: AreaScore[] };
  /** Weakest areas today, each with the plan products that close it and eligible catalogue products that could. */
  gaps: { area: Area; before: number; after: number; fixedBy: ProductId[]; couldAdd: ProductId[] }[];
  roadmap: { horizon: "now" | "3-6m" | "6-12m"; items: { code: string; products: ProductId[]; params?: Record<string, number | string> }[] }[];
}

function areaScores(products: ProductId[], extra: Partial<Record<Area, number>> = {}): AreaScore[] {
  return AREAS.map((area) => {
    const used = products.filter((p) => POINTS[p]?.some(([a]) => a === area));
    const pts = used.reduce((s, p) => s + (POINTS[p].find(([a]) => a === area)?.[1] ?? 0), extra[area] ?? 0);
    return { area, score: Math.min(20, pts), products: used };
  });
}
function total(areas: AreaScore[], seg: Segment): number {
  const w = WEIGHT[seg];
  const sumW = AREAS.reduce((s, a) => s + w[a], 0);
  return Math.round((areas.reduce((s, a) => s + a.score * w[a.area], 0) / (20 * sumW)) * 100);
}

export function maturity(profile: BusinessProfile, lines: Line[], counterfactuals: Counterfactual[] = []): Maturity {
  const segment = deriveSegment(profile);
  const before = areaScores([], { connectivity: CURRENT_INTERNET[profile.currentInternet ?? "none"] ?? 0, reach: OWNER_PHONE_REACH });
  const planIds = [...new Set(lines.map((l) => l.productId))];
  // "after" keeps what they have today if it is better than what the plan replaces (e.g. an existing leased line)
  const afterRaw = areaScores(planIds);
  const after = afterRaw.map((a, i) => ({ ...a, score: Math.max(a.score, before[i].score) }));

  const couldAddFor = (area: Area) => CATALOGUE
    .filter((p) => !planIds.includes(p.id) && POINTS[p.id]?.some(([a]) => a === area) && !["P01", "P02", "P03", "P04", "P05", "P06"].includes(p.id))
    .filter((p) => p.segments.includes(segment) && eligibility(p, profile).ok)
    .filter((p) => !p.requiresOneOf.length || p.requiresOneOf.some((c) => planIds.includes(c)))
    .map((p) => p.id);

  const gaps = AREAS
    .map((area, i) => ({ area, before: before[i].score, after: after[i].score, fixedBy: after[i].products, couldAdd: couldAddFor(area) }))
    .filter((g) => g.before < 12)
    .sort((a, b) => WEIGHT[segment][b.area] * (20 - b.before) - WEIGHT[segment][a.area] * (20 - a.before))
    .slice(0, 3);

  const later = [...new Set(gaps.flatMap((g) => g.couldAdd))].slice(0, 4);
  const unlocks = counterfactuals.map((c) => ({ code: `UNLOCK_${c.condition}`, products: c.unlocks, params: c.threshold ? { threshold: c.threshold } : undefined }));
  const roadmap: Maturity["roadmap"] = [
    { horizon: "now", items: [{ code: "GO_LIVE", products: planIds }] },
    { horizon: "3-6m", items: later.length ? [{ code: "ADD_WHEN_READY", products: later }] : [] },
    { horizon: "6-12m", items: [...unlocks, ...(segment === "micro" || segment === "prof" ? [{ code: "GROWTH_SECOND_SITE", products: ["P10"] as ProductId[], params: { threshold: 3 } }] : [])] },
  ];
  return { segment, before: { total: total(before, segment), areas: before }, after: { total: total(after, segment), areas: after }, gaps, roadmap };
}
