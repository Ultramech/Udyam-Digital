import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { get, put } from "@/lib/db/store";
import { audit } from "@/lib/privacy/audit";
import { addEvent } from "@/lib/store/orders";
import type { Ticket } from "@/lib/store/types";
import { publicTicket } from "@/lib/support/tickets";

const Body = z.object({ reply: z.string().trim().min(2).max(1000).optional(), status: z.enum(["open", "in_progress", "resolved"]).optional(), assignToMe: z.boolean().optional() });

/** Agent replies / assigns / resolves. The reply also lands on the order timeline (and the owner's chat channel, if linked). */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireRole("rep", "ops", "admin");
  const b = await parseBody(req, Body);
  const t = await get<Ticket>("ticket", (await params).id);
  if (!t) throw new HttpError(404, "TICKET_NOT_FOUND");
  if (b.assignToMe) t.assignedTo = staff.id;
  if (b.reply) {
    t.messages.push({ by: "staff", name: staff.name.split(" ")[0], text: b.reply, at: Date.now() });
    if (!b.status && t.status === "open") t.status = "in_progress";
    if (!t.assignedTo) t.assignedTo = staff.id;
    if (t.orderId) await addEvent(t.orderId, "message", `${staff.name.split(" ")[0]} (${t.id}): ${b.reply}`);
  }
  if (b.status) t.status = b.status;
  t.updatedAt = Date.now();
  await put("ticket", t.id, t);
  await audit(staff, b.reply ? "ticket.reply" : "ticket.update", "ticket", t.id);
  return ok({ ticket: publicTicket(t) });
});
