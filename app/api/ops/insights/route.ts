import { HttpError, ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { datasetInsights, overviewInsights, playbookInsights } from "@/lib/leads/insights";
import { playbook } from "@/lib/leads/playbook";
import { leadSignals } from "@/lib/leads/signals";
import { cxScorecard, historicalStats, liveStats } from "@/lib/leads/stats";

/**
 * Data-derived findings for a page: scope=analytics (respects the same filters as the analytics page), overview, or playbook.
 * Staff only; the overview scope is open to partners because it only uses what the overview already shows them.
 */
export const GET = route(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  const scope = u.get("scope") ?? "analytics";
  if (scope === "overview") {
    await requireRole("rep", "partner", "ops", "admin");
    const [live, cx] = await Promise.all([liveStats(), cxScorecard()]);
    return ok(overviewInsights({ hist: historicalStats(), live, cx }));
  }
  await requireRole("ops", "admin", "rep");
  if (scope === "playbook") {
    const pb = playbook();
    return ok(playbookInsights({ total: pb.total, gstin: pb.gstin, waste: pb.waste, signals: leadSignals() }));
  }
  if (scope !== "analytics") throw new HttpError(400, "BAD_SCOPE");
  const f = { segment: u.get("segment") || undefined, tier: u.get("tier") || undefined, source: u.get("source") || undefined, language: u.get("language") || undefined, month: u.get("month") || undefined };
  return ok(datasetInsights(f));
});
