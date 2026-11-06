import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
const afterJobs: Array<() => Promise<void> | void> = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void> | void) => { afterJobs.push(fn); } }));

const SECRET = "tg-secret_1";
let POST: (r: Request) => Promise<Response>;
let html: (s: string) => string;
const sent: { method: string; body: { chat_id: number; text: string; reply_markup?: { keyboard?: { text: string; request_contact?: boolean }[][]; remove_keyboard?: boolean } } }[] = [];

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "tg-")), "t.db")}`;
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_WEBHOOK_SECRET: SECRET, PUBLIC_BASE_URL: "https://app.example.test" });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ method: url.split("/").pop()!, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }));
  POST = (await import("@/app/api/channels/telegram/route")).POST;
  html = (await import("@/lib/channels/telegram")).toTelegramHtml;
});
afterEach(() => { afterJobs.length = 0; sent.length = 0; });

let uid = 1;
const req = (message: Record<string, unknown>, secret: string | null = SECRET) => new Request("http://localhost/api/channels/telegram", {
  method: "POST", headers: { "content-type": "application/json", ...(secret === null ? {} : { "x-telegram-bot-api-secret-token": secret }) },
  body: JSON.stringify({ update_id: uid++, message: { message_id: 1, chat: { id: 777, type: "private" }, from: { id: 777 }, ...message } }),
});
const runAfter = async () => { for (const j of afterJobs.splice(0)) await j(); };

describe("Telegram webhook", () => {
  it("rejects a missing or wrong secret header", async () => {
    expect((await POST(req({ text: "hi" }, null))).status).toBe(403);
    expect((await POST(req({ text: "hi" }, "nope")))).toHaveProperty("status", 403);
    expect(afterJobs).toHaveLength(0);
  });

  it("answers /start with the advisor, as HTML, to the same chat", async () => {
    expect((await POST(req({ text: "/start" }))).status).toBe(200);
    await runAfter();
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((s) => s.method === "sendMessage" && s.body.chat_id === 777)).toBe(true);
    expect(sent.map((s) => s.body.text).join("\n")).toContain("Accel Business");
  });

  it("asks for the user's own contact before tracking, and rejects a forwarded contact", async () => {
    await POST(req({ text: "track" })); await runAfter();
    expect(sent.at(-1)!.body.reply_markup?.keyboard?.[0][0].request_contact).toBe(true);
    sent.length = 0;
    await POST(req({ contact: { phone_number: "+919876500301", user_id: 999 } })); await runAfter();
    expect(sent[0].body.text).toContain("own number");
  });

  it("links a verified +91 contact, then track works without asking again", async () => {
    await POST(req({ contact: { phone_number: "+91 98765 00302", user_id: 777 } })); await runAfter();
    expect(sent[0].body.text).toContain("verified");
    sent.length = 0;
    await POST(req({ text: "track" })); await runAfter();
    expect(sent.map((s) => s.body.text).join("\n")).toContain("find an order");
    expect(sent.at(-1)!.body.reply_markup?.keyboard?.[0]?.[0]?.request_contact).not.toBe(true);
  });

  it("ignores group chats and duplicate update ids", async () => {
    const g = new Request("http://localhost/api/channels/telegram", { method: "POST", headers: { "x-telegram-bot-api-secret-token": SECRET }, body: JSON.stringify({ update_id: 9001, message: { message_id: 1, chat: { id: -5, type: "group" }, from: { id: 1 }, text: "hi" } }) });
    await POST(g); expect(afterJobs).toHaveLength(0);
    const body = JSON.stringify({ update_id: 9002, message: { message_id: 1, chat: { id: 778, type: "private" }, from: { id: 778 }, text: "hi" } });
    const mk = () => new Request("http://localhost/api/channels/telegram", { method: "POST", headers: { "x-telegram-bot-api-secret-token": SECRET }, body });
    await POST(mk()); afterJobs.length = 0; await POST(mk());
    expect(afterJobs).toHaveLength(0);
  });

  it("escapes HTML and converts WhatsApp-style bold", () => {
    expect(html("*Plan* <b>x</b> & co")).toBe("<b>Plan</b> &lt;b&gt;x&lt;/b&gt; &amp; co");
  });
});
