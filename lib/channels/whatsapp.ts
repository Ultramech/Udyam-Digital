import "server-only";
import { get, put } from "@/lib/db/store";
import { metaConfigured, sendMeta } from "./meta";
import { sendWhatsApp, twilioConfigured } from "./twilio";

/**
 * One WhatsApp facade over two providers, which can run side by side: Meta Cloud API (own business number) and the Twilio sandbox
 * (any number after one "join" message). Each inbound message records which route that number used, and proactive updates go back
 * the same way — a sandbox user can't be reached from the Meta number and vice versa. With no history, Meta wins when configured.
 */
export type WhatsAppProvider = "meta" | "twilio";
const configured = (p: WhatsAppProvider) => (p === "meta" ? metaConfigured() : twilioConfigured());
export const whatsappProvider = (): WhatsAppProvider | null => (metaConfigured() ? "meta" : twilioConfigured() ? "twilio" : null);

const routeKey = (phone10: string) => `wa-route:${phone10}`;
export async function rememberWhatsAppRoute(phone10: string, provider: WhatsAppProvider) {
  await put("session", routeKey(phone10), { provider, at: Date.now() });
}
export async function whatsappRouteFor(phone10: string): Promise<WhatsAppProvider | null> {
  const r = await get<{ provider: WhatsAppProvider }>("session", routeKey(phone10));
  return r && configured(r.provider) ? r.provider : whatsappProvider();
}

/** `phone10` is a verified 10-digit Indian mobile. */
export async function sendWhatsAppTo(phone10: string, body: string): Promise<void> {
  const p = await whatsappRouteFor(phone10);
  if (p === "meta") return sendMeta(`91${phone10}`, body);
  if (p === "twilio") return sendWhatsApp(`whatsapp:+91${phone10}`, body);
  throw new Error("whatsapp_not_configured");
}
