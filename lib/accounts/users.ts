/**
 * Customer accounts.
 *
 * Identity is a mobile number proved by SMS OTP (no passwords for owners). Signing in creates a `user_sessions` row; the browser
 * holds a random 32-char token in an httpOnly cookie and the database keeps only its SHA-256. Sessions last 30 days, can be
 * listed and revoked ("sign out other devices"), and are revoked on account deletion.
 *
 * The anonymous visitor session (cookie `ud_sid`) still carries the journey before login; on sign-in it is linked to the user and
 * everything it created (conversations, quotes, their orders, support requests) is claimed by the account, so the owner sees it
 * on any device afterwards.
 */
import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { HttpError } from "@/lib/api";
import { get, listBy, newId, newSecret, orm, put } from "@/lib/db/store";
import { businessLocations, businesses, userSessions, users } from "@/lib/db/schema";
import { deriveSegment } from "@/lib/rules/normalise";
import type { Conversation, KycCase, Order, Quote, Session, Ticket } from "@/lib/store/types";
import { hashToken } from "./crypto";

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type BusinessLocation = typeof businessLocations.$inferSelect;

const AUTH = "ud_auth";
const TTL_MS = 30 * 86_400_000;
const SEEN_EVERY_MS = 60 * 60_000;
export const secureCookies = () => process.env.NODE_ENV === "production";

async function requestMeta() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
  return { userAgent: (h.get("user-agent") ?? "").slice(0, 200) || null, ipPrefix: ip ? ip.split(/[.:]/).slice(0, 2).join(ip.includes(":") ? ":" : ".") : null };
}

// ---- users ---------------------------------------------------------------------------------------------------------
export async function findOrCreateUser(phone: string, lang = "en"): Promise<User> {
  const d = await orm();
  const now = Date.now();
  const existing = await d.query.users.findFirst({ where: eq(users.phone, phone) });
  if (existing) {
    await d.update(users).set({ lastLoginAt: now, phoneVerifiedAt: now, updatedAt: now }).where(eq(users.id, existing.id));
    return { ...existing, lastLoginAt: now, phoneVerifiedAt: now };
  }
  const u = { id: newId("U"), phone, lang, phoneVerifiedAt: now, lastLoginAt: now };
  await d.insert(users).values(u).onConflictDoNothing();
  return (await d.query.users.findFirst({ where: eq(users.phone, phone) }))!;
}

export async function getUser(id: string) { return (await orm()).query.users.findFirst({ where: eq(users.id, id) }); }

export async function updateProfile(id: string, patch: Partial<Pick<User, "name" | "email" | "lang" | "profileType" | "onboardedAt" | "notifyWhatsapp" | "notifySms" | "notifyEmail" | "marketingOptIn">>) {
  const d = await orm();
  await d.update(users).set({ ...patch, updatedAt: Date.now() }).where(eq(users.id, id));
  return getUser(id);
}

// ---- sessions ------------------------------------------------------------------------------------------------------
export async function startUserSession(userId: string): Promise<void> {
  const token = newSecret();
  const meta = await requestMeta();
  const now = Date.now();
  await (await orm()).insert(userSessions).values({ id: newId("US"), userId, tokenHash: hashToken(token), ...meta, createdAt: now, lastSeenAt: now, expiresAt: now + TTL_MS });
  (await cookies()).set(AUTH, token, { httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", maxAge: TTL_MS / 1000 });
}

/** The signed-in owner, or null. Expired/revoked sessions count as signed out. */
export async function currentUser(): Promise<(User & { sessionId: string }) | null> {
  const token = (await cookies()).get(AUTH)?.value;
  if (!token) return null;
  const d = await orm();
  const now = Date.now();
  const s = await d.query.userSessions.findFirst({ where: and(eq(userSessions.tokenHash, hashToken(token)), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now)) });
  if (!s) return null;
  const u = await getUser(s.userId);
  if (!u) return null;
  if (now - s.lastSeenAt > SEEN_EVERY_MS) await d.update(userSessions).set({ lastSeenAt: now }).where(eq(userSessions.id, s.id));
  return { ...u, sessionId: s.id };
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "SIGN_IN_REQUIRED");
  return u;
}

export async function listUserSessions(userId: string) {
  const d = await orm();
  return d.select({ id: userSessions.id, userAgent: userSessions.userAgent, ipPrefix: userSessions.ipPrefix, createdAt: userSessions.createdAt, lastSeenAt: userSessions.lastSeenAt, expiresAt: userSessions.expiresAt })
    .from(userSessions).where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, Date.now()))).orderBy(desc(userSessions.lastSeenAt));
}

/** Revoke one session (or all of a user's sessions except `keep`). */
export async function revokeUserSessions(userId: string, opts: { id?: string; exceptId?: string } = {}) {
  const d = await orm();
  const all = await listUserSessions(userId);
  for (const s of all) if ((opts.id ? s.id === opts.id : true) && s.id !== opts.exceptId) await d.update(userSessions).set({ revokedAt: Date.now() }).where(eq(userSessions.id, s.id));
}

export async function signOutUser() {
  const u = await currentUser();
  if (u) await revokeUserSessions(u.id, { id: u.sessionId });
  const c = await cookies();
  c.delete(AUTH);
  // the visitor session on this device is no longer verified either
  const sid = c.get("ud_sid")?.value;
  const s = sid ? await get<Session>("session", sid) : null;
  if (s) await put("session", s.id, { ...s, verified: false, phone: undefined, userId: undefined });
}

// ---- visitor → account -------------------------------------------------------------------------------------------
/** Marks the device's visitor session as this user's and claims everything it created. Idempotent. */
export async function linkVisitor(visitorId: string, user: Pick<User, "id" | "phone" | "lang">): Promise<{ claimed: number }> {
  const cur = await get<Session>("session", visitorId);
  await put("session", visitorId, { ...(cur ?? { id: visitorId, lang: user.lang, attribution: {}, createdAt: Date.now() }), id: visitorId, verified: true, phone: user.phone, userId: user.id } as Session);
  let claimed = 0;
  for (const c of await listBy<Conversation & { userId?: string }>("conversation", "session_id", visitorId)) if (!c.userId) { await put("conversation", c.id, { ...c, userId: user.id }); claimed++; }
  for (const t of await listBy<Ticket & { userId?: string }>("ticket", "session_id", visitorId)) if (!t.userId) { await put("ticket", t.id, { ...t, userId: user.id }); claimed++; }
  for (const q of await listBy<Quote>("quote", "session_id", visitorId)) {
    if (!q.userId) { await put("quote", q.id, { ...q, userId: user.id }); claimed++; }
    if (q.orderId) { const o = await get<Order>("order", q.orderId); if (o && !o.userId) { await put("order", o.id, { ...o, userId: user.id }); claimed++; } }
  }
  return { claimed };
}

/** If this browser holds a valid account cookie, make sure its visitor session is linked (e.g. after the 7-day visitor cookie expired). */
export async function syncVisitorWithAccount(visitorId: string | undefined): Promise<User | null> {
  const u = await currentUser();
  if (!u || !visitorId) return u;
  const s = await get<Session>("session", visitorId);
  if (!s || !s.verified || s.userId !== u.id || s.phone !== u.phone) await linkVisitor(visitorId, u);
  return u;
}

// ---- businesses ----------------------------------------------------------------------------------------------------
export async function listBusinesses(userId: string) {
  const d = await orm();
  const bs = await d.query.businesses.findMany({ where: eq(businesses.ownerUserId, userId), orderBy: desc(businesses.updatedAt) });
  const locs = bs.length ? await d.select().from(businessLocations) : [];
  return bs.map((b) => ({ ...b, locations: locs.filter((l) => l.businessId === b.id) }));
}

export async function getOwnedBusiness(userId: string, id: string) {
  const b = await (await orm()).query.businesses.findFirst({ where: and(eq(businesses.id, id), eq(businesses.ownerUserId, userId)) });
  if (!b) throw new HttpError(404, "BUSINESS_NOT_FOUND");
  return b;
}

export async function createBusiness(userId: string, v: { name: string; businessType?: string | null; city?: string | null; employees?: number | null; sites?: number | null; gstin?: string | null; udyam?: string | null }) {
  const id = newId("B");
  const segment = v.employees ? deriveSegment({ businessType: v.businessType ?? undefined, employees: v.employees, sites: v.sites ?? 1 }) : null;
  // gstin/udyam entered by the owner are stored UNVERIFIED (verifiedAt stays null) until KYC checks them against the registries
  await (await orm()).insert(businesses).values({ id, ownerUserId: userId, name: v.name, businessType: v.businessType ?? null, city: v.city ?? null, employees: v.employees ?? null, sites: v.sites ?? null, segment, gstin: v.gstin ?? null, udyam: v.udyam ?? null });
  return id;
}

export async function updateBusiness(userId: string, id: string, v: Partial<{ name: string; businessType: string | null; city: string | null; employees: number | null; sites: number | null }>) {
  await getOwnedBusiness(userId, id);
  await (await orm()).update(businesses).set({ ...v, updatedAt: Date.now() }).where(eq(businesses.id, id));
}

export async function addLocation(userId: string, businessId: string, v: { label?: string | null; address: string; pincode?: string | null }) {
  await getOwnedBusiness(userId, businessId);
  const id = newId("L");
  await (await orm()).insert(businessLocations).values({ id, businessId, label: v.label ?? null, address: v.address, pincode: v.pincode ?? null });
  return id;
}

export async function removeLocation(userId: string, businessId: string, locationId: string) {
  await getOwnedBusiness(userId, businessId);
  await (await orm()).delete(businessLocations).where(and(eq(businessLocations.id, locationId), eq(businessLocations.businessId, businessId)));
}

/**
 * After an order is placed: file it under the right business (same verified GSTIN, else same name), creating the business and its
 * service locations if new, and record registry-verified identifiers from KYC.
 */
export async function attachOrderToBusiness(userId: string, order: Order, kyc: KycCase | null): Promise<string> {
  const d = await orm();
  const gstin = kyc?.gstinUsed && kyc.gstStatus ? kyc.gstinUsed : null;
  const mine = await d.query.businesses.findMany({ where: eq(businesses.ownerUserId, userId) });
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  let b = mine.find((x) => gstin && x.gstin === gstin) ?? mine.find((x) => norm(x.name) === norm(order.businessName));
  const p = order.profile;
  const facts = { businessType: p.businessType ?? null, city: p.city, employees: p.employees, sites: p.sites, segment: deriveSegment(p) };
  const verified = gstin ? { gstin, gstStatus: kyc!.gstStatus ?? null, verifiedAt: Date.now() } : {};
  const udyam = kyc?.udyamName && kyc.entered.udyam ? { udyam: kyc.entered.udyam } : {};
  if (!b) {
    const id = newId("B");
    await d.insert(businesses).values({ id, ownerUserId: userId, name: order.businessName, ...facts, ...verified, ...udyam });
    b = (await d.query.businesses.findFirst({ where: eq(businesses.id, id) }))!;
  } else await d.update(businesses).set({ ...facts, ...verified, ...udyam, updatedAt: Date.now() }).where(eq(businesses.id, b.id));
  const existing = await d.select().from(businessLocations).where(eq(businessLocations.businessId, b.id));
  for (const s of order.sites) {
    if (!s.address || existing.some((l) => norm(l.address) === norm(s.address) && l.pincode === s.pincode)) continue;
    await d.insert(businessLocations).values({ id: newId("L"), businessId: b.id, label: order.sites.length > 1 ? `Location ${s.index + 1}` : null, address: s.address, pincode: s.pincode || null, fibreFeasible: s.fibreFeasible ?? null });
  }
  return b.id;
}

/** Everything an owner's account holds, server-side (works on any device they sign in from). */
export async function accountRecords(userId: string) {
  const [orders, quotes, tickets] = await Promise.all([
    listBy<Order>("order", "user_id", userId, { limit: 200 }),
    listBy<Quote>("quote", "user_id", userId, { limit: 200 }),
    listBy<Ticket>("ticket", "user_id", userId, { limit: 200 }),
  ]);
  return { orders, quotes, tickets };
}
