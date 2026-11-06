import { z } from "zod";
import { requireCustomer } from "@/lib/accounts/guard";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { get, put } from "@/lib/db/store";
import type { Ticket } from "@/lib/store/types";
import { publicTicket } from "@/lib/support/tickets";

const Body = z.object({ t: z.string().max(40), text: z.string().trim().min(1).max(1000).optional(), resolve: z.boolean().optional() });

/** Owner replies on (or closes) their own request. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireCustomer();
  const b = await parseBody(req, Body);
  const t = await get<Ticket>("ticket", (await params).id);
  if (!t || t.token !== b.t) throw new HttpError(404, "TICKET_NOT_FOUND");
  if (b.text) { t.messages.push({ by: "customer", text: b.text, at: Date.now() }); if (t.status === "resolved") t.status = "open"; }
  if (b.resolve) t.status = "resolved";
  t.updatedAt = Date.now();
  await put("ticket", t.id, t);
  return ok({ ticket: publicTicket(t) });
});
