import { z } from "zod";
import { requireCustomer } from "@/lib/accounts/guard";
import { ok, parseBody, route } from "@/lib/api";
import { loadOrder } from "@/lib/store/orderAccess";
import { answer } from "@/lib/support/assistant";

const Body = z.object({ question: z.string().trim().min(2).max(500), orderId: z.string().max(20).optional(), t: z.string().max(40).optional(), lang: z.enum(["en", "hi", "mr", "ta"]).default("en") });

/** Grounded support answer from the owner's own order (reached by its private link token). Stateless. */
export const POST = route(async (req: Request) => {
  await requireCustomer();
  const b = await parseBody(req, Body);
  const o = b.orderId ? await loadOrder(b.orderId, b.t ?? null) : null;
  return ok(answer(b.question, o, b.lang));
});
