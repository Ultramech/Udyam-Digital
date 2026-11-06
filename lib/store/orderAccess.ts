import "server-only";
import { HttpError } from "@/lib/api";
import { currentStaff } from "@/lib/auth";
import { requireCustomer } from "@/lib/accounts/guard";
import { put } from "@/lib/db/store";
import { eventsFor, getOrder } from "./orders";
import { getKyc } from "./kyc";
import { kycView } from "./kycView";
import type { Order } from "./types";

/**
 * Staff reach any order through their role session. A customer needs BOTH: to be signed in (phone verified, profile set up)
 * as the order's owner, and its unguessable link token. An order placed before accounts existed is claimed on first access.
 */
export async function loadOrder(id: string, token: string | null): Promise<Order> {
  const o = await getOrder(id);
  if (!o) throw new HttpError(404, "ORDER_NOT_FOUND");
  if (await currentStaff()) return o;
  const u = await requireCustomer();
  if (!token || token !== o.token) throw new HttpError(403, "INVALID_TRACKING_LINK");
  if (o.userId && o.userId !== u.id) throw new HttpError(403, "NOT_YOUR_ORDER");
  if (!o.userId) { o.userId = u.id; await put("order", o.id, o); }
  return o;
}

export async function orderView(o: Order) {
  const events = await eventsFor(o.id);
  const kyc = o.kycId ? await getKyc(o.kycId) : null;
  const { token: _t, phone, ...safe } = o;
  void _t;
  return { order: { ...safe, phoneMasked: phone ? phone.replace(/^(\d{2})\d{6}(\d{2})$/, "$1••••••$2") : undefined }, events, kyc: kyc ? kycView(kyc) : null };
}

/** For actions that move an order forward (pay, sign, book a slot): a cancelled order is read-only. */
export async function loadActiveOrder(id: string, token: string | null): Promise<Order> {
  const o = await loadOrder(id, token);
  if (o.cancelled) throw new HttpError(409, "ORDER_CANCELLED");
  return o;
}
