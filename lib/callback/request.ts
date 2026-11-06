import "server-only";
import { get, newId, put } from "@/lib/db/store";
import { HttpError } from "@/lib/api";
import { toProfile } from "@/lib/advisor/orchestrator";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import { autoOwner } from "@/lib/leads/leads";
import { CALLBACK_WINDOWS, callbackDays, windowStartHour, type CallbackWindow } from "./windows";
import type { Conversation, Lead, Session } from "@/lib/store/types";

/**
 * "Call me" — the owner picks a day and window; it lands on the ops lead (with the advisor's summary and transcript already attached)
 * as a callback. Needs a verified phone so a rep has a real number and the request can't be spammed anonymously.
 */
export async function requestCallback(input: { conversationId: string; date: string; window: string; note?: string; sessionId?: string }): Promise<{ at: string; window: CallbackWindow; phoneMasked: string }> {
  const session = input.sessionId ? await get<Session>("session", input.sessionId) : null;
  if (!session?.verified || !session.phone) throw new HttpError(401, "NOT_VERIFIED");
  if (!(CALLBACK_WINDOWS as readonly string[]).includes(input.window)) throw new HttpError(400, "BAD_WINDOW");
  if (!callbackDays().includes(input.date)) throw new HttpError(400, "BAD_DATE");
  const window = input.window as CallbackWindow;

  const conv = await get<Conversation>("conversation", input.conversationId);
  if (!conv || (conv.sessionId && conv.sessionId !== session.id)) throw new HttpError(404, "CONVERSATION_NOT_FOUND");
  if (conv.stage === "collecting") throw new HttpError(409, "NO_PLAN_YET");

  const profile = toProfile(conv.facts, conv.lang as "en");
  const rec = recommend(profile);
  let lead = conv.leadId ? await get<Lead>("lead", conv.leadId) : null;
  if (!lead) {
    lead = {
      id: newId("LD"), origin: "live", createdAt: Date.now(), conversationId: conv.id, quoteId: conv.quoteId, profile, facts: conv.facts,
      bundleId: rec.lines.length ? rec.bundleId : undefined, monthly: rec.lines.length ? priceLines(rec.lines).monthly : 0,
      level: "hard", reasons: ["REQUESTED_HUMAN"], status: "callback", ownerId: autoOwner(profile.city, rec.segment), attribution: conv.attribution, notes: [], callbacks: [],
    };
  }
  const at = `${input.date}T${windowStartHour(window)}:00`;
  const note = `Owner requested a call, ${window} IST${input.note?.trim() ? ` — “${input.note.trim().slice(0, 200)}”` : ""}`;
  if (lead.callbacks.some((c) => !c.done && c.at === at)) return { at, window, phoneMasked: mask(session.phone) }; // same slot twice is a no-op
  if (lead.callbacks.filter((c) => !c.done).length >= 3) throw new HttpError(429, "TOO_MANY_CALLBACKS");
  lead = {
    ...lead, phone: session.phone, level: lead.level === "none" ? "hard" : lead.level,
    reasons: lead.reasons.includes("REQUESTED_HUMAN") ? lead.reasons : [...lead.reasons, "REQUESTED_HUMAN"],
    status: lead.status === "converted" ? lead.status : "callback", callbacks: [...lead.callbacks, { at, note, done: false }],
  };
  await put("lead", lead.id, lead);
  if (conv.leadId !== lead.id) await put("conversation", conv.id, { ...conv, leadId: lead.id });
  return { at, window, phoneMasked: mask(lead.phone!) };
}
const mask = (p: string) => p.replace(/^(\d{2})\d{6}(\d{2})$/, "$1••••••$2");
