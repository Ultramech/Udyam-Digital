/** Lead-time features ONLY — nothing that is known after the fact (stage dates, drop reason, follow-up calls, bundle, churn). */
export interface LeadRow {
  has_gstin: string; has_udyam: string; segment: string; annual_turnover_band: string; lead_source: string;
  current_internet: string; city_tier: string; preferred_language: string; employee_count: string; num_sites: string; monthly_telecom_spend_inr: string;
}

const TURNOVER = ["< 40 lakh", "40 lakh - 1.5 cr", "1.5 - 5 cr", "5 - 25 cr", "25 - 100 cr"];
const SEGMENTS = ["Professional offices", "Small multi-site businesses", "Small manufacturers"]; // micro = reference
const SOURCES = ["Website form", "Channel partner", "Inbound call", "Referral", "WhatsApp campaign"]; // field sales = reference
const INTERNET = ["Home broadband", "Business broadband", "Mixed per site", "Leased line", "None"]; // hotspot = reference

export const FEATURE_NAMES = [
  "has_gstin", "has_udyam", ...SEGMENTS.map((s) => `segment:${s}`), "turnover_level", ...SOURCES.map((s) => `source:${s}`),
  ...INTERNET.map((s) => `internet:${s}`), "tier_2_city", "regional_language", "log_employees", "multi_site", "log_spend",
];

export function featureVector(r: LeadRow): number[] {
  return [
    r.has_gstin === "Y" ? 1 : 0,
    r.has_udyam === "Y" ? 1 : 0,
    ...SEGMENTS.map((s) => (r.segment === s ? 1 : 0)),
    Math.max(0, TURNOVER.indexOf(r.annual_turnover_band)),
    ...SOURCES.map((s) => (r.lead_source === s ? 1 : 0)),
    ...INTERNET.map((s) => (r.current_internet === s ? 1 : 0)),
    r.city_tier === "2" ? 1 : 0,
    ["Hindi", "English"].includes(r.preferred_language) ? 0 : 1,
    Math.log(Math.max(1, Number(r.employee_count) || 1)),
    Number(r.num_sites) >= 3 ? 1 : 0,
    Math.log1p(Number(r.monthly_telecom_spend_inr) || 0),
  ];
}
