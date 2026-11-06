import { createHash } from "node:crypto";
import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { list } from "@/lib/db/store";
import { maskPhone } from "@/lib/kyc/identifiers";
import { deriveSegment } from "@/lib/rules/normalise";
import { ownerName } from "@/lib/leads/leads";
import type { Lead, Order, Ticket } from "@/lib/store/types";

/**
 * Customer view for staff: every business that reached us through the digital journey, grouped by verified phone
 * (the identity the owner proved by OTP), with their leads, orders and support requests. Phones are masked.
 */
interface Customer {
  key: string; name: string; phoneMasked: string; city: string; segment: string; sites: number; employees: number;
  /** one verified phone can own several businesses (blueprint 1.1) */
  businesses: string[];
  owner: string; leads: { id: string; status: string; level: string; at: number }[];
  orders: { id: string; stage: string; monthly: number; kyc: string; payment: string; at: number }[];
  tickets: { id: string; status: string; category: string }[];
  mrr: number; lastActivity: number; status: "prospect" | "onboarding" | "active" | "cancelled";
}

export const GET = route(async () => {
  await requireRole("rep", "ops", "admin");
  const [leads, orders, tickets] = await Promise.all([list<Lead>("lead", { limit: 1000 }), list<Order>("order", { limit: 1000 }), list<Ticket>("ticket", { limit: 1000 })]);
  const by = new Map<string, Customer>();
  const blank = (key: string, name: string, phone: string | undefined, p: Lead["profile"], owner?: string): Customer => ({
    key, name, phoneMasked: maskPhone(phone) || "—", city: p.city, segment: deriveSegment(p), sites: p.sites, employees: p.employees, owner: ownerName(owner),
    businesses: [], leads: [], orders: [], tickets: [], mrr: 0, lastActivity: 0, status: "prospect",
  });
  for (const o of orders) {
    const key = o.phone ?? `order:${o.id}`;
    const c = by.get(key) ?? blank(key, o.businessName, o.phone, o.profile);
    // orders arrive newest first: the first name seen is the latest; every distinct name is kept
    if (o.businessName && !c.businesses.includes(o.businessName)) c.businesses.push(o.businessName);
    if (!c.orders.length && o.businessName) c.name = o.businessName;
    c.orders.push({ id: o.id, stage: o.cancelled ? "CANCELLED" : o.stage ?? "AWAITING_PAYMENT", monthly: o.totals.monthly, kyc: o.kycStatus, payment: o.payment.status, at: o.createdAt });
    if (o.stage === "ACTIVATED" && !o.cancelled) c.mrr += o.totals.monthly;
    c.lastActivity = Math.max(c.lastActivity, o.createdAt);
    for (const t of tickets.filter((x) => x.orderId === o.id)) c.tickets.push({ id: t.id, status: t.status, category: t.category });
    by.set(key, c);
  }
  for (const l of leads) {
    const key = l.phone ?? (l.orderId ? [...by.values()].find((c) => c.orders.some((o) => o.id === l.orderId))?.key : undefined) ?? `lead:${l.id}`;
    const c = by.get(key) ?? blank(key, l.businessName ?? l.profile.businessType ?? "Unnamed business", l.phone, l.profile, l.ownerId);
    if (c.owner === "Unassigned" && l.ownerId) c.owner = ownerName(l.ownerId);
    c.leads.push({ id: l.id, status: l.status, level: l.level, at: l.createdAt });
    c.lastActivity = Math.max(c.lastActivity, l.createdAt);
    by.set(key, c);
  }
  const customers = [...by.values()].map((c) => {
    const live = c.orders.filter((o) => o.stage !== "CANCELLED");
    c.status = live.some((o) => o.stage === "ACTIVATED") ? "active" : live.length ? "onboarding" : c.orders.length ? "cancelled" : "prospect";
    const { key: _k, ...rest } = c; void _k;
    return { id: createHash("sha256").update(c.key).digest("hex").slice(0, 12), ...rest }; // opaque: never derived reversibly from the phone
  }).sort((a, b) => b.lastActivity - a.lastActivity);
  return ok({ customers });
});
