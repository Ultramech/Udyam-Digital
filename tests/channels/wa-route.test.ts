import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

const calls: string[] = [];
let wa: typeof import("@/lib/channels/whatsapp");

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "war-")), "t.db")}`;
  Object.assign(process.env, {
    TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: "tok", TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
    META_WA_TOKEN: "mt", META_WA_PHONE_NUMBER_ID: "123", META_WA_APP_SECRET: "sec", META_WA_VERIFY_TOKEN: "vt",
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(String(url)); return new Response(JSON.stringify({ sid: "SM1", messages: [{ id: "w1" }] }), { status: 200 }); }));
  wa = await import("@/lib/channels/whatsapp");
});

describe("WhatsApp route memory", () => {
  it("defaults to Meta when both providers are configured and the number has no history", async () => {
    calls.length = 0;
    await wa.sendWhatsAppTo("9876500300", "hello");
    expect(calls[0]).toContain("graph.facebook.com");
  });

  it("sends updates back over Twilio to a number that came in through the sandbox", async () => {
    await wa.rememberWhatsAppRoute("9876500301", "twilio");
    calls.length = 0;
    await wa.sendWhatsAppTo("9876500301", "your order moved");
    expect(calls[0]).toContain("api.twilio.com");
  });

  it("falls back to the configured provider if the remembered one is switched off", async () => {
    await wa.rememberWhatsAppRoute("9876500302", "twilio");
    const keep = process.env.TWILIO_AUTH_TOKEN; delete process.env.TWILIO_AUTH_TOKEN;
    calls.length = 0;
    await wa.sendWhatsAppTo("9876500302", "x");
    expect(calls[0]).toContain("graph.facebook.com");
    process.env.TWILIO_AUTH_TOKEN = keep;
  });
});
