import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta WhatsApp Cloud API transport — free for this use: anyone can message the business number (no sandbox "join" step), replies inside
 * the 24-hour customer-service window are free up to 1,000/month per number, and an unverified business can serve 250 people/day.
 * Needs a real phone number registered on the Cloud API (Meta's test number can only reach 5 pre-added recipients).
 */
const cfg = () => ({
  token: process.env.META_WA_TOKEN, phoneId: process.env.META_WA_PHONE_NUMBER_ID, secret: process.env.META_WA_APP_SECRET,
  verify: process.env.META_WA_VERIFY_TOKEN, version: process.env.META_GRAPH_VERSION || "v23.0",
});
export const metaConfigured = () => { const c = cfg(); return !!(c.token && c.phoneId && c.secret && c.verify); };

/** X-Hub-Signature-256 = "sha256=" + hex(HMAC-SHA256(appSecret, rawBody)). */
export function metaSignature(secret: string, raw: string) { return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex"); }
export function verifyMetaSignature(raw: string, header: string | null, secret = cfg().secret): boolean {
  if (!header || !secret) return false;
  const a = Buffer.from(metaSignature(secret, raw)), b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}
/** GET handshake when the webhook is saved in the Meta app dashboard. */
export function verifyHandshake(params: URLSearchParams): string | null {
  return params.get("hub.mode") === "subscribe" && !!cfg().verify && params.get("hub.verify_token") === cfg().verify ? params.get("hub.challenge") : null;
}

export interface InboundMessage { id: string; from: string; text: string; hasMedia: boolean }
type Payload = { entry?: { changes?: { value?: {
  messages?: { id: string; from: string; type: string; text?: { body?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } }; button?: { text?: string } }[];
  statuses?: { id: string; status: string; timestamp?: string; errors?: { code?: number; title?: string }[] }[];
} }[] }[] };
export interface DeliveryStatus { id: string; status: "sent" | "delivered" | "read" | "failed" | string; at: number; errorCode?: number }
/** Delivery receipts for messages WE sent (sent → delivered → read, or failed with Meta's error code). No numbers or text. */
export function parseStatuses(body: Payload): DeliveryStatus[] {
  const out: DeliveryStatus[] = [];
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) for (const st of c.value?.statuses ?? [])
    out.push({ id: st.id, status: st.status, at: st.timestamp ? Number(st.timestamp) * 1000 : Date.now(), errorCode: st.errors?.[0]?.code });
  return out;
}
/** Pulls user messages out of a webhook payload (delivery/read receipts are read separately by parseStatuses). */
export function parseInbound(body: Payload): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) for (const m of c.value?.messages ?? []) {
    const text = m.text?.body ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? m.button?.text ?? "";
    out.push({ id: m.id, from: m.from, text: text.trim(), hasMedia: ["image", "document", "audio", "video", "sticker"].includes(m.type) });
  }
  return out;
}

/** `to` is digits with country code, e.g. 919876543210. */
export async function sendMeta(to: string, body: string): Promise<void> {
  const c = cfg();
  if (!metaConfigured()) throw new Error("meta_not_configured");
  const res = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneId}/messages`, {
    method: "POST", headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json" }, signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "text", text: { body, preview_url: true } }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: { code?: number } };
    throw new Error(`meta_send_${res.status}_${e.error?.code ?? "?"}`); // 131047 = outside the 24h window (needs an approved template)
  }
}
