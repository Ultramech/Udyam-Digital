import "server-only";
import { get, list, put } from "@/lib/db/store";
import { priceLines } from "@/lib/rules/pricing";
import { bundleName } from "@/lib/i18n/bundles";
import { publicBaseUrl } from "@/lib/channels/twilio";
import { sendWhatsAppTo, whatsappProvider } from "@/lib/channels/whatsapp";
import { chatForPhone, sendTelegram, telegramConfigured } from "@/lib/channels/telegram";
import type { ConsentRecord, KycCase, Order, Quote, Session } from "@/lib/store/types";

/**
 * One reminder, once, to an owner who started an application and stopped. The steepest funnel drop is before the order, so this is
 * the cheapest recovery. Strict by design:
 *  - only with a phone the owner verified by OTP AND the "service" consent purpose (DPDP: purpose limitation) — never marketing;
 *  - at most one per quote (a dedupe record is kept), only while the journey is between `NUDGE_AFTER_MINUTES` (default 120) and 7 days idle;
 *  - never once the order is paid; never when no channel can reach the owner (then nothing is recorded, so it retries after setup);
 *  - the outcome (sent / failed + reason) is stored for ops; phone numbers and message text are never logged.
 * WhatsApp only delivers free-form text inside the 24h window (a failure is recorded as such); Telegram has no such limit.
 */
export type NudgeStep = "docs" | "sign";
type Delivery = { channel: "whatsapp" | "telegram"; status: "sent" | "failed"; reason?: string };

const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const MAX_IDLE_MS = 7 * 86_400_000;

export function nudgeText(o: { lang: string; bundle: string; monthly: number; step: NudgeStep; url: string }): string {
  const hi = o.lang === "hi" || o.lang === "mr";
  const rs = `₹${o.monthly.toLocaleString("en-IN")}`;
  if (hi) {
    const next = o.step === "docs" ? "अगला कदम: अपने बिज़नेस के दस्तावेज़ अपलोड करें।" : "अगला कदम: ऑर्डर फ़ॉर्म साइन करें और भुगतान करें।";
    return `नमस्ते! आपका ${o.bundle} प्लान सेव है — ${rs}/माह + GST।\n${next}\nजहाँ छोड़ा था वहीं से शुरू करें: ${o.url}\n(यह एक बार का रिमाइंडर है।)`;
  }
  const next = o.step === "docs" ? "Next step: upload your business documents." : "Next step: sign your order form and pay.";
  return `Hi! Your ${o.bundle} plan is saved at ${rs}/month + GST.\n${next}\nPick up where you left off: ${o.url}\n(This is a one-time reminder.)`;
}

export interface NudgeCandidate { quote: Quote; phone: string; lang: string; step: NudgeStep; lastActivity: number }

/** Pure selection: who is eligible right now. Exposed for tests. */
export async function findNudgeCandidates(now = Date.now()): Promise<NudgeCandidate[]> {
  const after = num(process.env.NUDGE_AFTER_MINUTES, 120) * 60_000;
  const quotes = await list<Quote>("quote", { limit: 2000 });
  const out: NudgeCandidate[] = [];
  for (const q of quotes) {
    if (!q.consentId || !q.sessionId) continue;
    const [consent, session, order, kyc] = await Promise.all([
      get<ConsentRecord>("consent", q.consentId), get<Session>("session", q.sessionId),
      q.orderId ? get<Order>("order", q.orderId) : Promise.resolve(null), q.kycId ? get<KycCase>("kyc", q.kycId) : Promise.resolve(null),
    ]);
    if (!consent?.purposes.service || !session?.verified || !session.phone) continue;
    if (order?.payment.status === "success") continue;
    const last = Math.max(q.createdAt, consent.at, kyc?.updatedAt ?? 0, order?.createdAt ?? 0);
    if (now - last < after || now - last > MAX_IDLE_MS) continue;
    if (await get("analytics", `nudge:${q.id}`)) continue;
    const kycDone = !!kyc && (kyc.status === "verified" || kyc.status === "review");
    out.push({ quote: q, phone: session.phone, lang: session.lang, step: kycDone ? "sign" : "docs", lastActivity: last });
  }
  return out;
}

async function deliver(phone: string, body: string): Promise<Delivery[] | null> {
  const results: Delivery[] = [];
  const chatId = telegramConfigured() ? await chatForPhone(phone) : undefined;
  if (!whatsappProvider() && !chatId) return null; // nobody can be reached yet
  if (whatsappProvider()) {
    try { await sendWhatsAppTo(phone, body); results.push({ channel: "whatsapp", status: "sent" }); }
    catch (e) { results.push({ channel: "whatsapp", status: "failed", reason: e instanceof Error ? e.message.slice(0, 60) : "SEND_FAILED" }); }
  }
  if (chatId) {
    try { await sendTelegram(chatId, body); results.push({ channel: "telegram", status: "sent" }); }
    catch (e) { results.push({ channel: "telegram", status: "failed", reason: e instanceof Error ? e.message.slice(0, 60) : "SEND_FAILED" }); }
  }
  return results;
}

export async function runResumeNudges(now = Date.now()): Promise<{ eligible: number; sent: number; failed: number; unreachable: number }> {
  const base = publicBaseUrl();
  const res = { eligible: 0, sent: 0, failed: 0, unreachable: 0 };
  if (!base) return res; // a reminder without a link is useless
  for (const c of await findNudgeCandidates(now)) {
    res.eligible++;
    const body = nudgeText({ lang: c.lang, bundle: bundleName(c.quote.bundleId, c.lang as "en"), monthly: priceLines(c.quote.lines).monthly, step: c.step, url: `${base}/quote/${c.quote.id}` });
    const results = await deliver(c.phone, body);
    if (!results) { res.unreachable++; continue; }
    await put("analytics", `nudge:${c.quote.id}`, { at: now, step: c.step, results });
    if (results.some((r) => r.status === "sent")) res.sent++; else res.failed++;
  }
  return res;
}
