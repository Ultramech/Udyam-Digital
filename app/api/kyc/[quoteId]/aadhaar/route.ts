import { HttpError, ok, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { getQuote } from "@/lib/store/quotes";
import { kycFor, recompute, requireKycConsent } from "@/lib/store/kyc";
import { kycView } from "@/lib/store/kycView";
import { limit } from "@/lib/accounts/rateLimit";
import { AADHAAR_MAX_BYTES, AadhaarError, aadhaarAsDocument, readAadhaarOffline } from "@/lib/kyc/aadhaar";

/**
 * Aadhaar Paperless Offline e-KYC: the owner uploads the ZIP they downloaded from myaadhaar.uidai.gov.in plus the share phrase they chose.
 * Verified locally against UIDAI's published key (lib/kyc/aadhaar.ts). The ZIP, XML and phrase live in memory for this request only;
 * the photo and hashed mobile/email are dropped, and only name, address and the last four digits are kept.
 */
export const maxDuration = 30;

const SLOTS = ["signatory_id", "address_proof"] as const;

export const POST = route(async (req: Request, { params }: { params: Promise<{ quoteId: string }> }) => {
  const q = await ownedQuote((await params).quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  await requireKycConsent(q);
  await limit(`aadhaar:${q.id}`, 15, 60 * 60 * 1000); // a share phrase is the owner's own; this only stops guessing at someone else's file
  const form = await req.formData();
  const slot = String(form.get("slot") ?? "") as (typeof SLOTS)[number];
  const phrase = String(form.get("phrase") ?? "");
  const file = form.get("file");
  if (!SLOTS.includes(slot)) throw new HttpError(400, "INVALID_SLOT");
  if (!(file instanceof File)) throw new HttpError(400, "FILE_REQUIRED");
  if (file.size > AADHAAR_MAX_BYTES) throw new HttpError(413, "FILE_TOO_LARGE");
  const buf = Buffer.from(await file.arrayBuffer());
  let a;
  try { a = await readAadhaarOffline(buf, phrase); }
  catch (e) { if (e instanceof AadhaarError) throw new HttpError(422, `AADHAAR_${e.code}`); throw e; }
  const k = await kycFor(q);
  k.docs[slot] = aadhaarAsDocument(slot, a);
  await recompute(k);
  return ok({ kyc: kycView(await kycFor((await getQuote(q.id))!)) });
});
