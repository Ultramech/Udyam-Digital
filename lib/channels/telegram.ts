import "server-only";
import { timingSafeEqual } from "node:crypto";
import { get, put } from "@/lib/db/store";

/**
 * Telegram Bot API transport — completely free, no approval, anyone can open the bot from a link (t.me/<bot>).
 * Identity: Telegram verifies a user's phone number; when the user taps "Share my number" we get it as a `contact` whose user_id
 * matches the sender, so that number is trusted exactly like WhatsApp's (a contact forwarded from someone else is rejected).
 */
const token = () => process.env.TELEGRAM_BOT_TOKEN;
const secret = () => process.env.TELEGRAM_WEBHOOK_SECRET;
export const telegramConfigured = () => !!(token() && secret());

export function verifyTelegramSecret(header: string | null): boolean {
  const s = secret();
  if (!header || !s) return false;
  const a = Buffer.from(header), b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function tg<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T> {
  if (!token()) throw new Error("telegram_not_configured");
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number };
  if (!j.ok) throw new Error(`telegram_${method}_${j.error_code ?? res.status}`); // never include the token-bearing URL
  return j.result as T;
}

/** WhatsApp-style text (*bold*, _italic_) → Telegram HTML, escaping everything else. */
export function toTelegramHtml(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1<i>$2</i>");
}

export type Keyboard = { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard: true; one_time_keyboard?: boolean } | { remove_keyboard: true };
export const contactKeyboard = (label: string): Keyboard => ({ keyboard: [[{ text: `📱 ${label}`, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
export const chipKeyboard = (labels: string[]): Keyboard =>
  labels.length ? { keyboard: labels.slice(0, 12).map((t) => [{ text: t }]), resize_keyboard: true, one_time_keyboard: true } : { remove_keyboard: true };

export async function sendTelegram(chatId: number | string, text: string, keyboard?: Keyboard) {
  await tg("sendMessage", { chat_id: chatId, text: toTelegramHtml(text), parse_mode: "HTML", disable_web_page_preview: false, ...(keyboard ? { reply_markup: keyboard } : {}) });
}

/** Verified phone ↔ chat links (so order updates can reach the owner on Telegram too). */
export async function linkPhone(chatId: number, phone10: string) {
  await put("tglink", `chat:${chatId}`, { phone: phone10, at: Date.now() });
  await put("tglink", `phone:${phone10}`, { chatId, at: Date.now() });
}
export const phoneForChat = async (chatId: number) => (await get<{ phone: string }>("tglink", `chat:${chatId}`))?.phone;
export const chatForPhone = async (phone10: string) => (await get<{ chatId: number }>("tglink", `phone:${phone10}`))?.chatId;
