import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio WhatsApp transport (works with the free WhatsApp Sandbox and with a production sender — only the From number differs).
 * No SDK: signature validation is one HMAC and sending is one REST call, so there is nothing extra to install or to bundle.
 */
const sid = () => process.env.TWILIO_ACCOUNT_SID;
const token = () => process.env.TWILIO_AUTH_TOKEN;
const from = () => process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886 (sandbox)

export const twilioConfigured = () => !!(sid() && token() && from());

/** The public origin Twilio calls (and that we put in links). Never derived from request headers, which a caller could forge. */
export function publicBaseUrl(): string | null {
  const u = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  return u ? u.replace(/\/+$/, "") : null;
}

/**
 * X-Twilio-Signature = base64(HMAC-SHA1(authToken, fullUrl + Σ(key + value) over POST params sorted by key)).
 * `fullUrl` must be exactly what is configured in the Twilio console.
 */
export function twilioSignature(authToken: string, fullUrl: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], fullUrl);
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function validateTwilioSignature(authToken: string, fullUrl: string, params: Record<string, string>, header: string | null): boolean {
  if (!header) return false;
  const a = Buffer.from(twilioSignature(authToken, fullUrl, params));
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const verifyTwilioRequest = (fullUrl: string, params: Record<string, string>, header: string | null) =>
  !!token() && validateTwilioSignature(token()!, fullUrl, params, header);

/** `whatsapp:+919876543210` → `9876543210` (the form orders and leads store). */
export const phoneFromWhatsApp = (addr: string): string => addr.replace(/^whatsapp:/, "").replace(/\D/g, "").slice(-10);

export async function sendWhatsApp(toAddress: string, body: string): Promise<void> {
  if (!twilioConfigured()) throw new Error("twilio_not_configured");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid()}/Messages.json`, {
    method: "POST",
    headers: { authorization: "Basic " + Buffer.from(`${sid()}:${token()}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ From: from()!, To: toAddress.startsWith("whatsapp:") ? toAddress : `whatsapp:${toAddress}`, Body: body }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
    throw new Error(`twilio_send_${res.status}_${e.code ?? "?"}`);
  }
}
