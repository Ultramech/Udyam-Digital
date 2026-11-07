"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, FileText, Layers, MessageCircle, PhoneCall, ShoppingBag, Target, Users, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Donut, Funnel, HBars } from "@/components/ops/charts";
import { ExportButton, InsightList, Kpi, More, PageHeader, Panel, Pill, TargetsPanel, useInsights } from "@/components/ops/kit";
import { OpsShell } from "@/components/ops/shell";
import { api } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

interface Group { key: string; leads: number; activations: number; conversion: number; avgMonthly: number; churn: number; costPerActivation: number; avgDays: number; chaseCalls: number }
interface Hist {
  totals: { leads: number; activations: number; conversion: number; avgDaysToActivate: number; avgChaseCalls: number; blendedCac: number; medianBundle: number };
  funnel: { stage: string; leads: number }[]; bySegment: Group[]; bySource: Group[]; byTier: Group[]; byLanguage: Group[];
  backtest: { activatedSales: number; ruleViolatingSales: number; inactiveGstActivations: number; winbackPool: number; winbackMonthlyValue: number };
  model: { aucTest: number; liftTopDecile: number; baseRate: number; n: number; note: string };
}
interface Live { conversations: number; advisorRecommended: number; leads: number; escalated: number; quotes: number; kycCases: number; kycClean: number; kycReview: number; orders: number; activated: number; mrr: number; chasesPerOrder: number; escalationRate: number; kycFirstPass: number; conversion: number; avgMonthly: number; referralConversations?: number; referralOrders?: number; copilotLeads?: number }
interface Cx { journeys: number; medianMinutesToOrder: number; medianAdvisorTurns: number; avgQuoteEdits: number; avgPaymentAttempts: number; kycReviewRate: number; selfServeRate: number; avgHumanTouches: number; dropOff: { step: string; n: number }[] }
type TargetRow = Parameters<typeof TargetsPanel>[0]["targets"][number];
interface Trend { label: string; leads: number; conversion: number; avgDays: number | null; cac: number | null }

function GroupTable({ title, rows }: { title: string; rows: Group[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-sm font-bold">{title}</div>
      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["", "Leads", "Conv.", "₹/mo", "Churn", "Cost / activation", "Days", "Chases"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key} className="border-t"><td className="px-3 py-2 font-medium">{r.key}</td><td className="px-3">{r.leads.toLocaleString("en-IN")}</td><td className="px-3">{r.conversion}%</td><td className="px-3">{r.avgMonthly ? inr(r.avgMonthly) : "—"}</td><td className="px-3">{r.churn}%</td><td className="px-3">{r.costPerActivation ? inr(r.costPerActivation) : "—"}</td><td className="px-3">{r.avgDays || "—"}</td><td className="px-3">{r.chaseCalls || "—"}</td></tr>)}</tbody></table>
    </div>
  );
}

export default function Overview() {
  const [d, setD] = useState<{ historical: Hist; live: Live; cx?: Cx; targets: TargetRow[] } | null>(null);
  const insights = useInsights("overview");
  const [trend, setTrend] = useState<Trend[]>([]);
  useEffect(() => { const load = () => api<{ historical: Hist; live: Live; cx?: Cx; targets: TargetRow[] }>("GET", "/api/ops/overview").then(setD).catch(() => {}); load(); const h = setInterval(load, 6000); return () => clearInterval(h); }, []);
  useEffect(() => { api<{ trend: Trend[] }>("GET", "/api/ops/analytics").then((r) => setTrend(r.trend)).catch(() => {}); }, []); // partners can't read analytics: the sparklines are simply left out
  const spark = (k: keyof Trend) => (trend.length ? trend.map((t) => t[k]).filter((v): v is number => typeof v === "number") : undefined);

  return (
    <OpsShell>
      <div className="space-y-7">
        <PageHeader title="Overview" sub="What is happening in the prototype right now, next to the supplied quarter of leads. The two are kept separate on purpose."
          actions={<>
            <Pill tone="green" className="h-9 px-4"><span className="mr-2 size-2 animate-pulse rounded-full bg-success" />Live · updates every 6 s</Pill>
            {d && <ExportButton name="overview" rows={() => [["Metric", "Value"], ["Advisor conversations", d.live.conversations], ["Plans recommended", d.live.advisorRecommended], ["Quotes", d.live.quotes], ["Paid orders", d.live.orders], ["Activated", d.live.activated], ["Est. MRR (pre-GST)", d.live.mrr], ["Dataset leads", d.historical.totals.leads], ["Dataset lead → activation %", d.historical.totals.conversion], ["Dataset days to activate", d.historical.totals.avgDaysToActivate], ["Dataset blended CAC", d.historical.totals.blendedCac]]} />}
          </>} />

        {!d ? <div className="grid gap-4 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : (() => {
          const { historical: h, live: l, cx } = d;
          return (
            <>
              <section className="space-y-4" aria-label="Live prototype activity">
                <h2 className="text-lg font-extrabold">Live in the prototype</h2>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  <Kpi icon={MessageCircle} label="Advisor conversations" value={l.conversations} />
                  <Kpi icon={FileText} label="Quotes generated" value={l.quotes} />
                  <Kpi icon={ShoppingBag} label="Orders placed (paid)" value={l.orders} />
                  <Kpi icon={CheckCircle2} label="Activated" value={l.activated} />
                  <Kpi icon={Wallet} label="Est. monthly revenue" value={inr(l.mrr)} sub="before GST" />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Live journey funnel" sub="From the first advisor message to an activated order.">
                    {l.conversations === 0
                      ? <p className="py-10 text-center text-sm text-muted-foreground">Nothing yet. Start a journey from the <Link href="/" className="font-semibold text-primary underline">customer app</Link> or open a demo business.</p>
                      : <Funnel stages={[["Conversations", l.conversations], ["Plans recommended", l.advisorRecommended], ["Quotes", l.quotes], ["KYC cases", l.kycCases], ["Paid orders", l.orders], ["Activated", l.activated]].map(([stage, value], i, a) => ({ stage: stage as string, value: value as number, step: i && (a[i - 1][1] as number) ? Math.round(((value as number) / (a[i - 1][1] as number)) * 100) : null }))} />}
                  </Panel>
                  <Panel title="Hand-offs and quality" sub="How much of the journey ran without a person.">
                    <div className="grid grid-cols-3 gap-3">
                      {[["Needs a person", `${l.escalationRate}%`, `${l.escalated} leads`], ["KYC first pass", `${l.kycFirstPass}%`, `${l.kycClean} clean · ${l.kycReview} in review`], ["Chase calls / order", String(l.chasesPerOrder), "lower is better"]].map(([a, b, c]) => (
                        <div key={a} className="rounded-2xl bg-[oklch(0.975_0.012_20)] p-3.5"><div className="text-xs font-medium text-muted-foreground">{a}</div><div className="mt-1 text-2xl font-extrabold tabular-nums">{b}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{c}</div></div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-[oklch(0.975_0.012_20)] p-3.5"><div className="text-xs font-medium text-muted-foreground">Referral conversations</div><div className="mt-1 text-xl font-extrabold">{l.referralConversations ?? 0}</div><div className="text-[11px] text-muted-foreground">{l.referralOrders ?? 0} became paid orders</div></div>
                      <div className="rounded-2xl bg-[oklch(0.975_0.012_20)] p-3.5"><div className="text-xs font-medium text-muted-foreground">Co-pilot assisted</div><div className="mt-1 text-xl font-extrabold">{l.copilotLeads ?? 0}</div><div className="text-[11px] text-muted-foreground">reps and partners who helped</div></div>
                    </div>
                  </Panel>
                </div>
              </section>

              {cx && (
                <section className="space-y-4" aria-label="CX scorecard">
                  <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-extrabold">CX scorecard</h2><Pill tone="green">measured on live journeys, not assumed</Pill></div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <Panel title="Journeys that needed no one" sub={`${cx.journeys} paid journey${cx.journeys === 1 ? "" : "s"} so far`}>
                      <div className="flex flex-wrap items-center gap-6">
                        <Donut size={140} centre={`${cx.selfServeRate}%`} sub="self-serve" parts={[{ label: "Self-serve", value: cx.selfServeRate, color: "oklch(0.56 0.235 27)" }, { label: "Needed a person", value: Math.max(0, 100 - cx.selfServeRate), color: "oklch(0.9 0.04 20)" }]} />
                        <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 text-sm">
                          {[["First message → order", `${cx.medianMinutesToOrder} min`], ["Advisor turns", String(cx.medianAdvisorTurns)], ["Quote edits", String(cx.avgQuoteEdits)], ["Payment tries", String(cx.avgPaymentAttempts)], ["KYC needed a reviewer", `${cx.kycReviewRate}%`], ["Human touches", String(cx.avgHumanTouches)]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-extrabold tabular-nums">{v}</dd></div>)}
                        </dl>
                      </div>
                    </Panel>
                    <Panel title="Where live journeys stop" sub="Steps at which owners left before paying.">
                      <HBars rows={cx.dropOff.map((x) => ({ label: x.step, value: x.n }))} empty="No journey has stopped yet" />
                    </Panel>
                  </div>
                </section>
              )}

              <section className="space-y-4" aria-label="Historical dataset">
                <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-extrabold">The supplied quarter</h2><Pill>Apr–Jun 2026 · {h.totals.leads.toLocaleString("en-IN")} leads · synthetic</Pill></div>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  <Kpi icon={Users} label="Leads" value={h.totals.leads.toLocaleString("en-IN")} spark={spark("leads")} />
                  <Kpi icon={Target} label="Lead → activation" value={`${h.totals.conversion}%`} sub={`${h.totals.activations} activated`} spark={spark("conversion")} />
                  <Kpi icon={CalendarDays} label="Days to activate" value={h.totals.avgDaysToActivate} spark={spark("avgDays")} />
                  <Kpi icon={Layers} label="Cost / activation" value={inr(h.totals.blendedCac)} spark={spark("cac")} />
                  <Kpi icon={PhoneCall} label="Chase calls" value={h.totals.avgChaseCalls} sub="per activated customer" />
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <Panel title="Conversion funnel" sub="Lead journey to activation."><Funnel stages={h.funnel.map((f, i, a) => ({ stage: f.stage, value: f.leads, step: i ? Math.round((f.leads / a[i - 1].leads) * 100) : null }))} /></Panel>
                  <Panel title="Conversion by segment" sub="Share of leads that activated."><HBars rows={[...h.bySegment].sort((a, b) => b.conversion - a.conversion).map((s) => ({ label: s.key, value: s.conversion }))} fmt={(n) => `${n}%`} /></Panel>
                  <Panel title="Weekly lead → activation" sub="By the week the lead was created.">{trend.length ? <AreaChart data={trend.map((t) => ({ label: t.label, value: t.conversion }))} unit="%" format={(n) => n.toFixed(n % 1 ? 1 : 0)} /> : <p className="py-10 text-center text-sm text-muted-foreground">Trend is available to ops, admin and reps.</p>}</Panel>
                </div>
              </section>

              <section className="space-y-3" aria-label="Key insights">
                <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-extrabold">Key insights</h2><Pill>computed from the data · ranked by strength of evidence</Pill></div>
                <InsightList data={insights} />
              </section>

              <TargetsPanel targets={d.targets} />

              <More summary="Propensity model and breakdowns">
                <div className="space-y-6">
                  <p className="rounded-2xl bg-[oklch(0.975_0.012_20)] p-4 text-sm"><b>Propensity model.</b> Logistic regression on lead-time features only (no leakage). Held-out AUC <b>{h.model.aucTest}</b>, top-decile lift <b>{h.model.liftTopDecile}×</b> vs a {(h.model.baseRate * 100).toFixed(1)}% base rate. <span className="text-muted-foreground">{h.model.note}</span></p>
                  <GroupTable title="By segment" rows={h.bySegment} /><GroupTable title="By lead source" rows={h.bySource} /><GroupTable title="By language" rows={h.byLanguage} /><GroupTable title="By city tier" rows={h.byTier} />
                </div>
              </More>
            </>
          );
        })()}
      </div>
    </OpsShell>
  );
}
