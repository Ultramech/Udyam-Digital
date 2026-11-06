import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { signInWithVerifiedPhone } from "@/lib/accounts/signin";
import { confirmOtp, requestOtp } from "@/lib/otp/flow";
import { cleanPhone, isValidIndianMobile } from "@/lib/services";

/** Login OTP (real SMS via 2Factor.in). See lib/otp/flow.ts for the guarantees: fail-closed, single-use, rate-limited, purpose-bound. */
export const POST = route(async (req: Request) => {
  const { phone: raw } = await parseBody(req, z.object({ phone: z.string().min(10).max(16) }));
  if (!isValidIndianMobile(raw)) throw new HttpError(400, "INVALID_PHONE");
  return ok({ sent: true, otpId: await requestOtp(cleanPhone(raw), "login") });
});

export const PUT = route(async (req: Request) => {
  const { otpId, code } = await parseBody(req, z.object({ otpId: z.string().min(4).max(40), code: z.string().regex(/^\d{4,8}$/) }));
  const { phone } = await confirmOtp(otpId, code, "login");
  return ok(await signInWithVerifiedPhone(phone));
});
