import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { get } from "@/lib/db/store";
import { OWNERS, getLead, historicalLeads, leadSummary, nextBestAction, ownerName, patchLead } from "@/lib/leads/leads";
import { audit } from "@/lib/privacy/audit";
import { quoteView } from "@/lib/store/quotes";
import type { Conversation, KycCase, Order, Quote } from "@/lib/store/types";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireRole("rep", "partner", "ops", "admin");
  const id = (await params).id;
  if (id.startsWith("L") && /^L\d{5}$/.test(id)) {
    const h = historicalLeads().find((l) => l.id === id);
    if (!h) throw new HttpError(404, "LEAD_NOT_FOUND");
    return ok({ origin: "historical", lead: h });
  }
  const l = await getLead(id);
  if (!l) throw new HttpError(404, "LEAD_NOT_FOUND");
  const conv = l.conversationId ? await get<Conversation>("conversation", l.conversationId) : null;
  const quote = l.quoteId ? await get<Quote>("quote", l.quoteId) : null;
  const order = l.orderId ? await get<Order>("order", l.orderId) : null;
  const kyc = order?.kycId ? await get<KycCase>("kyc", order.kycId) : null;
  return ok({
    origin: "live", lead: { ...l, ownerName: ownerName(l.ownerId) }, summary: leadSummary(l, quote ? quoteView(quote).pricing.monthly : undefined), nextAction: nextBestAction(l, { kycStatus: kyc?.status, orderStage: order?.stage }),
    transcript: conv?.messages ?? [], quote: quote ? quoteView(quote) : null,
    order: order ? { id: order.id, stage: order.stage, payment: order.payment.status, kycStatus: order.kycStatus } : null,
    kyc: kyc ? { id: kyc.id, status: kyc.status, review: kyc.review ?? null } : null, owners: OWNERS,
  });
});

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), ownerId: z.string().max(10) }),
  z.object({ action: z.literal("note"), text: z.string().min(1).max(500) }),
  z.object({ action: z.literal("callback"), at: z.string().max(40), note: z.string().max(200).default("") }),
  z.object({ action: z.literal("done"), index: z.number().int().min(0).max(50) }),
  z.object({ action: z.literal("escalate"), team: z.enum(["field_sales", "enterprise", "kyc_ops"]) }),
]);

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireRole("rep", "partner", "ops", "admin");
  const id = (await params).id;
  const b = await parseBody(req, Action);
  const cur = await getLead(id);
  if (!cur) throw new HttpError(404, "LEAD_NOT_FOUND");
  if ((staff.role === "rep" || staff.role === "partner") && cur.ownerId !== staff.id) throw new HttpError(403, "NOT_YOUR_LEAD");
  const now = Date.now();
  const l = await patchLead(id, (x) => {
    switch (b.action) {
      case "assign": if (!OWNERS.some((o) => o.id === b.ownerId)) throw new HttpError(400, "UNKNOWN_OWNER"); return { ...x, ownerId: b.ownerId, status: "assigned" };
      case "note": return { ...x, notes: [...x.notes, { at: now, by: staff.name, text: b.text }] };
      case "callback": return { ...x, status: "callback", callbacks: [...x.callbacks, { at: b.at, note: b.note, done: false }] };
      case "done": return { ...x, callbacks: x.callbacks.map((c, i) => (i === b.index ? { ...c, done: true } : c)) };
      case "escalate": return { ...x, notes: [...x.notes, { at: now, by: staff.name, text: `Escalated to ${b.team.replace("_", " ")}` }] };
    }
  });
  await audit(staff, `lead.${b.action}`, "lead", id);
  return ok({ lead: l });
});
