import { say, unavailableNotice } from "@/lib/ai/say";
import { after } from "next/server";
import { get, put } from "@/lib/db/store";
import { handleChat } from "@/lib/channels/chat";
import { splitMessage } from "@/lib/channels/format";
import { publicBaseUrl } from "@/lib/channels/twilio";
import { chipKeyboard, contactKeyboard, linkPhone, phoneForChat, sendTelegram, telegramConfigured, verifyTelegramSecret } from "@/lib/channels/telegram";

/**
 * Telegram webhook (registered by `npm run setup:channels`, which sets the secret Telegram echoes back in a header).
 * Same chat controller as WhatsApp. Order tracking / callbacks need a verified number: the bot asks the user to share their own contact.
 */
export const maxDuration = 60;

interface Update {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: { id: number; language_code?: string }; text?: string; contact?: { phone_number: string; user_id?: number }; photo?: unknown; document?: unknown };
}

export async function GET() {
  return Response.json({ channel: "telegram", configured: telegramConfigured() && !!publicBaseUrl() });
}

export async function POST(req: Request) {
  if (!telegramConfigured()) return new Response("Telegram channel not configured", { status: 503 });
  if (!verifyTelegramSecret(req.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Forbidden", { status: 403 });
  const u = (await req.json().catch(() => null)) as Update | null;
  const m = u?.message;
  if (!u || !m || m.chat.type !== "private" || !m.from) return new Response("OK");
  const key = `tg:${u.update_id}`; // Telegram retries until it gets 200
  if (await get("analytics", key)) return new Response("OK");
  await put("analytics", key, { at: Date.now() });
  const chatId = m.chat.id, base = publicBaseUrl();
  const lang: "en" | "hi" | "mr" | "ta" = m.from.language_code === "hi" ? "hi" : m.from.language_code === "mr" ? "mr" : m.from.language_code === "ta" ? "ta" : "en";
  const w = async (situation: string, mustInclude?: string[]) => (await say({ lang, situation, facts: {}, mustInclude, format: "whatsapp" }))?.text ?? unavailableNotice();

  after(async () => {
    try {
      if (m.contact) {
        // Trust only the sender's OWN contact (Telegram has verified that number); reject forwarded contacts.
        const digits = m.contact.phone_number.replace(/\D/g, "");
        if (m.contact.user_id !== m.from!.id) return void (await sendTelegram(chatId, await w("The shared contact is not the sender's own. Ask them to share their own number using the button.")));
        if (!(digits.length === 12 && digits.startsWith("91"))) return void (await sendTelegram(chatId, await w("Only Indian mobile numbers are supported for orders right now."), { remove_keyboard: true }));
        await linkPhone(chatId, digits.slice(2));
        await sendTelegram(chatId, await w("Confirm their phone number is verified. They can send *track* to see their orders, or tell you about their business. Order updates will also arrive on this chat.", ["track"]), { remove_keyboard: true });
        return;
      }
      if (!m.text) return void (await sendTelegram(chatId, await w("Explain you can read text messages only here; KYC documents are uploaded on the secure web app, after the owner gives consent.")));
      const start = m.text.match(/^\/start(?:\s+(\S+))?/); // deep link t.me/<bot>?start=track arrives as "/start track"
      const text = start ? (start[1] ?? "hi") : m.text.replace(/^\/(\w+).*/, "$1");
      const phone = await phoneForChat(chatId);
      const out = await handleChat({ channel: "telegram", userId: `tg:${chatId}`, phone, text, baseUrl: base });
      const msgs = out.messages.flatMap((x) => splitMessage(x, 3800)).filter(Boolean);
      for (let i = 0; i < msgs.length; i++) {
        const last = i === msgs.length - 1;
        await sendTelegram(chatId, msgs[i], last ? (out.needsVerify ? contactKeyboard((await say({ lang, situation: "Short button text that lets the user share their own phone number", facts: {}, chips: [{ value: "share", label: "Share my phone number" }] }))?.labels?.[0] ?? "Share my phone number") : chipKeyboard(out.chips.map((c) => c.label))) : undefined);
      }
    } catch (e) {
      console.error("telegram turn failed", e instanceof Error ? e.message : "unknown");
      try { await sendTelegram(chatId, "Sorry, something went wrong on our side. Please try again in a moment."); } catch { /* nothing more */ }
    }
  });
  return new Response("OK");
}
