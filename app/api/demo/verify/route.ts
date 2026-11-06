import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { signInWithVerifiedPhone } from "@/lib/accounts/signin";

/**
 * AUTOMATED-TEST SEAM ONLY (scripts/journey-check.ts). Marks a session verified without SMS so the API journey can be scripted.
 * Disabled unless ALLOW_TEST_VERIFY=1 AND not a production build. The real flow is POST+PUT /api/otp (2Factor SMS).
 */
export const POST = route(async (req: Request) => {
  if (process.env.ALLOW_TEST_VERIFY !== "1" || process.env.NODE_ENV === "production") throw new HttpError(403, "TEST_ONLY");
  const { phone } = await parseBody(req, z.object({ phone: z.string().regex(/^[6-9]\d{9}$/) }));
  return ok(await signInWithVerifiedPhone(phone)); // same account path as a real OTP — only the SMS round-trip is skipped
});
