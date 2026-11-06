import model from "./propensity_model.json";
import { featureVector, type LeadRow } from "./features";

const LABEL: Record<string, string> = {
  has_gstin: "has a GST number", has_udyam: "has Udyam registration", turnover_level: "annual turnover",
  tier_2_city: "Tier-2 city", regional_language: "prefers a regional language", log_employees: "team size", multi_site: "multiple locations", log_spend: "current telecom spend",
};
const label = (f: string) => LABEL[f] ?? f.replace("segment:", "segment: ").replace("source:", "came via ").replace("internet:", "uses ");

export interface Score { probability: number; band: "high" | "medium" | "low"; drivers: { feature: string; text: string; direction: "up" | "down" }[] }

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const base = model.baseRate;

export function scoreLead(row: LeadRow): Score {
  const x = featureVector(row);
  const z = x.map((v, j) => (v - model.mean[j]) / model.sd[j]);
  const contrib = z.map((v, j) => v * model.weights[j]);
  const p = sig(contrib.reduce((s, c) => s + c, model.intercept));
  const drivers = contrib
    .map((c, j) => ({ feature: model.features[j], c }))
    .filter((d) => Math.abs(d.c) > 0.05)
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
    .slice(0, 3)
    .map((d) => ({ feature: d.feature, text: label(d.feature), direction: (d.c > 0 ? "up" : "down") as "up" | "down" }));
  // the model is class-balanced, so p is a ranking score, not a calibrated probability: bands are relative to the base rate
  const band = p >= 0.62 ? "high" : p >= 0.45 ? "medium" : "low";
  void base;
  return { probability: +p.toFixed(3), band, drivers };
}

export const MODEL_INFO = { aucTest: model.aucTest, liftTopDecile: model.liftTopDecile, baseRate: model.baseRate, n: model.n, note: model.note };
