"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
interface Live { conversations: number; advisorRecommended: number; leads: number; escalated: number; quotes: number; kycCases: number; kycClean: number; kycReview: number; orders: number; activated: number; mrr: number; chasesPerOrder: number; escalationRate: number; kycFirstPass: number; conversion: number; avgMonthly: number ; referralConversations?: number; referralOrders?: number; copilotLeads?: number }

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Card className="p-3.5"><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold leading-none">{value}</div>{sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}</Card>
);

function GroupTable({ title, rows }: { title: string; rows: Group[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <div className="border-b p-3 text-sm font-semibold">{title}</div>
      <table className="w-full text-sm"><thead><tr className="text-left text-[11px] text-muted-foreground">{["", "Leads", "Conv.", "₹/mo", "Churn", "Cost / activation", "Days", "Chases"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key} className="border-t"><td className="px-3 py-1.5 font-medium">{r.key}</td><td className="px-3">{r.leads.toLocaleString("en-IN")}</td><td className="px-3">{r.conversion}%</td><td className="px-3">{r.avgMonthly ? inr(r.avgMonthly) : "—"}</td><td className="px-3">{r.churn}%</td><td className="px-3">{r.costPerActivation ? inr(r.costPerActivation) : "—"}</td><td className="px-3">{r.avgDays || "—"}</td><td className="px-3">{r.chaseCalls || "—"}</td></tr>)}</tbody></table>
    </Card>
  );
}

interface Cx {
  journeys: number; medianMinutesToOrder: number; medianAdvisorTurns: number; avgQuoteEdits: number; avgPaymentAttempts: number; kycReviewRate: number; selfServeRate: number; avgHumanTouches: number;
  dropOff: { step: string; n: number }[];
  recent: { orderId: string; stage: string; advisorTurns: number; quoteEdits: number; minutesToOrder: number | null; paymentAttempts: number; kycReview: boolean; chases: number; humanTouches: number; selfServe: boolean }[];
}

function CxScorecard({ cx }: { cx: Cx }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2"><h2 className="font-semibold">CX scorecard</h2><Badge variant="success">live journeys · measured, not assumed</Badge></div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile label="Paid journeys" value={cx.journeys} />
        <Tile label="First message → order" value={`${cx.medianMinutesToOrder} min`} sub="median" />
        <Tile label="Advisor turns" value={cx.medianAdvisorTurns} sub="median messages from the owner" />
        <Tile label="Fully self-serve" value={`${cx.selfServeRate}%`} sub={`${cx.avgHumanTouches} human touches / journey`} />
        <Tile label="Quote edits" value={cx.avgQuoteEdits} sub="average per journey" />
        <Tile label="Payment attempts" value={cx.avgPaymentAttempts} sub="average (1.00 = no retries)" />
        <Tile label="KYC needed a reviewer" value={`${cx.kycReviewRate}%`} />
        <Tile label="Stopped before paying" value={cx.dropOff.reduce((s, d) => s + d.n, 0)} sub="see where below" />
      </div>
      <Card className="overflow-x-auto p-0">
        <div className="border-b p-3 text-sm font-semibold">Where live journeys stop</div>
        <table className="w-full text-sm"><tbody>{cx.dropOff.map((d) => <tr key={d.step} className="border-t first:border-0"><td className="px-3 py-1.5">{d.step}</td><td className="px-3 text-right tabular-nums">{d.n}</td></tr>)}</tbody></table>
      </Card>
      {cx.recent.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <div className="border-b p-3 text-sm font-semibold">Recent journeys</div>
          <table className="w-full text-sm"><thead><tr className="text-left text-[11px] text-muted-foreground">{["Order", "Stage", "Turns", "Edits", "Minutes", "Pay tries", "KYC review", "Chases", "Human touches"].map((h) => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}</tr></thead>
            <tbody>{cx.recent.map((j) => <tr key={j.orderId} className="border-t"><td className="px-3 py-1.5 font-mono text-xs">{j.orderId}</td><td className="px-3 text-xs">{j.stage}</td><td className="px-3 tabular-nums">{j.advisorTurns}</td><td className="px-3 tabular-nums">{j.quoteEdits}</td><td className="px-3 tabular-nums">{j.minutesToOrder ?? "—"}</td><td className="px-3 tabular-nums">{j.paymentAttempts}</td><td className="px-3">{j.kycReview ? "yes" : "no"}</td><td className="px-3 tabular-nums">{j.chases}</td><td className="px-3 tabular-nums">{j.humanTouches}{j.selfServe ? " · self-serve" : ""}</td></tr>)}</tbody></table>
        </Card>
      )}
    </section>
  );
}

export default function Overview() {
  const [d, setD] = useState<{ historical: Hist; live: Live; cx?: Cx } | null>(null);
  useEffect(() => { const load = () => api<{ historical: Hist; live: Live; cx?: Cx }>("GET", "/api/ops/overview").then(setD).catch(() => {}); load(); const h = setInterval(load, 6000); return () => clearInterval(h); }, []);
  return (
    <OpsShell>
      {!d ? <Skeleton className="h-96" /> : (() => {
        const { historical: h, live: l } = d;
        const max = h.funnel[0].leads;
        return (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-bold">Overview</h1><p className="text-sm text-muted-foreground">Live prototype activity and the historical dataset are kept separate on purpose.</p></div>

            <section className="space-y-2.5"><div className="flex items-center gap-2"><h2 className="font-semibold">Live prototype activity</h2><Badge variant="success">live · refreshes every 6s</Badge></div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
                <Tile label="Advisor conversations" value={l.conversations} /><Tile label="Plans recommended" value={l.advisorRecommended} /><Tile label="Quotes generated" value={l.quotes} />
                <Tile label="KYC cases" value={l.kycCases} sub={`${l.kycClean} clean · ${l.kycReview} in review`} /><Tile label="Orders placed (paid)" value={l.orders} /><Tile label="Activated" value={l.activated} />
                <Tile label="Conversation → order" value={`${l.conversion}%`} /><Tile label="Escalation rate" value={`${l.escalationRate}%`} sub={`${l.escalated} leads need a person`} /><Tile label="KYC first-pass" value={`${l.kycFirstPass}%`} />
                <Tile label="Chase calls / order" value={l.chasesPerOrder} /><Tile label="Est. MRR (pre-GST)" value={inr(l.mrr)} /><Tile label="Avg plan value" value={l.avgMonthly ? inr(l.avgMonthly) : "—"} />
                <Tile label="Referrals" value={l.referralConversations ?? 0} sub={`${l.referralOrders ?? 0} became paid orders`} /><Tile label="Co-pilot assisted leads" value={l.copilotLeads ?? 0} sub="rep/partner helped in the advisor" />
              </div>
              {l.conversations === 0 && <p className="text-xs text-muted-foreground">Nothing yet — start a journey from the <Link href="/" className="text-primary underline">customer app</Link> or pick a demo business.</p>}
            </section>

            {d.cx && <CxScorecard cx={d.cx} />}
            <section className="space-y-2.5"><div className="flex items-center gap-2"><h2 className="font-semibold">Historical dataset</h2><Badge variant="secondary">Apr–Jun 2026 · {h.totals.leads.toLocaleString("en-IN")} leads · synthetic</Badge></div>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-6">
                <Tile label="Lead → activation" value={`${h.totals.conversion}%`} sub={`${h.totals.activations} activated`} /><Tile label="Days to activate" value={h.totals.avgDaysToActivate} /><Tile label="Chase calls" value={h.totals.avgChaseCalls} />
                <Tile label="Blended cost / activation" value={inr(h.totals.blendedCac)} /><Tile label="Median bundle" value={inr(h.totals.medianBundle)} sub="per month" />
              </div>
              <Card className="space-y-1.5 p-4"><div className="mb-1 text-sm font-semibold">Funnel</div>
                {h.funnel.map((f, i) => <div key={f.stage} className="flex items-center gap-3 text-sm"><div className="w-32 shrink-0 text-muted-foreground">{f.stage}</div><div className="h-5 flex-1 rounded bg-muted"><div className={`h-5 rounded ${f.stage === "Quote accepted" ? "bg-primary" : "bg-foreground/25"}`} style={{ width: `${(f.leads / max) * 100}%` }} /></div><div className="w-24 shrink-0 text-right tabular-nums">{f.leads.toLocaleString("en-IN")}{i > 0 && <span className="ml-1 text-xs text-muted-foreground">{Math.round((f.leads / h.funnel[i - 1].leads) * 100)}%</span>}</div></div>)}
              </Card>
            </section>

            <section className="space-y-2.5"><div className="flex items-center gap-2"><h2 className="font-semibold">Impact hypothesis</h2><Badge variant="outline">proposed targets · not measured · need a real pilot</Badge></div>
              <Card className="overflow-x-auto p-0"><table className="w-full text-sm"><thead><tr className="text-left text-[11px] text-muted-foreground"><th className="px-3 py-2">Metric</th><th>Baseline (dataset)</th><th>Proposed pilot target</th></tr></thead><tbody>
                {[["Lead → activation", `${h.totals.conversion}%`, "12%"], ["Time to activate", `${h.totals.avgDaysToActivate} days`, "≤ 7 days"], ["Blended cost / activation", inr(h.totals.blendedCac), "≤ ₹7,000 (micro ≤ ₹5,000)"], ["Chase calls / order", h.totals.avgChaseCalls, "≤ 0.5"], ["Micro-retail 6-month churn", `${h.bySegment.find((s) => s.key.startsWith("Micro"))?.churn}%`, "≤ 15%"]].map((r) => <tr key={String(r[0])} className="border-t"><td className="px-3 py-1.5 font-medium">{r[0]}</td><td>{r[1]}</td><td className="text-primary">{r[2]}</td></tr>)}
              </tbody></table></Card>
              <p className="text-xs text-muted-foreground">Chase calls correlate with churn in the dataset (1 call → 6%, 5 calls → 28%); we do not claim the tracker causes the difference.</p>
            </section>

            <section className="space-y-2.5"><h2 className="font-semibold">What the rules engine found in the historical sales</h2>
              <div className="grid gap-2.5 md:grid-cols-3">
                <Tile label="Sales that broke the catalogue's own rules" value={`${h.backtest.ruleViolatingSales} of ${h.backtest.activatedSales}`} sub="wrong tier, missing GST, no carrier — our engine blocks these" />
                <Tile label="Activations on Cancelled / Suspended GST" value={h.backtest.inactiveGstActivations} sub="customers activated whose GSTIN is Cancelled or Suspended in the registry" />
                <Tile label="Win-back pool" value={h.backtest.winbackPool.toLocaleString("en-IN")} sub="dropped for reasons a digital journey fixes" />
              </div>
              <Card className="p-3.5 text-sm"><b>Propensity model</b> — logistic regression on lead-time features only (no leakage). Held-out AUC <b>{h.model.aucTest}</b>, top-decile lift <b>{h.model.liftTopDecile}×</b> vs a {(h.model.baseRate * 100).toFixed(1)}% base rate. <span className="text-muted-foreground">{h.model.note}</span></Card>
            </section>

            <section className="space-y-3"><h2 className="font-semibold">Where the money and the leaks are</h2>
              <GroupTable title="By segment" rows={h.bySegment} /><GroupTable title="By lead source" rows={h.bySource} /><GroupTable title="By language" rows={h.byLanguage} /><GroupTable title="By city tier" rows={h.byTier} />
            </section>
          </div>
        );
      })()}
    </OpsShell>
  );
}
