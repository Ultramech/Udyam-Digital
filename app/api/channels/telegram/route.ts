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
  const lang: "en" | "hi" = m.from.language_code === "hi" ? "hi" : "en";

  after(async () => {
    try {
      if (m.contact) {
        // Trust only the sender's OWN contact (Telegram has verified that number); reject forwarded contacts.
        const digits = m.contact.phone_number.replace(/\D/g, "");
        if (m.contact.user_id !== m.from!.id) return void (await sendTelegram(chatId, lang === "hi" ? "कृपया अपना ही नंबर शेयर करें।" : "Please share your own number using the button."));
        if (!(digits.length === 12 && digits.startsWith("91"))) return void (await sendTelegram(chatId, lang === "hi" ? "अभी सिर्फ़ भारतीय (+91) नंबर समर्थित हैं।" : "Only Indian (+91) numbers are supported for orders right now.", { remove_keyboard: true }));
        await linkPhone(chatId, digits.slice(2));
        await sendTelegram(chatId, lang === "hi" ? "✅ नंबर वेरिफाई हो गया। अब *track* लिखें या अपने बिज़नेस के बारे में बताएँ। ऑर्डर के अपडेट यहाँ भी आएँगे।" : "✅ Number verified. Send *track* to see your orders, or tell me about your business. Order updates will also come here.", { remove_keyboard: true });
        return;
      }
      if (!m.text) return void (await sendTelegram(chatId, "I can read text messages only. Documents for KYC are uploaded on our secure web app, after you give consent. / मैं सिर्फ़ टेक्स्ट पढ़ सकता हूँ।"));
      const start = m.text.match(/^\/start(?:\s+(\S+))?/); // deep link t.me/<bot>?start=track arrives as "/start track"
      const text = start ? (start[1] ?? (lang === "hi" ? "नमस्ते" : "hi")) : m.text.replace(/^\/(\w+).*/, "$1");
      const phone = await phoneForChat(chatId);
      const out = await handleChat({ channel: "telegram", userId: `tg:${chatId}`, phone, text, baseUrl: base });
      const msgs = out.messages.flatMap((x) => splitMessage(x, 3800)).filter(Boolean);
      for (let i = 0; i < msgs.length; i++) {
        const last = i === msgs.length - 1;
        await sendTelegram(chatId, msgs[i], last ? (out.needsVerify ? contactKeyboard(lang) : chipKeyboard(out.chips.map((c) => c.label))) : undefined);
      }
    } catch (e) {
      console.error("telegram turn failed", e instanceof Error ? e.message : "unknown");
      try { await sendTelegram(chatId, "Sorry, something went wrong on our side. Please try again in a moment."); } catch { /* nothing more */ }
    }
  });
  return new Response("OK");
}
