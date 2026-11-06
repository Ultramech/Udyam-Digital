import { canonicalCity, findBusinessType, KNOWN_CITIES } from "@/lib/rules/normalise";
import type { CurrentInternet, Need } from "@/lib/rules/types";

/** Everything the advisor can learn about a business. `undefined` = not yet known. */
export interface Facts {
  businessType?: string;
  employees?: number;
  sites?: number;
  city?: string;
  gst?: "yes" | "no";
  gstinText?: string;
  udyam?: "yes" | "no";
  currentInternet?: CurrentInternet;
  currentSpend?: number;
  needs: Need[];
  notSureNeeds?: boolean;
  budget?: number;
  vehicles?: number;
  machines?: number;
  explicitHuman?: boolean;
  otherNeeds?: string[];
  declined?: Need[];
  cameras?: number;
  phoneLines?: number;
}
export const emptyFacts = (): Facts => ({ needs: [] });

const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  एक: 1, दो: 2, तीन: 3, चार: 4, पाँच: 5, पांच: 5, छह: 6, छः: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, ग्यारह: 11, बारह: 12, पंद्रह: 15, बीस: 20, तीस: 30, चालीस: 40, पचास: 50,
};
const DEV_DIGITS = "०१२३४५६७८९";
const asciiDigits = (s: string) => s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
const NUM = "(\\d+|" + Object.keys(WORDS).join("|") + ")";
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORDS[s.toLowerCase()]);

const EMP_UNITS = "(?:employees?|staff|people|persons?|workers?|members?|colleagues|team members|कर्मचारी(?:यों)?|लोग|स्टाफ|कामगार|सदस्य)";
const SITE_UNITS = "(?:shops?|stores?|outlets?|branches|branch|locations?|sites?|offices?|clinics?|restaurants?|showrooms?|factories|units?|plants?|ब्रांच|दुकानें|दुकान|शाखा(?:एं|ओं)?|लोकेशन|आउटलेट|ऑफिस|क्लिनिक)";

const NEEDS: [Need, RegExp][] = [
  ["sim_only", /\bonly (?:a )?(?:sim|mobile|phone)s?\b|\bjust (?:a )?(?:sim|mobile|phone)s?\b|सिर्फ़? ?सिम|केवल सिम|सिर्फ़? ?मोबाइल/i],
  ["payments", /\bupi\b|billing|\bpos\b|card machine|card payment|payments?\b|\bgst bill|invoice|यूपीआई|बिलिंग|पेमेंट|कार्ड मशीन|क्यूआर/i],
  ["cctv", /cctv|camera|सीसीटीवी|कैमरा/i],
  ["whatsapp", /whats ?app|व्हाट्सएप|व्हाट्सऐप/i],
  ["sms", /\bsms\b|text messages|एसएमएस/i],
  ["email", /\be-?mail|work email|ईमेल/i],
  ["backup", /cloud backup|data backup|\bbackup of (?:files|data)|बैकअप/i],
  ["uptime", /fail ?over|backup (?:internet|line|connection)|never (?:goes?|go) down|downtime|goes down|uptime|internet (?:keeps )?(?:going|drops?)|अक्सर बंद|बैकअप इंटरनेट/i],
  ["static_ip", /static ip|fixed ip|स्टैटिक ip/i],
  ["phone_system", /\bivr\b|cloud phone|call cent(?:re|er)|\bpbx\b|landline|business phone system|फोन सिस्टम/i],
  ["tollfree", /toll[- ]?free|\b1800\b|टोल[- ]?फ्री/i],
  ["wifi", /guest wi-?fi|wi-?fi for (?:customers|guests)|customer wi-?fi|गेस्ट वाई-?फाई|ग्राहकों के लिए वाई-?फाई/i],
  ["website", /website|web site|वेबसाइट/i],
  ["fleet", /vehicles?|fleet|gps|\btrucks?\b|\bcabs?\b|वाहन|गाड़ी|गाड़ियाँ|ट्रक/i],
  ["machines", /machines?|sensors?|\biot\b|machine monitoring|मशीन|सेंसर/i],
  ["security", /security|anti-?virus|firewall|ransomware|cyber|सुरक्षा|एंटीवायरस|फ़ायरवॉल|फायरवॉल/i],
  ["multisite_mgmt", /all (?:my )?(?:branches|locations|shops|outlets)|central(?:ly)? (?:control|manage)|one control|सभी (?:ब्रांच|दुकान)/i],
  ["fast_internet", /1 ?gbps|gigabit|fastest|very fast|high[- ]speed|तेज़ इंटरनेट|हाई स्पीड/i],
];

export function extractFacts(textRaw: string, prev: Facts = emptyFacts()): Facts {
  const text = asciiDigits(textRaw);
  const out: Facts = { ...prev, needs: [...prev.needs] };

  // business type
  const bt = findBusinessType(text);
  const GENERIC = /^(Shop|Office|Factory|Clinic|Restaurant)$/;
  // a specific type (Pharmacy) is never overwritten by a generic one (Shop); a generic one is replaced by a specific one
  if (bt && (!out.businessType || GENERIC.test(out.businessType) || !GENERIC.test(bt.name))) out.businessType = bt.name;

  // employees
  const emp = text.match(new RegExp(`${NUM}\\s*(?:\\+\\s*)?${EMP_UNITS}`, "i")) ?? text.match(new RegExp(`(?:team|staff) of ${NUM}`, "i"));
  if (emp) out.employees = toNum(emp[1]);
  else if (/\bjust me\b|\bonly me\b|\bsolo\b|अकेला|अकेली|सिर्फ़? मैं/i.test(text)) out.employees = 1;

  // sites
  const site = text.match(new RegExp(`${NUM}\\s*${SITE_UNITS}`, "i"));
  if (site && !emp?.[0]?.includes(site[0])) out.sites = toNum(site[1]);
  else if (!/chain|branches|locations|outlets|multiple|several/i.test(text) && /\b(?:a|an|one|single|my|our)\s+(?:\w+\s+){0,2}(?:shop|store|clinic|office|outlet|restaurant|pharmacy|salon|bakery|firm|studio|centre|center|lab|factory|workshop|unit)\b|एक दुकान|सिर्फ़? एक/i.test(text)) out.sites = 1;

  // city
  const lower = text.toLowerCase();
  const hit = KNOWN_CITIES.find((c) => lower.includes(c.toLowerCase())) ?? ["bangalore", "bombay", "calcutta", "vizag", "mysore", "इंदौर", "दिल्ली", "मुंबई", "पुणे", "जयपुर", "लखनऊ", "भोपाल", "पटना", "नागपुर", "सूरत", "कोलकाता"].find((c) => lower.includes(c));
  if (hit) out.city = canonicalCity(hit) ?? hit;
  else {
    const m = textRaw.match(/\b(?:in|at|from|based in)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)/);
    if (m && !findBusinessType(m[1])) out.city = m[1];
  }

  // GST
  const g15 = text.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/);
  if (g15) { out.gst = "yes"; out.gstinText = g15[0]; }
  else if (/(?:no|don'?t have|do not have|without|not have|haven'?t|nahi|नहीं|बिना)\W+(?:\w+\W+){0,3}(?:gst|gstin|जीएसटी)|(?:gst|gstin|जीएसटी)\W+(?:\w+\W+){0,3}(?:nahi|नहीं|not|no|applied|pending)/i.test(text)) out.gst = "no";
  else if (/(?:have|with|got|registered|है)\W+(?:\w+\W+){0,3}(?:gst|gstin|जीएसटी)|(?:gst|gstin|जीएसटी)\W+(?:\w+\W+){0,3}(?:registered|number|है|yes|active)/i.test(text)) out.gst = "yes";

  // Udyam
  if (/udyam|उद्यम/i.test(text)) out.udyam = /(?:no|not|without|नहीं)\W+(?:\w+\W+){0,2}(?:udyam|उद्यम)/i.test(text) ? "no" : "yes";

  // current internet
  if (/hotspot|mobile data|phone data|हॉटस्पॉट|मोबाइल डेटा/i.test(text)) out.currentInternet = "hotspot";
  else if (/home (?:broadband|wifi|wi-fi|internet)|घर का (?:इंटरनेट|वाईफाई)/i.test(text)) out.currentInternet = "home_bb";
  else if (/leased line/i.test(text)) out.currentInternet = "leased";
  else if (/business (?:broadband|fibre|fiber|internet)/i.test(text)) out.currentInternet = "biz_bb";
  else if (/no internet|without internet|इंटरनेट नहीं/i.test(text)) out.currentInternet = "none";

  // money
  const spend = text.match(/(?:spend|pay|paying|bill|costs?)[^\d₹]{0,25}(?:₹|rs\.?|inr)?\s*([\d,]{3,6})(?:\s*(?:a|per|\/|every)\s*month)?/i) ?? text.match(/(?:₹|rs\.?)\s*([\d,]{3,6})\s*(?:a|per|\/|every)?\s*month/i);
  const budget = text.match(/(?:under|below|within|less than|upto|up to|max(?:imum)?|budget(?: of| is)?)\s*(?:₹|rs\.?|inr)?\s*([\d,]{3,6})/i) ?? text.match(/([\d,]{3,6})\s*(?:से कम|तक|के अंदर)/);
  if (budget) out.budget = Number(budget[1].replace(/,/g, ""));
  else if (spend) out.currentSpend = Number(spend[1].replace(/,/g, ""));

  // vehicles / machines counts
  const veh = text.match(new RegExp(`${NUM}\\s*(?:vehicles?|trucks?|cabs?|cars?|gaadi|गाड़ी|गाड़ियाँ|वाहन)`, "i"));
  if (veh) out.vehicles = toNum(veh[1]);
  const mach = text.match(new RegExp(`${NUM}\\s*(?:machines?|sensors?|मशीन(?:ें)?)`, "i"));
  if (mach) out.machines = toNum(mach[1]);

  // needs
  const simOnly = NEEDS.find(([n, re]) => n === "sim_only" && re.test(text));
  for (const [n, re] of NEEDS) if (n !== "sim_only" && re.test(text) && !out.needs.includes(n)) out.needs.push(n);
  if (simOnly && !out.needs.length) out.needs = ["sim_only"];
  if (/not sure|don'?t know|you tell me|suggest|recommend|पता नहीं|आप बताइए|आप बताओ/i.test(text) && !out.needs.length) out.notSureNeeds = true;
  if (out.needs.length) out.notSureNeeds = false;
  if (/drone|satellite|submarine|erp implementation|data ?cent(?:re|er)|cloud migration/i.test(text)) out.otherNeeds = [...(out.otherNeeds ?? []), "custom"];

  // wants a person
  if (/(?:talk|speak|connect|chat) (?:to|with) (?:a |an |some)?(?:person|human|someone|agent|executive|representative|sales)|call me|human please|बात करनी|कॉल करें|इंसान से|किसी से बात/i.test(text)) out.explicitHuman = true;

  return out;
}

/** Slots a chip answer can fill directly (no parsing ambiguity). */
export type Slot = "businessType" | "employees" | "sites" | "city" | "gst" | "needs" | "currentInternet" | "udyam";
export function applyChip(prev: Facts, slot: Slot, value: string): Facts {
  const out: Facts = { ...prev, needs: [...prev.needs] };
  switch (slot) {
    case "businessType": out.businessType = value; break;
    case "employees": out.employees = Number(value); break;
    case "sites": out.sites = Number(value); break;
    case "city": out.city = canonicalCity(value) ?? value; break;
    case "gst": out.gst = value === "yes" ? "yes" : "no"; break;
    case "udyam": out.udyam = value === "yes" ? "yes" : "no"; break;
    case "currentInternet": out.currentInternet = value as CurrentInternet; break;
    case "needs": {
      if (value === "not_sure") { out.notSureNeeds = true; break; }
      const vs = value.split(",") as Need[];
      for (const v of vs) if (!out.needs.includes(v)) out.needs.push(v);
      out.notSureNeeds = false;
      break;
    }
  }
  return out;
}
