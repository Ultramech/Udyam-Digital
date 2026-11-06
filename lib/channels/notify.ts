import "server-only";
import { after } from "next/server";
import { get, put } from "@/lib/db/store";
import { publicBaseUrl } from "./twilio";
import { sendWhatsAppTo, whatsappProvider } from "./whatsapp";
import { chatForPhone, sendTelegram, telegramConfigured } from "./telegram";
import type { ConsentRecord, Order, OrderEvent } from "@/lib/store/types";

/**
 * Proactive order updates — the point of the tracker is that the owner never has to call. Sent on WhatsApp (to the order's verified
 * number) and on Telegram (if that same verified number has linked a Telegram chat), only with the "service" consent purpose.
 * Each attempt's outcome is written onto the event (sent / failed / skipped + why) for ops; numbers and texts are never logged.
 * Provider rules: Meta delivers free-form text only within 24h of the owner's last message (else error 131047 → failed);
 * Twilio's sandbox only reaches numbers that sent "join <code>"; Telegram has no such limits.
 */
const NOTIFY: OrderEvent["type"][] = ["stage", "delay", "payment", "action", "kyc", "visit"];
type Delivery = NonNullable<OrderEvent["delivery"]>[number];

async function deliver(e: OrderEvent) {
  const o = await get<Order>("order", e.orderId);
  const results: Delivery[] = [];
  const done = () => put("event", e.id, { ...e, delivery: results });
  if (!o?.phone) { results.push({ channel: "whatsapp", status: "skipped", reason: "NO_VERIFIED_PHONE" }); return done(); }
  const consent = o.consentId ? await get<ConsentRecord>("consent", o.consentId) : null;
  if (!consent?.purposes.service) { results.push({ channel: "whatsapp", status: "skipped", reason: "NO_SERVICE_CONSENT" }); return done(); }
  if (await get("optout", o.phone)) { results.push({ channel: "whatsapp", status: "skipped", reason: "OPTED_OUT" }); return done(); }
  const base = publicBaseUrl();
  const body = `${e.text}${base ? `\n\n${o.lang === "hi" ? "स्थिति देखें" : "Track your order"}: ${base}/track/${o.id}?t=${o.token}` : ""}`;

  if (!whatsappProvider()) results.push({ channel: "whatsapp", status: "skipped", reason: "CHANNEL_NOT_CONFIGURED" });
  else try { await sendWhatsAppTo(o.phone, body); results.push({ channel: "whatsapp", status: "sent", at: Date.now() }); }
  catch (err) { results.push({ channel: "whatsapp", status: "failed", reason: err instanceof Error ? err.message.slice(0, 60) : "SEND_FAILED" }); }

  const chatId = telegramConfigured() ? await chatForPhone(o.phone) : undefined;
  if (chatId) {
    try { await sendTelegram(chatId, body); results.push({ channel: "telegram", status: "sent", at: Date.now() }); }
    catch (err) { results.push({ channel: "telegram", status: "failed", reason: err instanceof Error ? err.message.slice(0, 60) : "SEND_FAILED" }); }
  }
  return done();
}

export function notifyOrderEvent(e: OrderEvent) {
  if (!NOTIFY.includes(e.type)) return;
  const job = () => deliver(e).catch(() => { /* best-effort; the tracker itself is the source of truth */ });
  try { after(job); } catch { void job(); } // outside a request (scripts/tests) `after` is unavailable
}
