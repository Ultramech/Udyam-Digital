import { z } from "zod";
import { requireCustomer } from "@/lib/accounts/guard";
import { ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { requestCallback } from "@/lib/callback/request";

const Body = z.object({ conversationId: z.string().max(40), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), window: z.string().max(20), note: z.string().max(200).optional() });

export const POST = route(async (req: Request) => {
  await requireCustomer();
  const b = await parseBody(req, Body);
  return ok(await requestCallback({ ...b, sessionId: await sessionId() }));
});
