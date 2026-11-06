import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { list } from "@/lib/db/store";
import { analytics, filterOptions, pilotTargets } from "@/lib/leads/analytics";
import { churnRisk, CHURN_MODEL_INFO } from "@/lib/leads/churn";
import type { Order } from "@/lib/store/types";

/** Historical analytics (filterable) + live at-risk customers scored with the same at-activation churn model. */
export const GET = route(async (req: Request) => {
  await requireRole("ops", "admin", "rep");
  const u = new URL(req.url).searchParams;
  const f = { segment: u.get("segment") || undefined, tier: u.get("tier") || undefined, source: u.get("source") || undefined, language: u.get("language") || undefined, month: u.get("month") || undefined };
  const live = (await list<Order>("order", { limit: 1000 })).filter((o) => o.stage === "ACTIVATED" && !o.cancelled).map((o) => ({
    id: o.id, business: o.businessName, monthly: o.totals.monthly,
    risk: churnRisk({
      customer_follow_up_calls: String(o.chases), employee_count: String(o.profile.employees), monthly_bundle_value_inr: String(o.totals.monthly),
      lead_source: o.attribution.referrer || o.attribution.source === "referral" ? "Referral" : o.attribution.partnerCode ? "Channel partner" : "Website form",
      contract_months: String(o.totals.contractMonths),
    }),
  })).sort((a, b) => b.risk.probability - a.risk.probability);
  return ok({ filters: f, options: filterOptions(), ...analytics(f), targets: pilotTargets(), churnModel: CHURN_MODEL_INFO, liveAtRisk: live });
});
