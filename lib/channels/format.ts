import type { QuickReply } from "@/lib/advisor/orchestrator";

/** WhatsApp bold is *x* (the advisor writes **x**). Nothing else is rewritten. */
export const toWhatsAppText = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "*$1*");

/** WhatsApp rejects bodies over 1600 characters; split on paragraph/line boundaries, never mid-word. */
export function splitMessage(text: string, max = 1400): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    const piece = para.length > max ? para.match(new RegExp(`.{1,${max}}(\\s|$)`, "gs"))?.map((x) => x.trim()) ?? [para.slice(0, max)] : [para];
    for (const p of piece) {
      if (cur && (cur + "\n\n" + p).length > max) { out.push(cur); cur = p; }
      else cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
}

const RANGE = /^(\d+)\s*(?:[–-]\s*(\d+)|(\+))?$/;
/** Chips like "1", "2–3", "25+" are number ranges (staff, sites). A typed number must mean a VALUE there, never "option #n". */
export const numericChips = (chips: QuickReply[]) => chips.length > 0 && chips.every((c) => RANGE.test(c.label.trim()));
function inRange(label: string, n: number): boolean {
  const m = label.trim().match(RANGE);
  if (!m) return false;
  const lo = Number(m[1]), hi = m[2] ? Number(m[2]) : m[3] ? Infinity : lo;
  return n >= lo && n <= hi;
}

/** Quick-reply chips become a numbered list on WhatsApp (plain text works for every phone). */
export function chipsToText(chips: QuickReply[], lang: "en" | "hi"): string {
  if (!chips.length) return "";
  if (numericChips(chips)) {
    const lines = chips.slice(0, 9).map((c) => `• ${c.label}`).join("\n");
    return `${lines}\n\n${lang === "hi" ? "_अपनी संख्या लिखें (जैसे 5)।_" : "_Reply with your number (for example 5)._"}`;
  }
  const lines = chips.slice(0, 9).map((c, i) => `${i + 1}. ${c.label}`).join("\n");
  return `${lines}\n\n${lang === "hi" ? "_नंबर भेजें, या अपना जवाब लिखें।_" : "_Reply with a number, or type your answer._"}`;
}

/** "2" → the 2nd chip (or, for range chips, the range containing that value); an exact label also works. Anything else is free text. */
export function matchChip(text: string, chips: QuickReply[]): QuickReply | null {
  const t = text.trim();
  if (numericChips(chips)) {
    const m = t.match(/^(\d{1,4})\+?$/);
    if (m) return chips.find((c) => inRange(c.label, Number(m[1]))) ?? null;
  } else if (/^\d{1,2}$/.test(t)) {
    return chips[Number(t) - 1] ?? null;
  }
  const low = t.toLowerCase();
  return chips.find((c) => c.label.toLowerCase() === low) ?? null;
}

export const hasDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);
