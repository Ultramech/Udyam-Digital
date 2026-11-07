import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/gemini", async () => (await import("../helpers/fakeGemini")).fakeGemini);
vi.mock("next/server", () => ({ after: () => { /* not used */ } }));

let handleChat: typeof import("@/lib/channels/chat").handleChat;
let store: typeof import("@/lib/db/store");

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "pc-")), "t.db")}`;
  handleChat = (await import("@/lib/channels/chat")).handleChat;
  store = await import("@/lib/db/store");
});

describe("chat privacy commands", () => {
  it("STOP and RESUME toggle the opt-out for the verified phone", async () => {
    const base = { channel: "whatsapp" as const, userId: "whatsapp:+919876500200", phone: "9876500200", baseUrl: null };
    expect((await handleChat({ ...base, text: "STOP" })).messages[0]).toContain("now OFF");
    expect(await store.get("optout", "9876500200")).toBeTruthy();
    expect((await handleChat({ ...base, text: "resume" })).messages[0]).toContain("back ON");
    expect(await store.get("optout", "9876500200")).toBeNull();
  });

  it("STOP needs a verified phone", async () => {
    const out = await handleChat({ channel: "web", userId: "s1", text: "stop", baseUrl: null });
    expect(out.needsVerify).toBe(true);
  });

  it("'delete my data' erases the conversation, chat state and Telegram link", async () => {
    const base = { channel: "telegram" as const, userId: "tg:555", phone: "9876500201", baseUrl: null };
    await store.put("tglink", "chat:555", { phone: "9876500201", at: 1 });
    await store.put("tglink", "phone:9876500201", { chatId: 555, at: 1 });
    const first = await handleChat({ ...base, text: "I run a small cafe in Pune with 4 staff" });
    const convId = first.conversationId!;
    expect(await store.get("conversation", convId)).toBeTruthy();

    const out = await handleChat({ ...base, text: "Delete my data" });
    expect(out.messages[0]).toContain("deleted");
    expect(await store.get("conversation", convId)).toBeNull();
    expect(await store.get("tglink", "chat:555")).toBeNull();
    expect(await store.get("tglink", "phone:9876500201")).toBeNull();
    // a fresh message starts a brand-new conversation
    const again = await handleChat({ ...base, text: "hi" });
    expect(again.conversationId).toBeUndefined();
  });

  it("a business description containing 'stop' is not a command", async () => {
    const out = await handleChat({ channel: "whatsapp", userId: "whatsapp:+919876500202", phone: "9876500202", text: "I run a bus stop kiosk in Jaipur", baseUrl: null });
    expect(out.messages.join(" ")).not.toContain("now OFF");
  });
});
