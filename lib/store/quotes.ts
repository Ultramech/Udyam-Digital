import "server-only";
import { get, newId, put } from "@/lib/db/store";
import { catalogueStatus, validateLines } from "@/lib/rules/quote";
import { estimateSchedule, priceLines } from "@/lib/rules/pricing";
import { recommend } from "@/lib/rules/recommend";
import { packages } from "@/lib/rules/packages";
import { maturity } from "@/lib/maturity/score";
import type { BusinessProfile } from "@/lib/rules/types";
import type { Attribution, Conversation, Quote, SiteInfo } from "./types";
import { toProfile } from "@/lib/advisor/orchestrator";

export const getQuote = (id: string) => get<Quote>("quote", id);
export const saveQuote = (q: Quote) => put("quote", q.id, q);

const blankSites = (n: number): SiteInfo[] => Array.from({ length: n }, (_, i) => ({ index: i, address: "", pincode: "", checked: false }));

export async function createQuoteFromConversation(conv: Conversation, attribution: Attribution, sessionId?: string): Promise<Quote> {
  const profile = toProfile(conv.facts, conv.lang as "en");
  const rec = recommend(profile);
  const q: Quote = {
    id: newId("QT"), conversationId: conv.id, sessionId, profile, lines: rec.lines, bundleId: rec.bundleId, notices: rec.notices, version: 1,
    attribution, sites: blankSites(profile.sites), createdAt: Date.now(),
  };
  await saveQuote(q);
  return q;
}

/** Everything the quote screens need, computed from the single source of truth (the rules engine). */
export function quoteView(q: Quote) {
  const rec = recommend(q.profile);
  return {
    quote: q,
    pricing: priceLines(q.lines),
    schedule: estimateSchedule(q.lines),
    issues: validateLines(q.lines, q.profile),
    catalogue: catalogueStatus(q.lines, q.profile, rec.segment),
    segment: rec.segment,
    escalation: rec.escalation,
    exclusions: rec.exclusions,
    counterfactuals: rec.counterfactuals,
    why: rec.why,
    alternatives: rec.alternatives,
    budget: rec.budget,
    packages: packages(q.profile, q.lines, rec),
    maturity: maturity(q.profile, q.lines, rec.counterfactuals),
  };
}

export const withProfile = (q: Quote, profile: BusinessProfile): Quote => ({ ...q, profile, version: q.version + 1 });
