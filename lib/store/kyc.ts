import "server-only";
import { fingerprintChecks } from "@/lib/kyc/anomaly";
import { get, newId, put } from "@/lib/db/store";
import { HttpError } from "@/lib/api";
import { registryLookups } from "@/lib/kyc/registry";
import { runKyc } from "@/lib/kyc/validate";
import { effectiveKycStatus } from "@/lib/kyc/effective";
import { REFERENCE_DATE } from "@/lib/config";
import type { ConsentRecord, KycCase, Quote } from "./types";
import { getQuote, saveQuote } from "./quotes";
import { getUser } from "@/lib/accounts/users";

export const getKyc = (id: string) => get<KycCase>("kyc", id);

/** Purpose limitation in code: no KYC lookup, upload or extraction happens without a recorded KYC consent. */
export async function requireKycConsent(q: Quote) {
  const c = q.consentId ? await get<ConsentRecord>("consent", q.consentId) : null;
  if (!c || !c.purposes.kyc) throw new HttpError(403, "KYC_CONSENT_REQUIRED");
  return c;
}

export async function kycFor(quote: Quote): Promise<KycCase> {
  const existing = quote.kycId ? await getKyc(quote.kycId) : null;
  if (existing) return existing;
  const k: KycCase = {
    id: newId("KY"), quoteId: quote.id, entered: {}, claimsUdyam: !!quote.profile.udyam?.has, docs: {}, status: "reupload", checks: [], gstEligible: false,
    neededSlots: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
  quote.kycId = k.id;
  await saveQuote(quote);
  await put("kyc", k.id, k);
  return k;
}

/** Re-runs every check from the current inputs, then mirrors the registry result onto the quote's GST status. */
export async function recompute(k: KycCase): Promise<KycCase> {
  const q = await getQuote(k.quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const s0 = q.sites[0];
  const siteAddress = k.entered.siteAddress ?? (s0?.address ? (s0.pincode && !s0.address.includes(s0.pincode) ? `${s0.address} - ${s0.pincode}` : s0.address) : undefined);
  // Compare the ID's name with the account holder only when that is meaningful: the person who placed the order is the owner or a director.
  // (A manager or accountant ordering for the business, or the demo placeholder name, would only cause false alarms.)
  const u = q.userId ? await getUser(q.userId) : null;
  const holderName = u && (u.profileType === "owner" || u.profileType === "director") && u.name && u.name !== "Demo User" ? u.name : null;
  const r = runKyc({
    today: REFERENCE_DATE, entered: { ...k.entered, siteAddress }, claimsUdyam: k.claimsUdyam, holderName,
    docs: k.docs, lookups: registryLookups(),
  });
  k.checks = [...r.checks, ...fingerprintChecks(k.docs)];
  k.gstEligible = r.gstEligible;
  k.neededSlots = r.neededSlots;
  k.gstinUsed = r.gstinUsed;
  k.gstName = r.gst?.trade_name;
  k.gstStatus = r.gst?.status;
  k.udyamName = r.udyam?.enterprise_name;
  k.status = effectiveKycStatus(k.checks, { requeued: k.requeued, decision: k.review?.decision }) as KycCase["status"];
  k.updatedAt = Date.now();
  await put("kyc", k.id, k);
  // mirror GST status onto the quote so eligibility reflects the registry (Cancelled/Suspended removes GST products at re-quote)
  if (r.gst) {
    q.profile = { ...q.profile, gstin: { has: true, verified: true, status: r.gst.status } };
    await saveQuote(q);
  }
  return k;
}
