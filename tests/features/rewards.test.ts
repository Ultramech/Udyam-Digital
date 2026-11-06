import { describe, expect, it } from "vitest";
import { computeRewards, TIERS } from "@/lib/rewards/coins";

const base = { onboarded: false, quotes: 0, orders: [], referralsPaid: 0 };
describe("Udyam Coins", () => {
  it("awards nothing for nothing", () => {
    const r = computeRewards(base);
    expect(r.balance).toBe(0);
    expect(r.tier).toBe("bronze");
    expect(r.entries.every((e) => !e.done)).toBe(true);
  });
  it("awards each real milestone once, in the right amount", () => {
    const r = computeRewards({ onboarded: true, quotes: 3, orders: [{ id: "o1", kycStatus: "verified", paymentStatus: "success", stage: "ACTIVATED" }, { id: "o2", kycStatus: "verified", paymentStatus: "success", stage: "ACTIVATED" }], referralsPaid: 0 });
    expect(r.balance).toBe(50 + 25 + 100 + 500 + 250); // two orders do not double-count the milestones
    expect(r.tier).toBe("gold");
  });
  it("a cancelled order earns no order milestones", () => {
    const r = computeRewards({ ...base, onboarded: true, orders: [{ id: "o", kycStatus: "verified", paymentStatus: "success", stage: null, cancelled: true }] });
    expect(r.balance).toBe(50);
  });
  it("each paid referral earns coins; progress to the next tier is exact", () => {
    const r = computeRewards({ ...base, onboarded: true, referralsPaid: 2 });
    expect(r.balance).toBe(50 + 1500);
    expect(r.tier).toBe("gold");
    expect(r.next).toEqual({ tier: "platinum", toGo: 2000 - 1550, pct: Math.round(((1550 - 800) / (2000 - 800)) * 100) });
  });
  it("the top tier has no next tier", () => {
    expect(computeRewards({ ...base, onboarded: true, referralsPaid: 3 }).next).toBeNull();
    expect(TIERS.map((t) => t.id)).toEqual(["bronze", "silver", "gold", "platinum"]);
  });
});
