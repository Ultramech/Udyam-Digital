import { route } from "@/lib/api";
import { get } from "@/lib/db/store";
import { accountRecords, listBusinesses, listUserSessions, requireUser } from "@/lib/accounts/users";
import type { ConsentRecord, KycCase } from "@/lib/store/types";

/**
 * DPDP right of access: everything we hold about the signed-in owner, as a JSON download. It is their own data, so identifiers are
 * included in full here (they are masked everywhere else). Uploaded images are not included because they are never stored.
 */
export const GET = route(async () => {
  const u = await requireUser();
  const [bs, sessions, rec] = await Promise.all([listBusinesses(u.id), listUserSessions(u.id), accountRecords(u.id)]);
  const consents: ConsentRecord[] = [];
  const kyc: Omit<KycCase, "docs">[] = [];
  for (const q of rec.quotes) {
    if (q.consentId) { const c = await get<ConsentRecord>("consent", q.consentId); if (c) consents.push(c); }
    if (q.kycId) { const k = await get<KycCase>("kyc", q.kycId); if (k) { const { docs, ...rest } = k; kyc.push({ ...rest, extractedFields: Object.fromEntries(Object.entries(docs).map(([s, d]) => [s, d?.fields])) } as never); } }
  }
  const body = {
    exportedAt: new Date().toISOString(),
    note: "Your data held by Udyam Digital (prototype). Document images are never stored, so only the fields read from them appear.",
    profile: { ...u, sessionId: undefined },
    businesses: bs, devices: sessions, quotes: rec.quotes, orders: rec.orders.map(({ token: _t, ...o }) => (void _t, o)), supportRequests: rec.tickets.map(({ token: _t, ...t }) => (void _t, t)),
    consents, kyc,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="my-data-${u.id}.json"`, "cache-control": "no-store" } });
});
