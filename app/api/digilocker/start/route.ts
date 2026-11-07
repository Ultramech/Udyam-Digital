import { HttpError, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { get, put } from "@/lib/db/store";
import { sessionId } from "@/lib/auth";
import { SLOTS } from "@/lib/kyc/types";
import { authorizeUrl, digilockerConfigured, directConfigured, pkce } from "@/lib/digilocker/client";
import { SLOT_SOURCE, aggregatorConfigured, startSession, type SlotWithLocker } from "@/lib/digilocker/aggregator";
import { publicBaseUrl } from "@/lib/channels/twilio";
import type { ConsentRecord } from "@/lib/store/types";

/** Starts the DigiLocker consent flow for one KYC slot. Requires the optional "DigiLocker" consent purpose (OFF by default). */
export const GET = route(async (req: Request) => {
  if (!digilockerConfigured()) throw new HttpError(503, "DIGILOCKER_NOT_CONFIGURED");
  const u = new URL(req.url);
  const quoteId = u.searchParams.get("quoteId") ?? "", slot = u.searchParams.get("slot") ?? "";
  if (!(SLOTS as string[]).includes(slot)) throw new HttpError(400, "BAD_SLOT");
  const q = await ownedQuote(quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const c = q.consentId ? await get<ConsentRecord>("consent", q.consentId) : null;
  if (!c?.purposes.kyc || !c.purposes.digilocker) throw new HttpError(403, "DIGILOCKER_CONSENT_REQUIRED");
  const sid = await sessionId();
  if (!sid || (q.sessionId && q.sessionId !== sid)) throw new HttpError(403, "SESSION_MISMATCH");
  const p = pkce();
  if (!directConfigured() && aggregatorConfigured()) {
    // licensed provider: DigiLocker needs a public HTTPS page to send the owner back to
    const origin = publicBaseUrl();
    if (!origin || !origin.startsWith("https://")) throw new HttpError(503, "DIGILOCKER_NEEDS_PUBLIC_HTTPS");
    const src = SLOT_SOURCE[slot as SlotWithLocker];
    const s = await startSession(src.locker, `${origin}/api/digilocker/callback?s=${p.state}`);
    await put("oauth", p.state, { quoteId, slot, provider: "aggregator", locker: src.locker, docType: src.docType, sessionId: s.sessionId, sid, at: Date.now() });
    return Response.redirect(s.url, 302);
  }
  await put("oauth", p.state, { quoteId, slot, verifier: p.verifier, sid, at: Date.now() });
  return Response.redirect(authorizeUrl(p.state, p.challenge), 302);
});
