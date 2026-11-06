import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { cxScorecard, historicalStats, liveStats } from "@/lib/leads/stats";

/** Historical dataset metrics and live prototype activity are returned separately and must be shown separately. */
export const GET = route(async () => {
  await requireRole("rep", "partner", "ops", "admin");
  return ok({ historical: historicalStats(), live: await liveStats(), cx: await cxScorecard() });
});
