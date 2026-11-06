import { ok, route } from "@/lib/api";
import { list } from "@/lib/db/store";
import { accountRecords, requireUser } from "@/lib/accounts/users";
import { computeRewards } from "@/lib/rewards/coins";
import type { Order } from "@/lib/store/types";

/** The signed-in owner's Udyam Coins, computed from their real records (profile, plans, KYC, orders, referrals). */
export const GET = route(async () => {
  const u = await requireUser();
  const rec = await accountRecords(u.id);
  const codes = new Set(rec.orders.map((o) => o.referralCode).filter(Boolean) as string[]);
  const everyone = codes.size ? await list<Order>("order", { limit: 2000 }) : [];
  // a referral counts once, when the referred business paid; an owner referring themselves earns nothing
  const referralsPaid = everyone.filter((o) => o.attribution?.referrer && codes.has(o.attribution.referrer) && o.userId !== u.id && o.payment.status === "success" && !o.cancelled).length;
  return ok(computeRewards({
    onboarded: !!u.onboardedAt,
    quotes: rec.quotes.length,
    orders: rec.orders.map((o) => ({ id: o.id, kycStatus: o.kycStatus, paymentStatus: o.payment.status, stage: o.stage ?? null, cancelled: !!o.cancelled })),
    referralsPaid,
  }));
});
