import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { loadOrder, orderView } from "@/lib/store/orderAccess";
import { chase, getOrder, pay, recordSignature } from "@/lib/store/orders";
import { mockPayments } from "@/lib/services";

const Body = z.object({ t: z.string().max(40).optional(), outcome: z.enum(["success", "fail", "pending"]).optional() });

/** Customer actions on an order: pay (test-only outcomes; real pay is /razorpay), e-sign (simulated), request a callback. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const { id, action } = await params;
  const b = await parseBody(req, Body);
  const o = await loadOrder(id, b.t ?? null);

  const testOnly = process.env.ALLOW_TEST_VERIFY === "1" && process.env.NODE_ENV !== "production";
  if (action === "test-esign") {
    // Real signing is /api/orders/[id]/esign (OTP-bound, hashed). This shortcut exists only for scripted tests.
    if (!testOnly) throw new HttpError(403, "USE_ESIGN");
    await recordSignature(o.id, { signedAt: Date.now(), method: "sms-otp", docHash: "test", signedHash: "test", signerPhoneMasked: "test", ip: "test" });
  } else if (action === "pay") {
    // Real payments go through /api/orders/[id]/razorpay (signature-verified). This outcome-picker exists ONLY for scripted tests
    // (ALLOW_TEST_VERIFY=1, never in production) — otherwise anyone could mark their own order paid.
    if (!testOnly) throw new HttpError(403, "USE_RAZORPAY");
    if (!o.esign) throw new HttpError(409, "ESIGN_REQUIRED");
    if (o.payment.status === "success") throw new HttpError(409, "ALREADY_PAID");
    await pay(o.id, mockPayments.outcome(b.outcome ?? "success"));
  } else if (action === "chase") {
    if (!o.stage) throw new HttpError(409, "ORDER_NOT_PLACED");
    await chase(o.id);
  } else throw new HttpError(404, "UNKNOWN_ACTION");
  return ok(await orderView((await getOrder(o.id))!));
});
