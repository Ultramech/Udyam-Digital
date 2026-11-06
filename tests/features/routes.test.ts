import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useTempDb } from "./helpers";

vi.mock("server-only", () => ({}));
const afterJobs: Array<() => Promise<void> | void> = [];
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => Promise<void> | void) => { afterJobs.push(fn); } }));

let fetchMock: ReturnType<typeof vi.fn>;
let S: typeof import("@/lib/db/store");
const H = 3_600_000;

beforeAll(async () => {
  useTempDb();
  for (const k of ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "META_WA_TOKEN", "META_WA_PHONE_NUMBER_ID", "META_WA_APP_SECRET", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "CRON_SECRET"]) delete process.env[k];
  process.env.PUBLIC_BASE_URL = "https://app.example.test";
  S = await import("@/lib/db/store");
});
beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => String(url).includes("postalpincode") ? new Response("down", { status: 503 }) : new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
});

async function journey(id: string, o: { service?: boolean; verified?: boolean; consentAgo?: number; paid?: boolean; kycDone?: boolean } = {}) {
  const { recommend } = await import("@/lib/rules/recommend");
  const profile = { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] };
  const rec = recommend(profile);
  await S.put("session", `S-${id}`, { id: `S-${id}`, phone: "9876500123", verified: o.verified ?? true, lang: "en", attribution: {}, createdAt: Date.now() - 9 * H });
  await S.put("consent", `C-${id}`, { id: `C-${id}`, quoteId: `QT-${id}`, noticeVersion: "1", at: Date.now() - (o.consentAgo ?? 3 * H), lang: "en", purposes: { kyc: true, service: o.service ?? true, digilocker: false, marketing: false } });
  if (o.kycDone) await S.put("kyc", `K-${id}`, { id: `K-${id}`, quoteId: `QT-${id}`, status: "verified", updatedAt: Date.now() - (o.consentAgo ?? 3 * H) });
  if (o.paid) await S.put("order", `UD-${id}`, { id: `UD-${id}`, payment: { status: "success" }, createdAt: Date.now() - 3 * H });
  await S.put("quote", `QT-${id}`, { id: `QT-${id}`, sessionId: `S-${id}`, consentId: `C-${id}`, kycId: o.kycDone ? `K-${id}` : undefined, orderId: o.paid ? `UD-${id}` : undefined, profile, lines: rec.lines, bundleId: rec.bundleId, notices: [], version: 1, attribution: {}, sites: [], createdAt: Date.now() - (o.consentAgo ?? 3 * H) - H });
}

describe("resume nudges", () => {
  it("selects only verified, consented, idle, unpaid journeys — and says what's left", async () => {
    const { findNudgeCandidates } = await import("@/lib/nudges/resume");
    await journey("ok"); await journey("kyc", { kycDone: true });
    await journey("noconsent", { service: false }); await journey("unverified", { verified: false });
    await journey("fresh", { consentAgo: 10 * 60_000 }); await journey("stale", { consentAgo: 8 * 24 * H }); await journey("paid", { paid: true });
    const c = await findNudgeCandidates();
    const by = Object.fromEntries(c.map((x) => [x.quote.id, x.step]));
    expect(by).toEqual({ "QT-ok": "docs", "QT-kyc": "sign" });
  });

  it("does nothing (and records nothing) while no channel can reach the owner", async () => {
    const { runResumeNudges } = await import("@/lib/nudges/resume");
    const r = await runResumeNudges();
    expect(r.sent).toBe(0); expect(r.unreachable).toBeGreaterThan(0);
    expect(await S.get("analytics", "nudge:QT-ok")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends once when WhatsApp is configured, then never again for the same quote", async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "tok", TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886" });
    const { runResumeNudges } = await import("@/lib/nudges/resume");
    const first = await runResumeNudges();
    expect(first.sent).toBe(2);
    const body = new URLSearchParams(String(fetchMock.mock.calls.find((c) => String(c[0]).includes("twilio"))![1].body)).get("Body")!;
    expect(body).toContain("https://app.example.test/quote/QT-");
    expect(body).not.toMatch(/9876500123/); // the owner's own number is never echoed
    expect((await S.get<{ results: unknown[] }>("analytics", "nudge:QT-ok"))!.results).toEqual([{ channel: "whatsapp", status: "sent" }]);
    fetchMock.mockClear();
    expect((await runResumeNudges()).eligible).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records a failed send (e.g. WhatsApp's 24h window) instead of retrying forever", async () => {
    await journey("fail");
    fetchMock.mockImplementation(async () => new Response("{}", { status: 400 }));
    const { runResumeNudges } = await import("@/lib/nudges/resume");
    const r = await runResumeNudges();
    expect(r.failed).toBe(1);
    expect((await S.get<{ results: { status: string }[] }>("analytics", "nudge:QT-fail"))!.results[0].status).toBe("failed");
  });
});

describe("cron endpoint", () => {
  const call = async (auth?: string) => (await import("@/app/api/cron/housekeeping/route")).GET(new Request("http://x/api/cron/housekeeping", { headers: auth ? { authorization: auth } : {} }));
  it("refuses everything until a secret is configured, then only the right bearer", async () => {
    expect((await call("Bearer anything")).status).toBe(503);
    process.env.CRON_SECRET = "s3cret";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong!")).status).toBe(401);
    const ok = await call("Bearer s3cret");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty("nudges");
  });
});

describe("callback request", () => {
  const conv = (id: string, stage: string) => S.put("conversation", id, { id, sessionId: "S-cb", lang: "en", facts: { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gst: "no", needs: [] }, messages: [], stage, attribution: { source: "web" }, createdAt: Date.now() });
  it("needs a verified phone, a plan, and a real slot", async () => {
    const { requestCallback } = await import("@/lib/callback/request");
    const { callbackDays } = await import("@/lib/callback/windows");
    const date = callbackDays()[0];
    await conv("CV-a", "recommended"); await conv("CV-c", "collecting");
    await expect(requestCallback({ conversationId: "CV-a", date, window: "10:00–12:00" })).rejects.toMatchObject({ code: "NOT_VERIFIED" });
    await S.put("session", "S-cb", { id: "S-cb", phone: "9876500123", verified: true, lang: "en", attribution: {}, createdAt: Date.now() });
    await expect(requestCallback({ conversationId: "CV-a", date, window: "3am", sessionId: "S-cb" })).rejects.toMatchObject({ code: "BAD_WINDOW" });
    await expect(requestCallback({ conversationId: "CV-a", date: "2031-01-01", window: "10:00–12:00", sessionId: "S-cb" })).rejects.toMatchObject({ code: "BAD_DATE" });
    await expect(requestCallback({ conversationId: "CV-c", date, window: "10:00–12:00", sessionId: "S-cb" })).rejects.toMatchObject({ code: "NO_PLAN_YET" });
  });
  it("creates the lead with the callback, masks the number, and a repeat of the same slot is a no-op", async () => {
    const { requestCallback } = await import("@/lib/callback/request");
    const { callbackDays } = await import("@/lib/callback/windows");
    const date = callbackDays()[1];
    const r = await requestCallback({ conversationId: "CV-a", date, window: "12:00–14:00", note: "after lunch please", sessionId: "S-cb" });
    expect(r.phoneMasked).toBe("98••••••23");
    const c = (await S.get<{ leadId: string }>("conversation", "CV-a"))!;
    const lead = (await S.get<import("@/lib/store/types").Lead>("lead", c.leadId))!;
    expect(lead).toMatchObject({ status: "callback", phone: "9876500123" });
    expect(lead.reasons).toContain("REQUESTED_HUMAN");
    expect(lead.callbacks).toHaveLength(1);
    expect(lead.callbacks[0].at).toBe(`${date}T12:00`);
    expect(lead.callbacks[0].note).toContain("after lunch please");
    await requestCallback({ conversationId: "CV-a", date, window: "12:00–14:00", sessionId: "S-cb" });
    expect((await S.get<import("@/lib/store/types").Lead>("lead", c.leadId))!.callbacks).toHaveLength(1);
  });
});

describe("availability", () => {
  const get = async (pin: string) => (await import("@/app/api/availability/route")).GET(new Request(`http://x/api/availability?pincode=${pin}`));
  it("rejects anything that is not a 6-digit pincode", async () => { expect((await get("12")).status).toBe(400); expect((await get("abcdef")).status).toBe(400); });
  it("uses the real postal directory when reachable, and says it is an estimate", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([{ Status: "Success", PostOffice: [{ District: "Indore", State: "Madhya Pradesh", BranchType: "Sub Post Office", Name: "Indore City" }] }]), { status: 200 }));
    const j = await (await get("452001")).json();
    expect(j).toMatchObject({ fibre: true, basis: "post_office", confirmed: false, area: { district: "Indore" }, fallback: null });
  });
  it("names the catalogue's wireless option when fibre is unlikely", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([{ Status: "Success", PostOffice: [{ District: "Dhar", State: "Madhya Pradesh", BranchType: "Branch Post Office", Name: "Some Village" }] }]), { status: 200 }));
    const j = await (await get("454001")).json();
    expect(j.fibre).toBe(false);
    expect(j.fallback).toMatchObject({ productId: "P04" });
    expect(j.fallback.priceFrom).toBeGreaterThan(0);
  });
});
