import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { loadActiveOrder, loadOrder, orderView } from "@/lib/store/orderAccess";
import { getOrder, pay } from "@/lib/store/orders";
import { put } from "@/lib/db/store";
import { splitFirstPayment } from "@/lib/payments/deposit";
import { createRazorpayOrder, fetchRazorpayPayment, razorpayEnabled, razorpayTestMode, verifyRazorpaySignature } from "@/lib/services/razorpay";

/** POST → create a Razorpay order for the server-computed amount. PUT → verify the signature, then mark paid. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional(), plan: z.enum(["full", "deposit"]).optional() }));
  const o = await loadActiveOrder(id, b.t ?? null);
  if (!razorpayEnabled()) throw new HttpError(503, "PAYMENTS_UNAVAILABLE");
  if (!o.esign) throw new HttpError(409, "ESIGN_REQUIRED");
  if (o.payment.status === "success") throw new HttpError(409, "ALREADY_PAID");
  const split = splitFirstPayment(o.totals.firstPayment);
  const plan = b.plan === "deposit" && split.offered ? "deposit" : "full"; // the server decides; a client cannot invent a smaller amount
  const r = await createRazorpayOrder(plan === "deposit" ? split.deposit : o.totals.firstPayment, o.id);
  o.payment.razorpayOrderId = r.id;
  o.payment.plan = plan;
  await put("order", o.id, o);
  return ok({ enabled: true, test: razorpayTestMode(), keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID, razorpayOrderId: r.id, amount: r.amount, currency: r.currency });
});

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional(), razorpay_order_id: z.string().max(60), razorpay_payment_id: z.string().max(60), razorpay_signature: z.string().max(128) }));
  const o = await loadOrder(id, b.t ?? null);
  if (o.payment.status === "success") throw new HttpError(409, "ALREADY_PAID");
  if (!o.payment.razorpayOrderId || o.payment.razorpayOrderId !== b.razorpay_order_id) throw new HttpError(400, "ORDER_MISMATCH");
  if (!verifyRazorpaySignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    await pay(o.id, "fail");
    throw new HttpError(400, "BAD_SIGNATURE");
  }
  const rp = await fetchRazorpayPayment(b.razorpay_payment_id);
  if (!rp || rp.order_id !== b.razorpay_order_id || rp.amount !== Math.round((o.payment.plan === "deposit" ? splitFirstPayment(o.totals.firstPayment).deposit : o.totals.firstPayment) * 100) || rp.currency !== "INR" || !["captured", "authorized"].includes(rp.status)) {
    await pay(o.id, "fail");
    throw new HttpError(400, "PAYMENT_NOT_CONFIRMED");
  }
  const fresh = (await getOrder(o.id))!;
  fresh.payment.razorpayPaymentId = b.razorpay_payment_id;
  const split = splitFirstPayment(fresh.totals.firstPayment);
  fresh.payment.paid = fresh.payment.plan === "deposit" ? split.deposit : fresh.totals.firstPayment;
  if (fresh.payment.plan === "deposit") fresh.payment.balance = { amount: split.balance, status: "due" };
  fresh.payment.method = (["upi", "card", "netbanking", "wallet"] as const).find((m) => m === rp.method) ?? "other";
  await put("order", fresh.id, fresh);
  await pay(o.id, "success");
  return ok(await orderView((await getOrder(o.id))!));
});
