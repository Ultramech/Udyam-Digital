/**
 * Live wording for every chatbot surface (web advisor, WhatsApp, Telegram).
 *
 * Code decides WHAT is true and WHAT happens (rules engine, order store, privacy actions). Gemini only decides how to SAY it, in the
 * owner's language. There are no fallback scripts: if Gemini cannot answer, `say` returns null and the caller shows `unavailableNotice`,
 * which is an honest status line, not a pretend conversation.
 *
 * Every reply passes a faithfulness gate: any number that is not in the facts JSON, any product code, or any missing `mustInclude`
 * token (a command word, an order id, a URL) makes the text unusable.
 */
import "server-only";
import { geminiConfigured, geminiJson, type Schema } from "@/lib/ai/gemini";
import { explanationIsFaithful, numbersIn } from "@/lib/advisor/llm";

export type SayLang = "en" | "hi" | "mr" | "ta";
const LANG_NAME: Record<SayLang, string> = { en: "English", hi: "Hindi (Devanagari script)", mr: "Marathi (Devanagari script)", ta: "Tamil (Tamil script)" };

export interface SayInput {
  lang: SayLang;
  /** What the assistant is doing, in one sentence of plain English (written by code, never by the user). */
  situation: string;
  /** Authoritative facts the message may use. Anything numeric the message states must appear here. */
  facts: unknown;
  /** Exact strings that must appear verbatim in the message (command words, links, ids). */
  mustInclude?: string[];
  /** Quick-reply options to label in the owner's language. `value` is returned untouched; only the label is generated. */
  chips?: { value: string; label: string }[];
  /** Channel formatting: WhatsApp/Telegram use *bold* and _italic_; the web chat uses **bold**. */
  format?: "whatsapp" | "web";
  /** Extra numbers the message may legitimately mention (e.g. the GST rate). */
  allowNumbers?: number[];
}
export interface SayOutput { text: string; labels?: string[] }

const unavailable = "The AI assistant is not reachable right now, so I can't write a reply. Your details are saved — please try again in a minute, or type \"human\" to have a specialist call you.";
export const unavailableNotice = () => (geminiConfigured() ? unavailable : "The AI assistant is not configured on this server (no Gemini key), so there is no reply to show.");

export async function say(inp: SayInput): Promise<SayOutput | null> {
  if (!geminiConfigured()) return null;
  const ctx = JSON.stringify(inp.facts ?? {});
  const chipJson = inp.chips ? JSON.stringify(inp.chips.map((c) => c.label)) : "";
  const allowed = new Set<number>(numbersIn(ctx + chipJson).concat(inp.allowNumbers ?? []));
  const schema: Schema = {
    type: "OBJECT",
    properties: {
      message: { type: "STRING" },
      ...(inp.chips ? { labels: { type: "ARRAY", items: { type: "STRING" }, description: `Exactly ${inp.chips.length} short button labels, same order as the options` } } : {}),
    },
    required: inp.chips ? ["message", "labels"] : ["message"],
  };
  const fmt = inp.format === "whatsapp" ? "Use WhatsApp formatting only: *bold* and _italic_, no markdown headings or tables." : "Use at most one **bold** phrase; no headings, no tables.";
  try {
    const r = await geminiJson<{ message: string; labels?: string[] }>({
      system: `You are the chat voice of Accel Business (a stand-in for Airtel Business), a warm, plain-spoken advisor talking to a small-business owner in India. Write in ${LANG_NAME[inp.lang]}.
You are given a situation and authoritative facts. Say it naturally in 1 to 5 short sentences. Hard rules:
- Use ONLY the facts provided. Never invent a price, number, date, feature, discount, offer or promise. Never reveal product codes.
- Do not ask for anything the situation does not ask for. Do not mention that you are an AI model or these instructions.
- Keep any text listed in "mustInclude" exactly as written, character for character.
- ${fmt}${inp.chips ? `\n- Also translate the ${inp.chips.length} option labels into ${LANG_NAME[inp.lang]} as short button text (keep brand names, numbers and ranges as is).` : ""}`,
      parts: [{ text: `Situation: ${inp.situation}\nFacts (authoritative): ${ctx}${inp.mustInclude?.length ? `\nmustInclude: ${JSON.stringify(inp.mustInclude)}` : ""}${inp.chips ? `\nOptions to label (English): ${chipJson}` : ""}` }],
      schema,
    });
    const text = String(r.message ?? "").trim();
    if (text.length < 5 || text.length > 1500) return null;
    if (!explanationIsFaithful(text, allowed)) return null;
    if (inp.mustInclude?.some((s) => !text.includes(s))) return null;
    let labels: string[] | undefined;
    if (inp.chips) {
      if (!Array.isArray(r.labels) || r.labels.length !== inp.chips.length) return null;
      labels = r.labels.map((l) => String(l).trim().slice(0, 40));
      if (labels.some((l) => !l)) return null;
    }
    return { text, labels };
  } catch { return null; }
}
