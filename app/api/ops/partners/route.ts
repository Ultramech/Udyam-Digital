import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { list } from "@/lib/db/store";
import { OWNERS } from "@/lib/leads/leads";
import { commissionPercent, partnerSummary } from "@/lib/leads/partners";
import type { Lead, Order } from "@/lib/store/types";

/** A partner sees only their own book; ops and admin see every partner. Enforced here, not in the UI. */
export const GET = route(async () => {
  const staff = await requireRole("partner", "ops", "admin");
  const [leads, orders] = await Promise.all([list<Lead>("lead", { limit: 5000 }), list<Order>("order", { limit: 5000 })]);
  const ids = staff.role === "partner" ? [staff.id] : OWNERS.filter((o) => o.kind === "partner").map((o) => o.id);
  const rate = commissionPercent();
  return ok({ partners: ids.map((id) => ({ name: OWNERS.find((o) => o.id === id)?.name ?? id, ...partnerSummary(id, leads, orders, rate) })) });
});
