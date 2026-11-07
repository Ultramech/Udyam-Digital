import "server-only";
import { analytics, sliceRows, type Filters } from "./analytics";
import { evaluateTargets } from "./targets";

/**
 * Insight engine. Every finding is DERIVED from the data and ranked by how strong its evidence is; nothing here names a segment, channel or number
 * in advance. Change a filter and the findings change: they are always about the slice you are looking at, compared with that slice's own average.
 * Wording is assembled from the measured values (the way the rules engine assembles a price), and no claim is made that the numbers don't support.
 */
export type Tone = "red" | "amber" | "green" | "blue";
export interface Insight { id: string; kind: string; tone: Tone; score: number; title: string; body: string; facts: { label: string; value: string }[] }

type Raw = Record<string, string>;
const pct1 = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");
const cap = (n: number, hi = 100) => Math.max(0, Math.min(hi, n));
/** Enough leads / activations before a group is allowed to be called an outlier. */
const MIN_N = 40, MIN_ACT = 12;

const DIMS: { key: string; noun: string; show: (v: string) => string }[] = [
  { key: "segment", noun: "segment", show: (v) => v },
  { key: "lead_source", noun: "channel", show: (v) => `${v} leads` },
  { key: "city_tier", noun: "city tier", show: (v) => `Tier ${v} cities` },
  { key: "preferred_language", noun: "language", show: (v) => `${v}-speaking owners` },
];

const stat = (rows: Raw[]) => {
  const act = rows.filter((r) => r.outcome === "Activated");
  const spend = rows.reduce((s, r) => s + (Number(r.acquisition_cost_inr) || 0), 0);
  const churned = act.filter((r) => r.churned_within_6_months === "Y").length;
  return { leads: rows.length, act: act.length, conv: pct1(act.length, rows.length), spend, cac: act.length ? spend / act.length : 0, churned, churn: pct1(churned, act.length) };
};
/** z-score of a group's rate against the slice's own rate (binomial). */
const z = (p: number, n: number, p0: number) => { const q = p0 / 100; return n && q > 0 && q < 1 ? (p / 100 - q) / Math.sqrt((q * (1 - q)) / n) : 0; };
const groups = (rows: Raw[], key: string) => { const m = new Map<string, Raw[]>(); for (const r of rows) (m.get(r[key]) ?? m.set(r[key], []).get(r[key])!).push(r); return [...m.entries()]; };
const varies = (rows: Raw[], key: string) => new Set(rows.map((r) => r[key])).size > 1;

const STAGES = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"];

/** The funnel step that loses the largest SHARE of the leads that reach it (steps with few leads are ignored), with the count and a typical step for scale. */
function funnelLeak(rows: Raw[]): Insight | null {
  if (rows.length < 100) return null;
  const n = STAGES.map((_, i) => rows.filter((r) => STAGES.indexOf(r.stage_reached) >= i).length);
  const steps = STAGES.slice(1).map((s, i) => ({ from: STAGES[i], to: s, reach: n[i], lost: n[i] - n[i + 1], keep: pct1(n[i + 1], n[i]), loss: 100 - pct1(n[i + 1], n[i]) })).filter((x) => x.reach >= 50);
  const totalLost = steps.reduce((s, x) => s + x.lost, 0);
  const worst = [...steps].sort((a, b) => b.loss - a.loss)[0];
  if (!worst || !totalLost) return null;
  const typical = [...steps].map((s) => s.loss).sort((a, b) => a - b)[Math.floor(steps.length / 2)];
  return {
    id: "funnel-leak", kind: "funnel", tone: "red", score: cap(worst.loss * 1.1 + pct1(worst.lost, totalLost) * 0.6),
    title: `${worst.from} → ${worst.to} is the steepest drop`,
    body: `${worst.loss.toFixed(1)}% of the ${num(worst.reach)} leads that reach it do not move on (${num(worst.lost)} lost, ${pct1(worst.lost, totalLost)}% of everything lost along the funnel). A typical step loses ${typical.toFixed(1)}%.`,
    facts: [{ label: "Kept", value: `${worst.keep}%` }, { label: "Lost", value: num(worst.lost) }, { label: "Typical step loses", value: `${typical.toFixed(1)}%` }],
  };
}

/** Groups whose conversion is too far from the slice's average to be noise. Returns the strongest above and the strongest below. */
function conversionOutliers(rows: Raw[]): Insight[] {
  const base = stat(rows);
  const found: { dim: (typeof DIMS)[number]; value: string; s: ReturnType<typeof stat>; z: number }[] = [];
  for (const dim of DIMS) {
    if (!varies(rows, dim.key)) continue;
    for (const [value, rs] of groups(rows, dim.key)) {
      if (rs.length < MIN_N) continue;
      const s = stat(rs), zz = z(s.conv, s.leads, base.conv);
      if (Math.abs(zz) >= 2 && Math.abs(s.conv - base.conv) >= 1) found.push({ dim, value, s, z: zz });
    }
  }
  const out: Insight[] = [];
  for (const dir of [1, -1]) {
    const best = found.filter((f) => Math.sign(f.z) === dir).sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
    if (!best) continue;
    const ratio = best.s.conv / (base.conv || 1);
    out.push({
      id: `conv-${dir > 0 ? "high" : "low"}`, kind: dir > 0 ? "outlier-high" : "outlier-low", tone: dir > 0 ? "green" : "red", score: cap(Math.abs(best.z) * 7),
      title: `${best.dim.show(best.value)} convert at ${best.s.conv}%`,
      body: `${dir > 0 ? "Above" : "Below"} the ${base.conv}% average for this view (${ratio.toFixed(1)}×). ${num(best.s.act)} of ${num(best.s.leads)} leads activated, a ${Math.abs(best.s.conv - base.conv).toFixed(1)}-point gap that is ${Math.abs(best.z).toFixed(1)}σ from average, too large to be chance. ${dir > 0 ? "A pattern worth copying." : "Where the funnel needs fixing first."}`,
      facts: [{ label: best.dim.noun, value: best.dim.show(best.value) }, { label: "Leads", value: num(best.s.leads) }, { label: "View average", value: `${base.conv}%` }],
    });
  }
  return out;
}

/** The group that costs the most extra money per activation, with its share of spend against its share of results. */
function costOutlier(rows: Raw[]): Insight | null {
  const base = stat(rows);
  if (base.act < MIN_ACT) return null;
  let best: { dim: (typeof DIMS)[number]; value: string; s: ReturnType<typeof stat>; excess: number } | null = null;
  for (const dim of DIMS) {
    if (!varies(rows, dim.key)) continue;
    for (const [value, rs] of groups(rows, dim.key)) {
      const s = stat(rs);
      if (s.act < MIN_ACT / 2 || s.leads < MIN_N) continue;
      const excess = (s.cac - base.cac) * s.act;
      if (s.cac > base.cac * 1.4 && excess > 0 && (!best || excess > best.excess)) best = { dim, value, s, excess };
    }
  }
  if (!best) return null;
  const spendShare = pct1(best.s.spend, base.spend), actShare = pct1(best.s.act, base.act);
  return {
    id: "cost-outlier", kind: "cost", tone: "amber", score: cap((spendShare - actShare) * 1.5 + (best.s.cac / base.cac) * 10),
    title: `${best.dim.show(best.value)} cost ${(best.s.cac / base.cac).toFixed(1)}× the average per activation`,
    body: `${inr(best.s.cac)} per activation against ${inr(base.cac)} for this view. That ${best.dim.noun} takes ${spendShare}% of acquisition spend but delivers ${actShare}% of activations; the extra spend over average is about ${inr(best.excess)}.`,
    facts: [{ label: "Spend share", value: `${spendShare}%` }, { label: "Activation share", value: `${actShare}%` }, { label: "Activations", value: num(best.s.act) }],
  };
}

/** Recent weeks against the weeks before them, with a significance check, so a wobble is not reported as a trend. */
function trendShift(trend: { week: string; leads: number; activations: number }[]): Insight | null {
  if (trend.length < 6) return null;
  const k = Math.min(4, Math.floor(trend.length / 2));
  const recent = trend.slice(-k), prior = trend.slice(-2 * k, -k);
  const R = { n: recent.reduce((s, w) => s + w.leads, 0), a: recent.reduce((s, w) => s + w.activations, 0) };
  const P = { n: prior.reduce((s, w) => s + w.leads, 0), a: prior.reduce((s, w) => s + w.activations, 0) };
  if (R.n < 80 || P.n < 80) return null;
  const pr = R.a / R.n, pp = P.a / P.n, pool = (R.a + P.a) / (R.n + P.n);
  const zz = (pr - pp) / Math.sqrt(pool * (1 - pool) * (1 / R.n + 1 / P.n));
  const diff = (pr - pp) * 100;
  const sig = Math.abs(zz) >= 1.64;
  return {
    id: "trend", kind: "trend", tone: !sig ? "blue" : diff > 0 ? "green" : "red", score: sig ? cap(Math.abs(zz) * 9) : 14,
    title: !sig ? "Conversion is steady week to week" : diff > 0 ? "Conversion is improving" : "Conversion is slipping",
    body: `${(pr * 100).toFixed(1)}% over the last ${k} complete weeks against ${(pp * 100).toFixed(1)}% in the ${k} before (${diff >= 0 ? "+" : ""}${diff.toFixed(1)} points). ${sig ? `That is ${Math.abs(zz).toFixed(1)}σ, unlikely to be chance.` : "The difference is within normal week-to-week variation."}`,
    facts: [{ label: "Recent", value: `${(pr * 100).toFixed(1)}%` }, { label: "Before", value: `${(pp * 100).toFixed(1)}%` }, { label: "Weeks compared", value: `${k} + ${k}` }],
  };
}

/** Churn that is meaningfully higher (or lower) in one group than in the rest. */
function churnOutlier(rows: Raw[]): Insight | null {
  const base = stat(rows);
  if (base.act < 60) return null;
  let best: { dim: (typeof DIMS)[number]; value: string; s: ReturnType<typeof stat>; z: number } | null = null;
  for (const dim of DIMS) {
    if (!varies(rows, dim.key)) continue;
    for (const [value, rs] of groups(rows, dim.key)) {
      const s = stat(rs);
      if (s.act < 25) continue;
      const zz = z(s.churn, s.act, base.churn);
      if (Math.abs(zz) >= 1.8 && (!best || Math.abs(zz) > Math.abs(best.z))) best = { dim, value, s, z: zz };
    }
  }
  if (!best) return null;
  const high = best.z > 0;
  return {
    id: "churn-outlier", kind: "churn", tone: high ? "red" : "green", score: cap(Math.abs(best.z) * 7),
    title: `${best.dim.show(best.value)} ${high ? "churn more" : "stay longer"}: ${best.s.churn}% in 6 months`,
    body: `${best.s.churned} of ${best.s.act} activated customers in this ${best.dim.noun} left within six months, against ${base.churn}% across this view. ${high ? "Retention effort is best spent here first." : "Worth understanding what keeps them."}`,
    facts: [{ label: best.dim.noun, value: best.dim.show(best.value) }, { label: "Customers", value: num(best.s.act) }, { label: "View average", value: `${base.churn}%` }],
  };
}

/** How concentrated activated revenue is. */
function concentration(revenue: { id: string; name: string; revenue: number }[]): Insight | null {
  const total = revenue.reduce((s, r) => s + r.revenue, 0);
  if (revenue.length < 3 || !total) return null;
  const top = revenue[0], top3 = revenue.slice(0, 3).reduce((s, r) => s + r.revenue, 0);
  const share = pct1(top.revenue, total);
  return {
    id: "concentration", kind: "revenue", tone: "blue", score: cap(share * 1.4),
    title: `${top.name} brings ${share}% of activated revenue`,
    body: `The top three products bring ${pct1(top3, total)}% of monthly revenue (${inr(total)} in total); the other ${revenue.length - 3} share the remaining ${(100 - pct1(top3, total)).toFixed(1)}%.`,
    facts: [{ label: "Top product", value: inr(top.revenue) }, { label: "Top 3", value: `${pct1(top3, total)}%` }, { label: "Products", value: String(revenue.length) }],
  };
}

/** The pilot target that is furthest from the measured baseline (or a note that all are met). */
function targetGap(totals: Parameters<typeof evaluateTargets>[0]): Insight | null {
  const ev = evaluateTargets(totals);
  const open = ev.filter((t) => !t.met).sort((a, b) => b.gap - a.gap);
  if (!open.length) return { id: "target-gap", kind: "target", tone: "green", score: 12, title: "Every pilot target is already met in this view", body: "All five measured baselines are at or better than the proposed targets.", facts: [] };
  const w = open[0];
  return {
    id: "target-gap", kind: "target", tone: "amber", score: cap(w.gap * 90 + 10),
    title: `${w.label} is ${w.baselineText} against a ${w.targetText} target`,
    body: `The widest gap of the ${ev.length} targets: ${Math.round(w.gap * 100)}% still to close. ${open.length === ev.length ? "None of the targets is met" : `${ev.length - open.length} of ${ev.length} are met`}. Planned lever: ${w.lever.charAt(0).toLowerCase()}${w.lever.slice(1)}.`,
    facts: [{ label: "Measured", value: w.baselineText }, { label: "Target", value: w.targetText }, { label: "Gap", value: `${Math.round(w.gap * 100)}%` }],
  };
}

function reasonInsight(drops: { reason: string; n: number }[]): Insight | null {
  const total = drops.reduce((s, d) => s + d.n, 0);
  if (drops.length < 2 || total < 50) return null;
  const [a, b] = drops;
  return {
    id: "top-reason", kind: "reason", tone: "amber", score: cap(pct1(a.n, total) * 1.3),
    title: `“${a.reason}” is the top reason leads are lost`,
    body: `${num(a.n)} of ${num(total)} lost leads (${pct1(a.n, total)}%) in the ten most common reasons; “${b.reason}” follows with ${num(b.n)}.`,
    facts: [{ label: "Lost leads", value: num(total) }, { label: "Top reason", value: num(a.n) }],
  };
}

function npsInsight(n: { responses: number; promoters: number; detractors: number; score: number | null }): Insight | null {
  if (n.score === null || n.responses < 30) return null;
  const neg = n.score < 0;
  return {
    id: "nps", kind: "nps", tone: neg ? "amber" : "green", score: cap(Math.abs(n.score) * 0.8 + 5),
    title: neg ? `Detractors outnumber promoters ${(n.detractors / Math.max(1, n.promoters)).toFixed(1)} to 1` : `Promoters outnumber detractors ${(n.promoters / Math.max(1, n.detractors)).toFixed(1)} to 1`,
    body: `NPS is ${n.score} across ${num(n.responses)} responses: ${n.promoters} promoters, ${n.detractors} detractors.`,
    facts: [{ label: "NPS", value: String(n.score) }, { label: "Responses", value: num(n.responses) }],
  };
}

const pick = (xs: (Insight | null | undefined)[]) => xs.filter((x): x is Insight => !!x);
/** Highest score first, but no more than one finding of each kind in the headline list; the rest are "more". */
export function rank(all: Insight[], headline = 3) {
  const sorted = [...all].sort((a, b) => b.score - a.score);
  const seen = new Set<string>(), top: Insight[] = [], rest: Insight[] = [];
  for (const i of sorted) (top.length < headline && !seen.has(i.kind) ? (seen.add(i.kind), top) : rest).push(i);
  return { insights: top, more: rest };
}

/** Findings about the slice the filters select, always compared with that slice's own average. */
export function datasetInsights(f: Filters) {
  const rows = sliceRows(f);
  const a = analytics(f);
  if (!rows.length) return { insights: [], more: [] };
  return rank(pick([
    funnelLeak(rows), ...conversionOutliers(rows), costOutlier(rows), trendShift(a.trend), churnOutlier(rows), concentration(a.revenueByProduct),
    targetGap({ conversion: a.totals.conversion, avgDaysToActivate: a.totals.avgDaysToActivate, avgChases: a.totals.avgChases, cac: a.totals.cac, churn6m: a.totals.churn6m }),
    reasonInsight(a.dropReasons), npsInsight(a.nps),
  ]));
}

export interface OverviewInput {
  hist: { backtest: { activatedSales: number; ruleViolatingSales: number; inactiveGstActivations: number; winbackPool: number; winbackMonthlyValue: number }; totals: { avgChaseCalls: number } };
  live: { conversations: number; advisorRecommended: number; quotes: number; kycCases: number; orders: number; activated: number; kycFirstPass: number; chasesPerOrder: number };
  cx?: { journeys: number; selfServeRate: number; dropOff: { step: string; n: number }[] };
}

/** Overview: what the live prototype is doing, the dataset's strongest findings, and the backtest of past sales against the rules. */
export function overviewInsights(o: OverviewInput) {
  const out: Insight[] = [...datasetInsights({}).insights, ...datasetInsights({}).more];
  const { backtest: b } = o.hist;
  if (b.activatedSales) {
    const share = pct1(b.ruleViolatingSales, b.activatedSales);
    out.push({
      id: "backtest", kind: "backtest", tone: "amber", score: cap(share * 2.2 + 8),
      title: `${num(b.ruleViolatingSales)} of ${num(b.activatedSales)} past sales broke the catalogue's own rules`,
      body: `${share}% of activated bundles break the catalogue's own eligibility rules, and ${num(b.inactiveGstActivations)} went live on a GSTIN the registry marks Cancelled or Suspended. The rules engine blocks both before a quote is created.`,
      facts: [{ label: "Rule-breaking", value: num(b.ruleViolatingSales) }, { label: "On inactive GSTIN", value: num(b.inactiveGstActivations) }],
    });
  }
  if (b.winbackPool) out.push({
    id: "winback", kind: "winback", tone: "green", score: cap(Math.log10(b.winbackPool + 1) * 18),
    title: `${num(b.winbackPool)} dropped leads can be won back`,
    body: `They left for reasons a self-serve journey removes (no time for a visit, a slow quote, paperwork, install delay). Their expected value is about ${inr(b.winbackMonthlyValue)} a month, ranked by propensity.`,
    facts: [{ label: "Pool", value: num(b.winbackPool) }, { label: "Expected / month", value: inr(b.winbackMonthlyValue) }],
  });
  const l = o.live;
  if (l.conversations >= 5) {
    const steps: [string, number][] = [["Conversations", l.conversations], ["Plans recommended", l.advisorRecommended], ["Quotes", l.quotes], ["KYC cases", l.kycCases], ["Paid orders", l.orders], ["Activated", l.activated]];
    const drops = steps.slice(1).map(([name, n], i) => ({ from: steps[i][0], to: name, lost: Math.max(0, steps[i][1] - n), of: steps[i][1] }));
    const w = [...drops].sort((x, y) => y.lost - x.lost)[0];
    if (w && w.lost > 0) out.push({
      id: "live-leak", kind: "live", tone: "red", score: cap(pct1(w.lost, w.of) * 0.9 + 10),
      title: `Live: most owners stop between ${w.from} and ${w.to}`,
      body: `${num(w.lost)} of ${num(w.of)} stopped there (${pct1(w.lost, w.of)}%), the largest loss in the live funnel so far.`,
      facts: [{ label: "Stopped", value: num(w.lost) }, { label: "Reached step", value: num(w.of) }],
    });
    out.push({
      id: "live-chase", kind: "live-chase", tone: l.chasesPerOrder < o.hist.totals.avgChaseCalls ? "green" : "amber", score: 30,
      title: `Live chase calls per order: ${l.chasesPerOrder}`,
      body: `Against ${o.hist.totals.avgChaseCalls} in the supplied quarter. ${l.orders ? `Measured over ${l.orders} paid order${l.orders === 1 ? "" : "s"}.` : "No paid order yet, so this is not a result."}`,
      facts: [{ label: "Live", value: String(l.chasesPerOrder) }, { label: "Dataset", value: String(o.hist.totals.avgChaseCalls) }],
    });
  } else {
    out.push({ id: "live-thin", kind: "live", tone: "blue", score: 20, title: "Too few live journeys to read yet", body: `${l.conversations} advisor conversation${l.conversations === 1 ? "" : "s"} so far. Live findings appear once there are at least five.`, facts: [{ label: "Conversations", value: String(l.conversations) }] });
  }
  return rank(out);
}

export interface PlaybookInput {
  total: { cac: number | null; conversion: number };
  gstin: { with: { conversion: number; cac: number | null }; without: { conversion: number; cac: number | null } };
  waste: { segment: string; source: string; leads: number; activations: number; conversion: number; cac: number | null; spend: number } | null;
  signals: {
    partnerPay: { medianCostActivated: number; monthsOfRevenuePaid: number; fieldMonthsOfRevenue: number; maxPayout: number; partnerChurn: number; restChurn: number };
    leadQuality: { source: string; leads: number; lostBeforeContact: number; conversion: number }[];
    compliance: { activations: number; nonActiveGstin: number; ruleBreakingBundles: number; churnRuleBreaking: number; churnClean: number };
    labels: { activations: number; afterToday: number; churnNotYetObservable: number };
    language: { hindiEnglish: number; weakest: { language: string; leads: number; conversion: number }[] };
  };
}

/** Playbook: each signal states what the data shows, and only suggests an action when the numbers point to one. */
export function playbookInsights(p: PlaybookInput) {
  const out: Insight[] = [];
  const s = p.signals;
  if (p.waste) out.push({
    id: "pb-waste", kind: "waste", tone: "amber", score: cap((p.waste.cac && p.total.cac ? p.waste.cac / p.total.cac : 1) * 22),
    title: `${p.waste.source} on ${p.waste.segment} is the biggest leak`,
    body: `${num(p.waste.leads)} leads, ${p.waste.activations} activations (${p.waste.conversion}%), ${p.waste.cac ? inr(p.waste.cac) : "—"} per activation and ${inr(p.waste.spend)} spent${p.total.cac ? `, against ${inr(p.total.cac)} on average` : ""}.`,
    facts: [{ label: "Spend", value: inr(p.waste.spend) }, { label: "Activations", value: String(p.waste.activations) }],
  });
  if (p.gstin.without.conversion > 0) {
    const r = p.gstin.with.conversion / p.gstin.without.conversion;
    out.push({ id: "pb-gstin", kind: "gstin", tone: "blue", score: cap(r * 12), title: `Owners with a GSTIN convert ${r.toFixed(1)}× as often`, body: `${p.gstin.with.conversion}% activate with a GSTIN against ${p.gstin.without.conversion}% without${p.gstin.with.cac && p.gstin.without.cac ? `; cost per activation is ${inr(p.gstin.with.cac)} against ${inr(p.gstin.without.cac)}` : ""}.`, facts: [{ label: "With", value: `${p.gstin.with.conversion}%` }, { label: "Without", value: `${p.gstin.without.conversion}%` }] });
  }
  const pp = s.partnerPay, churnGap = pp.partnerChurn - pp.restChurn;
  out.push({
    id: "pb-partner", kind: "partner", tone: churnGap > 2 ? "red" : "blue", score: cap(Math.abs(churnGap) * 6 + 18),
    title: churnGap > 2 ? `Partner-sourced customers churn ${pp.partnerChurn}% against ${pp.restChurn}%` : `Partner churn (${pp.partnerChurn}%) is in line with the rest (${pp.restChurn}%)`,
    body: `A partner lead that activates is paid a median ${inr(pp.medianCostActivated)}, about ${pp.monthsOfRevenuePaid}× the monthly bundle (field sales: ${pp.fieldMonthsOfRevenue}×), up to ${inr(pp.maxPayout)} for one deal. ${churnGap > 2 ? "Because the payout is made at activation, holding part of it until month six would tie pay to retention." : "On this evidence a retention claw-back is not needed."}`,
    facts: [{ label: "Partner churn", value: `${pp.partnerChurn}%` }, { label: "Others", value: `${pp.restChurn}%` }],
  });
  const lq = [...s.leadQuality].sort((a, b) => b.lostBeforeContact - a.lostBeforeContact);
  if (lq.length > 1) {
    const worst = lq[0], rest = lq.slice(1), restAvg = rest.reduce((a, x) => a + x.lostBeforeContact * x.leads, 0) / Math.max(1, rest.reduce((a, x) => a + x.leads, 0));
    out.push({ id: "pb-leak", kind: "leak", tone: "amber", score: cap((worst.lostBeforeContact - restAvg) * 1.2 + 15), title: `${worst.source} loses ${worst.lostBeforeContact}% of leads before anyone speaks to them`, body: `Unreachable or wrong numbers, against ${restAvg.toFixed(1)}% for the other channels combined. It converts ${worst.conversion}% of its leads.`, facts: [{ label: "Lost early", value: `${worst.lostBeforeContact}%` }, { label: "Converts", value: `${worst.conversion}%` }] });
  }
  const c = s.compliance;
  out.push({ id: "pb-compliance", kind: "compliance", tone: "amber", score: cap(pct1(c.ruleBreakingBundles, c.activations) * 2 + 12), title: `${c.ruleBreakingBundles} of ${c.activations} sold bundles break the catalogue's rules`, body: `${c.nonActiveGstin} activations went live on a GSTIN the registry marks Cancelled or Suspended. Rule-breaking bundles churned ${c.churnRuleBreaking}% against ${c.churnClean}% for clean ones, ${c.churnRuleBreaking <= c.churnClean ? "so this is a compliance exposure rather than a churn driver" : "so they also retain worse"}.`, facts: [{ label: "Rule-breaking", value: String(c.ruleBreakingBundles) }, { label: "Inactive GSTIN", value: String(c.nonActiveGstin) }] });
  const lang = s.language.weakest[0];
  if (lang && lang.conversion < s.language.hindiEnglish) out.push({ id: "pb-lang", kind: "language", tone: "blue", score: cap((s.language.hindiEnglish - lang.conversion) * 4 + 8), title: `${lang.language}-speaking owners convert at ${lang.conversion}%`, body: `Against ${s.language.hindiEnglish}% for Hindi and English owners (${lang.leads} ${lang.language} leads). The weakest languages are the next candidates for the advisor.`, facts: [{ label: lang.language, value: `${lang.conversion}%` }, { label: "Hindi / English", value: `${s.language.hindiEnglish}%` }] });
  if (s.labels.churnNotYetObservable > 0) out.push({ id: "pb-caveat", kind: "caveat", tone: "blue", score: 10, title: "Churn cannot be fully observed yet", body: `With “today” fixed at 15 July 2026, a six-month churn flag can't be seen for ${num(s.labels.churnNotYetObservable)} of ${num(s.labels.activations)} activations, and ${s.labels.afterToday} are dated after today. Churn targets are proposals to re-baseline on real data.`, facts: [{ label: "Not observable", value: num(s.labels.churnNotYetObservable) }] });
  return rank(out, 4);
}
