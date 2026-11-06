import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { HttpError, ok, route } from "@/lib/api";
import { demoMode } from "@/lib/auth";
import { limit } from "@/lib/accounts/rateLimit";
import { signInWithVerifiedPhone } from "@/lib/accounts/signin";
import { addLocation, createBusiness, updateProfile } from "@/lib/accounts/users";

/**
 * One-click demo sign-in for judges and visitors: no SMS code. Each click gets its own fresh account with a sample business
 * profile already filled in, so it lands straight on Home and no two visitors see each other's quotes or orders.
 * Refused when DEMO_MODE=false; rate-limited per IP so it can't be used to flood the database.
 */
export const POST = route(async () => {
  if (!demoMode()) throw new HttpError(403, "DEMO_ONLY");
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  await limit(`demo-signin:${ip}`, 20, 60 * 60 * 1000);

  const phone = `9${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;
  const { user } = await signInWithVerifiedPhone(phone);
  if (!user.onboarded) {
    await updateProfile(user.id, { name: "Demo User", profileType: "owner", email: null, onboardedAt: Date.now() });
    const businessId = await createBusiness(user.id, { name: "Sharma Medical", businessType: "Pharmacy", city: "Indore", employees: 3, sites: 1, gstin: null, udyam: null });
    await addLocation(user.id, businessId, { label: null, address: "Shop 4, MG Road, Rajwada", pincode: "452001" });
  }
  return ok({ ok: true });
});
