import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { loadActiveOrder, loadOrder, orderView } from "@/lib/store/orderAccess";
import { getOrder, markBalancePaid } from "@/lib/store/orders";
import { put } from "@/lib/db/store";
import { createRazorpayOrder, fetchRazorpayPayment, razorpayEnabled, razorpayTestMode, verifyRazorpaySignature } from "@/lib/services/razorpay";

/**
 * Balance of a reserve-now order. POST → create a Razorpay order for exactly the stored balance. PUT → verify the signature AND ask
 * Razorpay what was captured before marking it paid. Same guarantees as the first payment; the amount never comes from the browser.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional() }));
  const o = await loadActiveOrder(id, b.t ?? null);
  if (!razorpayEnabled()) throw new HttpError(503, "PAYMENTS_UNAVAILABLE");
  const bal = o.payment.balance;
  if (o.payment.status !== "success" || !bal) throw new HttpError(409, "NO_BALANCE_DUE");
  if (bal.status === "paid") throw new HttpError(409, "ALREADY_PAID");
  const r = await createRazorpayOrder(bal.amount, `${o.id}-bal`);
  o.payment.balance = { ...bal, razorpayOrderId: r.id };
  await put("order", o.id, o);
  return ok({ enabled: true, test: razorpayTestMode(), keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID, razorpayOrderId: r.id, amount: r.amount, currency: r.currency });
});

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional(), razorpay_order_id: z.string().max(60), razorpay_payment_id: z.string().max(60), razorpay_signature: z.string().max(128) }));
  const o = await loadOrder(id, b.t ?? null);
  const bal = o.payment.balance;
  if (!bal) throw new HttpError(409, "NO_BALANCE_DUE");
  if (bal.status === "paid") throw new HttpError(409, "ALREADY_PAID");
  if (!bal.razorpayOrderId || bal.razorpayOrderId !== b.razorpay_order_id) throw new HttpError(400, "ORDER_MISMATCH");
  if (!verifyRazorpaySignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) throw new HttpError(400, "BAD_SIGNATURE");
  const rp = await fetchRazorpayPayment(b.razorpay_payment_id);
  if (!rp || rp.order_id !== b.razorpay_order_id || rp.amount !== Math.round(bal.amount * 100) || rp.currency !== "INR" || !["captured", "authorized"].includes(rp.status)) throw new HttpError(400, "PAYMENT_NOT_CONFIRMED");
  await markBalancePaid(o.id, b.razorpay_payment_id);
  return ok(await orderView((await getOrder(o.id))!));
});
