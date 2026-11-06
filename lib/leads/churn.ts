import model from "./churn_model.json";
import { churnVector, type ChurnRow } from "./churnFeatures";

/**
 * Churn risk at activation. A ranking signal for the retention team — who to call first — not a prediction about any one
 * customer, and not a cause: e.g. "many chase calls" correlates with churn in this data; it doesn't prove the calls cause it.
 */
const LABEL: Record<string, string> = {
  chase_calls: "chased us for status during onboarding", log_employees: "team size", log_monthly_value: "bundle value",
  "source:Referral": "came via referral", "source:Channel partner": "came via a channel partner", short_contract: "short contract",
};
/** What to do about each driver (only for drivers that push risk UP). */
const ACTION: Record<string, string> = {
  chase_calls: "Proactive check-in call in week 1; confirm every service works and the owner knows where to track issues.",
  log_employees: "Small team: offer a 10-minute setup walkthrough of the apps they bought.",
  log_monthly_value: "Low-value bundle: review usage at day 30 and suggest the add-on that fits their stated needs.",
  "source:Referral": "Referral customer: confirm the referrer's promise matched what was sold.",
  "source:Channel partner": "Partner-sold: joint welcome call with the partner; check the bundle matches the needs on file.",
  short_contract: "Short contract: offer the 12-month plan at renewal with its price explained.",
};

export interface ChurnRisk { probability: number; band: "high" | "medium" | "low"; drivers: { feature: string; text: string; direction: "up" | "down" }[]; actions: string[] }
const sig = (z: number) => 1 / (1 + Math.exp(-z));

export function churnRisk(row: ChurnRow): ChurnRisk {
  const z = churnVector(row).map((v, j) => (v - model.mean[j]) / model.sd[j]);
  const contrib = z.map((v, j) => v * model.weights[j]);
  const p = sig(contrib.reduce((s, c) => s + c, model.intercept));
  const drivers = contrib.map((c, j) => ({ feature: model.features[j], c })).filter((d) => Math.abs(d.c) > 0.05)
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 3)
    .map((d) => ({ feature: d.feature, text: LABEL[d.feature] ?? d.feature, direction: (d.c > 0 ? "up" : "down") as "up" | "down" }));
  // class-balanced model → p ranks customers; bands are relative, not calibrated probabilities
  const band = p >= 0.6 ? "high" : p >= 0.45 ? "medium" : "low";
  const actions = drivers.filter((d) => d.direction === "up").map((d) => ACTION[d.feature]).filter(Boolean);
  return { probability: +p.toFixed(3), band, drivers, actions: band === "low" ? [] : actions.length ? actions : ["Standard 30-day check-in."] };
}

export const CHURN_MODEL_INFO = { n: model.n, churners: model.churners, baseRate: model.baseRate, aucCv5: model.aucCv5, liftTopQuartile: model.liftTopQuartile, note: model.note };
