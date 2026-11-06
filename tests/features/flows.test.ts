import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useTempDb } from "./helpers";

vi.mock("server-only", () => ({}));
const afterJobs: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void> | void) => { afterJobs.push(fn); } }));

type Orders = typeof import("@/lib/store/orders");
type Store = typeof import("@/lib/db/store");
let O: Orders, S: Store;
let mk: () => Promise<import("@/lib/store/types").Order>;
const sent: { url: string; body: URLSearchParams }[] = [];

beforeAll(async () => {
  useTempDb();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { sent.push({ url, body: new URLSearchParams(String(init?.body ?? "")) }); return new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }); }));
  O = await import("@/lib/store/orders");
  S = await import("@/lib/db/store");
  const { recommend } = await import("@/lib/rules/recommend");
  const profile = { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] };
  const rec = recommend(profile);
  mk = () => O.createOrder({ id: "QT-T", profile, lines: rec.lines, bundleId: rec.bundleId, notices: [], version: 1, attribution: {}, sites: [{ index: 0, address: "x", pincode: "452001", checked: true }], createdAt: Date.now() }, null, { businessName: "Test Kirana", phone: "9876500123", lang: "en" });
  const { addEngineer } = await import("@/lib/scheduling");
  await addEngineer("Asha", "9000000001", ["*"]);
});
afterEach(() => { afterJobs.length = 0; sent.length = 0; });

/** Walks an order to INSTALL_SCHEDULED with a real roster booking. */
async function toScheduled(id: string) {
  await O.advance(id); // RECEIVED -> KYC_VERIFICATION
  await O.setKycStatus(id, "verified");
  await O.advance(id); // -> FEASIBILITY
  const r = await O.advance(id); // -> INSTALL_SCHEDULED (books the earliest free slot)
  expect(r.order?.stage).toBe("INSTALL_SCHEDULED");
}

describe("reserve-now orders", () => {
  it("places the order on the deposit, holds activation until the balance is paid, then releases it", async () => {
    const o = await mk();
    o.payment = { ...o.payment, plan: "deposit", paid: 2000, balance: { amount: o.totals.firstPayment - 2000, status: "due" } };
    await S.put("order", o.id, o);
    const paid = (await O.pay(o.id, "success"))!;
    expect(paid.stage).toBe("RECEIVED");
    expect(paid.stageChangedAt).toBeGreaterThan(0);
    expect((await O.eventsFor(o.id)).some((e) => /Reservation of ₹2,000 received/.test(e.text))).toBe(true);

    await toScheduled(o.id);
    const inProgress = (await O.advance(o.id)).order!;
    expect(inProgress.stage).toBe("INSTALL_IN_PROGRESS");
    expect(inProgress.actionNeeded?.code).toBe("BALANCE_DUE"); // owner is asked in time, not at the last step

    const held = await O.advance(o.id);
    expect(held.blocked).toBe("BALANCE_PENDING");
    expect(held.order?.stage).toBe("INSTALL_IN_PROGRESS");

    const after = (await O.markBalancePaid(o.id, "pay_test"))!;
    expect(after.payment.balance?.status).toBe("paid");
    expect(after.payment.paid).toBe(o.totals.firstPayment);
    expect(after.actionNeeded).toBeUndefined();
    expect((await O.advance(o.id)).order?.stage).toBe("ACTIVATED");
  });

  it("paying the balance twice changes nothing", async () => {
    const o = await mk();
    o.payment = { ...o.payment, plan: "deposit", paid: 2000, balance: { amount: 500, status: "due" } };
    await S.put("order", o.id, o);
    await O.pay(o.id, "success");
    await O.markBalancePaid(o.id, "pay_1");
    const again = (await O.markBalancePaid(o.id, "pay_2"))!;
    expect(again.payment.paid).toBe(2500);
    expect(again.payment.balance?.razorpayPaymentId).toBe("pay_1");
  });

  it("a full-payment order is never blocked by the balance rule", async () => {
    const o = await mk();
    await O.pay(o.id, "success");
    await toScheduled(o.id);
    await O.advance(o.id);
    expect((await O.advance(o.id)).order?.stage).toBe("ACTIVATED");
  });
});

describe("engineer on the way", () => {
  it("needs a booked visit, tells the owner once, and records it", async () => {
    const o = await mk();
    await O.pay(o.id, "success");
    expect((await O.markEnRoute(o.id)).blocked).toBe("NO_VISIT_TO_START");
    await toScheduled(o.id);
    const r = await O.markEnRoute(o.id);
    expect(r.blocked).toBeUndefined();
    expect(r.order?.engineer?.enRoute?.at).toBeGreaterThan(0);
    const ev = (await O.eventsFor(o.id)).filter((e) => e.type === "visit");
    expect(ev).toHaveLength(1);
    expect(ev[0].text).toMatch(/Asha is on the way/);
    expect((await O.markEnRoute(o.id)).blocked).toBe("ALREADY_EN_ROUTE");
  });
});

describe("stuck-order sweep", () => {
  it("delays only orders that sat too long with nothing pending on the customer, and tells them", async () => {
    const { sweepStuckOrders, isStuck } = await import("@/lib/orders/sla");
    const old = await mk(); await O.pay(old.id, "success");
    const fresh = await mk(); await O.pay(fresh.id, "success");
    const waiting = await mk(); await O.pay(waiting.id, "success");
    const legacy = await mk(); await O.pay(legacy.id, "success");
    const ago = (h: number) => Date.now() - h * 3_600_000;
    await S.update<import("@/lib/store/types").Order>("order", old.id, (x) => ({ ...x, stageChangedAt: ago(60) }));
    await S.update<import("@/lib/store/types").Order>("order", fresh.id, (x) => ({ ...x, stageChangedAt: ago(1) }));
    await S.update<import("@/lib/store/types").Order>("order", waiting.id, (x) => ({ ...x, stageChangedAt: ago(60), actionNeeded: { code: "KYC_ACTION_NEEDED" } }));
    await S.update<import("@/lib/store/types").Order>("order", legacy.id, (x) => ({ ...x, stageChangedAt: undefined }));

    expect(isStuck((await O.getOrder(old.id))!, Date.now())).toBe(true);
    const r = await sweepStuckOrders();
    expect(r.delayed).toContain(old.id);
    expect(r.delayed).not.toContain(fresh.id);
    expect(r.delayed).not.toContain(waiting.id);
    expect(r.delayed).not.toContain(legacy.id);
    const d = (await O.getOrder(old.id))!;
    expect(d.delayed?.reason).toMatch(/longer than we planned/);
    expect((await O.eventsFor(old.id)).some((e) => e.type === "delay")).toBe(true);
    expect((await sweepStuckOrders()).delayed).not.toContain(old.id); // once per stage, no repeat messages
  });
});
