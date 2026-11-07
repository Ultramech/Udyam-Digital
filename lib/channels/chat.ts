import "server-only";
import { createHash } from "node:crypto";
import { del, get, list, put } from "@/lib/db/store";
import { runAdvisor } from "@/lib/advisor/turn";
import { say, unavailableNotice, type SayLang } from "@/lib/ai/say";
import type { QuickReply } from "@/lib/advisor/orchestrator";
import { createQuoteFromConversation } from "@/lib/store/quotes";
import { stageText } from "@/lib/store/orders";
import { getLead, patchLead } from "@/lib/leads/leads";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { plainName } from "@/lib/catalogue/plain";
import { fmtDate } from "@/lib/client/format";
import { chipsToText, hasDevanagari, matchChip, toWhatsAppText } from "./format";
import type { Conversation, Order } from "@/lib/store/types";

/**
 * One conversation controller for every chat surface (WhatsApp via Meta Cloud API or Twilio, Telegram, and the in-app WhatsApp-style page).
 * It owns no business logic: eligibility, price and order state come from the rules engine and the order store.
 * It only decides what to say, in which language, and how a typed number maps back to a quick-reply chip.
 */
export type Channel = "whatsapp" | "web" | "telegram";
type Lang = "en" | "hi";

export interface ChatInput {
  channel: Channel;
  /** Stable id of the sender (the WhatsApp number, or the web session id). Hashed before it is used as a storage key. */
  userId: string;
  /** Only set when the channel has VERIFIED this phone (WhatsApp does by itself; the web page needs the OTP flow first). */
  phone?: string;
  text: string;
  /** Origin used to build links. `null` means no usable public origin, so links are left out rather than guessed. */
  baseUrl: string | null;
}
export interface ChatOutput {
  messages: string[];
  chips: QuickReply[];
  /** The web page should run phone verification, then resend the same text. */
  needsVerify?: boolean;
  conversationId?: string;
  quoteUrl?: string;
}

interface ChatState {
  conversationId?: string; lang: Lang; advLang?: "en" | "hi" | "mr" | "ta"; chips: QuickReply[]; planSig?: string; quoteId?: string; recent: number[]; seen: boolean; updatedAt: number;
}

const MAX_PER_MINUTE = 12;
const T = (l: Lang, en: string, hi: string) => (l === "hi" ? hi : en); // card field labels only (data cards), never conversational text
const stateKey = (c: Channel, userId: string) => `ch:${c}:${createHash("sha256").update(userId).digest("hex").slice(0, 20)}`;

async function loadState(key: string): Promise<ChatState> {
  return (await get<ChatState>("session", key)) ?? { lang: "en", chips: [], recent: [], seen: false, updatedAt: Date.now() };
}
const saveState = (key: string, s: ChatState) => put("session", key, { ...s, updatedAt: Date.now() });

type Cmd = "menu" | "reset" | "hindi" | "english" | "track" | "human" | "plan" | "stop" | "resume" | "delete";
/** Commands only match when they are the WHOLE (short) message, so a business description can never be hijacked by a keyword. */
function parseCommand(text: string): Cmd | null {
  const t = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  if (/^(hi|hello|hey|hii|start|menu|help|namaste|नमस्ते|हेलो|हैलो|मदद)$/.test(t)) return "menu";
  if (/^(new|reset|restart|start over|new chat|नया|फिर से शुरू|दोबारा)$/.test(t)) return "reset";
  if (/^(hindi|हिंदी|हिन्दी|in hindi)$/.test(t)) return "hindi";
  if (/^(english|अंग्रेजी|अंग्रेज़ी|in english)$/.test(t)) return "english";
  if (/^(track|track order|track my order|status|order status|my order|my orders|where is my order|ट्रैक|स्टेटस|ऑर्डर|मेरा ऑर्डर)$/.test(t)) return "track";
  if (/^(human|agent|person|call me|callback|talk to a person|talk to human|इंसान|कॉल|कॉल करें|किसी से बात)$/.test(t)) return "human";
  if (/^(plan|quote|link|my plan|buy|order now|योजना|प्लान|लिंक|खरीदें)$/.test(t)) return "plan";
  if (/^(stop|unsubscribe|stop updates|stop messages|बंद|बंद करें|रोकें)$/.test(t)) return "stop";
  if (/^(resume|subscribe|resume updates|start updates|चालू करें)$/.test(t)) return "resume";
  if (/^(delete|delete my data|delete my chat|delete data|forget me|erase my data|मेरा डेटा हटाएं|डेटा हटाएं|डेटा हटाओ)$/.test(t)) return "delete";
  return null;
}

/** Every conversational line is worded live by Gemini from facts the code supplies; only the privacy notice below is fixed legal text. */
const COMMANDS = [
  { word: "track", does: "shows the status of their orders" }, { word: "human", does: "asks a person to call them back" },
  { word: "hindi", does: "switches the chat to Hindi" }, { word: "english", does: "switches the chat to English" },
  { word: "new", does: "starts the conversation over" }, { word: "stop", does: "stops order update messages" }, { word: "delete my data", does: "erases this chat" },
];
const sayLang = (st: ChatState): SayLang => st.advLang ?? st.lang;
async function words(st: ChatState, situation: string, facts: unknown = {}, mustInclude: string[] = []): Promise<string> {
  const r = await say({ lang: sayLang(st), situation, facts, mustInclude, format: "whatsapp" });
  return r ? r.text : unavailableNotice();
}
const menuText = (st: ChatState, resumed: boolean) =>
  words(st, "Greet the owner as the Accel Business advisor. Ask them to describe their business in ONE message: what they do, how many people, how many locations, which city, and whether they have a GST number. Promise a plan with one clear monthly price. Then list the commands they can type, each on its own line starting with '•' with the command word in *bold* exactly as given.",
    { alreadyMidConversation: resumed, commands: COMMANDS }, COMMANDS.map((c) => c.word));

const privacyLine = (l: Lang) =>
  T(l, "_Your messages are used only to recommend a plan and track your order. Documents (KYC) are collected only on our secure web app, after your consent._",
       "_आपके संदेश सिर्फ़ प्लान सुझाने और ऑर्डर ट्रैक करने के लिए इस्तेमाल होते हैं। KYC दस्तावेज़ सिर्फ़ हमारे सुरक्षित वेब ऐप पर, आपकी सहमति के बाद लिए जाते हैं।_");

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function planCard(l: Lang, res: Awaited<ReturnType<typeof runAdvisor>>, link: string | null): string {
  const rec = res.turn.recommendation!;
  const p = res.pricing!, sc = res.schedule!;
  const qty = new Map<string, number>();
  for (const x of rec.lines) qty.set(x.productId, (qty.get(x.productId) ?? 0) + x.qty);
  const items = [...qty].map(([id, q]) => `• ${plainName(id, l)}${q > 1 ? ` × ${q}` : ""}`).join("\n");
  const notIn = rec.exclusions.slice(0, 3).map((e) => `• ${ruleReason({ code: e.code, params: e.params, productId: e.productId }, l)}`).join("\n");
  return [
    `*${bundleName(rec.bundleId, l)}*`,
    `${T(l, "Monthly", "मासिक")}: *${inr(p.monthly)}* + GST ${inr(p.gstMonthly)} = ${inr(p.monthlyInclGst)}`,
    `${T(l, "One-time setup", "एक बार का सेटअप")}: ${p.setup ? `${inr(p.setup)} + GST ${inr(p.gstSetup)}` : T(l, "₹0", "₹0")}`,
    `${T(l, "Contract", "अवधि")}: ${p.contractMonths} ${T(l, "months", "महीने")} · ${T(l, "Go-live", "चालू होने की तारीख")}: ${fmtDate(sc.date, l)}`,
    `\n${T(l, "Includes", "शामिल")}:\n${items}`,
    notIn ? `\n${T(l, "Not included", "शामिल नहीं")}:\n${notIn}` : "",
    `\n_${T(l, "Indicative prototype quote — based on the lower end of list prices, not a confirmed commercial offer.", "सांकेतिक प्रोटोटाइप कोट — सूची मूल्य के निचले स्तर पर आधारित, पक्का व्यावसायिक ऑफ़र नहीं।")}_`,
    link ? `\n${T(l, "Customise, complete KYC, e-sign and pay here", "बदलाव, KYC, ई-साइन और भुगतान यहाँ करें")}:\n${link}` : "",
  ].filter(Boolean).join("\n");
}

/** A fresh quote is created only when the plan actually changed since the last one we linked. */
async function ensureQuote(st: ChatState, conv: Conversation, res: Awaited<ReturnType<typeof runAdvisor>>): Promise<string | null> {
  const rec = res.turn.recommendation;
  if (!rec?.lines.length || !res.pricing) return null;
  const sig = `${rec.bundleId}|${res.pricing.monthly}|${res.pricing.setup}`;
  if (st.quoteId && st.planSig === sig) return st.quoteId;
  const q = await createQuoteFromConversation(conv, conv.attribution);
  if (!q.lines.length) return null;
  conv.quoteId = q.id;
  await put("conversation", conv.id, conv);
  if (conv.leadId && (await getLead(conv.leadId))) await patchLead(conv.leadId, (x) => ({ ...x, quoteId: q.id, status: x.status === "new" ? "quoted" : x.status }));
  st.quoteId = q.id; st.planSig = sig;
  return q.id;
}

async function ordersFor(phone: string): Promise<Order[]> {
  return (await list<Order>("order", { limit: 2000 })).filter((o) => o.phone === phone).slice(0, 3);
}

function orderText(l: Lang, o: Order, base: string | null): string {
  const stage = o.stage ? stageText(o.stage, o) : T(l, "Your order is created — payment is the next step.", "आपका ऑर्डर बन गया है — अगला कदम भुगतान है।");
  const pay = { success: T(l, "Paid", "हो गया"), awaiting: T(l, "Awaiting", "बाकी"), processing: T(l, "Processing", "प्रोसेस हो रहा है"), failed: T(l, "Failed — please retry", "विफल — फिर कोशिश करें") }[o.payment.status];
  const kyc = { pending: T(l, "Pending", "बाकी"), verified: T(l, "Verified", "वेरिफाई"), approved: T(l, "Approved", "मंज़ूर"), review: T(l, "Under review", "समीक्षा में"), reupload: T(l, "Re-upload needed", "दोबारा अपलोड करें"), blocked: T(l, "Needs attention", "ध्यान चाहिए") } as Record<string, string>;
  return [
    `*${T(l, "Order", "ऑर्डर")} ${o.id}* — ${bundleName(o.bundleId, l)}`,
    stage,
    `${T(l, "Payment", "भुगतान")}: ${pay} · KYC: ${kyc[o.kycStatus] ?? o.kycStatus}`,
    `${T(l, "Expected live", "चालू होने की तारीख")}: ${fmtDate(o.goLive, l)}`,
    o.delayed ? `⚠ ${T(l, "Delayed", "देरी")}: ${o.delayed.reason} → ${fmtDate(o.delayed.newEta, l)}` : "",
    o.actionNeeded ? `➡ ${T(l, "We need from you", "आपसे चाहिए")}: ${ruleReason(o.actionNeeded, l)}` : "",
    base ? `${T(l, "Live tracker", "लाइव ट्रैकर")}: ${base}/track/${o.id}?t=${o.token}` : "",
  ].filter(Boolean).join("\n");
}

const advisorCommon = (st: ChatState, channel: Channel) => ({ lang: st.advLang ?? st.lang, attribution: { source: channel === "whatsapp" ? "whatsapp" : channel === "telegram" ? "telegram" : "whatsapp-web" } });

export async function handleChat(inp: ChatInput): Promise<ChatOutput> {
  const key = stateKey(inp.channel, inp.userId);
  const st = await loadState(key);
  const finish = async (messages: string[], extra: Partial<ChatOutput> = {}): Promise<ChatOutput> => {
    st.seen = true;
    await saveState(key, st);
    return { messages, chips: st.chips, conversationId: st.conversationId, ...extra };
  };

  const text = inp.text.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!text) return finish([await words(st, "The owner sent an empty message. Ask them to send a message.")]);

  const now = Date.now();
  st.recent = st.recent.filter((t) => now - t < 60_000);
  if (st.recent.length >= MAX_PER_MINUTE) return finish([await words(st, "The owner is sending messages too fast. Ask them to wait a minute and try again.")]);
  st.recent.push(now);
  if (hasDevanagari(text) && st.lang === "en") st.lang = "hi";

  const cmd = parseCommand(text);
  const first = !st.seen;

  if (cmd === "hindi" || cmd === "english") {
    st.lang = cmd === "hindi" ? "hi" : "en"; st.advLang = st.lang;
    return finish([await words(st, `Confirm the chat language is now ${st.lang === "hi" ? "Hindi" : "English"} and ask them to tell you about their business.`)]);
  }
  if (cmd === "reset") {
    st.conversationId = undefined; st.chips = []; st.planSig = undefined; st.quoteId = undefined;
    return finish([await menuText(st, false)]);
  }
  if (cmd === "menu") return finish([await menuText(st, !!st.conversationId), ...(first ? [privacyLine(st.lang)] : [])]);

  // Opt-out of proactive order updates is keyed by the verified phone, so it holds on every channel that number uses.
  if (cmd === "stop" || cmd === "resume") {
    if (!inp.phone) return finish([await words(st, "To change order-update settings you first need to verify the owner's phone number.")], { needsVerify: true });
    if (cmd === "stop") await put("optout", inp.phone, { at: Date.now(), channel: inp.channel });
    else await del("optout", inp.phone);
    return finish([cmd === "stop"
      ? await words(st, "Confirm that order update messages are now OFF, that they can still message you any time, and that typing *resume* turns updates back on.", {}, ["resume"])
      : await words(st, "Confirm that order update messages are back ON.")]);
  }

  // Erase this chat: the conversation transcript, this channel's chat state and any Telegram phone link.
  // Orders, invoices and signed forms are kept — the law requires them for the contract/statutory period (see /privacy).
  if (cmd === "delete") {
    if (st.conversationId) await del("conversation", st.conversationId);
    if (inp.channel === "telegram" && inp.userId.startsWith("tg:")) {
      const chat = inp.userId.slice(3);
      const link = await get<{ phone: string }>("tglink", `chat:${chat}`);
      await del("tglink", `chat:${chat}`);
      if (link?.phone) await del("tglink", `phone:${link.phone}`);
    }
    await del("session", key);
    return { messages: [await words(st, "Confirm the chat history and contact link are deleted. Records the law requires us to keep (orders, invoices, signed forms) stay until their retention period ends. They can say *hi* any time to start again.", {}, ["hi"])], chips: [] };
  }

  if (cmd === "track") {
    if (!inp.phone) return finish([await words(st, "To show their orders you first need to verify the owner's phone number.")], { needsVerify: true });
    const orders = await ordersFor(inp.phone);
    if (!orders.length) return finish([await words(st, "No order exists for this number yet; an order appears once checkout is completed with this number. Offer to recommend a plan if they describe their business.")]);
    return finish(orders.map((o) => orderText(st.lang, o, inp.baseUrl)));
  }

  if (cmd === "human") {
    if (!inp.phone) return finish([await words(st, "So a specialist can call the owner back, you first need to verify their phone number.")], { needsVerify: true });
    const r = await runAdvisor({ conversationId: st.conversationId, text: "I want to talk to a person please", ...advisorCommon(st, inp.channel) });
    st.conversationId = r.conversationId;
    if (r.leadId) await patchLead(r.leadId, (l) => ({ ...l, phone: l.phone ?? inp.phone }));
    return finish([await words(st, "Tell the owner a specialist will call them back on this number within 2 working hours, and already has everything they have shared.", { callbackWithinWorkingHours: 2 })]);
  }

  if (cmd === "plan") {
    const conv = st.conversationId ? await get<Conversation>("conversation", st.conversationId) : null;
    if (!conv) return finish([await words(st, "There is no plan for the owner yet. Ask them to tell you about their business first.")]);
    const res = await runAdvisor({ conversationId: conv.id, refresh: true, ...advisorCommon(st, inp.channel) });
    if (res.turn.stage !== "recommended" || !res.pricing) return finish([toWhatsAppText(res.turn.reply), chipsToText(st.chips, st.lang)].filter(Boolean));
    const qid = await ensureQuote(st, (await get<Conversation>("conversation", conv.id))!, res);
    return finish([planCard(st.lang, res, qid && inp.baseUrl ? `${inp.baseUrl}/quote/${qid}` : null)], { quoteUrl: qid && inp.baseUrl ? `${inp.baseUrl}/quote/${qid}` : undefined });
  }

  // ---- advisor turn --------------------------------------------------------------------------------------------------------------
  const chip = matchChip(text, st.chips);
  const res = await runAdvisor({
    conversationId: st.conversationId,
    ...(chip ? (chip.slot ? { chip: { slot: chip.slot as never, value: chip.value }, chipLabel: chip.label } : { text: chip.label }) : { text }),
    ...advisorCommon(st, inp.channel),
  });
  st.conversationId = res.conversationId;
  st.chips = res.turn.quickReplies ?? [];
  if (res.lang && res.lang !== (st.advLang ?? st.lang)) { st.advLang = res.lang; st.lang = res.lang === "hi" || res.lang === "mr" ? "hi" : "en"; }
  const out: string[] = [];
  if (first) out.push(privacyLine(st.lang));
  out.push(toWhatsAppText(res.turn.reply));
  let quoteUrl: string | undefined;
  // A plain answer to a question doesn't repeat the plan card; a new or changed plan does.
  if (res.kind !== "answer" && res.turn.stage === "recommended" && res.turn.recommendation?.lines.length && res.pricing && res.schedule) {
    const conv = (await get<Conversation>("conversation", res.conversationId))!;
    const qid = await ensureQuote(st, conv, res);
    if (qid && inp.baseUrl) quoteUrl = `${inp.baseUrl}/quote/${qid}`;
    out.push(planCard(st.lang, res, quoteUrl ?? null));
  }
  if (res.turn.stage === "escalated" && res.leadId && inp.phone) await patchLead(res.leadId, (l) => ({ ...l, phone: l.phone ?? inp.phone }));
  const chipsText = chipsToText(st.chips, st.lang);
  if (chipsText) out.push(chipsText);
  return finish(out, { quoteUrl });
}
