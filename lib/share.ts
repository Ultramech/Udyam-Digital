import "server-only";
import { get, newToken, put } from "@/lib/db/store";
import { getQuote } from "@/lib/store/quotes";
import { priceLines, estimateSchedule } from "@/lib/rules/pricing";
import { plainBenefit, plainName } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { recommend } from "@/lib/rules/recommend";
import type { Lang } from "@/lib/catalogue/plain";

/**
 * "Share this plan with the decision-maker" (MASTER_PLAN D8). An unguessable, expiring, read-only link to the LIVE quote: if the owner
 * changes the plan, the partner sees the change. The shared view carries no phone, GSTIN, address or other identifier.
 */
const TTL = 14 * 86_400_000;
interface Share { quoteId: string; createdAt: number }

export async function createShare(quoteId: string): Promise<string> {
  const token = newToken();
  await put("share", token, { quoteId, createdAt: Date.now() } satisfies Share);
  return token;
}

export async function sharedPlan(token: string, lang: Lang = "en") {
  const s = await get<Share>("share", token);
  if (!s || Date.now() - s.createdAt > TTL) return null;
  const q = await getQuote(s.quoteId);
  if (!q) return null;
  const pr = priceLines(q.lines), sc = estimateSchedule(q.lines), rec = recommend(q.profile);
  return {
    quote: q,
    view: {
      quoteId: s.quoteId,
      plan: bundleName(q.bundleId, lang), business: q.profile.businessType ?? "", city: q.profile.city, locations: q.profile.sites,
      monthly: pr.monthly, gstMonthly: pr.gstMonthly, setup: pr.setup, gstSetup: pr.gstSetup, payToday: pr.firstPayment, contractMonths: pr.contractMonths, goLive: sc.date,
      items: pr.lines.map((l) => ({ name: plainName(l.productId, lang), benefit: plainBenefit(l.productId, lang), qty: l.qty, location: l.siteIndex, monthly: l.monthly, setup: l.setup })),
      why: rec.why.map((w) => ruleReason(w, lang)),
      notIncluded: rec.exclusions.map((e) => `${plainName(e.productId, lang)} — ${ruleReason({ code: e.code, params: e.params, productId: e.productId }, lang)}`),
      sharedAt: s.createdAt, expiresAt: s.createdAt + TTL,
    },
  };
}
