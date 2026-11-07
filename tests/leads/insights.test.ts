import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { analytics, pilotTargets } from "@/lib/leads/analytics";
import { datasetInsights, overviewInsights, playbookInsights, type PlaybookInput } from "@/lib/leads/insights";
import { evaluateTargets, TARGETS } from "@/lib/leads/targets";

const ALL = [...datasetInsights({}).insights, ...datasetInsights({}).more];

describe("pilot targets have one source", () => {
  it("analytics reads the shared definitions and nothing else", () => {
    const t = analytics({}).totals;
    expect(pilotTargets()).toEqual(evaluateTargets({ conversion: t.conversion, avgDaysToActivate: t.avgDaysToActivate, avgChases: t.avgChases, cac: t.cac, churn6m: t.churn6m }));
    expect(pilotTargets().map((x) => x.id)).toEqual(TARGETS.map((x) => x.id));
  });
  it("distance to target is measured, and zero means met", () => {
    const met = evaluateTargets({ conversion: 20, avgDaysToActivate: 5, avgChases: 0.5, cac: 6000, churn6m: 8 });
    expect(met.every((x) => x.met && x.gap === 0)).toBe(true);
    const open = evaluateTargets({ conversion: 7.5, avgDaysToActivate: 14, avgChases: 3, cac: 15000, churn6m: 15 });
    expect(open.find((x) => x.id === "conversion")!.gap).toBeCloseTo(0.5, 5);
    expect(open.find((x) => x.id === "cac")!.gap).toBeCloseTo(0.5, 5);
  });
});

describe("dataset insights are derived from the data", () => {
  it("the funnel-leak insight quotes the analytics funnel's own numbers", () => {
    const f = analytics({}).funnel;
    const steps = f.slice(1).map((s, i) => ({ from: f[i].stage, to: s.stage, lost: f[i].leads - s.leads, loss: 1 - s.leads / f[i].leads })).filter((x, i) => f[i].leads >= 50);
    const worst = [...steps].sort((a, b) => b.loss - a.loss)[0];
    const leak = ALL.find((i) => i.id === "funnel-leak")!;
    expect(leak.title).toContain(`${worst.from} → ${worst.to}`);
    expect(leak.facts.find((x) => x.label === "Lost")!.value).toBe(worst.lost.toLocaleString("en-IN"));
  });

  it("every insight is evidenced: finite score, facts, no empty text, unique ids", () => {
    expect(ALL.length).toBeGreaterThanOrEqual(5);
    for (const i of ALL) { expect(Number.isFinite(i.score)).toBe(true); expect(i.title.length).toBeGreaterThan(10); expect(i.body.length).toBeGreaterThan(20); expect(i.facts.length).toBeGreaterThan(0); }
    expect(new Set(ALL.map((i) => i.id)).size).toBe(ALL.length);
  });

  it("the headline list is the strongest findings, at most one per kind", () => {
    const { insights } = datasetInsights({});
    expect(insights.length).toBeLessThanOrEqual(3);
    expect(new Set(insights.map((i) => i.kind)).size).toBe(insights.length);
    const rest = datasetInsights({}).more;
    expect(Math.min(...insights.map((i) => i.score))).toBeGreaterThanOrEqual(Math.max(...rest.filter((r) => !insights.some((i) => i.kind === r.kind)).map((r) => r.score), 0));
  });

  it("filtering changes the findings and never reports on the dimension that is filtered", () => {
    const micro = [...datasetInsights({ segment: "Micro retail & services" }).insights, ...datasetInsights({ segment: "Micro retail & services" }).more];
    expect(micro.map((i) => i.title)).not.toEqual(ALL.map((i) => i.title));
    expect(micro.some((i) => /\bsegment\b/.test(i.facts.map((f) => f.label).join(" ")))).toBe(false); // a one-segment slice has no segment outliers
    const tier = datasetInsights({ tier: "1" });
    expect([...tier.insights, ...tier.more].some((i) => i.facts.some((f) => f.label === "city tier"))).toBe(false);
  });

  it("outlier groups really are far from the view's average (z >= 2 and a real gap)", () => {
    const o = ALL.filter((i) => i.kind.startsWith("outlier"));
    for (const i of o) {
      const avg = Number(/the ([\d.]+)% average/.exec(i.body)![1]);
      const conv = Number(/convert at ([\d.]+)%/.exec(i.title)![1]);
      expect(Math.abs(conv - avg)).toBeGreaterThanOrEqual(1);
      expect(Number(/([\d.]+)σ/.exec(i.body)![1])).toBeGreaterThanOrEqual(2);
    }
  });

  it("a tiny slice yields no invented findings", () => {
    const tiny = datasetInsights({ segment: "Small manufacturers", tier: "2", language: "Punjabi", source: "WhatsApp campaign" });
    expect([...tiny.insights, ...tiny.more].every((i) => i.kind === "target" || i.kind === "revenue" || i.kind === "reason" || i.kind === "nps" || i.kind === "trend")).toBe(true);
  });
});

describe("overview and playbook insights change with the numbers", () => {
  const hist = { backtest: { activatedSales: 368, ruleViolatingSales: 56, inactiveGstActivations: 22, winbackPool: 1652, winbackMonthlyValue: 78_83_264 }, totals: { avgChaseCalls: 3 } };
  const live = (n: number) => ({ conversations: n, advisorRecommended: Math.round(n * 0.9), quotes: Math.round(n * 0.8), kycCases: Math.round(n * 0.2), orders: Math.round(n * 0.05), activated: 0, kycFirstPass: 50, chasesPerOrder: 0 });

  it("says there is too little live data instead of inventing a finding", () => {
    const o = overviewInsights({ hist, live: live(2) });
    expect([...o.insights, ...o.more].some((i) => i.id === "live-thin")).toBe(true);
    expect([...o.insights, ...o.more].some((i) => i.id === "live-leak")).toBe(false);
  });
  it("reads the live funnel once there is enough of it", () => {
    const o = overviewInsights({ hist, live: live(100) });
    const leak = [...o.insights, ...o.more].find((i) => i.id === "live-leak")!;
    expect(leak).toBeTruthy();
    expect(leak.facts.find((f) => f.label === "Stopped")).toBeTruthy();
  });

  const pb = (partnerChurn: number, restChurn: number): PlaybookInput => ({
    total: { cac: 15053, conversion: 7.4 }, gstin: { with: { conversion: 9.6, cac: 12686 }, without: { conversion: 2, cac: 41728 } }, waste: null,
    signals: {
      partnerPay: { medianCostActivated: 8560, monthsOfRevenuePaid: 1.7, fieldMonthsOfRevenue: 0.5, maxPayout: 103170, partnerChurn, restChurn },
      leadQuality: [{ source: "A", leads: 500, lostBeforeContact: 40, conversion: 3 }, { source: "B", leads: 800, lostBeforeContact: 10, conversion: 9 }],
      compliance: { activations: 368, nonActiveGstin: 22, ruleBreakingBundles: 56, churnRuleBreaking: 8.9, churnClean: 16.3 },
      labels: { activations: 368, afterToday: 16, churnNotYetObservable: 368 }, language: { hindiEnglish: 8, weakest: [{ language: "Punjabi", leads: 120, conversion: 4.2 }] },
    },
  });
  const find = (x: PlaybookInput) => { const r = playbookInsights(x); return [...r.insights, ...r.more].find((i) => i.id === "pb-partner")!; };

  it("only recommends a retention claw-back when partner churn is actually higher", () => {
    expect(find(pb(25, 14)).body).toContain("holding part of it until month six");
    expect(find(pb(14, 14)).body).toContain("not needed");
    expect(find(pb(25, 14)).tone).toBe("red");
    expect(find(pb(14, 14)).tone).toBe("blue");
  });
  it("names whichever channel leaks most, not a fixed one", () => {
    const r = playbookInsights(pb(14, 14)); const leak = [...r.insights, ...r.more].find((i) => i.id === "pb-leak")!;
    expect(leak.title).toContain("A loses 40%");
    const flipped = pb(14, 14); flipped.signals.leadQuality = [{ source: "B", leads: 800, lostBeforeContact: 45, conversion: 2 }, { source: "A", leads: 500, lostBeforeContact: 5, conversion: 9 }];
    const r2 = playbookInsights(flipped); expect([...r2.insights, ...r2.more].find((i) => i.id === "pb-leak")!.title).toContain("B loses 45%");
  });
});
