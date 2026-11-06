import type { Lang } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { priceLines, inr } from "@/lib/rules/pricing";
import { recommend } from "@/lib/rules/recommend";
import type { BusinessProfile, Recommendation } from "@/lib/rules/types";
import { plainName } from "@/lib/catalogue/plain";
import { applyChip, emptyFacts, extractFacts, type Facts, type Slot } from "./extract";

export interface QuickReply { label: string; slot?: Slot; value: string }
export type Stage = "collecting" | "recommended" | "escalated";
export interface AdvisorTurn {
  facts: Facts;
  missing: Slot[];
  reply: string;
  quickReplies: QuickReply[];
  stage: Stage;
  profile?: BusinessProfile;
  recommendation?: Recommendation;
}

const hi = (l: Lang) => l === "hi" || l === "mr";
/** en / hi always; mr and ta where provided (mr otherwise falls back to Hindi, which Marathi readers read; ta to English). */
const L = (l: Lang, en: string, h: string, mr?: string, ta?: string) => (l === "ta" ? ta ?? en : l === "mr" ? mr ?? h : hi(l) ? h : en);

/** Required facts, in the order we ask. Everything else is optional and editable in the facts panel. */
export function missingSlots(f: Facts): Slot[] {
  const m: Slot[] = [];
  if (!f.businessType) m.push("businessType");
  if (f.employees === undefined) m.push("employees");
  if (f.sites === undefined) m.push("sites");
  if (!f.city) m.push("city");
  if (!f.gst) m.push("gst");
  if (!f.needs.length && !f.notSureNeeds) m.push("needs");
  return m;
}

export function toProfile(f: Facts, lang: Lang): BusinessProfile {
  return {
    businessType: f.businessType,
    employees: f.employees ?? 1,
    sites: f.sites ?? 1,
    city: f.city ?? "",
    gstin: { has: f.gst === "yes" },
    udyam: f.udyam ? { has: f.udyam === "yes" } : undefined,
    currentInternet: f.currentInternet,
    currentSpend: f.currentSpend,
    needs: f.needs,
    budget: f.budget,
    vehicles: f.vehicles,
    machines: f.machines,
    explicitHuman: f.explicitHuman,
    otherNeeds: f.otherNeeds,
    declined: f.declined,
    cameras: f.cameras,
    lines: f.phoneLines,
    lang,
  };
}

function question(slot: Slot, lang: Lang): { text: string; chips: QuickReply[] } {
  switch (slot) {
    case "businessType":
      return {
        text: L(lang, "What kind of business do you run?", "आप किस तरह का बिज़नेस चलाते हैं?", "तुमचा व्यवसाय कोणत्या प्रकारचा आहे?", "நீங்கள் என்ன வகையான வணிகம் செய்கிறீர்கள்?"),
        chips: [
          { label: L(lang, "Shop", "दुकान", "दुकान", "கடை"), slot, value: "Shop" }, { label: L(lang, "Clinic", "क्लिनिक", "दवाखाना", "கிளினிக்"), slot, value: "Clinic" },
          { label: L(lang, "Office / CA / Law", "ऑफिस / CA / वकील", "ऑफिस / CA / वकील", "அலுவலகம் / CA / வழக்கறிஞர்"), slot, value: "Office" }, { label: L(lang, "Restaurant", "रेस्टोरेंट", "रेस्टॉरंट", "உணவகம்"), slot, value: "Restaurant" },
          { label: L(lang, "Factory", "फैक्ट्री", "कारखाना", "தொழிற்சாலை"), slot, value: "Factory" },
        ],
      };
    case "employees":
      return {
        text: L(lang, "How many people work there, including you?", "वहाँ आप समेत कितने लोग काम करते हैं?", "तुमच्यासह तिथे किती लोक काम करतात?", "உங்களையும் சேர்த்து எத்தனை பேர் வேலை செய்கிறார்கள்?"),
        chips: [["1", "1"], ["2–3", "3"], ["4–9", "5"], ["10–24", "12"], ["25+", "30"]].map(([label, value]) => ({ label, slot, value })),
      };
    case "sites":
      return {
        text: L(lang, "How many locations does the business have?", "आपके बिज़नेस की कितनी लोकेशन हैं?", "तुमच्या व्यवसायाची किती ठिकाणे आहेत?", "உங்கள் வணிகத்திற்கு எத்தனை கிளைகள் உள்ளன?"),
        chips: [["1", "1"], ["2", "2"], ["3–5", "3"], ["6–10", "6"], ["10+", "12"]].map(([label, value]) => ({ label, slot, value })),
      };
    case "city":
      return {
        text: L(lang, "Which city is it in?", "यह किस शहर में है?", "हे कोणत्या शहरात आहे?", "இது எந்த நகரத்தில் உள்ளது?"),
        chips: ["Delhi", "Mumbai", "Bengaluru", "Pune", "Indore", "Kochi", "Jaipur", "Surat"].map((c) => ({ label: c, slot, value: c })),
      };
    case "gst":
      return {
        text: L(lang, "Do you have a GST number?", "क्या आपके पास GST नंबर है?", "तुमच्याकडे GST नंबर आहे का?", "உங்களிடம் GST எண் உள்ளதா?"),
        chips: [
          { label: L(lang, "Yes", "हाँ", "होय", "ஆம்"), slot, value: "yes" }, { label: L(lang, "No", "नहीं", "नाही", "இல்லை"), slot, value: "no" },
          { label: L(lang, "Applied, waiting", "आवेदन किया, इंतज़ार", "अर्ज केला, प्रतीक्षेत", "விண்ணப்பித்துள்ளேன்"), slot, value: "no" },
        ],
      };
    default:
      return {
        text: L(lang, "What would you like to do better? Pick one or tell me in your own words.", "आप क्या बेहतर करना चाहते हैं? एक चुनें या अपने शब्दों में बताएँ।", "तुम्हाला काय चांगले करायचे आहे? एक निवडा किंवा तुमच्या शब्दांत सांगा.", "எதை மேம்படுத்த விரும்புகிறீர்கள்? ஒன்றைத் தேர்ந்தெடுக்கவும் அல்லது உங்கள் வார்த்தைகளில் சொல்லுங்கள்."),
        chips: [
          { label: L(lang, "Take UPI / card payments", "UPI / कार्ड पेमेंट", "UPI / कार्ड पेमेंट", "UPI / கார்டு பணம்"), slot: "needs", value: "payments" },
          { label: L(lang, "CCTV", "CCTV"), slot: "needs", value: "cctv" },
          { label: L(lang, "WhatsApp for customers", "ग्राहकों के लिए WhatsApp", "ग्राहकांसाठी WhatsApp", "வாடிக்கையாளர்களுக்கு WhatsApp"), slot: "needs", value: "whatsapp" },
          { label: L(lang, "Work email & security", "वर्क ईमेल और सुरक्षा", "वर्क ईमेल आणि सुरक्षा", "அலுவலக மின்னஞ்சல் & பாதுகாப்பு"), slot: "needs", value: "email,security" },
          { label: L(lang, "Internet that never drops", "इंटरनेट जो बंद न हो", "कधीही बंद न होणारे इंटरनेट", "எப்போதும் நிற்காத இணையம்"), slot: "needs", value: "uptime" },
          { label: L(lang, "Not sure — suggest for me", "पता नहीं — आप बताइए", "माहीत नाही — तुम्ही सुचवा", "தெரியவில்லை — நீங்களே பரிந்துரையுங்கள்"), slot: "needs", value: "not_sure" },
        ],
      };
  }
}

function recommendationText(rec: Recommendation, p: BusinessProfile, lang: Lang): string {
  const price = priceLines(rec.lines);
  const parts: string[] = [];
  parts.push(
    L(lang,
      `Here's what I'd suggest for your ${p.businessType?.toLowerCase() ?? "business"} in ${p.city}: **${bundleName(rec.bundleId, lang)}** at ${inr(price.monthly)} a month (plus 18% GST)${price.setup ? `, with a one-time setup of ${inr(price.setup)}` : ", with no setup fee"}.`,
      `आपके ${p.city} के ${p.businessType ?? "बिज़नेस"} के लिए मेरा सुझाव: **${bundleName(rec.bundleId, lang)}** — ${inr(price.monthly)} प्रति माह (+18% GST)${price.setup ? `, एक बार का सेटअप ${inr(price.setup)}` : ", कोई सेटअप फ़ीस नहीं"}।`),
  );
  for (const w of rec.why.slice(0, 2)) parts.push(ruleReason(w, lang));
  for (const n of rec.notices) parts.push(ruleReason(n, lang));
  for (const e of rec.exclusions.filter((x) => x.code === "EXCL_NEEDS_GSTIN" || x.code === "EXCL_GSTIN_INACTIVE" || x.code === "EXCL_TOO_SMALL" || x.code === "EXCL_FEW_SITES")) {
    if (rec.notices.some((n) => n.code === "WHATSAPP_ALTERNATIVE_WEBSITE") && e.productId === "P15") continue; // already explained
    parts.push(ruleReason({ code: e.code, params: e.params, productId: e.productId }, lang));
  }
  if (rec.budget) parts.push(ruleReason({ code: rec.budget.met ? "BUDGET_MET" : "BUDGET_NOT_MET", params: { target: rec.budget.target, min: rec.budget.minPossible } }, lang));
  return parts.join(" ");
}

export function advisorTurn(input: { facts?: Facts; text?: string; chip?: { slot: Slot; value: string }; lang: Lang; llmFacts?: Partial<Facts>; llmMeta?: LlmMeta }): AdvisorTurn {
  const { lang } = input;
  let facts = input.facts ?? emptyFacts();
  if (input.chip) facts = applyChip(facts, input.chip.slot, input.chip.value);
  if (input.text) facts = extractFacts(input.text, facts);
  if (input.llmFacts) facts = mergeLlm(facts, input.llmFacts, input.llmMeta);

  // greeting
  if (!input.text && !input.chip && !input.facts) {
    const q = question("businessType", lang);
    return {
      facts, missing: missingSlots(facts), stage: "collecting", quickReplies: q.chips,
      reply: L(lang,
        "Namaste! I'm your Airtel Business advisor. Tell me about your business in your own words — what you do, how many people, which city — and I'll suggest the right plan with one clear monthly price.",
        "नमस्ते! मैं आपका Airtel Business सलाहकार हूँ। अपने बिज़नेस के बारे में अपने शब्दों में बताइए — क्या काम है, कितने लोग, कौन-सा शहर — मैं एक साफ़ मासिक कीमत वाला सही प्लान सुझाऊँगा।",
        "नमस्कार! मी तुमचा Airtel Business सल्लागार आहे. तुमच्या व्यवसायाबद्दल तुमच्या शब्दांत सांगा — काय काम आहे, किती लोक, कोणते शहर — मी एका स्पष्ट मासिक किमतीसह योग्य प्लॅन सुचवेन.",
        "வணக்கம்! நான் உங்கள் Airtel Business ஆலோசகர். உங்கள் வணிகத்தைப் பற்றி உங்கள் வார்த்தைகளில் சொல்லுங்கள் — என்ன தொழில், எத்தனை பேர், எந்த நகரம் — ஒரே தெளிவான மாத விலையுடன் சரியான திட்டத்தைப் பரிந்துரைக்கிறேன்."),
    };
  }

  const missing = missingSlots(facts);
  if (facts.explicitHuman) {
    const profile = toProfile({ ...facts, businessType: facts.businessType, city: facts.city ?? "" }, lang);
    const rec = missing.length ? undefined : recommend(profile);
    return {
      facts, missing, stage: "escalated", profile, recommendation: rec, quickReplies: [],
      reply: ruleReason({ code: "REQUESTED_HUMAN" }, lang) + " " + L(lang, "I've passed on everything you've told me so you won't need to repeat it.", "आपने जो बताया वह सब आगे भेज दिया है, दोबारा बताने की ज़रूरत नहीं।"),
    };
  }
  if (missing.length) {
    const q = question(missing[0], lang);
    const known = facts.businessType && missing[0] !== "businessType"
      ? L(lang, `Got it — ${facts.businessType}${facts.city ? " in " + facts.city : ""}. `, `समझ गया — ${facts.businessType}${facts.city ? ", " + facts.city : ""}। `, `समजले — ${facts.businessType}${facts.city ? ", " + facts.city : ""}. `, `புரிந்தது — ${facts.businessType}${facts.city ? ", " + facts.city : ""}. `) : "";
    return { facts, missing, stage: "collecting", quickReplies: q.chips, reply: known + q.text };
  }

  const profile = toProfile(facts, lang);
  const rec = recommend(profile);
  if (rec.escalation.level === "hard") {
    return {
      facts, missing, profile, recommendation: rec, stage: "escalated", quickReplies: [],
      reply: rec.escalation.reasons.map((r) => ruleReason({ code: r }, lang)).join(" "),
    };
  }
  const extra = rec.escalation.level === "assist" ? " " + rec.escalation.reasons.map((r) => ruleReason({ code: r }, lang)).join(" ") : "";
  return {
    facts, missing, profile, recommendation: rec, stage: "recommended",
    quickReplies: [],
    reply: recommendationText(rec, profile, lang) + extra,
  };
}

/** Owner-intent signals beyond plain facts (from the LLM): what they are correcting, removing, or sizing. */
export interface LlmMeta { changedFields: (keyof Facts)[]; removeNeeds: Facts["needs"] }

/**
 * LLM output is untrusted: it only FILLS gaps, unless the owner explicitly corrected a fact ("actually we have 3 shops") — then that
 * field is overwritten. Removals ("I don't want CCTV") go to `declined`, which the rules engine honours. Everything is range-checked.
 */
function mergeLlm(facts: Facts, llm: Partial<Facts>, meta?: LlmMeta): Facts {
  const out: Facts = { ...facts, needs: [...facts.needs], declined: [...(facts.declined ?? [])] };
  const sane = (n: unknown, lo: number, hi_: number) => typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi_;
  const over = (k: keyof Facts) => meta?.changedFields.includes(k) ?? false;
  if ((!out.businessType || over("businessType")) && typeof llm.businessType === "string") out.businessType = llm.businessType.slice(0, 60);
  if ((out.employees === undefined || over("employees")) && sane(llm.employees, 1, 5000)) out.employees = llm.employees;
  if ((out.sites === undefined || over("sites")) && sane(llm.sites, 1, 500)) out.sites = llm.sites;
  if ((!out.city || over("city")) && typeof llm.city === "string") out.city = llm.city.slice(0, 40);
  if ((!out.gst || over("gst")) && (llm.gst === "yes" || llm.gst === "no")) out.gst = llm.gst;
  if ((!out.udyam || over("udyam")) && (llm.udyam === "yes" || llm.udyam === "no")) out.udyam = llm.udyam;
  if ((!out.currentInternet || over("currentInternet")) && llm.currentInternet) out.currentInternet = llm.currentInternet;
  if ((out.currentSpend === undefined || over("currentSpend")) && sane(llm.currentSpend, 100, 10_000_000)) out.currentSpend = llm.currentSpend;
  if ((out.budget === undefined || over("budget")) && sane(llm.budget, 100, 10_000_000)) out.budget = llm.budget;
  if ((out.vehicles === undefined || over("vehicles")) && sane(llm.vehicles, 1, 1000)) out.vehicles = llm.vehicles;
  if ((out.machines === undefined || over("machines")) && sane(llm.machines, 1, 1000)) out.machines = llm.machines;
  if (sane(llm.cameras, 1, 20)) out.cameras = llm.cameras; // a size the owner states is always the latest word
  if (sane(llm.phoneLines, 1, 50)) out.phoneLines = llm.phoneLines;
  for (const n of llm.needs ?? []) {
    if (!out.needs.includes(n)) out.needs.push(n);
    out.declined = out.declined!.filter((d) => d !== n); // asking for it again un-declines it
  }
  for (const n of meta?.removeNeeds ?? []) {
    out.needs = out.needs.filter((x) => x !== n);
    if (!out.declined!.includes(n)) out.declined!.push(n);
  }
  if (out.needs.length || out.declined!.length) out.notSureNeeds = out.needs.length ? false : out.notSureNeeds ?? true;
  if (llm.explicitHuman) out.explicitHuman = true;
  if (llm.otherNeeds?.length) out.otherNeeds = [...new Set([...(out.otherNeeds ?? []), ...llm.otherNeeds])];
  return out;
}

export const productLabel = (id: string, lang: Lang) => plainName(id, lang);
