import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/privacy/audit";
import { advance, getOrder, markEnRoute, pay, setDelay } from "@/lib/store/orders";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), force: z.boolean().optional() }),
  z.object({ action: z.literal("delay"), reason: z.string().max(120).default("a delay with our installation partner") }),
  z.object({ action: z.literal("en_route") }),
  z.object({ action: z.literal("resolve_payment"), outcome: z.enum(["success", "fail"]) }),
]);

/** Ops and the demo drawer drive the order through its stages; the customer tracker reads the same record. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireRole("ops", "admin");
  const id = (await params).id;
  const b = await parseBody(req, Body);
  if (!(await getOrder(id))) throw new HttpError(404, "ORDER_NOT_FOUND");
  let blocked: string | undefined;
  if (b.action === "advance") blocked = (await advance(id, b.force)).blocked;
  else if (b.action === "delay") await setDelay(id, b.reason);
  else if (b.action === "en_route") blocked = (await markEnRoute(id)).blocked;
  else await pay(id, b.outcome);
  await audit(staff, `order.${b.action}`, "order", id);
  return ok({ order: await getOrder(id), blocked: blocked ?? null });
});
