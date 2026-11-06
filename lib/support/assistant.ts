import { bundleName } from "@/lib/i18n/bundles";
import type { Lang } from "@/lib/catalogue/plain";
import type { Order, TicketCategory } from "@/lib/store/types";

/**
 * Support assistant. It answers ONLY from the owner's live order record (stage, KYC, payment, engineer, delay) — never from a
 * model's imagination — and hands off to a person for anything that needs a decision (refunds, complaints, plan changes).
 * Pure, so it is unit-tested and works with no AI key.
 */
export type Intent = "status" | "kyc" | "billing" | "installation" | "cancel" | "complaint" | "change" | "human" | "unknown";

const RULES: [Intent, RegExp][] = [
  ["human", /\b(human|person|agent|call me|speak to|talk to)\b|किसी से बात|इंसान|एजेंट|कॉल करो|कॉल करें/i],
  ["cancel", /\b(cancel|refund|money back)\b|रद्द|कैंसल|रिफंड|पैसे वापस/i],
  ["complaint", /\b(complain|complaint|angry|worst|bad service|fraud|cheat)\b|शिकायत|बेकार|धोखा/i],
  ["change", /\b(upgrade|downgrade|change (my )?plan|add (a |more )?(service|sim|line|camera)|another branch|new branch)\b|प्लान बदल|अपग्रेड|और सिम|नई ब्रांच/i],
  ["kyc", /\b(kyc|document|gst|udyam|verify|verification|upload|rejected)\b|दस्तावेज़|डॉक्यूमेंट|केवाईसी|वेरिफ/i],
  ["billing", /\b(bill|billing|pay|paid|payment|charge|invoice|price|amount|gst amount|deduct)\b|बिल|भुगतान|पेमेंट|पैसे|कीमत|चार्ज/i],
  ["installation", /\b(install|installation|engineer|technician|slot|visit|appointment|fibre|router)\b|इंस्टॉल|इंजीनियर|टेक्नीशियन|स्लॉट/i],
  ["status", /\b(status|when|where|how long|delay|late|eta|live|active|activated|track)\b|कब|कहाँ|स्टेटस|देर|चालू|कितने दिन/i],
];

export function classify(text: string): Intent {
  for (const [i, re] of RULES) if (re.test(text)) return i;
  return "unknown";
}
export const intentCategory = (i: Intent): TicketCategory =>
  ({ status: "order", kyc: "kyc", billing: "billing", installation: "installation", cancel: "cancel", complaint: "other", change: "order", human: "other", unknown: "other" } as const)[i];
/** These always go to a person: they need a decision or empathy, not a status line. */
export const needsHuman = (i: Intent) => i === "cancel" || i === "complaint" || i === "human" || i === "unknown";

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (d: string, hi: boolean) => new Date(`${d}T00:00:00Z`).toLocaleDateString(hi ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const STAGE: Record<string, [string, string]> = {
  RECEIVED: ["received", "मिल गया है"], KYC_VERIFICATION: ["in KYC verification", "KYC जाँच में है"], FEASIBILITY: ["in technical feasibility at your location", "आपकी लोकेशन पर तकनीकी जाँच में है"],
  INSTALL_SCHEDULED: ["scheduled for installation", "इंस्टॉलेशन के लिए तय है"], INSTALL_IN_PROGRESS: ["being installed right now", "अभी इंस्टॉल हो रहा है"], ACTIVATED: ["live — all services are active", "चालू है — सभी सेवाएँ एक्टिव हैं"],
};

export interface Answer { intent: Intent; text: string; handoff: boolean }

export function answer(question: string, o: Order | null, lang: Lang): Answer {
  const hi = lang === "hi" || lang === "mr";
  const intent = classify(question);
  const H = (en: string, h: string) => (hi ? h : en);
  if (!o) {
    if (intent === "change") return { intent, handoff: false, text: H("You can change or add services any time: open your plan, or ask the advisor — it re-checks eligibility and price instantly.", "आप कभी भी सेवाएँ बदल या जोड़ सकते हैं: अपना प्लान खोलें या सलाहकार से पूछें — वह तुरंत पात्रता और कीमत दोबारा जाँचता है।") };
    return { intent, handoff: needsHuman(intent), text: H("I can answer questions about an order once you pick it above. For anything else, raise a request and a person will reply here.", "ऊपर ऑर्डर चुनें तो मैं उसके बारे में बता सकता हूँ। बाकी किसी बात के लिए अनुरोध भेजें — कोई व्यक्ति यहीं जवाब देगा।") };
  }
  const bn = bundleName(o.bundleId, lang);
  if (o.cancelled) return { intent, handoff: intent === "cancel" && o.cancelled.refund.status === "failed", text: H(
    `Order ${o.id} was cancelled.${o.cancelled.refund.amount ? ` Refund of ${rs(o.cancelled.refund.amount)}: ${o.cancelled.refund.status === "initiated" ? "started, 5–7 working days" : o.cancelled.refund.status === "failed" ? "our team is processing it by hand" : "not needed"}.` : ""}`,
    `ऑर्डर ${o.id} रद्द हो चुका है।${o.cancelled.refund.amount ? ` ${rs(o.cancelled.refund.amount)} की वापसी: ${o.cancelled.refund.status === "initiated" ? "शुरू हो गई है, 5–7 कामकाजी दिन" : "हमारी टीम मैन्युअली कर रही है"}।` : ""}`) };

  const stage = o.stage ? STAGE[o.stage][hi ? 1 : 0] : H("waiting for payment", "भुगतान का इंतज़ार कर रहा है");
  const delay = o.delayed ? H(` It's delayed: ${o.delayed.reason}. New date ${day(o.delayed.newEta, hi)}.`, ` इसमें देरी है: ${o.delayed.reason}। नई तारीख ${day(o.delayed.newEta, hi)}।`) : "";
  const eng = o.engineer ? H(` Engineer ${o.engineer.name} (${o.engineer.phoneMasked}), slot ${o.engineer.slot}.`, ` इंजीनियर ${o.engineer.name} (${o.engineer.phoneMasked}), स्लॉट ${o.engineer.slot}।`) : "";
  switch (intent) {
    case "status":
      return { intent, handoff: false, text: H(`Your ${bn} order ${o.id} is ${stage}. Expected live by ${day(o.goLive, hi)}.${delay}${eng}`, `आपका ${bn} ऑर्डर ${o.id} ${stage}। ${day(o.goLive, hi)} तक चालू होने की उम्मीद है।${delay}${eng}`) };
    case "installation":
      if (!o.stage || o.stage === "RECEIVED" || o.stage === "KYC_VERIFICATION" || o.stage === "FEASIBILITY")
        return { intent, handoff: false, text: H(`Installation is booked after verification — your order is ${stage}. You can already pick a preferred slot in your tracker.${delay}`, `इंस्टॉलेशन जाँच के बाद तय होता है — आपका ऑर्डर ${stage}। आप ट्रैकर में अभी से पसंदीदा स्लॉट चुन सकते हैं।${delay}`) };
      return { intent, handoff: false, text: H(`Your order is ${stage}.${eng || " The engineer will be shown in your tracker."}${delay}`, `आपका ऑर्डर ${stage}।${eng || " इंजीनियर की जानकारी ट्रैकर में दिखेगी।"}${delay}`) };
    case "kyc": {
      const k = o.kycStatus;
      const t = k === "verified" || k === "approved" ? H("Your documents are verified. Nothing more is needed.", "आपके दस्तावेज़ वेरिफाई हो गए हैं। और कुछ नहीं चाहिए।")
        : k === "review" ? H("A reviewer is checking one detail on your documents (usually within a working day). You'll get an update here — no need to call.", "एक समीक्षक आपके दस्तावेज़ की एक बात जाँच रहे हैं (आमतौर पर एक कामकाजी दिन में)। अपडेट यहीं मिलेगा — कॉल करने की ज़रूरत नहीं।")
        : k === "reupload" ? H("One document needs a clearer or corrected copy. Open the action card in your tracker to re-upload it.", "एक दस्तावेज़ की साफ़ या सही कॉपी चाहिए। ट्रैकर में एक्शन कार्ड खोलकर दोबारा अपलोड करें।")
        : k === "blocked" ? H("Verification couldn't be completed with the documents given. A person will contact you with the next step.", "दिए गए दस्तावेज़ों से जाँच पूरी नहीं हो सकी। अगला कदम बताने के लिए कोई व्यक्ति संपर्क करेगा।")
        : H("Your documents are being checked.", "आपके दस्तावेज़ जाँचे जा रहे हैं।");
      return { intent, handoff: k === "blocked", text: t };
    }
    case "billing": {
      const p = o.payment;
      const paid = p.status === "success" ? H(`Paid ${rs(p.paid ?? o.totals.firstPayment)}`, `${rs(p.paid ?? o.totals.firstPayment)} का भुगतान हो चुका है`) : p.status === "failed" ? H("Your last payment didn't go through — you can retry from checkout; no money was taken for a failed attempt", "आपका पिछला भुगतान नहीं हुआ — चेकआउट से दोबारा कोशिश करें; असफल प्रयास में पैसे नहीं कटते") : H("Payment is pending", "भुगतान बाकी है");
      const bal = p.balance?.status === "due" ? H(` Balance due before activation: ${rs(p.balance.amount)}.`, ` चालू होने से पहले बाकी: ${rs(p.balance.amount)}।`) : "";
      return { intent, handoff: false, text: H(`${paid}.${bal} Your monthly charge is ${rs(o.totals.monthly)} + ${rs(o.totals.gstMonthly)} GST, on a ${o.totals.contractMonths}-month contract. One bill covers every service.`, `${paid}।${bal} आपका मासिक शुल्क ${rs(o.totals.monthly)} + ${rs(o.totals.gstMonthly)} GST है, ${o.totals.contractMonths} महीने का कॉन्ट्रैक्ट। सभी सेवाओं का एक ही बिल।`) };
    }
    case "cancel": {
      const late = o.stage === "INSTALL_IN_PROGRESS" || o.stage === "ACTIVATED";
      return { intent, handoff: late, text: late
        ? H("Installation has already started, so this is a service change rather than a cancellation. Tap \"Send to a person\" and someone will call you.", "इंस्टॉलेशन शुरू हो चुका है, इसलिए यह रद्द करना नहीं बल्कि सेवा में बदलाव है। \"व्यक्ति को भेजें\" दबाएँ — कोई आपको कॉल करेगा।")
        : H("You can cancel from your tracker until installation starts. Anything you've paid is refunded to the same account (5–7 working days).", "इंस्टॉलेशन शुरू होने तक आप ट्रैकर से ऑर्डर रद्द कर सकते हैं। जो भुगतान किया है वह उसी खाते में वापस आएगा (5–7 कामकाजी दिन)।") };
    }
    case "change":
      return { intent, handoff: false, text: H("Use \"Add services / upgrade\" in your tracker or account: it starts a new plan from this one, re-checked for eligibility and price.", "ट्रैकर या अकाउंट में \"सेवाएँ जोड़ें / अपग्रेड\" दबाएँ: यह इसी प्लान से नया प्लान शुरू करता है, पात्रता और कीमत दोबारा जाँचकर।") };
    default:
      return { intent, handoff: true, text: H("Tap \"Send to a person\" — they'll get your order details, so you won't have to repeat yourself. Their reply appears here.", "\"व्यक्ति को भेजें\" दबाएँ — उन्हें आपके ऑर्डर की जानकारी मिलेगी, ताकि आपको दोहराना न पड़े। जवाब यहीं दिखेगा।") };
  }
}

/** The handoff a human agent sees. Masked/derived values only. */
export function ticketContext(o: Order | null, intent: Intent, question: string): { summary: string[] } & Record<string, unknown> {
  if (!o) return { summary: [`Owner asked (${intent}): "${question.slice(0, 160)}"`, "No order linked."] };
  return {
    businessName: o.businessName, bundle: bundleName(o.bundleId, "en"), stage: o.cancelled ? "CANCELLED" : o.stage ?? "AWAITING_PAYMENT",
    kycStatus: o.kycStatus, payment: o.payment.status, monthly: o.totals.monthly, goLive: o.goLive, delayed: o.delayed?.reason,
    summary: [
      `Owner asked (${intent}): "${question.slice(0, 160)}"`,
      `${bundleName(o.bundleId, "en")} for ${o.profile.businessType ?? "business"} in ${o.profile.city}, ${o.profile.sites} site(s), ${o.profile.employees} staff.`,
      `Order ${o.id}: ${o.cancelled ? "cancelled" : o.stage ?? "awaiting payment"}; KYC ${o.kycStatus}; payment ${o.payment.status}; ${o.chases} earlier chase(s).`,
      ...(o.delayed ? [`Delayed: ${o.delayed.reason} (new ETA ${o.delayed.newEta}).`] : []),
      ...(o.actionNeeded ? [`Open action for owner: ${o.actionNeeded.code}.`] : []),
    ],
  };
}
