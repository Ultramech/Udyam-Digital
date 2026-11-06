import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { get } from "@/lib/db/store";
import { historicalLeads, liveLeads, nextBestAction, ownerName } from "@/lib/leads/leads";
import { priceLines } from "@/lib/rules/pricing";
import type { KycCase, Order } from "@/lib/store/types";

export const GET = route(async (req: Request) => {
  const staff = await requireRole("rep", "partner", "ops", "admin");
  const u = new URL(req.url).searchParams;
  const tab = u.get("tab") ?? "live";
  const f = { segment: u.get("segment"), city: u.get("city"), source: u.get("source"), stage: u.get("stage"), owner: u.get("owner"), q: u.get("q")?.toLowerCase() };
  const limit = Math.min(200, Number(u.get("limit") ?? 100));
  const offset = Math.max(0, Number(u.get("offset") ?? 0));

  if (tab === "live" || tab === "escalated") {
    let rows = await liveLeads();
    if (tab === "escalated") rows = rows.filter((l) => l.level !== "none");
    // reps see only their own leads; partners likewise; ops/admin see all
    if (staff.role === "rep" || staff.role === "partner") rows = rows.filter((l) => l.ownerId === staff.id);
    const out = await Promise.all(rows.map(async (l) => {
      const order = l.orderId ? await get<Order>("order", l.orderId) : null;
      const kyc = order?.kycId ? await get<KycCase>("kyc", order.kycId) : null;
      return {
        id: l.id, origin: "live", business: l.businessName ?? "(new enquiry)", segment: l.profile.businessType ?? "", city: l.profile.city, source: l.attribution.source ?? "advisor",
        stage: l.status, monthly: l.monthly, hasGstin: l.profile.gstin.has, owner: ownerName(l.ownerId), ownerId: l.ownerId ?? null, level: l.level, reasons: l.reasons,
        nextAction: nextBestAction(l, { kycStatus: kyc?.status, orderStage: order?.stage }), createdAt: l.createdAt, assistCredit: l.assistCredit ?? null,
      };
    }));
    return ok({ total: out.length, rows: out.slice(offset, offset + limit) });
  }

  let rows = historicalLeads();
  if (tab === "winback") rows = rows.filter((l) => l.winback);
  if (f.segment) rows = rows.filter((l) => l.segment === f.segment);
  if (f.city) rows = rows.filter((l) => l.city === f.city);
  if (f.source) rows = rows.filter((l) => l.source === f.source);
  if (f.stage) rows = rows.filter((l) => l.stage === f.stage);
  if (f.q) rows = rows.filter((l) => l.business.toLowerCase().includes(f.q!) || l.id.toLowerCase().includes(f.q!));
  rows = [...rows].sort((a, b) => b.priority - a.priority);
  return ok({
    total: rows.length,
    rows: rows.slice(offset, offset + limit).map((l) => ({
      id: l.id, origin: "historical", business: l.business, segment: l.segment, city: l.city, source: l.source, stage: l.stage, outcome: l.outcome, dropReason: l.dropReason,
      hasGstin: l.hasGstin, monthly: l.outcome === "Activated" ? l.monthlyValue : l.expectedValue, score: l.score.probability, band: l.score.band, drivers: l.score.drivers, priority: l.priority,
      nextAction: l.nextAction, winback: l.winback, language: l.language,
    })),
  });
});
void priceLines;
