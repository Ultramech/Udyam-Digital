"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Layers, Target, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Donut, Funnel, HBars, Meter } from "@/components/ops/charts";
import { ExportButton, Insight, Kpi, More, PageHeader, Panel, Pill, selectCls } from "@/components/ops/kit";
import { OpsShell } from "@/components/ops/shell";
import { api } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

type Band = "high" | "medium" | "low";
interface Risk { probability: number; band: Band; drivers: { text: string; direction: "up" | "down" }[]; actions: string[] }
interface Data {
  options: Record<"segment" | "tier" | "source" | "language" | "month", string[]>;
  n: number;
  trend: { week: string; label: string; leads: number; activations: number; conversion: number; avgDays: number | null; cac: number | null; churn: number | null }[];
  totals: { leads: number; activations: number; conversion: number; avgDaysToActivate: number; avgChases: number; cac: number; mrrActivated: number; mrrRetained: number; arpa: number; avgSetup: number; churn6m: number; retainedCustomers: number; paybackMonths: number | null };
  funnel: { stage: string; leads: number; fromPrevious: number | null }[];
  nps: { responses: number; promoters: number; passives: number; detractors: number; score: number | null };
  revenueByProduct: { id: string; name: string; revenue: number; customers: number }[];
  churnByBundle: { bundle: string; customers: number; churn: number; avgMonthly: number }[];
  dropReasons: { reason: string; n: number }[];
  retention: { bands: { band: Band; customers: number; actualChurn: number }[]; top: { id: string; business: string; segment: string; source: string; monthly: number; churned: boolean; risk: Risk }[] };
  targets: { metric: string; baseline: string; target: string; lever: string }[];
  churnModel: { n: number; churners: number; baseRate: number; aucCv5: number; liftTopQuartile: number; note: string };
  liveAtRisk: { id: string; business: string; monthly: number; risk: Risk }[];
}

const BAND_TONE = { high: "red", medium: "amber", low: "green" } as const;
const FILTERS = ["segment", "tier", "source", "language"] as const;
const L: Record<string, string> = { segment: "All segments", tier: "All city tiers", source: "All sources", language: "All languages", month: "All months" };
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export default function Analytics() {
  const [f, setF] = useState<Record<string, string>>({});
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    api<Data>("GET", `/api/ops/analytics${qs ? `?${qs}` : ""}`).then(setD).catch(() => {});
  }, [f]);
  const sp = (k: "leads" | "conversion" | "avgDays" | "cac" | "churn") => d?.trend.map((t) => t[k]).filter((v): v is number => v !== null);
  const filtered = Object.values(f).some(Boolean);

  const top = d?.revenueByProduct[0];
  const conv = d?.totals.conversion ?? 0;
  const nps = d?.nps;

  return (
    <OpsShell>
      <div className="space-y-6">
        <PageHeader title="Analytics" sub="Business performance, conversion and retention insights from the supplied quarter of leads (synthetic). Live activity is on Overview."
          actions={<>
            {d && (
              <select aria-label={L.month} className={selectCls} value={f.month ?? ""} onChange={(e) => setF((x) => ({ ...x, month: e.target.value }))}>
                <option value="">Apr – Jun 2026</option>{d.options.month.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </select>
            )}
            {d && d.n > 0 && <ExportButton name="analytics" rows={() => [["Metric", "Value"], ["Leads", d.totals.leads], ["Activations", d.totals.activations], ["Lead → activation %", d.totals.conversion], ["Days to activate", d.totals.avgDaysToActivate], ["CAC per activation (INR)", d.totals.cac], ["6-month churn %", d.totals.churn6m], ["MRR activated (INR)", d.totals.mrrActivated], [], ["Funnel stage", "Leads", "From previous %"], ...d.funnel.map((s) => [s.stage, s.leads, s.fromPrevious ?? ""]), [], ["Product", "Monthly revenue (INR)", "Customers"], ...d.revenueByProduct.map((p) => [`${p.id} ${p.name}`, p.revenue, p.customers])]} />}
          </>} />

        <div className="flex flex-wrap items-center gap-3">
          {d && FILTERS.map((k) => (
            <select key={k} className={selectCls} value={f[k] ?? ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} aria-label={L[k]}>
              <option value="">{L[k]}</option>{d.options[k].map((o) => <option key={o} value={o}>{k === "tier" ? `Tier ${o}` : o}</option>)}
            </select>
          ))}
          {filtered && <button type="button" className="text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setF({})}>Clear filters</button>}
        </div>

        {!d ? <div className="grid gap-4 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div> : d.n === 0 ? <Panel><p className="py-8 text-center text-sm text-muted-foreground">No leads match these filters.</p></Panel> : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi icon={Users} label="Leads" value={d.totals.leads.toLocaleString("en-IN")} spark={sp("leads")} />
              <Kpi icon={Target} label="Lead → activation" value={`${d.totals.conversion}%`} sub={`${d.totals.activations} activated`} spark={sp("conversion")} />
              <Kpi icon={CalendarDays} label="Days to activate" value={d.totals.avgDaysToActivate} sub={`${d.totals.avgChases} status chases each`} spark={sp("avgDays")} />
              <Kpi icon={Layers} label="CAC / activation" value={inr(d.totals.cac)} sub={d.totals.paybackMonths ? `payback ≈ ${d.totals.paybackMonths} months of revenue` : undefined} spark={sp("cac")} />
              <Kpi icon={TrendingUp} label="6-month churn" value={`${d.totals.churn6m}%`} sub={`${d.totals.retainedCustomers} retained`} spark={sp("churn")} />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Conversion funnel" sub="Lead journey to activation."><Funnel stages={d.funnel.map((s) => ({ stage: s.stage, value: s.leads, step: s.fromPrevious }))} /></Panel>
              <Panel title="Revenue by product" sub="Monthly revenue from activated customers.">
                <HBars rows={d.revenueByProduct.slice(0, 6).map((p) => ({ label: `${p.id} ${p.name}`, value: p.revenue, note: `${p.customers}` }))} fmt={inr} />
                <p className="mt-3 text-[11px] text-muted-foreground">Each bundle&apos;s value is split across its products by catalogue list-price weight. Small number = customers.</p>
              </Panel>
              <Panel title="Churn trend" sub="% churned within 6 months, by the week the lead was created (complete weeks with 5+ activations).">
                <AreaChart data={d.trend.filter((t) => t.churn !== null).map((t) => ({ label: t.label, value: t.churn as number }))} unit="%" format={(n) => n.toFixed(n % 1 ? 1 : 0)} />
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Panel title="Weekly lead → activation" sub="Share of each week's leads that activated.">
                <AreaChart data={d.trend.map((t) => ({ label: t.label, value: t.conversion }))} unit="%" format={(n) => n.toFixed(n % 1 ? 1 : 0)} />
              </Panel>
              <Panel title="Why leads dropped" sub="Reasons recorded on lost leads.">
                <HBars rows={d.dropReasons.slice(0, 6).map((r) => ({ label: r.reason, value: r.n }))} />
              </Panel>
              <Panel title="Customer satisfaction" sub={`${d.nps.responses} NPS responses from activated customers.`}>
                {nps && nps.score !== null ? (
                  <div className="flex flex-wrap items-center gap-5">
                    <Donut size={142} centre={String(nps.score)} sub="NPS" parts={[{ label: "Promoters", value: nps.promoters, color: "oklch(0.56 0.235 27)" }, { label: "Passives", value: nps.passives, color: "oklch(0.8 0.08 25)" }, { label: "Detractors", value: nps.detractors, color: "oklch(0.35 0.012 60)" }]} />
                    <ul className="space-y-2 text-sm">{[["Promoters", nps.promoters, "oklch(0.56 0.235 27)"], ["Passives", nps.passives, "oklch(0.8 0.08 25)"], ["Detractors", nps.detractors, "oklch(0.35 0.012 60)"]].map(([k, v, c]) => <li key={String(k)} className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: String(c) }} /><span className="text-muted-foreground">{k}</span><b className="ml-auto tabular-nums">{v}</b></li>)}</ul>
                  </div>
                ) : <p className="py-8 text-center text-sm text-muted-foreground">No NPS responses in this slice.</p>}
              </Panel>
            </div>

            <section className="space-y-3" aria-label="Key insights">
              <h2 className="text-lg font-extrabold">Key insights</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                <Insight icon={TrendingUp} tone="red" title="Activation can improve">Lead → activation is {conv}%. The proposed pilot target is 15%, mostly from the step between needs assessed and quote accepted.</Insight>
                {top && <Insight icon={Wallet} tone="amber" title={`${top.id} drives the most revenue`}>{top.name} contributes {inr(top.revenue)} a month across {top.customers} activated customers ({Math.round((top.revenue / Math.max(1, d.totals.mrrActivated)) * 100)}% of all activated revenue).</Insight>}
                <Insight icon={TrendingDown} tone="green" title={d.totals.churn6m > 10 ? "Churn needs attention" : "Churn is within target"}>6-month churn is {d.totals.churn6m}% against a proposed target of 10% or less. Early check-ins on at-risk customers are the lever.</Insight>
              </div>
            </section>

            <Panel title="Pilot targets (proposed, not results)" sub="Baselines are from the full file, not the filter.">
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["Metric", "Baseline", "Pilot target", "What has to change"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{d.targets.map((t) => <tr key={t.metric} className="border-t"><td className="px-3 py-2.5 font-semibold">{t.metric}</td><td className="px-3">{t.baseline}</td><td className="px-3 font-bold text-primary">{t.target}</td><td className="px-3 text-xs text-muted-foreground">{t.lever}</td></tr>)}</tbody></table></div>
            </Panel>

            <Panel title="Retention risk at activation" sub={`Logistic model on ${d.churnModel.n} activated customers (${d.churnModel.churners} churned). 5-fold cross-validated AUC ${d.churnModel.aucCv5}, top-quartile lift ${d.churnModel.liftTopQuartile}×. A modest ranking signal for who to call first: correlation, not cause. Features known at activation only (no NPS).`}>
              <div className="grid gap-3 sm:grid-cols-3">
                {d.retention.bands.map((b) => (
                  <div key={b.band} className="rounded-2xl bg-[oklch(0.975_0.012_20)] p-4">
                    <Pill tone={BAND_TONE[b.band]} className="capitalize">{b.band} risk</Pill>
                    <div className="mt-2 text-2xl font-extrabold tabular-nums">{b.customers}</div><div className="text-xs text-muted-foreground">customers · actual churn {b.actualChurn}%</div>
                    <div className="mt-2"><Meter value={b.actualChurn} max={40} tone={b.band === "high" ? "red" : b.band === "medium" ? "amber" : "green"} /></div>
                  </div>
                ))}
              </div>
              {d.liveAtRisk.length > 0 && (
                <div className="mt-5"><div className="mb-2 text-sm font-bold">Live activated customers</div>
                  <ul className="space-y-2 text-sm">{d.liveAtRisk.map((c) => <li key={c.id} className="rounded-2xl border p-3.5"><div className="flex items-center justify-between gap-2"><span><b>{c.business}</b> · {c.id} · {inr(c.monthly)}/mo</span><Pill tone={BAND_TONE[c.risk.band]} className="capitalize">{c.risk.band}</Pill></div>
                    <div className="mt-1 text-xs text-muted-foreground">{c.risk.drivers.map((x) => `${x.direction === "up" ? "↑" : "↓"} ${x.text}`).join(" · ")}</div>{c.risk.actions.map((a) => <div key={a} className="text-xs">→ {a}</div>)}</li>)}</ul></div>
              )}
            </Panel>

            <More summary="Churn by bundle and the highest-risk customers">
              <div className="space-y-6">
                <div><div className="mb-3 text-sm font-bold">Churn by bundle (5 or more customers)</div>
                  <HBars rows={d.churnByBundle.map((b) => ({ label: b.bundle, value: b.churn, note: `${b.customers} cust · ${inr(b.avgMonthly)}/mo` }))} fmt={(n) => `${n}%`} /></div>
                <div className="overflow-x-auto"><div className="mb-2 text-sm font-bold">Highest-risk historical customers <span className="font-normal text-muted-foreground">(actual outcome shown for transparency)</span></div>
                  <table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["Customer", "Segment / source", "₹/mo", "Risk", "Drivers", "Suggested action", "Churned"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{d.retention.top.map((c) => <tr key={c.id} className="border-t align-top"><td className="px-2 py-2">{c.business}<div className="font-mono text-[10px] text-muted-foreground">{c.id}</div></td><td className="px-2 text-xs">{c.segment}<div className="text-muted-foreground">{c.source}</div></td><td className="px-2">{inr(c.monthly)}</td><td className="px-2"><Pill tone={BAND_TONE[c.risk.band]}>{Math.round(c.risk.probability * 100)}</Pill></td><td className="px-2 text-xs">{c.risk.drivers.map((x) => `${x.direction === "up" ? "↑" : "↓"} ${x.text}`).join(" · ")}</td><td className="px-2 text-xs">{c.risk.actions[0] ?? "—"}</td><td className="px-2">{c.churned ? "Yes" : "No"}</td></tr>)}</tbody></table></div>
              </div>
            </More>
          </>
        )}
      </div>
    </OpsShell>
  );
}
