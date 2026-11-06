import "server-only";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { list } from "@/lib/db/store";
import { CATALOGUE } from "@/lib/catalogue";
import { eligibility } from "@/lib/rules/eligibility";
import { priceLines } from "@/lib/rules/pricing";
import type { BusinessProfile } from "@/lib/rules/types";
import type { Conversation, KycCase, Lead, Order, Quote } from "@/lib/store/types";
import { historicalLeads } from "./leads";
import { MODEL_INFO } from "./propensity";

type Raw = Record<string, string>;
const read = (f: string) => parse(readFileSync(join(process.cwd(), "data", f)), { columns: true }) as Raw[];
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

let cached: ReturnType<typeof compute> | null = null;
function compute() {
  const raw = read("smb_leads.csv");
  const gst = new Map(read("mock_gstin_registry.csv").map((r) => [r.gstin, r.status]));
  const act = raw.filter((r) => r.outcome === "Activated");

  const order = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"];
  const reached = (r: Raw) => order.indexOf(r.stage_reached);
  const funnel = order.map((s, i) => ({ stage: s, leads: raw.filter((r) => reached(r) >= i).length }));

  const group = (key: string) => {
    const keys = [...new Set(raw.map((r) => r[key]))];
    return keys.map((k) => {
      const all = raw.filter((r) => r[key] === k), a = all.filter((r) => r.outcome === "Activated");
      const cost = all.reduce((s, r) => s + (Number(r.acquisition_cost_inr) || 0), 0);
      return {
        key: k, leads: all.length, activations: a.length, conversion: pct(a.length, all.length),
        avgMonthly: Math.round(mean(a.map((r) => Number(r.monthly_bundle_value_inr)))),
        churn: pct(a.filter((r) => r.churned_within_6_months === "Y").length, a.length),
        costPerActivation: a.length ? Math.round(cost / a.length) : 0,
        avgDays: +mean(a.map((r) => Number(r.days_lead_to_activation))).toFixed(1),
        chaseCalls: +mean(a.map((r) => Number(r.customer_follow_up_calls))).toFixed(1),
      };
    }).sort((x, y) => y.leads - x.leads);
  };

  // Backtest: how many historical SALES break the catalogue's own rules (our engine would have blocked them)?
  const byId = new Map(CATALOGUE.map((p) => [p.id, p]));
  let violating = 0, inactiveGst = 0;
  for (const r of act) {
    const p: BusinessProfile = {
      businessType: r.business_type, employees: Number(r.employee_count), sites: Number(r.num_sites), city: r.city, needs: [],
      gstin: r.has_gstin === "Y" ? { has: true, verified: true, status: gst.get(r.gstin) as "Active" } : { has: false },
    };
    const lines = r.bundle_products.split(";").map((b) => { const [id, q] = b.split("x"); return { productId: id, qty: Number(q) }; });
    const bad = lines.some((l) => !eligibility(l.productId, p).ok || (byId.get(l.productId)!.requiresOneOf.length > 0 && !lines.some((x) => byId.get(l.productId)!.requiresOneOf.includes(x.productId))));
    if (bad) violating++;
    if (p.gstin.has && p.gstin.status !== "Active") inactiveGst++;
  }
  const winback = historicalLeads().filter((l) => l.winback);
  return {
    totals: { leads: raw.length, activations: act.length, conversion: pct(act.length, raw.length), avgDaysToActivate: +mean(act.map((r) => Number(r.days_lead_to_activation))).toFixed(1),
      avgChaseCalls: +mean(act.map((r) => Number(r.customer_follow_up_calls))).toFixed(1), blendedCac: Math.round(raw.reduce((s, r) => s + (Number(r.acquisition_cost_inr) || 0), 0) / act.length),
      medianBundle: [...act.map((r) => Number(r.monthly_bundle_value_inr))].sort((a, b) => a - b)[Math.floor(act.length / 2)] },
    funnel, bySegment: group("segment"), bySource: group("lead_source"), byTier: group("city_tier"), byLanguage: group("preferred_language"),
    backtest: { activatedSales: act.length, ruleViolatingSales: violating, inactiveGstActivations: inactiveGst, winbackPool: winback.length, winbackMonthlyValue: winback.reduce((s, l) => s + l.expectedValue * l.score.probability, 0) },
    model: MODEL_INFO,
  };
}
export const historicalStats = () => (cached ??= compute());

export async function liveStats() {
  const [convs, leads, quotes, kycs, orders] = await Promise.all([
    list<Conversation>("conversation"), list<Lead>("lead"), list<Quote>("quote"), list<KycCase>("kyc"), list<Order>("order"),
  ]);
  const paid = orders.filter((o) => o.payment.status === "success");
  const active = paid.filter((o) => o.stage === "ACTIVATED");
  const recommended = convs.filter((c) => c.stage === "recommended" || c.stage === "escalated");
  const mrr = paid.reduce((s, o) => s + o.totals.monthly, 0);
  const chases = paid.reduce((s, o) => s + o.chases, 0);
  const firstPass = kycs.filter((k) => k.status === "verified" || k.review?.decision === "approved" || k.status === "review").length;
  return {
    conversations: convs.length, advisorRecommended: recommended.length, leads: leads.length, escalated: leads.filter((l) => l.level !== "none").length,
    quotes: quotes.length, kycCases: kycs.length, kycClean: kycs.filter((k) => k.status === "verified").length, kycReview: kycs.filter((k) => k.status === "review" && !k.review).length,
    orders: paid.length, activated: active.length, mrr, chasesPerOrder: paid.length ? +(chases / paid.length).toFixed(2) : 0,
    escalationRate: pct(leads.filter((l) => l.level !== "none").length, Math.max(1, recommended.length)),
    kycFirstPass: pct(firstPass, kycs.length), conversion: pct(paid.length, Math.max(1, convs.length)),
    avgMonthly: paid.length ? Math.round(mrr / paid.length) : 0,
    referralConversations: convs.filter((c) => c.attribution?.referrer).length,
    referralOrders: paid.filter((o) => o.attribution?.referrer).length,
    copilotLeads: leads.filter((l) => l.attribution?.source === "copilot" || l.attribution?.repId).length,
  };
}
void priceLines;

// ---- CX scorecard (MASTER_PLAN D13): makes "one sitting" measurable on LIVE journeys only ------------------------------------------------
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function cxScorecard() {
  const [convs, leads, quotes, kycs, orders] = await Promise.all([
    list<Conversation>("conversation", { limit: 5000 }), list<Lead>("lead", { limit: 5000 }), list<Quote>("quote", { limit: 5000 }), list<KycCase>("kyc", { limit: 5000 }), list<Order>("order", { limit: 5000 }),
  ]);
  const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const Q = byId(quotes), C = byId(convs), K = byId(kycs), L = byId(leads);
  const journeys = orders.map((o) => {
    const q = Q.get(o.quoteId), c = q?.conversationId ? C.get(q.conversationId) : undefined, k = o.kycId ? K.get(o.kycId) : undefined;
    const lead = o.leadId ? L.get(o.leadId) : c?.leadId ? L.get(c.leadId) : undefined;
    const kycReview = !!k?.review || k?.status === "review";
    const touches = (lead?.ownerId ? 1 : 0) + (lead && lead.level !== "none" ? 1 : 0) + (kycReview ? 1 : 0) + o.chases;
    return {
      orderId: o.id, bundleId: o.bundleId, paid: o.payment.status === "success", stage: o.stage ?? "UNPAID",
      advisorTurns: c ? c.messages.filter((m) => m.role === "user").length : 0,
      quoteEdits: q ? Math.max(0, q.version - 1) : 0,
      minutesToOrder: c ? Math.max(0, Math.round((o.createdAt - c.createdAt) / 60000)) : null,
      paymentAttempts: o.payment.attempts, kycReview, chases: o.chases, humanTouches: touches, selfServe: touches === 0,
    };
  });
  const paid = journeys.filter((j) => j.paid);
  const withConsent = quotes.filter((q) => q.consentId).length;
  return {
    journeys: paid.length,
    medianMinutesToOrder: median(paid.map((j) => j.minutesToOrder ?? 0)),
    medianAdvisorTurns: median(paid.map((j) => j.advisorTurns)),
    avgQuoteEdits: paid.length ? +(paid.reduce((s, j) => s + j.quoteEdits, 0) / paid.length).toFixed(1) : 0,
    avgPaymentAttempts: paid.length ? +(paid.reduce((s, j) => s + j.paymentAttempts, 0) / paid.length).toFixed(2) : 0,
    kycReviewRate: pct(paid.filter((j) => j.kycReview).length, Math.max(1, paid.length)),
    selfServeRate: pct(paid.filter((j) => j.selfServe).length, Math.max(1, paid.length)),
    avgHumanTouches: paid.length ? +(paid.reduce((s, j) => s + j.humanTouches, 0) / paid.length).toFixed(2) : 0,
    // where live journeys stop: each count is "reached this step but not the next"
    dropOff: [
      { step: "Chatting, no plan yet", n: convs.filter((c) => c.stage === "collecting").length },
      { step: "Plan shown, no quote", n: convs.filter((c) => c.stage !== "collecting" && !quotes.some((q) => q.conversationId === c.id)).length },
      { step: "Quote, no consent", n: quotes.length - withConsent },
      { step: "Consent, KYC not done", n: quotes.filter((q) => q.consentId && !q.orderId).length },
      { step: "Order created, not paid", n: journeys.filter((j) => !j.paid).length },
    ],
    recent: journeys.slice(0, 12),
  };
}
