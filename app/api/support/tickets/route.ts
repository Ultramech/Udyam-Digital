import { z } from "zod";
import { requireCustomer } from "@/lib/accounts/guard";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { currentUser } from "@/lib/accounts/users";
import { get, list, listBy, newId, newToken, put } from "@/lib/db/store";
import { loadOrder } from "@/lib/store/orderAccess";
import { addEvent } from "@/lib/store/orders";
import { classify, intentCategory, ticketContext } from "@/lib/support/assistant";
import type { Ticket } from "@/lib/store/types";
import { publicTicket } from "@/lib/support/tickets";

const Body = z.object({
  text: z.string().trim().min(5).max(1000), orderId: z.string().max(20).optional(), t: z.string().max(40).optional(),
  lang: z.enum(["en", "hi", "mr", "ta"]).default("en"),
  /** the assistant exchange that preceded this request, so the agent sees it */
  transcript: z.array(z.object({ by: z.enum(["customer", "assistant"]), text: z.string().max(1000) })).max(10).optional(),
});


/** Raise a support request. The human gets the full context (order state + what the owner asked) — the owner never repeats it. */
export const POST = route(async (req: Request) => {
  await requireCustomer();
  const b = await parseBody(req, Body);
  const o = b.orderId ? await loadOrder(b.orderId, b.t ?? null) : null;
  const sid = await sessionId();
  // light abuse guard: at most 5 open requests per visitor session
  if (sid && (await list<Ticket>("ticket", { limit: 500 })).filter((x) => x.sessionId === sid && x.status !== "resolved").length >= 5) throw new HttpError(429, "TOO_MANY_OPEN_TICKETS");
  const intent = classify(b.text);
  const now = Date.now();
  const t: Ticket = {
    id: newId("TK"), token: newToken(), createdAt: now, updatedAt: now, sessionId: sid, userId: (await currentUser())?.id, orderId: o?.id, lang: b.lang,
    category: intentCategory(intent), status: "open", priority: intent === "complaint" || intent === "cancel" || (o?.chases ?? 0) >= 2 || !!o?.delayed ? "high" : "normal",
    messages: [...(b.transcript ?? []).map((m) => ({ ...m, at: now - 1 })), { by: "customer" as const, text: b.text, at: now }],
    context: ticketContext(o, intent, b.text) as Ticket["context"],
  };
  await put("ticket", t.id, t);
  if (o) await addEvent(o.id, "message", b.lang === "hi" || b.lang === "mr" ? `आपका सहायता अनुरोध ${t.id} मिल गया है। जवाब सहायता पेज पर आएगा।` : `We've received your support request ${t.id}. The reply will appear on the Help page.`);
  return ok({ ticket: publicTicket(t), token: t.token });
});

/** The owner's own requests: ?ids=TK-A:token,TK-B:token (tokens are held on their device). */
export const GET = route(async (req: Request) => {
  await requireCustomer();
  const pairs = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 20).map((p) => p.split(":"));
  const out: Ticket[] = [];
  for (const [id, tok] of pairs) { const t = await get<Ticket>("ticket", id); if (t && tok && t.token === tok) out.push(t); }
  // a signed-in owner also sees requests raised from their other devices
  const u = await currentUser();
  if (u) for (const t of await listBy<Ticket>("ticket", "user_id", u.id, { limit: 50 })) if (!out.some((x) => x.id === t.id)) out.push(t);
  return ok({ tickets: out.sort((a, b) => b.updatedAt - a.updatedAt).map(publicTicket) });
});
