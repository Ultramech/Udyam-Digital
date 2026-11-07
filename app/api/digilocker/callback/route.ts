import { del, get } from "@/lib/db/store";
import { sessionId } from "@/lib/auth";
import { HttpError } from "@/lib/api";
import { getQuote } from "@/lib/store/quotes";
import { kycFor, recompute } from "@/lib/store/kyc";
import { getOrder, setKycStatus } from "@/lib/store/orders";
import { readOrFail } from "@/lib/kyc/ocr";
import { exchangeCode, fetchFile, listIssued, pickFor } from "@/lib/digilocker/client";
import { fetchDocument, sessionStatus, type Locker } from "@/lib/digilocker/aggregator";
import { aadhaarAsDocument, readDigilockerAadhaarXml } from "@/lib/kyc/aadhaar";
import type { Slot } from "@/lib/kyc/types";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

/**
 * DigiLocker redirect target. State is single-use, 10-minute, and bound to the browser session that started it. The access token is
 * used once and discarded (never stored); only the one document needed for the requested slot is fetched (data minimisation).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const state = u.searchParams.get("state") ?? u.searchParams.get("s") ?? ""; // `state` from direct OAuth, `s` from the licensed provider's redirect
  const saved = state ? await get<{ quoteId: string; slot: Slot; verifier: string; sid: string; at: number; provider?: "aggregator"; locker?: Locker; docType?: string; sessionId?: string }>("oauth", state) : null;
  if (saved) await del("oauth", state);
  const back = (quoteId: string, result: string) => Response.redirect(new URL(`/order/${quoteId}/kyc?digilocker=${result}`, u.origin), 302);
  if (!saved || Date.now() - saved.at > 10 * 60_000 || saved.sid !== (await sessionId())) return new Response("This DigiLocker link has expired. Please start again.", { status: 400 });
  if (saved.provider === "aggregator") return viaProvider(saved, back);
  if (u.searchParams.get("error") || !u.searchParams.get("code")) return back(saved.quoteId, "declined");
  try {
    const token = await exchangeCode(u.searchParams.get("code")!, saved.verifier);
    const doc = pickFor(saved.slot, await listIssued(token));
    if (!doc) return back(saved.quoteId, "none");
    const file = await fetchFile(token, doc.uri);
    const q = await getQuote(saved.quoteId);
    if (!q) return back(saved.quoteId, "error");
    let k = await kycFor(q);
    k.docs[saved.slot] = { ...(await readOrFail(saved.slot, file.buf, file.mime, HttpError)), source: "digilocker" };
    k = await recompute(k);
    if (q.orderId) { const o = await getOrder(q.orderId); if (o) await setKycStatus(o.id, k.status === "blocked" ? "reupload" : (k.status as never)); }
    return back(saved.quoteId, "ok");
  } catch {
    return back(saved.quoteId, "error");
  }
}

/** Licensed-provider flow: the provider already holds the owner's consent; we ask it what was shared and take only the one document for this slot. */
async function viaProvider(saved: { quoteId: string; slot: Slot; locker?: Locker; docType?: string; sessionId?: string }, back: (q: string, r: string) => Response): Promise<Response> {
  try {
    const st = await sessionStatus(saved.locker!, saved.sessionId!);
    if (st.status === "failed" || st.status === "expired") return back(saved.quoteId, "declined");
    if (st.status !== "succeeded") return back(saved.quoteId, "declined"); // the owner came back without finishing consent
    const file = await fetchDocument(saved.locker!, saved.sessionId!, saved.docType!);
    if (!file) return back(saved.quoteId, "none");
    const q = await getQuote(saved.quoteId);
    if (!q) return back(saved.quoteId, "error");
    let k = await kycFor(q);
    if (saved.locker === "digilocker") {
      // the Aadhaar arrives as XML: keep name, address and the last four digits only
      if (!/xml/i.test(file.mime) && !file.buf.subarray(0, 64).toString("utf8").trimStart().startsWith("<")) return back(saved.quoteId, "none");
      const a = readDigilockerAadhaarXml(file.buf.toString("utf8"));
      k.docs[saved.slot] = aadhaarAsDocument(saved.slot as "signatory_id" | "address_proof", a, "digilocker_aadhaar");
      // the same consented Aadhaar also answers an address proof that is still outstanding (one trip to DigiLocker, not two)
      if (saved.slot === "signatory_id" && k.neededSlots.includes("address_proof") && !k.docs.address_proof) k.docs.address_proof = aadhaarAsDocument("address_proof", a, "digilocker_aadhaar");
    } else {
      k.docs[saved.slot] = { ...(await readOrFail(saved.slot, file.buf, file.mime, HttpError)), source: "digilocker" };
    }
    k = await recompute(k);
    if (q.orderId) { const o = await getOrder(q.orderId); if (o) await setKycStatus(o.id, k.status === "blocked" ? "reupload" : (k.status as never)); }
    return back(saved.quoteId, "ok");
  } catch {
    return back(saved.quoteId, "error");
  }
}
