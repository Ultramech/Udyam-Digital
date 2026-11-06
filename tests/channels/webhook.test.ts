import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
const afterJobs: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void> | void) => { afterJobs.push(fn); } }));

const URL_ = "https://app.example.test/api/channels/whatsapp";
const TOKEN = "test-token";
let POST: (r: Request) => Promise<Response>;
let sign: (token: string, url: string, p: Record<string, string>) => string;
const sent: { url: string; auth: string | null; body: URLSearchParams }[] = [];

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "wa-")), "t.db")}`;
  Object.assign(process.env, { TWILIO_ACCOUNT_SID: "ACtest", TWILIO_AUTH_TOKEN: TOKEN, TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886", PUBLIC_BASE_URL: "https://app.example.test/" });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, auth: new Headers(init.headers).get("authorization"), body: new URLSearchParams(String(init.body)) });
    return new Response(JSON.stringify({ sid: "SMtest" }), { status: 201 });
  }));
  POST = (await import("@/app/api/channels/whatsapp/route")).POST;
  sign = (await import("@/lib/channels/twilio")).twilioSignature;
});
afterEach(() => { afterJobs.length = 0; sent.length = 0; });

const req = (params: Record<string, string>, signature?: string) =>
  new Request("http://localhost:3000/api/channels/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(signature === undefined ? { "x-twilio-signature": sign(TOKEN, URL_, params) } : signature ? { "x-twilio-signature": signature } : {}) },
    body: new URLSearchParams(params).toString(),
  });
const runAfter = async () => { for (const j of afterJobs.splice(0)) await j(); };

describe("WhatsApp webhook", () => {
  it("rejects a missing or forged signature and does no work", async () => {
    expect((await POST(req({ From: "whatsapp:+919876500123", Body: "hi", MessageSid: "SM-a" }, "forged"))).status).toBe(403);
    expect((await POST(req({ From: "whatsapp:+919876500123", Body: "hi", MessageSid: "SM-b" }, ""))).status).toBe(403);
    expect(afterJobs).toHaveLength(0);
  });

  it("acknowledges at once with empty TwiML, then replies through the Twilio REST API", async () => {
    const res = await POST(req({ From: "whatsapp:+919876500123", To: "whatsapp:+14155238886", Body: "hi", MessageSid: "SM-1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
    expect(await res.text()).toBe("<Response/>");
    expect(sent).toHaveLength(0); // nothing is sent before the acknowledgement
    await runAfter();
    expect(sent.length).toBeGreaterThanOrEqual(1);
    for (const m of sent) {
      expect(m.url).toBe("https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json");
      expect(m.auth).toBe("Basic " + Buffer.from(`ACtest:${TOKEN}`).toString("base64"));
      expect(m.body.get("To")).toBe("whatsapp:+919876500123");
      expect(m.body.get("From")).toBe("whatsapp:+14155238886");
      expect((m.body.get("Body") ?? "").length).toBeLessThanOrEqual(1600);
    }
    expect(sent[0].body.get("Body")).toContain("Accel Business");
  });

  it("never answers the same MessageSid twice (Twilio retries)", async () => {
    const p = { From: "whatsapp:+919876500124", Body: "hi", MessageSid: "SM-dup" };
    await POST(req(p)); await runAfter(); const first = sent.length;
    expect(first).toBeGreaterThan(0);
    const again = await POST(req(p));
    expect(again.status).toBe(200);
    expect(afterJobs).toHaveLength(0);
  });

  it("ignores senders that are not WhatsApp", async () => {
    await POST(req({ From: "+919876500125", Body: "hi", MessageSid: "SM-sms" }));
    expect(afterJobs).toHaveLength(0);
  });

  it("tells a media-only sender that documents go through the web app", async () => {
    await POST(req({ From: "whatsapp:+919876500126", Body: "", NumMedia: "1", MessageSid: "SM-media" }));
    await runAfter();
    expect(sent[0].body.get("Body")).toContain("secure web app");
  });

  it("track shows 'no order yet' for a number without orders (the WhatsApp number is the verified identity)", async () => {
    await POST(req({ From: "whatsapp:+919876500127", Body: "track", MessageSid: "SM-track" }));
    await runAfter();
    expect(sent.map((m) => m.body.get("Body")).join("\n")).toContain("can't find an order");
  });

  it("answers 503 when the channel is not configured", async () => {
    const keep = process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_AUTH_TOKEN;
    expect((await POST(req({ From: "whatsapp:+919876500128", Body: "hi", MessageSid: "SM-x" }, "x"))).status).toBe(503);
    process.env.TWILIO_AUTH_TOKEN = keep;
  });
});
