import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { splitFirstPayment } from "@/lib/payments/deposit";
import { speakable } from "@/lib/client/speech";
import { partnerSummary } from "@/lib/leads/partners";
import { callbackDays, CALLBACK_WINDOWS } from "@/lib/callback/windows";
import { nudgeText } from "@/lib/nudges/resume";
import type { Lead, Order } from "@/lib/store/types";

afterEach(() => { for (const k of ["NEXT_PUBLIC_DEPOSIT_PERCENT", "NEXT_PUBLIC_DEPOSIT_MIN", "NEXT_PUBLIC_DEPOSIT_OFFER_FROM"]) delete process.env[k]; });

describe("reserve-now split", () => {
  it("is not offered on small first payments", () => {
    expect(splitFirstPayment(1999)).toEqual({ offered: false, deposit: 1999, balance: 0, total: 1999 });
  });
  it("takes 20% by default and the balance is exactly the remainder (nothing added or discounted)", () => {
    const s = splitFirstPayment(10_284);
    expect(s.offered).toBe(true);
    expect(s.deposit).toBe(2057);
    expect(s.deposit + s.balance).toBe(10_284);
  });
  it("never goes below the minimum reservation and always leaves a balance", () => {
    process.env.NEXT_PUBLIC_DEPOSIT_PERCENT = "1";
    expect(splitFirstPayment(5000).deposit).toBe(500);
    process.env.NEXT_PUBLIC_DEPOSIT_MIN = "99999";
    const s = splitFirstPayment(5000);
    expect(s.balance).toBeGreaterThan(0);
    expect(s.deposit + s.balance).toBe(5000);
  });
  it("ignores garbage configuration", () => {
    process.env.NEXT_PUBLIC_DEPOSIT_PERCENT = "abc";
    expect(splitFirstPayment(10_000).deposit).toBe(2000);
    process.env.NEXT_PUBLIC_DEPOSIT_PERCENT = "500";
    expect(splitFirstPayment(10_000).deposit).toBeLessThanOrEqual(9000); // capped at 90%
  });
});

describe("speakable", () => {
  it("strips markup, links and emoji so the voice doesn't read symbols", () => {
    expect(speakable("**Dukaan Digital** — ₹1,299/month 🎉\nTrack: https://x.test/a?b=1")).toBe("Dukaan Digital — ₹1,299/month. Track:");
  });
});

describe("callback windows", () => {
  it("offers the next three working days, never a Sunday", () => {
    const d = callbackDays();
    expect(d).toHaveLength(3);
    expect(d.every((x) => new Date(`${x}T00:00:00Z`).getUTCDay() !== 0)).toBe(true);
    expect(CALLBACK_WINDOWS).toHaveLength(3);
  });
});

describe("nudge text", () => {
  it("is one reminder with the plan, the next step and a link — in the owner's language", () => {
    const en = nudgeText({ lang: "en", bundle: "Dukaan Digital", monthly: 1299, step: "docs", url: "https://a.test/quote/QT-1" });
    expect(en).toContain("₹1,299/month + GST"); expect(en).toContain("upload your business documents"); expect(en).toContain("https://a.test/quote/QT-1"); expect(en).toContain("one-time");
    const hi = nudgeText({ lang: "hi", bundle: "दुकान डिजिटल", monthly: 1299, step: "sign", url: "https://a.test/q" });
    expect(hi).toContain("साइन"); expect(hi).toContain("एक बार");
  });
});

const lead = (o: Partial<Lead> & { id: string }): Lead => ({
  origin: "live", createdAt: 1, profile: { employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] }, facts: { needs: [] }, monthly: 1000,
  level: "assist", reasons: [], status: "assigned", attribution: {}, notes: [], callbacks: [], ...o,
} as Lead);
const order = (id: string, paid: boolean, stage: Order["stage"], monthly: number) => ({ id, payment: { status: paid ? "success" : "awaiting" }, stage, totals: { monthly } }) as unknown as Order;

describe("partner book", () => {
  const leads = [
    lead({ id: "L1", attribution: { partnerCode: "P01" }, orderId: "O1", businessName: "Raj Kirana" }),
    lead({ id: "L2", ownerId: "P01", orderId: "O2" }),
    lead({ id: "L3", assistCredit: { to: "P01", kind: "partner" } }),
    lead({ id: "L4", ownerId: "R01" }), // someone else's
  ];
  const orders = [order("O1", true, "ACTIVATED", 2000), order("O2", true, "INSTALL_SCHEDULED", 3000)];
  it("counts only this partner's leads and only paid/activated money", () => {
    const s = partnerSummary("P01", leads, orders, null);
    expect(s.totals).toMatchObject({ leads: 3, ordersPaid: 2, activated: 1, mrrBooked: 5000, mrrActivated: 2000 });
  });
  it("never invents a commission rate", () => {
    expect(partnerSummary("P01", leads, orders, null).totals.earningsActivated).toBeNull();
    expect(partnerSummary("P01", leads, orders, 10).totals.earningsActivated).toBe(200);
  });
});
