import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Razorpay (TEST mode). No SDK needed: one REST call to create the order + an HMAC check on the way back. */
const keyId = () => process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const keySecret = () => process.env.RAZORPAY_KEY_SECRET;
export const razorpayEnabled = () => !!(keyId() && keySecret());
export const razorpayTestMode = () => (keyId() ?? "").startsWith("rzp_test_");

export async function createRazorpayOrder(amountRupees: number, receipt: string) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64") },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt: receipt.slice(0, 40) }),
  });
  if (!res.ok) throw new Error(`razorpay_order_${res.status}`);
  return (await res.json()) as { id: string; amount: number; currency: string };
}

/** Razorpay signs `order_id|payment_id` with the key secret. Never mark an order paid without this. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac("sha256", keySecret() ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Asks Razorpay itself what happened to a payment (defence in depth on top of the signature). */
export async function fetchRazorpayPayment(paymentId: string) {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64") }, cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; order_id: string; amount: number; currency: string; status: string; method: string };
}

/** Full refund of a captured payment (used when an order is cancelled before installation). Returns null when Razorpay refuses. */
export async function refundRazorpayPayment(paymentId: string, receipt: string): Promise<{ id: string; status: string; amount: number } | null> {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(`${keyId()}:${keySecret()}`).toString("base64") },
    body: JSON.stringify({ speed: "normal", receipt: receipt.slice(0, 40) }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { id: string; status: string; amount: number };
}
