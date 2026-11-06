import type { Lead, Order } from "@/lib/store/types";

/**
 * Partner view: every lead a channel partner brought or was assigned, where it stands, and what it is worth. Pure and testable.
 * A lead belongs to a partner when it carries their partner code (link/QR), is assigned to them, or they hold the assist credit.
 * Money figures come only from real paid orders. The commission RATE is Accel Business policy and is never invented here: with no
 * `PARTNER_COMMISSION_PERCENT` configured the earnings are reported as null and the screen says so.
 */
export interface PartnerLeadRow { id: string; business: string; city: string; status: Lead["status"]; monthly: number; stage: string; paid: boolean; activated: boolean; createdAt: number }
export interface PartnerSummary {
  partnerId: string; commissionPercent: number | null;
  totals: { leads: number; open: number; ordersPaid: number; activated: number; mrrBooked: number; mrrActivated: number; earningsActivated: number | null };
  rows: PartnerLeadRow[];
}

export const belongsToPartner = (l: Lead, partnerId: string) => l.attribution?.partnerCode === partnerId || l.ownerId === partnerId || l.assistCredit?.to === partnerId;

export function partnerSummary(partnerId: string, leads: Lead[], orders: Order[], commissionPercent: number | null): PartnerSummary {
  const byId = new Map(orders.map((o) => [o.id, o]));
  const rows: PartnerLeadRow[] = leads.filter((l) => belongsToPartner(l, partnerId)).map((l) => {
    const o = l.orderId ? byId.get(l.orderId) : undefined;
    const paid = o?.payment.status === "success";
    return {
      id: l.id, business: l.businessName ?? "New enquiry", city: l.profile.city, status: l.status, monthly: o ? o.totals.monthly : l.monthly,
      stage: o ? (o.stage ?? "awaiting payment") : l.status, paid, activated: o?.stage === "ACTIVATED", createdAt: l.createdAt,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);
  const paidRows = rows.filter((r) => r.paid), act = rows.filter((r) => r.activated);
  const mrrActivated = act.reduce((s, r) => s + r.monthly, 0);
  return {
    partnerId, commissionPercent,
    totals: {
      leads: rows.length, open: rows.filter((r) => !r.paid && r.status !== "closed").length, ordersPaid: paidRows.length, activated: act.length,
      mrrBooked: paidRows.reduce((s, r) => s + r.monthly, 0), mrrActivated,
      earningsActivated: commissionPercent === null ? null : Math.round((mrrActivated * commissionPercent) / 100),
    },
    rows,
  };
}

export const commissionPercent = (): number | null => { const n = Number(process.env.PARTNER_COMMISSION_PERCENT); return process.env.PARTNER_COMMISSION_PERCENT && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null; };
