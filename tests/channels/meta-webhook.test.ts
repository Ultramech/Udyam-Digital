import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/gemini", async () => (await import("../helpers/fakeGemini")).fakeGemini);
const afterJobs: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void> | void) => { afterJobs.push(fn); } }));

const SECRET = "app-secret";
let GET: (r: Request) => Promise<Response>;
let POST: (r: Request) => Promise<Response>;
let sign: (secret: string, raw: string) => string;
const sent: { url: string; auth: string | null; body: { to: string; type: string; text: { body: string } } }[] = [];

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "wam-")), "t.db")}`;
  Object.assign(process.env, { META_WA_TOKEN: "tok", META_WA_PHONE_NUMBER_ID: "123456", META_WA_APP_SECRET: SECRET, META_WA_VERIFY_TOKEN: "verify-me", PUBLIC_BASE_URL: "https://app.example.test" });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url, auth: new Headers(init.headers).get("authorization"), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }), { status: 200 });
  }));
  ({ GET, POST } = await import("@/app/api/channels/whatsapp/meta/route"));
  sign = (await import("@/lib/channels/meta")).metaSignature;
});
afterEach(() => { afterJobs.length = 0; sent.length = 0; });

const payload = (from: string, id: string, msg: Record<string, unknown>) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ from, id, ...msg }] } }] }] });
const req = (raw: string, sig?: string | null) => new Request("http://localhost/api/channels/whatsapp/meta", {
  method: "POST", headers: { "content-type": "application/json", ...(sig === null ? {} : { "x-hub-signature-256": sig ?? sign(SECRET, raw) }) }, body: raw,
});
const runAfter = async () => { for (const j of afterJobs.splice(0)) await j(); };

describe("Meta WhatsApp Cloud API webhook", () => {
  it("answers the subscribe handshake only with the right verify token", async () => {
    const ok = await GET(new Request("http://x/api?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=4242"));
    expect(ok.status).toBe(200); expect(await ok.text()).toBe("4242");
    expect((await GET(new Request("http://x/api?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1"))).status).toBe(403);
  });

  it("rejects a missing or forged signature and does no work", async () => {
    const raw = payload("919876500201", "wamid.a", { type: "text", text: { body: "hi" } });
    expect((await POST(req(raw, null))).status).toBe(403);
    expect((await POST(req(raw, "sha256=" + "0".repeat(64)))).status).toBe(403);
    expect(afterJobs).toHaveLength(0);
  });

  it("acks 200 at once, then replies through the Graph API to the sender", async () => {
    const res = await POST(req(payload("919876500202", "wamid.1", { type: "text", text: { body: "hi" } })));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
    await runAfter();
    expect(sent.length).toBeGreaterThanOrEqual(1);
    for (const m of sent) {
      expect(m.url).toBe("https://graph.facebook.com/v23.0/123456/messages");
      expect(m.auth).toBe("Bearer tok");
      expect(m.body.to).toBe("919876500202");
      expect(m.body.type).toBe("text");
    }
    expect(sent.map((m) => m.body.text.body).join("\n")).toContain("Accel Business");
  });

  it("never answers the same message id twice (Meta retries)", async () => {
    const raw = payload("919876500203", "wamid.dup", { type: "text", text: { body: "hi" } });
    await POST(req(raw)); await runAfter();
    await POST(req(raw));
    expect(afterJobs).toHaveLength(0);
  });

  it("ignores status callbacks and handles media-only messages", async () => {
    const status = JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.s", status: "read" }] } }] }] });
    expect((await POST(req(status))).status).toBe(200);
    expect(afterJobs).toHaveLength(0);
    await POST(req(payload("919876500204", "wamid.m", { type: "image", image: { id: "img" } })));
    await runAfter();
    expect(sent[0].body.text.body).toContain("secure web app");
  });

  it("answers 503 when not configured", async () => {
    const keep = process.env.META_WA_TOKEN;
    delete process.env.META_WA_TOKEN;
    expect((await POST(req("{}"))).status).toBe(503);
    process.env.META_WA_TOKEN = keep;
  });
});
