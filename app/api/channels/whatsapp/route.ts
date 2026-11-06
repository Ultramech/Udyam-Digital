import { after } from "next/server";
import { get, put } from "@/lib/db/store";
import { handleChat } from "@/lib/channels/chat";
import { splitMessage } from "@/lib/channels/format";
import { phoneFromWhatsApp, publicBaseUrl, sendWhatsApp, twilioConfigured, verifyTwilioRequest } from "@/lib/channels/twilio";
import { rememberWhatsAppRoute } from "@/lib/channels/whatsapp";

/**
 * Twilio WhatsApp webhook. Configure `<PUBLIC_BASE_URL>/api/channels/whatsapp` (POST) as "When a message comes in".
 *
 * Twilio gives a webhook 15 seconds, and the advisor (Gemini) can be slower than that. So we verify the signature, acknowledge at once with
 * an empty TwiML, and do the real work in `after()`, sending each reply through the REST API.
 */
export const maxDuration = 60;
const EMPTY = () => new Response("<Response/>", { headers: { "content-type": "text/xml" } });

export async function GET() {
  return Response.json({ channel: "whatsapp", provider: "twilio", configured: twilioConfigured() && !!publicBaseUrl() });
}

export async function POST(req: Request) {
  const base = publicBaseUrl();
  if (!twilioConfigured() || !base) return new Response("WhatsApp channel not configured", { status: 503 });

  const params = Object.fromEntries(new URLSearchParams(await req.text())) as Record<string, string>;
  const url = process.env.TWILIO_WEBHOOK_URL || `${base}/api/channels/whatsapp`; // must equal the URL saved in the Twilio console
  if (!verifyTwilioRequest(url, params, req.headers.get("x-twilio-signature"))) return new Response("Forbidden", { status: 403 });

  const from = params.From ?? "";
  if (!from.startsWith("whatsapp:")) return EMPTY();

  // Twilio retries on non-2xx/timeouts; never answer the same message twice.
  const dedupeId = `wa:${params.MessageSid ?? ""}`;
  if (params.MessageSid) {
    if (await get("analytics", dedupeId)) return EMPTY();
    await put("analytics", dedupeId, { at: Date.now() });
  }

  const isIndian = from.startsWith("whatsapp:+91");
  const phone = isIndian ? phoneFromWhatsApp(from) : undefined; // WhatsApp has authenticated this number; it is the verified identity
  const text = (params.Body ?? "").trim();
  const hasMedia = Number(params.NumMedia ?? "0") > 0;
  if (phone) await rememberWhatsAppRoute(phone, "twilio"); // order updates go back over the route this number actually uses

  after(async () => {
    try {
      const out = hasMedia && !text
        ? { messages: ["I can read text messages only. Documents for KYC are uploaded on our secure web app, after you give consent. / मैं सिर्फ़ टेक्स्ट पढ़ सकता हूँ। KYC दस्तावेज़ आपकी सहमति के बाद सुरक्षित वेब ऐप पर अपलोड होते हैं।"] }
        : await handleChat({ channel: "whatsapp", userId: from, phone, text, baseUrl: base });
      for (const m of out.messages) for (const part of splitMessage(m)) if (part) await sendWhatsApp(from, part);
    } catch (e) {
      console.error("whatsapp turn failed", e instanceof Error ? e.message : "unknown"); // never log the number or the message text
      try { await sendWhatsApp(from, "Sorry, something went wrong on our side. Please try again in a moment. / क्षमा करें, कुछ गड़बड़ हो गई। कृपया थोड़ी देर में फिर कोशिश करें।"); } catch { /* nothing more we can do */ }
    }
  });
  return EMPTY();
}
