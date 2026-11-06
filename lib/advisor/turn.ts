import { z } from "zod";
import "server-only";
import { get, newId, put } from "@/lib/db/store";
import { advisorTurn } from "@/lib/advisor/orchestrator";
import { llmAnswer, llmExtract, llmExplain, type ExtractMeta, type LlmStatus } from "@/lib/advisor/llm";
import { knowledgeContext } from "@/lib/advisor/knowledge";
import type { Lang } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { plainName } from "@/lib/catalogue/plain";
import { fmtDate } from "@/lib/client/format";
import { emptyFacts, type Facts } from "@/lib/advisor/extract";
import { upsertLeadFromTurn } from "@/lib/leads/leads";
import { estimateSchedule, priceLines } from "@/lib/rules/pricing";
import type { Conversation, Lead } from "@/lib/store/types";
import { getPersona } from "@/lib/demo/personas";

export const AdvisorBody = z.object({
  conversationId: z.string().max(40).optional(),
  text: z.string().max(1000).optional(),
  chip: z.object({ slot: z.enum(["businessType", "employees", "sites", "city", "gst", "needs", "currentInternet", "udyam"]), value: z.string().max(60) }).optional(),
  chipLabel: z.string().max(80).optional(),
  lang: z.enum(["en", "hi", "mr", "ta"]).default("en"),
  /** facts edited by hand in the "What I know" panel */
  factsPatch: z.object({ employees: z.number().int().min(1).max(5000).optional(), sites: z.number().int().min(1).max(500).optional(), city: z.string().max(40).optional(), gst: z.enum(["yes", "no"]).optional(), budget: z.number().int().min(100).max(10_000_000).nullable().optional() }).optional(),
  attribution: z.object({ source: z.string().max(40).optional(), partnerCode: z.string().max(20).optional(), repId: z.string().max(20).optional(), referrer: z.string().regex(/^R-[a-z0-9]{8}$/).optional() }).default({}),
  persona: z.string().max(20).optional(),
  /** a signed-in rep/partner is driving this conversation on the customer's behalf (co-pilot); verified server-side from the staff session */
  copilot: z.boolean().optional(),
  /** recompute the current state (e.g. when re-opening a conversation) without appending to the transcript */
  refresh: z.boolean().optional(),
});

export type AdvisorInput = z.infer<typeof AdvisorBody>;

/** One advisor turn. Shared by the web route and the chat channels (WhatsApp). `sid` ties the conversation to a browser session when there is one. */
export async function runAdvisor(b: AdvisorInput, sid?: string) {
  let conv = b.conversationId ? await get<Conversation>("conversation", b.conversationId) : null;
  const isNew = !conv;
  conv ??= { id: newId("CV"), sessionId: sid, lang: b.lang, facts: emptyFacts(), messages: [], stage: "collecting", attribution: b.attribution, createdAt: Date.now() };
  conv.lang = b.lang;
  // Attribution fills in, never overwrites: the first source/partner/rep that touched the journey keeps the credit.
  conv.attribution = { ...b.attribution, ...conv.attribution, repId: conv.attribution?.repId ?? b.attribution.repId, partnerCode: conv.attribution?.partnerCode ?? b.attribution.partnerCode, referrer: conv.attribution?.referrer ?? b.attribution.referrer };

  let facts: Facts | undefined = isNew && !b.text && !b.chip ? undefined : conv.facts;
  if (b.factsPatch && facts) {
    const { budget, ...rest } = b.factsPatch;
    facts = { ...facts, ...rest, ...(budget === null ? { budget: undefined } : budget ? { budget } : {}) };
  }
  let ai: LlmStatus = { used: false, reason: "NOT_CONFIGURED" };
  let llmFacts: Awaited<ReturnType<typeof llmExtract>>["facts"] = null;
  let meta: ExtractMeta | null = null;
  if (b.text) {
    const lastAdvisor = conv.messages.filter((m) => m.role === "assistant").at(-1)?.text;
    const r = await llmExtract(b.text, lastAdvisor);
    llmFacts = r.facts; meta = r.meta; ai = r.status;
  }
  // "Hindi mein batao" switches the conversation language for this and every later turn.
  let lang: Lang = b.lang;
  if (meta?.languageRequest) { lang = meta.languageRequest; conv.lang = lang; }

  const asking = !!meta && !b.chip && (meta.intent === "question" || ((meta.intent === "smalltalk" || meta.intent === "other") && conv.stage === "recommended"));
  // A question must not change the plan by keyword ("why do I need CCTV?" is not a request for CCTV), so the keyword extractor is skipped.
  const turn = advisorTurn({
    facts, text: asking ? undefined : b.text, chip: b.chip, lang,
    // a question never mutates the plan: no removals, no corrections (hypotheticals are answered from computed what-ifs instead)
    llmFacts: llmFacts ?? undefined, llmMeta: meta ? (asking ? { changedFields: [], removeNeeds: [] } : { changedFields: meta.changedFields, removeNeeds: meta.removeNeeds }) : undefined,
  });
  const finalTurn = turn;
  let kind: "answer" | "plan" | "collect" | "escalated" = finalTurn.stage === "recommended" ? "plan" : finalTurn.stage === "escalated" ? "escalated" : "collect";

  if (asking && finalTurn.stage !== "escalated") {
    // Free-form question: answered ONLY from the plan + catalogue + journey facts assembled by code, then faithfulness-checked.
    const ans = await llmAnswer(lang, meta!.question ?? b.text ?? "", knowledgeContext(finalTurn.profile, finalTurn.recommendation));
    const fallback = lang === "hi" || lang === "mr"
      ? "इसका पक्का जवाब मैं यहाँ नहीं दे पा रहा — विशेषज्ञ मदद कर सकते हैं। \"human\" लिखें या \"किसी व्यक्ति से बात करें\" दबाएँ।"
      : "I can't answer that reliably here — a specialist can help. Type \"human\" or tap \"Talk to a person\".";
    finalTurn.reply = (ans ?? fallback) + (finalTurn.stage === "collecting" ? `\n\n${finalTurn.reply}` : "");
    kind = "answer";
    if (ans) ai = { used: true };
  } else {
    // Once a plan exists, let Gemini explain it in the owner's language — but only if the text passes the faithfulness check.
    const rec0 = finalTurn.recommendation;
    if (rec0?.lines.length && finalTurn.profile && finalTurn.stage === "recommended" && !b.refresh) {
      const pr = priceLines(rec0.lines), sc = estimateSchedule(rec0.lines);
      const msg = await llmExplain(lang, {
        bundleName: bundleName(rec0.bundleId, lang), monthly: pr.monthly, setup: pr.setup, gstPercent: 18, contractMonths: pr.contractMonths,
        items: [...new Set(rec0.lines.map((l) => plainName(l.productId, "en")))],
        why: rec0.why.map((w) => ruleReason(w, "en")),
        notIncluded: rec0.exclusions.map((e) => ruleReason({ code: e.code, params: e.params, productId: e.productId }, "en"))
          .concat(rec0.trace.filter((t) => t.code === "DECLINED_BY_OWNER").map((t) => ruleReason({ code: t.code, productId: t.productId }, "en"))),
        notes: rec0.notices.map((n) => ruleReason(n, "en")), city: finalTurn.profile.city, businessType: finalTurn.profile.businessType ?? "business", goLive: fmtDate(sc.date, "en"),
      });
      if (msg) { finalTurn.reply = msg; ai = { used: true }; }
    }
  } // a hand edit in the facts panel flows through `facts`, so the recommendation is recomputed

  const now = Date.now();
  if (!b.refresh) {
    if (b.text) conv.messages.push({ role: "user", text: b.text, at: now });
    else if (b.chip) conv.messages.push({ role: "user", text: b.chipLabel ?? b.chip.value, at: now });
    conv.messages.push({ role: "assistant", text: finalTurn.reply, at: now });
  }
  conv.facts = finalTurn.facts;
  conv.stage = finalTurn.stage;
  if (b.persona) conv.attribution = { ...conv.attribution, source: `demo:${b.persona}` };

  let lead = await upsertLeadFromTurn(conv, finalTurn);
  if (!lead && conv.leadId) lead = await get<Lead>("lead", conv.leadId);
  if (lead && b.attribution.repId && !b.refresh) {
    // co-pilot: the rep/partner who actually helped is recorded on the lead and gets the assist credit when it converts
    if (!lead.ownerId) lead.ownerId = b.attribution.repId;
    lead.attribution = { ...lead.attribution, repId: lead.attribution.repId ?? b.attribution.repId };
    lead.notes = [...(lead.notes ?? []), { at: Date.now(), by: b.attribution.repId, text: "Co-pilot session: rep assisted the customer in the advisor." }].slice(-50);
    await put("lead", lead.id, lead);
  }
  if (lead) {
    const persona = getPersona(b.persona);
    if (persona && !lead.businessName) { lead.businessName = persona.title.en.split(" · ")[1] ?? persona.title.en; lead.phone = persona.phone; await put("lead", lead.id, lead); }
    conv.leadId = lead.id;
  }
  await put("conversation", conv.id, conv);

  const rec = finalTurn.recommendation;
  return ({
    conversationId: conv.id,
    turn: { ...finalTurn, recommendation: rec },
    pricing: rec?.lines.length ? priceLines(rec.lines) : null,
    schedule: rec?.lines.length ? estimateSchedule(rec.lines) : null,
    leadId: conv.leadId ?? null,
    ai,
    kind,
    lang,
    messages: conv.messages,
  });
}
