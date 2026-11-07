import { plainName, type Lang } from "@/lib/catalogue/plain";
import type { Params, Ref } from "@/lib/rules/types";

type Tpl = string | ((p: Params) => string);
type Dict = Record<string, { en: Tpl; hi: Tpl }>;
const f = (t: Tpl, p: Params) => (typeof t === "function" ? t(p) : t);
const nm = (p: Params, lang: Lang) => (p.product ? plainName(String(p.product), lang) : "");

/** Reasons the rules engine gives. Every exclusion, notice and "why" is explainable in plain words. */
export const RULE_REASONS: Dict = {
  // exclusions
  EXCL_NEEDS_GSTIN: {
    en: (p) => `${p.name} needs a GST number. You can add it the day your GST is verified.`,
    hi: (p) => `${p.name} के लिए GST नंबर चाहिए। GST वेरिफाई होते ही इसे जोड़ा जा सकता है।`,
  },
  EXCL_GSTIN_INACTIVE: {
    en: (p) => `${p.name} needs an active GST registration. Yours shows as ${String(p.status).toLowerCase()}.`,
    hi: (p) => `${p.name} के लिए चालू GST रजिस्ट्रेशन चाहिए। आपका GST "${p.status === "Cancelled" ? "रद्द" : "निलंबित"}" दिख रहा है।`,
  },
  EXCL_TOO_SMALL: {
    en: (p) => `${p.name} is for teams of ${p.need}+ people (you told us ${p.have}).`,
    hi: (p) => `${p.name} ${p.need}+ लोगों की टीम के लिए है (आपने ${p.have} बताए)।`,
  },
  EXCL_FEW_SITES: {
    en: (p) => `${p.name} is for ${p.need} or more locations.`,
    hi: (p) => `${p.name} ${p.need} या ज़्यादा लोकेशन के लिए है।`,
  },
  EXCL_PAUSED: {
    en: (p) => `${p.name} is temporarily not on sale. We'll tell you when it's back.`,
    hi: (p) => `${p.name} अभी कुछ समय के लिए उपलब्ध नहीं है। वापस आने पर हम बताएँगे।`,
  },
  EXCL_CITY_TIER: {
    en: (p) => `${p.name} isn't available in your city yet.`,
    hi: (p) => `${p.name} अभी आपके शहर में उपलब्ध नहीं है।`,
  },
  EXCL_AIRFIBER_INCOMPATIBLE: {
    en: (p) => `${p.name} can't run on the internet connection chosen for location ${p.site}.`,
    hi: (p) => `लोकेशन ${p.site} के चुने गए इंटरनेट कनेक्शन पर ${p.name} नहीं चल सकता।`,
  },
  EXCL_DEPENDENCY: {
    en: (p) => `${p.name} needs an internet connection at location ${p.site}.`,
    hi: (p) => `${p.name} के लिए लोकेशन ${p.site} पर इंटरनेट कनेक्शन चाहिए।`,
  },
  QTY_INVALID: { en: "That quantity isn't allowed. Use a whole number from 1 to 100.", hi: "यह संख्या मान्य नहीं है। 1 से 100 के बीच पूरी संख्या डालें।" },
  DUPLICATE_CONNECTIVITY: { en: (p) => `Location ${p.site} can only have one main internet connection.`, hi: (p) => `लोकेशन ${p.site} पर सिर्फ़ एक मुख्य इंटरनेट कनेक्शन हो सकता है।` },
  DUPLICATE_LINE: { en: "This item appears more than once in the plan.", hi: "यह आइटम प्लान में एक से ज़्यादा बार है।" },
  MISPLACED_LINE: { en: "This item applies to the whole business, not one location.", hi: "यह आइटम पूरे बिज़नेस के लिए है, किसी एक लोकेशन के लिए नहीं।" },
  SITE_INVALID: { en: (p) => `Location ${p.site} doesn't exist in this plan.`, hi: (p) => `इस प्लान में लोकेशन ${p.site} नहीं है।` },
  MIN_ONE_SITE: { en: "You need at least one location.", hi: "कम से कम एक लोकेशन ज़रूरी है।" },
  // why this bundle
  BECAUSE_HOTSPOT_UNRELIABLE: { en: "A phone hotspot drops during busy hours; a proper business line keeps UPI and billing running.", hi: "फोन हॉटस्पॉट व्यस्त समय में अटकता है; बिज़नेस लाइन से UPI और बिलिंग चलती रहती है।" },
  BECAUSE_ONE_BILL_ALL_SITES: { en: (p) => `One plan and one bill for all ${p.sites} of your locations.`, hi: (p) => `आपकी सभी ${p.sites} लोकेशन के लिए एक प्लान और एक बिल।` },
  BECAUSE_OFFICE_SECURE_PRODUCTIVE: { en: "Reliable internet, work email on your own name, backup and security for every device.", hi: "भरोसेमंद इंटरनेट, अपने नाम का ईमेल, बैकअप और हर डिवाइस की सुरक्षा।" },
  BECAUSE_MFG_DEDICATED: { en: "A dedicated line, machine monitoring and a firewall suit factory operations.", hi: "फैक्ट्री के काम के लिए डेडिकेटेड लाइन, मशीन मॉनिटरिंग और फ़ायरवॉल सही रहते हैं।" },
  BECAUSE_BILLING_UPI: { en: "GST billing with UPI and cards on one tablet, so payments never wait.", hi: "एक टैबलेट पर GST बिलिंग, UPI और कार्ड — भुगतान में देरी नहीं।" },
  DECLINED_BY_OWNER: { en: "Left out because you said you don't want {name}.", hi: "आपने कहा कि {name} नहीं चाहिए, इसलिए नहीं जोड़ा।" },
  BECAUSE_CCTV: { en: "CCTV you can watch on your phone, with 30 days of recording.", hi: "फोन पर देखने वाला CCTV, 30 दिन की रिकॉर्डिंग के साथ।" },
  BECAUSE_BACKUP: { en: "Backup internet switches on by itself if the main line goes down.", hi: "मुख्य लाइन बंद होने पर बैकअप इंटरनेट अपने-आप चालू हो जाता है।" },
  BECAUSE_AIRFIBER_FAST: { en: "Wireless AirFiber needs no cable work, so you can be live in about 2 days.", hi: "वायरलेस AirFiber में केबल का काम नहीं, लगभग 2 दिन में चालू।" },
  BECAUSE_SMALL_SHOP_SIMPLE: { en: "A simple, affordable setup for a small shop.", hi: "छोटी दुकान के लिए सरल और किफ़ायती सेटअप।" },
  BECAUSE_SIM_ONLY: { en: "You asked only for phone lines, so here they are with no extras and no long contract.", hi: "आपने सिर्फ़ फोन लाइन माँगी थी, इसलिए बिना एक्स्ट्रा और बिना लंबे कॉन्ट्रैक्ट के।" },
  // notices
  AIRFIBER_SWAP: { en: (p) => `Fibre can't reach location ${p.site}, so we switched it to wireless AirFiber.`, hi: (p) => `लोकेशन ${p.site} तक फाइबर नहीं पहुँच सकता, इसलिए वायरलेस AirFiber लगाया है।` },
  WHATSAPP_ALTERNATIVE_WEBSITE: { en: "WhatsApp Business needs a GST number. Today a website with your catalogue works instead; WhatsApp can be added after GST is verified.", hi: "WhatsApp Business के लिए GST नंबर चाहिए। अभी कैटलॉग वाली वेबसाइट ले सकते हैं; GST वेरिफाई होने पर WhatsApp जोड़ें।" },
  SIM_UPGRADE_LATER: { en: "You can add internet, billing or CCTV any time after activation.", hi: "एक्टिवेशन के बाद कभी भी इंटरनेट, बिलिंग या CCTV जोड़ सकते हैं।" },
  DEP_ADDED: { en: (p) => `${plainName(String(p.for))} needs internet, so we added ${plainName(String(p.productId))} at location ${p.site}.`, hi: (p) => `${plainName(String(p.for), "hi")} के लिए इंटरनेट चाहिए, इसलिए लोकेशन ${p.site} पर ${plainName(String(p.productId), "hi")} जोड़ा।` },
  DEP_REMOVED: { en: (p) => `Removed ${p.count} item(s) at location ${p.site} that needed that internet link.`, hi: (p) => `लोकेशन ${p.site} के ${p.count} आइटम हटाए जो उसी इंटरनेट पर चलते थे।` },
  NETWORK_CONTROL_NOW_AVAILABLE: { en: "With 3 locations you can now add one control panel for all your branches.", hi: "3 लोकेशन होने पर अब सभी ब्रांच के लिए एक कंट्रोल पैनल जोड़ सकते हैं।" },
  NETWORK_CONTROL_REMOVED: { en: "The multi-location control panel was removed because it needs 3 or more locations.", hi: "मल्टी-लोकेशन कंट्रोल पैनल हटाया गया क्योंकि इसके लिए 3 या ज़्यादा लोकेशन चाहिए।" },
  // escalation
  OUT_OF_AREA: { en: "We can't sign up this city online yet. A specialist will call you.", hi: "इस शहर में अभी ऑनलाइन साइन-अप नहीं हो सकता। विशेषज्ञ आपको कॉल करेगा।" },
  MANY_SITES: { en: "With this many locations a specialist will build your plan with you.", hi: "इतनी लोकेशन के लिए विशेषज्ञ आपके साथ प्लान बनाएगा।" },
  REQUESTED_HUMAN: { en: "You asked to speak to a person — a specialist will call you.", hi: "आपने किसी व्यक्ति से बात करने को कहा — विशेषज्ञ आपको कॉल करेगा।" },
  NO_VALID_BUNDLE: { en: "We couldn't build a plan that fits automatically. A specialist will help.", hi: "हम अपने-आप सही प्लान नहीं बना सके। विशेषज्ञ मदद करेगा।" },
  OUT_OF_CATALOGUE: { en: "Part of what you need isn't in our standard plans. A specialist will look at it.", hi: "आपकी कुछ ज़रूरतें हमारे सामान्य प्लान में नहीं हैं। विशेषज्ञ देखेगा।" },
  MULTI_SITE_HIGH_VALUE: { en: "Multi-location setups benefit from a specialist. You can still continue online.", hi: "मल्टी-लोकेशन सेटअप में विशेषज्ञ मददगार होता है। आप ऑनलाइन आगे भी बढ़ सकते हैं।" },
  MFG_FIELD_LED: { en: "A field engineer will visit your unit to confirm the setup. You can still reserve your plan online.", hi: "फील्ड इंजीनियर आपकी यूनिट पर आकर सेटअप पक्का करेगा। प्लान ऑनलाइन रिज़र्व कर सकते हैं।" },
  DEDICATED_LINE: { en: "A dedicated line needs a site survey, which a field engineer will do.", hi: "डेडिकेटेड लाइन के लिए साइट सर्वे चाहिए, जो फील्ड इंजीनियर करेगा।" },
  // budget
  BUDGET_MET: { en: (p) => `Fits within your ₹${Number(p.target).toLocaleString("en-IN")} budget.`, hi: (p) => `आपके ₹${Number(p.target).toLocaleString("en-IN")} के बजट में फिट।` },
  BUDGET_NOT_MET: { en: (p) => `The lowest we can go is ₹${Number(p.min).toLocaleString("en-IN")} a month.`, hi: (p) => `सबसे कम ₹${Number(p.min).toLocaleString("en-IN")} प्रति माह तक आ सकते हैं।` },
};

export function ruleReason(ref: Ref & { productId?: string }, lang: Lang = "en"): string {
  const d = RULE_REASONS[ref.code];
  const l = lang === "hi" || lang === "mr" ? "hi" : "en";
  const params: Params = { ...(ref.params ?? {}) };
  if (ref.productId) { params.product = ref.productId; params.name = plainName(ref.productId, l); }
  return d ? f(d[l], params) : ref.code;
}

// ---- counterfactuals --------------------------------------------------------------------------
export function counterfactualText(c: { condition: string; threshold?: number; unlocks: string[] }, lang: Lang = "en"): string {
  const l = lang === "hi" || lang === "mr" ? "hi" : "en";
  const names = c.unlocks.map((u) => plainName(u, l)).join(", ");
  if (c.condition === "GST_VERIFIED") return l === "hi" ? `GST नंबर वेरिफाई होने पर जुड़ सकेगा: ${names}` : `Once your GST number is verified you can add: ${names}`;
  if (c.condition === "MORE_STAFF") return l === "hi" ? `${c.threshold}+ लोगों की टीम होने पर: ${names}` : `With ${c.threshold}+ people on your team: ${names}`;
  return l === "hi" ? `${c.threshold}+ लोकेशन होने पर: ${names}` : `With ${c.threshold}+ locations: ${names}`;
}

// ---- KYC checks: a reason AND a suggested fix for every failure ---------------------------------
const SLOT_NAME: Record<string, { en: string; hi: string }> = {
  gst_certificate: { en: "GST certificate", hi: "GST सर्टिफिकेट" },
  udyam_certificate: { en: "Udyam certificate", hi: "उद्यम सर्टिफिकेट" },
  address_proof: { en: "address proof", hi: "पता प्रमाण" },
  signatory_id: { en: "signatory ID", hi: "हस्ताक्षरकर्ता ID" },
};
export const slotName = (slot: string, lang: Lang = "en") => (SLOT_NAME[slot]?.[lang === "hi" || lang === "mr" ? "hi" : "en"] ?? slot);

const KYC: Record<string, { reason: { en: Tpl; hi: Tpl }; fix: { en: Tpl; hi: Tpl } }> = {
  DOC_MISSING: { reason: { en: "This document hasn't been provided.", hi: "यह दस्तावेज़ नहीं दिया गया है।" }, fix: { en: "Upload it, or type the number so we can look it up.", hi: "इसे अपलोड करें, या नंबर टाइप करें ताकि हम खोज सकें।" } },
  DOC_BLURRY: { reason: { en: "The photo is too blurry to read.", hi: "फोटो इतनी धुंधली है कि पढ़ी नहीं जा सकती।" }, fix: { en: "Retake it in good light, hold the phone steady and keep the whole page in view.", hi: "अच्छी रोशनी में फोन स्थिर रखकर पूरा पेज दिखाते हुए दोबारा फोटो लें।" } },
  DOC_UNREADABLE: { reason: { en: "We couldn't read this document.", hi: "हम यह दस्तावेज़ पढ़ नहीं सके।" }, fix: { en: "Upload a clearer photo or a PDF.", hi: "साफ़ फोटो या PDF अपलोड करें।" } },
  DOC_WRONG_TYPE: { reason: { en: (p) => `This looks like a different document (${String(p.got).replace(/_/g, " ")}).`, hi: (p) => `यह कोई दूसरा दस्तावेज़ लग रहा है (${String(p.got).replace(/_/g, " ")})।` }, fix: { en: "Upload the correct document in this slot.", hi: "इस जगह सही दस्तावेज़ अपलोड करें।" } },
  DOC_SKEWED: { reason: { en: "The scan is slightly tilted but readable.", hi: "स्कैन थोड़ा तिरछा है पर पढ़ा जा सकता है।" }, fix: { en: "No action needed.", hi: "कुछ करने की ज़रूरत नहीं।" } },
  DOC_DUPLICATE_SLOT: { reason: { en: (p) => `This is the same file you uploaded as your ${slotName(String(p.other))}.`, hi: (p) => `यह वही फ़ाइल है जो आपने ${slotName(String(p.other), "hi")} के रूप में अपलोड की थी।` }, fix: { en: "Upload the correct document in this slot.", hi: "इस जगह सही दस्तावेज़ अपलोड करें।" } },
  DOC_SEEN_ELSEWHERE: { reason: { en: (p) => `This exact file was also uploaded in ${p.n} other application(s).`, hi: (p) => `यही फ़ाइल ${p.n} दूसरे आवेदन(नों) में भी अपलोड हुई है।` }, fix: { en: "No action needed — a reviewer may take a quick look.", hi: "कुछ करने की ज़रूरत नहीं — समीक्षक एक बार देख सकते हैं।" } },
  FIELD_MISSING: { reason: { en: (p) => `A required field is empty (${String(p.field).replace(/_/g, " ")}).`, hi: (p) => `एक ज़रूरी जानकारी खाली है (${String(p.field).replace(/_/g, " ")})।` }, fix: { en: "Upload the complete certificate, or type the number so we can look it up.", hi: "पूरा सर्टिफिकेट अपलोड करें, या नंबर टाइप करें ताकि हम खोज सकें।" } },
  GSTIN_FORMAT: { reason: { en: "The GST number isn't in the right format.", hi: "GST नंबर सही फ़ॉर्मेट में नहीं है।" }, fix: { en: "It has 15 characters. Check it against your certificate.", hi: "इसमें 15 अक्षर होते हैं। अपने सर्टिफिकेट से मिलाएँ।" } },
  GSTIN_CHECKSUM: { reason: { en: "This GST number doesn't pass its check digit — probably a typing mistake.", hi: "यह GST नंबर अपनी चेक-डिजिट जाँच में फेल है — शायद टाइपिंग की गलती।" }, fix: { en: (p) => p.suggestion ? `Did you mean ${String(p.suggestion).slice(0, 4)}•••••••${String(p.suggestion).slice(-4)} (${p.suggestionName})?` : "Check the number against your certificate.", hi: (p) => p.suggestion ? `क्या आपका मतलब ${String(p.suggestion).slice(0, 4)}•••••••${String(p.suggestion).slice(-4)} (${p.suggestionName}) है?` : "अपने सर्टिफिकेट से नंबर मिलाएँ।" } },
  GSTIN_NOT_FOUND: { reason: { en: "We can't find this GST number in the records.", hi: "यह GST नंबर रिकॉर्ड में नहीं मिला।" }, fix: { en: "Check the number, or continue without GST products.", hi: "नंबर जाँचें, या GST वाले प्रोडक्ट के बिना आगे बढ़ें।" } },
  GSTIN_CANCELLED: { reason: { en: "This GST registration is cancelled.", hi: "यह GST रजिस्ट्रेशन रद्द है।" }, fix: { en: "We've removed the products that need GST. You can continue with the rest, and add them back after re-registering.", hi: "GST वाले प्रोडक्ट हटा दिए हैं। बाकी के साथ आगे बढ़ें; दोबारा रजिस्टर होने पर जोड़ सकते हैं।" } },
  GSTIN_SUSPENDED: { reason: { en: "This GST registration is suspended.", hi: "यह GST रजिस्ट्रेशन निलंबित है।" }, fix: { en: "We've removed the products that need GST. You can continue with the rest.", hi: "GST वाले प्रोडक्ट हटा दिए हैं। बाकी के साथ आगे बढ़ सकते हैं।" } },
  GSTIN_STATE_MISMATCH: { reason: { en: "The state in the GST number doesn't match the registered address.", hi: "GST नंबर का राज्य रजिस्टर्ड पते से मेल नहीं खाता।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
  GSTIN_DOC_ENTERED_MISMATCH: { reason: { en: "The GST number on the certificate differs from the one you typed.", hi: "सर्टिफिकेट पर GST नंबर आपके टाइप किए नंबर से अलग है।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
  GSTIN_OCR_REPAIRED: { reason: { en: "We corrected a character our reader was unsure about, and confirmed it in the records.", hi: "हमारे रीडर को जिस अक्षर पर शक था उसे ठीक किया और रिकॉर्ड से पुष्टि की।" }, fix: { en: "No action needed.", hi: "कुछ करने की ज़रूरत नहीं।" } },
  GST_DOC_REGISTRY_MISMATCH: { reason: { en: (p) => `The ${String(p.field).replace(/_/g, " ")} on the certificate doesn't match GST records.`, hi: (p) => `सर्टिफिकेट का ${String(p.field).replace(/_/g, " ")} GST रिकॉर्ड से मेल नहीं खाता।` }, fix: { en: "A reviewer will check this, usually within 4 working hours.", hi: "समीक्षक इसकी जाँच करेगा, आमतौर पर 4 कार्य-घंटों में।" } },
  UDYAM_FORMAT: { reason: { en: "The Udyam number isn't in the right format.", hi: "उद्यम नंबर सही फ़ॉर्मेट में नहीं है।" }, fix: { en: "It looks like UDYAM-XX-00-0000000.", hi: "यह UDYAM-XX-00-0000000 जैसा दिखता है।" } },
  UDYAM_NOT_FOUND: { reason: { en: "We can't find this Udyam number in the records.", hi: "यह उद्यम नंबर रिकॉर्ड में नहीं मिला।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
  UDYAM_NAME_MISMATCH: { reason: { en: "The business name on the Udyam certificate differs from the records.", hi: "उद्यम सर्टिफिकेट का बिज़नेस नाम रिकॉर्ड से अलग है।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
  UDYAM_STATE_MISMATCH: { reason: { en: "The state code in the Udyam number doesn't match the registered state.", hi: "उद्यम नंबर का राज्य-कोड रजिस्टर्ड राज्य से मेल नहीं खाता।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
  NAME_MISMATCH: { reason: { en: (p) => `The business name differs between documents ("${p.a}" vs "${p.b}").`, hi: (p) => `दस्तावेज़ों में बिज़नेस नाम अलग है ("${p.a}" बनाम "${p.b}")।` }, fix: { en: "A reviewer will check this, or upload a corrected document.", hi: "समीक्षक जाँच करेगा, या सुधारा हुआ दस्तावेज़ अपलोड करें।" } },
  ADDRESS_MISMATCH: { reason: { en: "The address on this document doesn't match your registered address.", hi: "इस दस्तावेज़ का पता आपके रजिस्टर्ड पते से मेल नहीं खाता।" }, fix: { en: "Upload a bill for the business address, or a reviewer will check.", hi: "बिज़नेस पते का बिल अपलोड करें, या समीक्षक जाँच करेगा।" } },
  ADDRESS_PROOF_STALE: { reason: { en: (p) => `The bill is dated ${p.billDate} — ${p.days} days old. We accept bills up to ${p.max} days old.`, hi: (p) => `बिल की तारीख ${p.billDate} है — ${p.days} दिन पुराना। हम ${p.max} दिन तक पुराना बिल मानते हैं।` }, fix: { en: "Upload your latest electricity, water or gas bill.", hi: "अपना सबसे नया बिजली, पानी या गैस का बिल अपलोड करें।" } },
  ADDRESS_PROOF_FUTURE: { reason: { en: "The bill date is in the future.", hi: "बिल की तारीख आगे की है।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
  SIGNATORY_ID_EXPIRED: { reason: { en: (p) => `This ID expired on ${p.validTill}.`, hi: (p) => `यह ID ${p.validTill} को एक्सपायर हो चुकी है।` }, fix: { en: "Upload a valid ID.", hi: "वैध ID अपलोड करें।" } },
  SIGNATORY_NAME_MISMATCH: { reason: { en: (p) => `The name on this ID (${p.onId}) is different from the name on your account (${p.holder}).`, hi: (p) => `इस ID पर नाम (${p.onId}) आपके अकाउंट के नाम (${p.holder}) से अलग है।` }, fix: { en: "If a partner or director is signing for the business, a reviewer will confirm. If not, upload your own ID.", hi: "अगर पार्टनर या डायरेक्टर बिज़नेस की ओर से साइन कर रहे हैं, तो समीक्षक पुष्टि करेगा। नहीं तो अपनी ID अपलोड करें।" } },
  SIGNATORY_NOT_LINKED: { reason: { en: "We can't link this ID to the business owner or authorised person.", hi: "हम इस ID को बिज़नेस मालिक या अधिकृत व्यक्ति से जोड़ नहीं पाए।" }, fix: { en: "A reviewer will check this.", hi: "समीक्षक इसकी जाँच करेगा।" } },
};
export function kycReason(code: string, params: Params | undefined, lang: Lang = "en") {
  const d = KYC[code];
  const l = lang === "hi" || lang === "mr" ? "hi" : "en";
  if (!d) return { reason: code, fix: "" };
  return { reason: f(d.reason[l], params ?? {}), fix: f(d.fix[l], params ?? {}) };
}
void nm;
