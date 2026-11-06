import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { list } from "@/lib/db/store";
import { ownerName } from "@/lib/leads/leads";
import type { Order } from "@/lib/store/types";

export const GET = route(async () => {
  await requireRole("ops", "admin", "rep", "partner");
  const orders = (await list<Order>("order")).filter((o) => o.payment.status === "success" || o.payment.status === "processing" || o.payment.status === "failed");
  return ok({
    rows: orders.map((o) => ({
      id: o.id, business: o.businessName, bundleId: o.bundleId, stage: o.stage ?? null, payment: o.payment.status, kycStatus: o.kycStatus, goLive: o.goLive,
      monthly: o.totals.monthly, sites: o.sites.length, delayed: o.delayed ?? null, actionNeeded: o.actionNeeded ?? null, chases: o.chases, engineer: o.engineer?.name ?? null,
      balanceDue: o.payment.balance?.status === "due" ? o.payment.balance.amount : null, enRoute: !!o.engineer?.enRoute, stuckSince: o.stageChangedAt ?? null,
      owner: ownerName(o.attribution.repId ?? undefined), createdAt: o.createdAt, token: o.token,
    })),
  });
});
