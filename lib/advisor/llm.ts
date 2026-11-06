/**
 * Advisor ↔ Gemini. Two jobs only, both constrained:
 *   llmExtract  — turn the owner's message (any language) into structured facts. Never recommends, never prices.
 *   llmExplain  — write the plan explanation in the owner's language from the rules engine's output, then PASS A CHECK:
 *                 every number in the text must come from that output and no product codes may appear; otherwise it is discarded.
 */
import "server-only";
import { geminiConfigured, geminiJson, GeminiError, type Schema } from "@/lib/ai/gemini";
import type { Lang } from "@/lib/catalogue/plain";
import type { Facts } from "./extract";

const NEEDS = ["payments", "cctv", "whatsapp", "sms", "email", "backup", "uptime", "static_ip", "phone_system", "tollfree", "wifi", "website", "fleet", "machines", "security", "multisite_mgmt", "sim_only", "fast_internet"];
const INTERNET = ["hotspot", "home_bb", "biz_bb", "leased", "mixed", "none"];

const FACTS_SCHEMA: Schema = {
  type: "OBJECT",
  properties: {
    businessType: { type: "STRING", nullable: true, description: "Short English label, e.g. pharmacy, dental clinic, restaurant chain, textile unit, CA firm" },
    employees: { type: "INTEGER", nullable: true, description: "People working there including the owner" },
    sites: { type: "INTEGER", nullable: true, description: "Number of locations/branches/shops" },
    city: { type: "STRING", nullable: true, description: "City name in English" },
    gst: { type: "STRING", nullable: true, enum: ["yes", "no"], description: "Whether the business has a GST number" },
    udyam: { type: "STRING", nullable: true, enum: ["yes", "no"] },
    currentInternet: { type: "STRING", nullable: true, enum: INTERNET },
    currentSpend: { type: "INTEGER", nullable: true, description: "Current monthly telecom/internet spend in INR if stated" },
    budget: { type: "INTEGER", nullable: true, description: "Maximum monthly budget in INR if the owner states one" },
    vehicles: { type: "INTEGER", nullable: true }, machines: { type: "INTEGER", nullable: true },
    needs: { type: "ARRAY", items: { type: "STRING", enum: NEEDS }, description: "What the owner wants to do / have" },
    explicitHuman: { type: "BOOLEAN", description: "True only if the owner asks to talk to a person" },
    otherNeeds: { type: "ARRAY", items: { type: "STRING" }, description: "Requirements that fit none of the allowed needs" },
    cameras: { type: "INTEGER", nullable: true, description: "Number of CCTV cameras per location if the owner states one" },
    phoneLines: { type: "INTEGER", nullable: true, description: "Number of business mobile lines/SIMs if the owner states one" },
    intent: { type: "STRING", enum: ["describe", "question", "change", "smalltalk", "other"], description: "describe = gives facts about the business; question = asks something about plans, products, price, installation, process, documents, privacy; change = wants to add/remove/resize something in the plan or corrects a fact; smalltalk = greeting/thanks" },
    question: { type: "STRING", nullable: true, description: "If intent is question: the question restated clearly in English" },
    languageRequest: { type: "STRING", nullable: true, enum: ["en", "hi", "mr", "ta"], description: "Set ONLY if the owner asks to switch the conversation language (e.g. 'hindi mein batao' → hi, 'speak English' → en)" },
    removeNeeds: { type: "ARRAY", items: { type: "STRING", enum: NEEDS }, description: "Features the owner says they do NOT want or wants removed" },
    changedFields: { type: "ARRAY", items: { type: "STRING", enum: ["businessType", "employees", "sites", "city", "gst", "udyam", "currentInternet", "currentSpend", "budget", "vehicles", "machines"] }, description: "Facts the owner is CORRECTING or updating from what they said before (e.g. 'actually we have 3 shops' → sites)" },
  },
  required: ["needs", "explicitHuman", "otherNeeds", "intent", "removeNeeds", "changedFields"],
};

const EXTRACT_SYSTEM = `You extract facts from a small-business owner's message in India. The message may be in English, Hindi, Marathi, Tamil, Telugu, Kannada, Gujarati, Bengali, Punjabi, Malayalam or a mix (Hinglish).
Rules: record ONLY what the owner actually said — never guess or infer a missing fact; use null for anything not stated.
needs: payments = UPI/card/billing/POS; cctv = cameras; whatsapp = WhatsApp for customers; email = work email; security = antivirus/firewall; uptime = a BACKUP INTERNET LINE / failover / internet that never goes down (NOT file backup); backup = CLOUD BACKUP of files/data only; wifi = managed Wi-Fi for customers/staff; sim_only = ONLY wants mobile SIMs and nothing else; multisite_mgmt = one control/central management of many branches; fast_internet = asks for very high speed / 1 Gbps.
"Reliable internet" alone is NOT a need (every plan includes internet). explicitHuman only if they ask for a person/call back.
Questions ("why do I need CCTV?", "how long is installation?", "do you have a leased line?") are intent=question — do NOT add needs for features merely asked about.
"Remove the CCTV" / "I don't need billing" → removeNeeds. "Make it 4 cameras" → cameras=4, intent=change.
Hypotheticals ("what if I drop CCTV?", "how much would I save without billing?") are intent=question with EMPTY removeNeeds — only a clear instruction changes the plan.`;

export type LlmStatus = { used: true } | { used: false; reason: "NOT_CONFIGURED" | "RATE_LIMITED" | "UNAVAILABLE" | "BAD_RESPONSE" | "REJECTED" };

export interface ExtractMeta { intent: "describe" | "question" | "change" | "smalltalk" | "other"; question?: string; languageRequest?: Lang; removeNeeds: Facts["needs"]; changedFields: (keyof Facts)[] }

/** `context` is the last advisor message, so short replies ("4", "no, 3 shops") are understood in context. */
export async function llmExtract(text: string, context?: string): Promise<{ facts: Partial<Facts> | null; meta: ExtractMeta | null; status: LlmStatus }> {
  if (!geminiConfigured()) return { facts: null, meta: null, status: { used: false, reason: "NOT_CONFIGURED" } };
  try {
    const prompt = `${context ? `Advisor's previous message (context only):\n"""${context.slice(0, 600)}"""\n\n` : ""}Owner's message:\n"""${text.slice(0, 1200)}"""`;
    const r = await geminiJson<Record<string, unknown>>({ system: EXTRACT_SYSTEM, parts: [{ text: prompt }], schema: FACTS_SCHEMA });
    return { facts: sanitiseFacts(r), meta: sanitiseMeta(r), status: { used: true } };
  } catch (e) {
    return { facts: null, meta: null, status: { used: false, reason: e instanceof GeminiError ? e.code : "UNAVAILABLE" } };
  }
}

const FIELDS = ["businessType", "employees", "sites", "city", "gst", "udyam", "currentInternet", "currentSpend", "budget", "vehicles", "machines"];
export function sanitiseMeta(r: Record<string, unknown>): ExtractMeta {
  const intent = ["describe", "question", "change", "smalltalk", "other"].includes(String(r.intent)) ? (r.intent as ExtractMeta["intent"]) : "describe";
  return {
    intent,
    question: typeof r.question === "string" && r.question.trim() ? r.question.trim().slice(0, 300) : undefined,
    languageRequest: ["en", "hi", "mr", "ta"].includes(String(r.languageRequest)) ? (r.languageRequest as Lang) : undefined,
    removeNeeds: Array.isArray(r.removeNeeds) ? (r.removeNeeds.filter((n) => typeof n === "string" && NEEDS.includes(n)) as Facts["needs"]) : [],
    changedFields: Array.isArray(r.changedFields) ? (r.changedFields.filter((n) => typeof n === "string" && FIELDS.includes(n)) as (keyof Facts)[]) : [],
  };
}

/** Model output is untrusted input: clamp, whitelist and drop anything implausible before it can touch the profile. */
export function sanitiseFacts(r: Record<string, unknown>): Partial<Facts> {
  const out: Partial<Facts> = {};
  const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
  if (typeof r.businessType === "string" && r.businessType.trim()) out.businessType = r.businessType.trim().slice(0, 60);
  out.employees = int(r.employees, 1, 5000);
  out.sites = int(r.sites, 1, 500);
  if (typeof r.city === "string" && r.city.trim()) out.city = r.city.trim().slice(0, 40);
  if (r.gst === "yes" || r.gst === "no") out.gst = r.gst;
  if (r.udyam === "yes" || r.udyam === "no") out.udyam = r.udyam;
  if (typeof r.currentInternet === "string" && INTERNET.includes(r.currentInternet)) out.currentInternet = r.currentInternet as Facts["currentInternet"];
  out.currentSpend = int(r.currentSpend, 100, 10_000_000);
  out.budget = int(r.budget, 100, 10_000_000);
  out.vehicles = int(r.vehicles, 1, 1000);
  out.machines = int(r.machines, 1, 1000);
  out.needs = Array.isArray(r.needs) ? (r.needs.filter((n) => typeof n === "string" && NEEDS.includes(n)) as Facts["needs"]) : [];
  out.explicitHuman = r.explicitHuman === true;
  out.otherNeeds = Array.isArray(r.otherNeeds) ? r.otherNeeds.filter((n): n is string => typeof n === "string").slice(0, 5).map((s) => s.slice(0, 60)) : [];
  out.cameras = int(r.cameras, 1, 20);
  out.phoneLines = int(r.phoneLines, 1, 50);
  return out;
}

// ---- explanation ---------------------------------------------------------------------------------------------
const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hindi (Devanagari script)", mr: "Marathi (Devanagari script)", ta: "Tamil (Tamil script)" };
const DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9", "௦": "0", "௧": "1", "௨": "2", "௩": "3", "௪": "4", "௫": "5", "௬": "6", "௭": "7", "௮": "8", "௯": "9" };

export function numbersIn(s: string): number[] {
  const ascii = s.replace(/[०-९௦-௯]/g, (d) => DIGITS[d]);
  return (ascii.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
}

/** The explanation may only use numbers that appear in the engine's own output, and never a product code. */
export function explanationIsFaithful(text: string, allowed: Set<number>): boolean {
  if (/\bP\d{2}\b/.test(text)) return false;
  return numbersIn(text).every((n) => allowed.has(n));
}

export interface PlanFacts { bundleName: string; monthly: number; setup: number; gstPercent: number; contractMonths: number; items: string[]; why: string[]; notIncluded: string[]; notes: string[]; city: string; businessType: string; goLive: string }

export async function llmExplain(lang: Lang, plan: PlanFacts): Promise<string | null> {
  if (!geminiConfigured()) return null;
  const context = JSON.stringify(plan);
  const allowed = new Set<number>(numbersIn(context).concat([plan.gstPercent]));
  try {
    const r = await geminiJson<{ message: string }>({
      system: `You are a warm, plain-spoken Airtel Business advisor writing to a small-business owner in India, in ${LANG_NAME[lang]}.
Write 3 to 5 short sentences that explain the recommended plan using ONLY the facts in the JSON. Hard rules:
- Never state a number, price, quantity or date that is not in the JSON. Never invent a feature, discount or saving.
- Mention the monthly price (plus GST) and setup fee exactly as given. Wrap the plan name in **double asterisks** once.
- If "notIncluded" has items, say clearly that they are not included and why, in your own words, and what works instead if "notes" says so.
- No product codes, no jargon, no markdown other than the one **plan name**.`,
      parts: [{ text: `Facts (authoritative):\n${context}` }],
      schema: { type: "OBJECT", properties: { message: { type: "STRING" } }, required: ["message"] },
    });
    const msg = String(r.message ?? "").trim();
    if (msg.length < 20 || msg.length > 900) return null;
    if (!explanationIsFaithful(msg, allowed)) return null; // discarded: it said something the rules engine didn't
    return msg;
  } catch { return null; }
}

// ---- grounded answers ----------------------------------------------------------------------------------------
/**
 * Answers an owner's question from a JSON context built by code (their current plan from the rules engine, the catalogue, and how the
 * journey works). Same faithfulness gate as the explanation: any number not present in the context → the answer is discarded, and the
 * caller says honestly that a specialist can help. The model never decides eligibility or price; it only reads them out.
 */
export async function llmAnswer(lang: Lang, question: string, context: unknown): Promise<string | null> {
  if (!geminiConfigured()) return null;
  const ctx = JSON.stringify(context);
  const allowed = new Set<number>(numbersIn(ctx).concat([18, 24, 1, 2, 3]));
  try {
    const r = await geminiJson<{ answer: string; answerable: boolean }>({
      system: `You are a warm, plain-spoken Airtel Business advisor answering a small-business owner in India, in ${LANG_NAME[lang]}.
Answer the question in 2 to 4 short sentences using ONLY the JSON context. Hard rules:
- Never state a price, quantity, duration or date that is not in the context. Never promise discounts, offers or anything not in the context.
- Eligibility comes only from the context (eligibility text / notIncluded reasons). If something is not available to them, say why in plain words.
- If the context does not contain the answer, set answerable=false and say a specialist can help (the owner can type "human").
- To change the plan, the owner can simply tell you (e.g. "remove CCTV", "make it 4 cameras") or tap "Customise & buy". No product codes. No markdown except *bold* once at most.`,
      parts: [{ text: `Context (authoritative):\n${ctx}\n\nOwner's question: ${question.slice(0, 400)}` }],
      schema: { type: "OBJECT", properties: { answer: { type: "STRING" }, answerable: { type: "BOOLEAN" } }, required: ["answer", "answerable"] },
    });
    const msg = String(r.answer ?? "").trim();
    if (msg.length < 10 || msg.length > 1100) return null;
    if (!explanationIsFaithful(msg, allowed)) return null;
    return msg;
  } catch { return null; }
}
