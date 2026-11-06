import { get, list } from "@/lib/db/store";
import { ok, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { currentUser, signOutUser } from "@/lib/accounts/users";
import { eraseEverything } from "@/lib/accounts/erase";
import type { ConsentRecord, Quote } from "@/lib/store/types";

/** DPDP rights in practice. GET = what we hold about this visitor (masked). DELETE = erase it. */
export const GET = route(async () => {
  const sid = await sessionId();
  const quotes = sid ? (await list<Quote>("quote")).filter((q) => q.sessionId === sid) : [];
  const out = await Promise.all(quotes.map(async (q) => {
    const consent = q.consentId ? await get<ConsentRecord>("consent", q.consentId) : null;
    return { quoteId: q.id, bundleId: q.bundleId, createdAt: q.createdAt, orderId: q.orderId ?? null, consent: consent ? { id: consent.id, at: consent.at, purposes: consent.purposes, version: consent.noticeVersion } : null };
  }));
  return ok({ quotes: out });
});

/**
 * Erases the visitor's conversation, quote, KYC case (extracted fields + documents) and consent record, and detaches their lead.
 * Orders are contractual records and are retained in an anonymised form — stated to the user in the UI.
 */
export const DELETE = route(async () => {
  const sid = await sessionId();
  const user = await currentUser();
  if (!sid && !user) return ok({ deleted: 0 });
  if (user) await signOutUser();
  return ok(await eraseEverything({ sessionId: sid, userId: user?.id }));
});
