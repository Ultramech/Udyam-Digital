/**
 * Udyam Coins: a record of real progress, computed from what actually happened. Nothing is awarded for anything that did not happen,
 * and the same records always give the same balance. What coins can be redeemed for is deliberately not promised here.
 */
export type TierId = "bronze" | "silver" | "gold" | "platinum";
export const TIERS: { id: TierId; min: number }[] = [
  { id: "bronze", min: 0 }, { id: "silver", min: 150 }, { id: "gold", min: 800 }, { id: "platinum", min: 2000 },
];

export const COINS = { profile: 50, plan: 25, kyc: 100, paid: 500, live: 250, referral: 750 } as const;

export interface RewardInput {
  onboarded: boolean;
  /** how many plans (quotes) the owner has created */
  quotes: number;
  orders: { id: string; kycStatus: string; paymentStatus: string; stage: string | null; cancelled?: boolean }[];
  /** orders placed through this owner's referral link that were paid for */
  referralsPaid: number;
}

export interface RewardEntry { id: "profile" | "plan" | "kyc" | "paid" | "live" | "referral"; coins: number; done: boolean; count?: number }
export interface Rewards { balance: number; tier: TierId; next: { tier: TierId; toGo: number; pct: number } | null; entries: RewardEntry[] }

export function computeRewards(i: RewardInput): Rewards {
  const live = i.orders.filter((o) => !o.cancelled);
  const kyc = live.some((o) => o.kycStatus === "verified" || o.kycStatus === "approved");
  const paid = live.some((o) => o.paymentStatus === "success");
  const active = live.some((o) => o.stage === "ACTIVATED");
  const entries: RewardEntry[] = [
    { id: "profile", coins: COINS.profile, done: i.onboarded },
    { id: "plan", coins: COINS.plan, done: i.quotes > 0 },
    { id: "kyc", coins: COINS.kyc, done: kyc },
    { id: "paid", coins: COINS.paid, done: paid },
    { id: "live", coins: COINS.live, done: active },
    { id: "referral", coins: COINS.referral, done: i.referralsPaid > 0, count: i.referralsPaid },
  ];
  const balance = entries.reduce((s, e) => s + (e.done ? e.coins * (e.id === "referral" ? e.count ?? 0 : 1) : 0), 0);
  const idx = TIERS.reduce((a, t, k) => (balance >= t.min ? k : a), 0);
  const nxt = TIERS[idx + 1];
  const next = nxt ? { tier: nxt.id, toGo: nxt.min - balance, pct: Math.min(100, Math.round(((balance - TIERS[idx].min) / (nxt.min - TIERS[idx].min)) * 100)) } : null;
  return { balance, tier: TIERS[idx].id, next, entries };
}
