/**
 * DPDP "right to erasure" in one place. Erases what we hold about a visitor session and, when signed in, the whole account:
 * conversations, quotes, KYC cases (+ their file fingerprints), consent records, support requests, sessions, businesses,
 * locations and the user row. Orders are contractual records and are kept ANONYMISED (no phone, no name, no user link) —
 * the UI says so before the owner confirms.
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { del, get, listBy, orm, put } from "@/lib/db/store";
import { businessLocations, businesses, userSessions, users } from "@/lib/db/schema";
import type { Conversation, KycCase, Order, Quote, Ticket } from "@/lib/store/types";

async function forgetKyc(kycId: string) {
  const k = await get<KycCase>("kyc", kycId);
  for (const d of Object.values(k?.docs ?? {})) {
    if (!d?.fileHash) continue;
    const idx = await get<{ cases: string[] }>("kyc_file", d.fileHash);
    if (!idx) continue;
    const rest = idx.cases.filter((c) => c !== kycId);
    if (rest.length) await put("kyc_file", d.fileHash, { cases: rest }); else await del("kyc_file", d.fileHash);
  }
  await del("kyc", kycId);
}

async function eraseQuote(q: Quote): Promise<number> {
  let n = 0;
  if (q.kycId) { await forgetKyc(q.kycId); n++; }
  if (q.consentId) { await del("consent", q.consentId); n++; }
  if (q.orderId) await anonymiseOrder(q.orderId);
  await del("quote", q.id);
  return n + 1;
}

export async function anonymiseOrder(orderId: string) {
  const o = await get<Order>("order", orderId);
  if (!o || o.businessName === "[erased]") return;
  await put("order", o.id, { ...o, phone: undefined, businessName: "[erased]", userId: undefined, businessId: undefined, sites: o.sites.map((s) => ({ ...s, address: "[erased]" })) });
}

export async function eraseEverything(opts: { sessionId?: string; userId?: string }): Promise<{ deleted: number }> {
  let n = 0;
  const seen = new Set<string>();
  const each = async <T extends { id: string }>(kind: "quote" | "conversation" | "ticket", col: "session_id" | "user_id", v: string | undefined, fn: (x: T) => Promise<number | void>) => {
    if (!v) return;
    for (const x of await listBy<T>(kind, col, v, { limit: 2000 })) { if (seen.has(x.id)) continue; seen.add(x.id); n += (await fn(x)) || 1; }
  };
  for (const col of ["session_id", "user_id"] as const) {
    const v = col === "session_id" ? opts.sessionId : opts.userId;
    await each<Quote>("quote", col, v, eraseQuote);
    await each<Conversation>("conversation", col, v, async (c) => { await del("conversation", c.id); });
    await each<Ticket>("ticket", col, v, async (t) => { await del("ticket", t.id); });
  }
  if (opts.userId) {
    for (const o of await listBy<Order>("order", "user_id", opts.userId, { limit: 2000 })) await anonymiseOrder(o.id);
    // explicit, child-first: SQLite only cascades when PRAGMA foreign_keys is on for that connection, which can't be
    // relied on over Turso's stateless HTTP connections — so erasure never depends on it
    const d = await orm();
    const bizIds = (await d.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerUserId, opts.userId))).map((b) => b.id);
    if (bizIds.length) await d.delete(businessLocations).where(inArray(businessLocations.businessId, bizIds));
    await d.delete(businesses).where(eq(businesses.ownerUserId, opts.userId));
    await d.delete(userSessions).where(eq(userSessions.userId, opts.userId));
    await d.delete(users).where(eq(users.id, opts.userId));
    n++;
  }
  if (opts.sessionId) await del("session", opts.sessionId);
  return { deleted: n };
}
