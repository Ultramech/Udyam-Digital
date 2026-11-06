import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { currentStaff } from "@/lib/auth";
import { audit } from "@/lib/privacy/audit";
import { loadOrder, orderView } from "@/lib/store/orderAccess";
import { cancelOrder, getOrder } from "@/lib/store/orders";

const Body = z.object({ t: z.string().max(40).optional(), reason: z.string().trim().min(2).max(200) });

/** Owner (via their tracking link) or staff cancels before installation starts; captured payments are refunded via Razorpay. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, Body);
  const o = await loadOrder(id, b.t ?? null);
  const staff = b.t && b.t === o.token ? null : await currentStaff();
  const r = await cancelOrder(o.id, staff ? staff.id : "customer", b.reason);
  if (r.blocked) throw new HttpError(409, r.blocked);
  if (staff) await audit(staff, "order.cancel", "order", o.id);
  return ok(await orderView((await getOrder(o.id))!));
});
