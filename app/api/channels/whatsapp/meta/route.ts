import { after } from "next/server";
import { get, put } from "@/lib/db/store";
import { handleChat } from "@/lib/channels/chat";
import { splitMessage } from "@/lib/channels/format";
import { publicBaseUrl } from "@/lib/channels/twilio";
import { rememberWhatsAppRoute } from "@/lib/channels/whatsapp";
import { metaConfigured, parseInbound, parseStatuses, sendMeta, verifyHandshake, verifyMetaSignature } from "@/lib/channels/meta";

/**
 * Meta WhatsApp Cloud API webhook. In the Meta app → WhatsApp → Configuration, set the callback URL to
 * `<PUBLIC_BASE_URL>/api/channels/whatsapp/meta`, the verify token to META_WA_VERIFY_TOKEN, and subscribe to "messages".
 * Signature-checked with the app secret; answered 200 at once; the advisor runs in `after()` and replies through the Graph API.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const challenge = verifyHandshake(new URL(req.url).searchParams);
  return challenge ? new Response(challenge, { status: 200 }) : new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  if (!metaConfigured()) return new Response("WhatsApp (Meta) channel not configured", { status: 503 });
  const raw = await req.text();
  const sigOk = verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"));
  // ops diagnostics (outcome only — never the body, number or text). Forged/unsigned calls share one row per minute so they can't flood the store.
  if (!sigOk) {
    const k = `wa-meta-reject:${Math.floor(Date.now() / 60_000)}`;
    const cur = await get<{ n: number }>("analytics", k);
    await put("analytics", k, { n: (cur?.n ?? 0) + 1 });
    return new Response("Forbidden", { status: 403 });
  }
  await put("analytics", `wa-meta-hit:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`, { at: Date.now(), bytes: raw.length });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("Bad request", { status: 400 }); }
  const base = publicBaseUrl();
  // delivery receipts: proof that replies and order updates actually reached the phone (or Meta's reason they didn't)
  for (const st of parseStatuses(body as Parameters<typeof parseStatuses>[0])) await put("analytics", `wa-status:${st.id}:${st.status}`, st);

  for (const m of parseInbound(body as Parameters<typeof parseInbound>[0])) {
    const key = `wa-meta:${m.id}`; // Meta retries deliveries; never answer one message twice
    if (await get("analytics", key)) continue;
    await put("analytics", key, { at: Date.now() });
    const isIndian = m.from.startsWith("91") && m.from.length === 12;
    const phone = isIndian ? m.from.slice(2) : undefined; // WhatsApp authenticated this number: it is the verified identity
    if (phone) await rememberWhatsAppRoute(phone, "meta");
    after(async () => {
      try {
        const out = m.hasMedia && !m.text
          ? { messages: ["I can read text messages only. Documents for KYC are uploaded on our secure web app, after you give consent. / मैं सिर्फ़ टेक्स्ट पढ़ सकता हूँ। KYC दस्तावेज़ आपकी सहमति के बाद सुरक्षित वेब ऐप पर अपलोड होते हैं।"] }
          : await handleChat({ channel: "whatsapp", userId: `whatsapp:+${m.from}`, phone, text: m.text, baseUrl: base });
        for (const msg of out.messages) for (const part of splitMessage(msg)) if (part) await sendMeta(m.from, part);
      } catch (e) {
        console.error("whatsapp(meta) turn failed", e instanceof Error ? e.message : "unknown"); // never log the number or text
        try { await sendMeta(m.from, "Sorry, something went wrong on our side. Please try again in a moment. / क्षमा करें, कुछ गड़बड़ हो गई। कृपया थोड़ी देर में फिर कोशिश करें।"); } catch { /* nothing more */ }
      }
    });
  }
  return new Response("OK", { status: 200 });
}
