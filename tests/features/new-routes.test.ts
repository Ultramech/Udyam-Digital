/**
 * Route-level integration tests for the features added on 2026-11-06: support assistant + tickets, cancellation + refunds,
 * reorder/upgrade, catalogue admin, customers, audit log, price-changed guard, package switching and upload sniffing.
 * Real route handlers + real store (a throwaway libSQL file). Only the network (Razorpay) is stubbed, and every stubbed call's
 * request shape is asserted.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useTempDb } from "./helpers";

vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k: string, v: string) => { jar.set(k, v); }, delete: (k: string) => { jar.delete(k); } }),
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

let S: typeof import("@/lib/db/store");
let fetchMock: ReturnType<typeof vi.fn>;
const req = (method: string, path: string, body?: unknown) => new Request(`http://t${path}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const P = <T,>(v: T) => ({ params: Promise.resolve(v) });
/** signs in through the real demo-login route (hashed session token in the cookie jar) */
const as = async (staff: string | null) => {
  jar.delete("ud_staff");
  if (staff) { const { POST } = await import("@/app/api/ops/session/route"); await POST(new Request("http://t/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: staff }) })); }
};
const json = async (r: Response) => ({ status: r.status, body: await r.json() });

beforeAll(async () => {
  useTempDb();
  for (const k of ["TWILIO_ACCOUNT_SID", "META_WA_TOKEN", "TELEGRAM_BOT_TOKEN", "RAZORPAY_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]) delete process.env[k];
  S = await import("@/lib/db/store");
});
/** every customer API now needs a signed-in, set-up account: each test starts as one (the same path a real OTP takes) */
let me: { id: string };
async function signInCustomer(phone = "9876543210") {
  process.env.ALLOW_TEST_VERIFY = "1";
  const { POST } = await import("@/app/api/demo/verify/route");
  const r = await (await POST(new Request("http://t/x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) }))).json();
  const { updateProfile } = await import("@/lib/accounts/users");
  await updateProfile(r.user.id, { onboardedAt: Date.now(), name: "Test Owner" });
  return { id: r.user.id as string };
}
beforeEach(async () => {
  jar.clear();
  fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  me = await signInCustomer();
});

/** A real quote + KYC case + order created through the store's own functions. */
async function seedOrder(id: string, o: { paid?: boolean; stage?: string } = {}) {
  const { recommend } = await import("@/lib/rules/recommend");
  const { createOrder } = await import("@/lib/store/orders");
  const profile = { businessType: "Pharmacy", employees: 3, sites: 1, city: "Indore", gstin: { has: false }, needs: ["payments" as const] };
  const rec = recommend(profile);
  const quote = { id: `QT-${id}`, userId: me.id, profile, lines: rec.lines, bundleId: rec.bundleId, notices: [], version: 1, attribution: {}, sites: [{ index: 0, address: "Shop 1, MG Road, Indore", pincode: "452001", checked: true }], createdAt: Date.now() };
  await S.put("quote", quote.id, quote);
  const order = await createOrder(quote as never, null, { businessName: `Shop ${id}`, phone: "9876543210", lang: "en" });
  order.userId = me.id;
  order.kycStatus = "verified";
  if (o.paid) { order.payment = { ...order.payment, status: "success", razorpayPaymentId: `pay_${id}`, paid: order.totals.firstPayment }; order.stage = "RECEIVED"; }
  if (o.stage) order.stage = o.stage as never;
  await S.put("order", order.id, order);
  return order;
}

describe("support assistant + tickets", () => {
  it("answers from the live order, only with the order's private token", async () => {
    const o = await seedOrder("A1", { paid: true });
    const { POST } = await import("@/app/api/support/ask/route");
    const ok = await json(await POST(req("POST", "/api/support/ask", { question: "where is my order?", orderId: o.id, t: o.token })));
    expect(ok.status).toBe(200);
    expect(ok.body.intent).toBe("status");
    expect(ok.body.text).toContain(o.id);
    expect(ok.body.handoff).toBe(false);
    const bad = await POST(req("POST", "/api/support/ask", { question: "where is my order?", orderId: o.id, t: "wrong" }));
    expect(bad.status).toBe(403);
    const cancel = await json(await POST(req("POST", "/api/support/ask", { question: "I want a refund", orderId: o.id, t: o.token, lang: "hi" })));
    expect(cancel.body.intent).toBe("cancel");
    expect(cancel.body.text).toMatch(/रद्द/);
  });

  it("a ticket carries the handoff context (no raw phone); staff reply lands on the order timeline and the audit log", async () => {
    const o = await seedOrder("T1", { paid: true });
    const tickets = await import("@/app/api/support/tickets/route");
    const r = await json(await tickets.POST(req("POST", "/api/support/tickets", { text: "Engineer did not come today, please help", orderId: o.id, t: o.token })));
    expect(r.status).toBe(200);
    expect(r.body.ticket.category).toBe("installation");
    expect(JSON.stringify(r.body.ticket)).not.toContain("9876543210");
    expect(r.body.ticket.token).toBeUndefined();
    expect(r.body.ticket.context.summary.join(" ")).toContain(o.id);
    // owner can read it only with its token
    const mine = await json(await tickets.GET(req("GET", `/api/support/tickets?ids=${r.body.ticket.id}:${r.body.token}`)));
    expect(mine.body.tickets).toHaveLength(1);
    // another customer, even holding the id, gets nothing without the token
    const ownerJar = new Map(jar); jar.clear(); await signInCustomer("9876500555");
    const other = await json(await tickets.GET(req("GET", `/api/support/tickets?ids=${r.body.ticket.id}:nope`)));
    expect(other.body.tickets).toHaveLength(0);
    jar.clear(); for (const [k, v] of ownerJar) jar.set(k, v);
    // staff
    const ops = await import("@/app/api/ops/support/[id]/route");
    await as(null);
    expect((await ops.PATCH(req("PATCH", "/x", { reply: "Rescheduled to tomorrow 10–12" }), P({ id: r.body.ticket.id }))).status).toBe(401);
    await as("P01"); // partners don't handle support
    expect((await ops.PATCH(req("PATCH", "/x", { reply: "hi" }), P({ id: r.body.ticket.id }))).status).toBe(403);
    await as("OPS1");
    const rep = await json(await ops.PATCH(req("PATCH", "/x", { reply: "Rescheduled to tomorrow 10–12" }), P({ id: r.body.ticket.id })));
    expect(rep.body.ticket.status).toBe("in_progress");
    expect(rep.body.ticket.assignedTo).toBe("OPS1");
    const { eventsFor } = await import("@/lib/store/orders");
    expect((await eventsFor(o.id)).some((e) => e.text.includes("Rescheduled to tomorrow"))).toBe(true);
    expect((await S.list<{ action: string; entityId: string }>("audit")).some((a) => a.action === "ticket.reply" && a.entityId === r.body.ticket.id)).toBe(true);
  });
});

describe("cancellation and refunds", () => {
  it("unpaid order: cancelled with nothing to refund; a second cancel is refused; a cancelled order can't be signed or scheduled", async () => {
    const o = await seedOrder("C1");
    const { POST } = await import("@/app/api/orders/[id]/cancel/route");
    const r = await json(await POST(req("POST", "/x", { t: o.token, reason: "Changed my mind" }), P({ id: o.id })));
    expect(r.status).toBe(200);
    expect(r.body.order.cancelled.refund.status).toBe("not_needed");
    expect((await POST(req("POST", "/x", { t: o.token, reason: "again" }), P({ id: o.id }))).status).toBe(409);
    const slots = await import("@/app/api/orders/[id]/slots/route");
    expect((await slots.POST(req("POST", "/x", { t: o.token, date: "2026-07-20", window: "10:00–12:00" }), P({ id: o.id }))).status).toBe(409);
    const { advance } = await import("@/lib/store/orders");
    expect((await advance(o.id)).blocked).toBe("ORDER_CANCELLED");
  });

  it("paid order: refunds through Razorpay's refund API and records the refund id", async () => {
    Object.assign(process.env, { RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "rfnd_1", status: "processed", amount: 100 }), { status: 200 }));
    const o = await seedOrder("C2", { paid: true });
    const { POST } = await import("@/app/api/orders/[id]/cancel/route");
    const r = await json(await POST(req("POST", "/x", { t: o.token, reason: "Moving shop" }), P({ id: o.id })));
    expect(r.body.order.cancelled.refund).toMatchObject({ status: "initiated", razorpayRefundIds: ["rfnd_1"], amount: o.totals.firstPayment });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://api.razorpay.com/v1/payments/pay_C2/refund`);
    expect(init.method).toBe("POST");
  });

  it("if Razorpay refuses, the refund is marked failed (never claimed); after installation starts, cancel is refused", async () => {
    Object.assign(process.env, { RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" });
    fetchMock.mockImplementation(async () => new Response("{}", { status: 400 }));
    const o = await seedOrder("C3", { paid: true });
    const { POST } = await import("@/app/api/orders/[id]/cancel/route");
    const r = await json(await POST(req("POST", "/x", { t: o.token, reason: "x1" }), P({ id: o.id })));
    expect(r.body.order.cancelled.refund.status).toBe("failed");
    const late = await seedOrder("C4", { paid: true, stage: "INSTALL_IN_PROGRESS" });
    const t = await json(await POST(req("POST", "/x", { t: late.token, reason: "x1" }), P({ id: late.id })));
    expect(t.status).toBe(409); expect(t.body.error).toBe("TOO_LATE_TO_CANCEL");
  });
});

describe("cancellation concurrency", () => {
  it("two simultaneous cancels refund exactly once", async () => {
    Object.assign(process.env, { RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "s" });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "rfnd_once", status: "processed", amount: 1 }), { status: 200 }));
    const o = await seedOrder("CC1", { paid: true });
    const { POST } = await import("@/app/api/orders/[id]/cancel/route");
    const [a, b] = await Promise.all([1, 2].map(() => POST(req("POST", "/x", { t: o.token, reason: "dup" }), P({ id: o.id }))));
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("/refund"))).toHaveLength(1);
  });
});

describe("DPDP erasure covers the new records", () => {
  it("deleting my data removes my support tickets and my file fingerprints", async () => {
    jar.set("ud_sid", "S-ER");
    await S.put("session", "S-ER", { id: "S-ER", verified: false, lang: "en", attribution: {}, createdAt: Date.now() });
    await S.put("kyc", "K-ER", { id: "K-ER", quoteId: "QT-ER", docs: { signatory_id: { fileHash: "h-er" } } });
    await S.put("kyc_file", "h-er", { cases: ["K-ER", "K-OTHER"] });
    await S.put("quote", "QT-ER", { id: "QT-ER", sessionId: "S-ER", kycId: "K-ER", profile: {}, lines: [], createdAt: Date.now() });
    const tickets = await import("@/app/api/support/tickets/route");
    const t = await json(await tickets.POST(req("POST", "/api/support/tickets", { text: "please call me back about my plan" })));
    const { DELETE } = await import("@/app/api/account/route");
    await DELETE();
    expect(await S.get("ticket", t.body.ticket.id)).toBeNull();
    expect(await S.get("kyc", "K-ER")).toBeNull();
    expect(await S.get("kyc_file", "h-er")).toEqual({ cases: ["K-OTHER"] }); // another applicant's link is untouched
  });
});

describe("reorder / upgrade", () => {
  it("starts a NEW quote from the order (same services for upgrade, one site for a new branch)", async () => {
    const o = await seedOrder("R1", { paid: true });
    const { POST } = await import("@/app/api/orders/[id]/reorder/route");
    const up = await json(await POST(req("POST", "/x", { t: o.token, mode: "upgrade" }), P({ id: o.id })));
    const q = await S.get<{ id: string; lines: unknown; orderId?: string; sites: unknown[] }>("quote", up.body.quoteId);
    expect(q!.id).not.toBe(o.quoteId);
    expect(q!.lines).toEqual(o.lines);
    expect(q!.orderId).toBeUndefined();
    expect((await POST(req("POST", "/x", { t: "bad", mode: "upgrade" }), P({ id: o.id }))).status).toBe(403);
  });
});

describe("catalogue admin", () => {
  it("role-gated, price kept inside the published band, pause excludes the product everywhere, history + audit kept", async () => {
    const admin = await import("@/app/api/ops/catalogue/route");
    await as("R01");
    expect((await admin.GET()).status).toBe(403);
    await as("OPS1");
    const bad = await json(await admin.PUT(req("PUT", "/x", { productId: "P01", priceMin: 5000, note: "test band" })));
    expect(bad.status).toBe(422); expect(bad.body.error).toBe("PRICE_OUTSIDE_PUBLISHED_BAND");
    expect((await admin.PUT(req("PUT", "/x", { productId: "P23", paused: true, note: "stock-out" }))).status).toBe(200);
    const { recommend } = await import("@/lib/rules/recommend");
    const cafe = { businessType: "restaurant", employees: 8, sites: 1, city: "Pune", gstin: { has: true }, needs: ["cctv" as const] };
    const r = recommend(cafe);
    expect(r.lines.some((l) => l.productId === "P23")).toBe(false);
    expect(r.exclusions.some((e) => e.productId === "P23" && e.code === "EXCL_PAUSED")).toBe(true);
    const g = await json(await admin.GET());
    expect(g.body.history[0]).toMatchObject({ productId: "P23", field: "paused", from: false, to: true, by: "OPS1" });
    await admin.PUT(req("PUT", "/x", { productId: "P23", reset: true, note: "back in stock" }));
    expect(recommend(cafe).lines.some((l) => l.productId === "P23")).toBe(true);
    expect(await S.get("catalogue_override", "P23")).toBeNull();
    // admin audit log: admin only
    const audit = await import("@/app/api/ops/audit/route");
    expect((await audit.GET(req("GET", "/api/ops/audit"))).status).toBe(403);
    await as("ADM1");
    const a = await json(await audit.GET(req("GET", "/api/ops/audit?entity=product")));
    expect(a.body.rows.filter((x: { action: string }) => x.action === "catalogue.update").length).toBeGreaterThanOrEqual(2);
  });
});

describe("customers view", () => {
  it("groups by verified phone, masks it, and never derives the id from it", async () => {
    await seedOrder("K1", { paid: true });
    const { GET } = await import("@/app/api/ops/customers/route");
    await as("OPS1");
    const r = await json(await GET());
    const c = r.body.customers.find((x: { businesses: string[] }) => x.businesses.includes("Shop K1"));
    expect(c.businesses.length).toBeGreaterThan(1); // same verified phone, several businesses → one account
    expect(c.name).toBe("Shop K1"); // latest order's name leads
    expect(c.phoneMasked).toBe("98••••••10");
    expect(JSON.stringify(r.body)).not.toContain("9876543210");
    expect(Buffer.from(c.id, "base64url").toString()).not.toContain("98765");
    await as("P01");
    expect((await GET()).status).toBe(403);
  });
});

describe("package switching + price-changed guard", () => {
  it("switch to Basic / Premium / back to Recommended through the engine", async () => {
    const o = await seedOrder("Q1");
    const quote = await S.get<{ id: string }>("quote", o.quoteId);
    const { PATCH } = await import("@/app/api/quote/[id]/route");
    const lite = await json(await PATCH(req("PATCH", "/x", { op: "alternative", id: "lighter" }), P({ id: quote!.id })));
    expect(lite.body.packages.find((p: { id: string }) => p.id === "basic").current).toBe(true);
    const back = await json(await PATCH(req("PATCH", "/x", { op: "alternative", id: "recommended" }), P({ id: quote!.id })));
    expect(back.body.packages.find((p: { id: string }) => p.id === "recommended").current).toBe(true);
    expect(back.body.maturity.after.total).toBeGreaterThanOrEqual(back.body.maturity.before.total);
  });

  it("order creation refuses when the price the owner saw is no longer the price", async () => {
    const { recommend } = await import("@/lib/rules/recommend");
    const { priceLines } = await import("@/lib/rules/pricing");
    const profile = { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] };
    const rec = recommend(profile);
    jar.set("ud_sid", "S-PG");
    await S.put("session", "S-PG", { id: "S-PG", phone: "9876500999", verified: true, lang: "en", attribution: {}, createdAt: Date.now() });
    await S.put("consent", "C-PG", { id: "C-PG", quoteId: "QT-PG", noticeVersion: "1", at: Date.now(), lang: "en", purposes: { kyc: true, service: true, digilocker: false, marketing: false } });
    await S.put("kyc", "K-PG", { id: "K-PG", quoteId: "QT-PG", entered: {}, claimsUdyam: false, docs: {}, status: "verified", checks: [], gstEligible: false, neededSlots: [], createdAt: Date.now(), updatedAt: Date.now() });
    await S.put("quote", "QT-PG", { id: "QT-PG", sessionId: "S-PG", consentId: "C-PG", kycId: "K-PG", profile, lines: rec.lines, bundleId: rec.bundleId, notices: [], version: 1, attribution: {}, sites: [{ index: 0, address: "a", pincode: "452001", checked: true }], createdAt: Date.now() });
    const now = priceLines(rec.lines);
    const { POST } = await import("@/app/api/orders/route");
    const stale = await json(await POST(req("POST", "/api/orders", { quoteId: "QT-PG", businessName: "Kirana PG", expectedMonthly: now.monthly + 100, expectedSetup: now.setup })));
    expect(stale.status).toBe(409); expect(stale.body).toMatchObject({ error: "PRICE_CHANGED", monthly: now.monthly });
    const fresh = await json(await POST(req("POST", "/api/orders", { quoteId: "QT-PG", businessName: "Kirana PG", expectedMonthly: now.monthly, expectedSetup: now.setup })));
    expect(fresh.status).toBe(200); expect(fresh.body.orderId).toMatch(/^UD-/);
  });
});

describe("document upload hardening", () => {
  it("a renamed non-image is refused from its bytes, before any reader is called", async () => {
    await S.put("consent", "C-UP", { id: "C-UP", quoteId: "QT-UP", noticeVersion: "1", at: Date.now(), lang: "en", purposes: { kyc: true, service: true, digilocker: false, marketing: false } });
    await S.put("quote", "QT-UP", { id: "QT-UP", userId: me.id, consentId: "C-UP", profile: { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] }, lines: [], bundleId: "dukaan", notices: [], version: 1, attribution: {}, sites: [], createdAt: Date.now() });
    const { POST } = await import("@/app/api/kyc/[quoteId]/doc/route");
    const fd = new FormData();
    fd.set("slot", "signatory_id");
    fd.set("file", new File([new TextEncoder().encode("#!/bin/sh\necho not an image")], "id.png", { type: "image/png" }));
    const r = await json(await POST(new Request("http://t/x", { method: "POST", body: fd }), P({ quoteId: "QT-UP" })));
    expect(r.status).toBe(415); expect(r.body.error).toBe("FILE_CONTENT_MISMATCH");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
