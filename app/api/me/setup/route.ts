import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { addLocation, createBusiness, requireUser, updateProfile } from "@/lib/accounts/users";
import { gstinState, OTHER, setupErrors } from "@/lib/accounts/profileRules";
import { verifyPincode } from "@/lib/feasibility";
import { canonicalCity } from "@/lib/rules/normalise";

/**
 * Profile setup — required once, right after the first OTP sign-in, before anything else in the app works
 * (see lib/accounts/guard.ts). Every field is validated with the same rules the form uses (lib/accounts/profileRules.ts),
 * and the pincode against the India Post directory. Errors come back per field: 422 { errors: { field: CODE } }.
 */
const Body = z.object({
  name: z.string().max(120), profileType: z.string().max(20), email: z.string().max(200).default(""), lang: z.enum(["en", "hi", "mr", "ta"]).optional(),
  business: z.object({
    name: z.string().max(120), type: z.string().max(80), typeOther: z.string().max(80).default(""), city: z.string().max(60), cityOther: z.string().max(60).default(""),
    employees: z.string().max(6), sites: z.string().max(4), address: z.string().max(240), pincode: z.string().max(6),
    gstin: z.string().max(20).default(""), udyam: z.string().max(25).default(""),
  }),
});

export const POST = route(async (req: Request) => {
  const u = await requireUser(); // phone already proved by OTP; setup itself is what unlocks the rest
  const b = await parseBody(req, Body);
  const errors: Record<string, string> = { ...setupErrors(b) } as Record<string, string>;
  const warnings: Record<string, string> = {};
  const biz = b.business;
  const city = biz.city === OTHER ? biz.cityOther.trim() : canonicalCity(biz.city) ?? biz.city;

  if (!errors["business.pincode"]) {
    const pin = await verifyPincode(biz.pincode);
    if (pin.status === "not_found") errors["business.pincode"] = "PINCODE_NOT_FOUND";
    else if (pin.status === "found") {
      const c = city.toLowerCase().slice(0, 5);
      if (c && !`${pin.district} ${pin.state}`.toLowerCase().includes(c)) warnings["business.pincode"] = "PINCODE_CITY_MISMATCH"; // district names vary (Bengaluru Urban, Mumbai Suburban) — warn, don't block
      const gst = biz.gstin.trim() ? gstinState(biz.gstin.toUpperCase()) : null;
      if (gst && gst.toLowerCase() !== pin.state.toLowerCase()) warnings["business.gstin"] = "GSTIN_STATE_MISMATCH";
    }
    // "unknown" (India Post unreachable): accepted; the location check at order time looks it up again
  }
  if (Object.keys(errors).length) throw new HttpError(422, "INVALID_PROFILE", { errors });

  await updateProfile(u.id, { name: b.name.trim().replace(/\s+/g, " "), profileType: b.profileType as "owner", email: b.email.trim() || null, lang: b.lang ?? u.lang, onboardedAt: Date.now() });
  const businessId = await createBusiness(u.id, {
    name: biz.name.trim().replace(/\s+/g, " "), businessType: biz.type === OTHER ? biz.typeOther.trim() : biz.type, city,
    employees: Number(biz.employees), sites: Number(biz.sites), gstin: biz.gstin.trim().toUpperCase() || null, udyam: biz.udyam.trim().toUpperCase() || null,
  });
  await addLocation(u.id, businessId, { label: Number(biz.sites) > 1 ? "Main location" : null, address: biz.address.trim().replace(/\s+/g, " "), pincode: biz.pincode });
  return ok({ ok: true, businessId, warnings });
});
