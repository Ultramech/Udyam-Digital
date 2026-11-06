import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { maskGstin } from "@/lib/kyc/identifiers";
import { accountRecords, listBusinesses, listUserSessions, requireUser, signOutUser, updateProfile } from "@/lib/accounts/users";
import { eraseEverything } from "@/lib/accounts/erase";
import { bundleName } from "@/lib/i18n/bundles";

const mask = (p: string) => p.replace(/^(\d{2})\d{6}(\d{2})$/, "$1••••••$2");

/** The signed-in owner's profile, businesses, devices and records (server-side: same on every device). */
export const GET = route(async () => {
  const u = await requireUser();
  const [bs, sessions, rec] = await Promise.all([listBusinesses(u.id), listUserSessions(u.id), accountRecords(u.id)]);
  return ok({
    user: { id: u.id, name: u.name, email: u.email, phoneMasked: mask(u.phone), lang: u.lang, profileType: u.profileType, onboarded: !!u.onboardedAt, notifyWhatsapp: u.notifyWhatsapp, notifySms: u.notifySms, notifyEmail: u.notifyEmail, marketingOptIn: u.marketingOptIn, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt },
    businesses: bs.map((b) => ({ ...b, gstin: b.gstin ? maskGstin(b.gstin) : null })),
    sessions: sessions.map((s) => ({ ...s, current: s.id === u.sessionId })),
    orders: rec.orders.map((o) => ({ id: o.id, token: o.token, businessName: o.businessName, businessId: o.businessId ?? null, bundle: bundleName(o.bundleId, u.lang as "en"), stage: o.cancelled ? "CANCELLED" : o.stage ?? null, payment: o.payment.status, kycStatus: o.kycStatus, monthly: o.totals.monthly, goLive: o.goLive, createdAt: o.createdAt,
      bundleId: o.bundleId, services: new Set((o.items?.length ? o.items : o.lines).map((x) => x.productId)).size, city: o.profile?.city ?? null,
      activatedAt: o.stageDates?.ACTIVATED ?? null, cancelledAt: o.cancelled?.at ?? null })),
    quotes: rec.quotes.map((q) => ({ id: q.id, bundle: bundleName(q.bundleId, u.lang as "en"), orderId: q.orderId ?? null, createdAt: q.createdAt })),
    tickets: rec.tickets.map((t) => ({ id: t.id, status: t.status, category: t.category, orderId: t.orderId ?? null, updatedAt: t.updatedAt })),
  });
});

const Patch = z.object({
  name: z.string().trim().min(1).max(80).nullable().optional(),
  email: z.string().trim().email().max(120).nullable().optional().or(z.literal("").transform(() => null)),
  lang: z.enum(["en", "hi", "mr", "ta"]).optional(),
  profileType: z.enum(["owner", "director", "manager", "accountant", "other"]).optional(),
  notifyWhatsapp: z.boolean().optional(), notifySms: z.boolean().optional(), notifyEmail: z.boolean().optional(), marketingOptIn: z.boolean().optional(),
});
export const PATCH = route(async (req: Request) => {
  const u = await requireUser();
  const b = await parseBody(req, Patch);
  const next = await updateProfile(u.id, b);
  return ok({ user: { id: next!.id, name: next!.name, email: next!.email, lang: next!.lang, profileType: next!.profileType, notifyWhatsapp: next!.notifyWhatsapp, notifySms: next!.notifySms, notifyEmail: next!.notifyEmail, marketingOptIn: next!.marketingOptIn } });
});

/** Delete my account: everything erased, orders kept anonymised (stated in the UI before confirming). */
export const DELETE = route(async () => {
  const u = await requireUser();
  const sid = await sessionId();
  await signOutUser();
  return ok(await eraseEverything({ userId: u.id, sessionId: sid }));
});
