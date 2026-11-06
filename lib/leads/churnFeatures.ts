/**
 * Churn-risk features: ONLY what is known on the day a customer is activated (profile, channel, bundle, and how their
 * onboarding went). Never the outcome itself, never NPS (surveyed later — would leak), never anything after activation.
 *
 * Deliberately few: with 368 activated customers and 56 churners, a wide model fits noise (a 18-feature version scored
 * 0.56 cross-validated AUC). These six carry the univariate signal in the data (chase calls 0.61, team size 0.61 inverse,
 * bundle value 0.59 inverse, referral 0.56, partner 0.53).
 */
export interface ChurnRow {
  lead_source: string; employee_count: string; monthly_bundle_value_inr: string; contract_months: string; customer_follow_up_calls: string;
}
export const CHURN_FEATURES = ["chase_calls", "log_employees", "log_monthly_value", "source:Referral", "source:Channel partner", "short_contract"];

export function churnVector(r: ChurnRow): number[] {
  return [
    Number(r.customer_follow_up_calls) || 0,
    Math.log(Math.max(1, Number(r.employee_count) || 1)),
    Math.log1p(Number(r.monthly_bundle_value_inr) || 0),
    r.lead_source === "Referral" ? 1 : 0,
    r.lead_source === "Channel partner" ? 1 : 0,
    (Number(r.contract_months) || 12) < 12 ? 1 : 0,
  ];
}
