"use client";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { HBars, Meter } from "@/components/ops/charts";
import { InsightList, More, PageHeader, Panel, Pill, useInsights } from "@/components/ops/kit";
import { OpsShell } from "@/components/ops/shell";
import { api } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

interface Cell { leads: number; activations: number; conversion: number; cac: number | null; spend: number; lowSample: boolean }
interface Seg extends Cell {
  segment: string; shareOfLeads: number; arpa: number; churn: number; avgDays: number; gstinShare: number; medianBought: number; typicalContract: string; firstYearPerRupee: number | null;
  advisor: { bundle: string; monthly: number; contractMonths: number; basis: string } | null;
  bestChannel: { source: string; cac: number; conversion: number; leads: number } | null;
  costlyChannels: { source: string; cac: number; spend: number; activations: number; conversion: number }[];
  bySource: ({ source: string } & Cell)[];
}
interface Data {
  total: Cell; segments: Seg[]; minCell: number;
  channels: ({ source: string; shareOfSpend: number; churn: number; arpa: number } & Cell)[];
  gstin: { with: Cell; without: Cell };
  waste: ({ segment: string; source: string } & Cell) | null;
  signals: {
    partnerPay: { medianCostActivated: number; medianCostDropped: number; monthsOfRevenuePaid: number; fieldMonthsOfRevenue: number; maxPayout: number; partnerChurn: number; restChurn: number };
    leadQuality: { source: string; leads: number; lostBeforeContact: number; conversion: number }[];
    compliance: { activations: number; nonActiveGstin: number; ruleBreakingBundles: number; churnRuleBreaking: number; churnClean: number };
    labels: { activations: number; afterToday: number; churnNotYetObservable: number };
    language: { hindiEnglish: number; weakest: { language: string; leads: number; conversion: number }[] };
  };
}
const cac = (n: number | null) => (n === null ? "—" : inr(n));

/** Cell shading for cost per activation, relative to the quarter's average: cheaper is green, dearer is red, thin cells are greyed. */
function cellStyle(v: number | null, avg: number, low: boolean): React.CSSProperties {
  if (v === null || low) return { background: "oklch(0.97 0.004 20)" };
  const r = v / (avg || 1);
  return r <= 1 ? { background: `color-mix(in oklch, var(--success) ${Math.round(Math.min(1, (1 - r) * 2.2) * 28)}%, white)` } : { background: `color-mix(in oklch, var(--primary) ${Math.round(Math.min(1, (r - 1) * 0.9) * 34)}%, white)` };
}

export default function Playbook() {
  const [d, setD] = useState<Data | null>(null);
  const insights = useInsights("playbook");
  useEffect(() => { api<Data>("GET", "/api/ops/playbook").then(setD).catch(() => {}); }, []);
  const sources = d ? d.segments[0]?.bySource.map((s) => s.source) ?? [] : [];

  return (
    <OpsShell>
      <div className="space-y-6">
        <PageHeader title="Segment & channel playbook" sub="Which customers to go after first, with which bundle and through which channel. Computed from the supplied quarter of leads (synthetic); bundle prices come from the advisor's own rules engine. Evidence, not a forecast." />
        {!d ? <Skeleton className="h-96 rounded-2xl" /> : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <Panel title="Which segment pays back best" sub="Year-one revenue brought back per ₹1 of acquisition spend = average monthly bundle × 12 × (1 − 6-month churn) ÷ cost per activation. Revenue, not margin.">
                <HBars rows={d.segments.map((s) => ({ label: s.segment, value: s.firstYearPerRupee ?? 0, note: `${s.conversion}% convert · ${cac(s.cac)}` }))} fmt={(n) => `₹${n}`} />
              </Panel>
              <Panel title="GSTIN is the biggest lever" sub="Activation with and without a GSTIN.">
                <div className="grid grid-cols-2 gap-3">
                  {([["With GSTIN", d.gstin.with], ["Without GSTIN", d.gstin.without]] as const).map(([l, g]) => (
                    <div key={l} className="rounded-2xl bg-[oklch(0.975_0.012_20)] p-4"><div className="text-xs font-medium text-muted-foreground">{l}</div><div className="mt-1 text-3xl font-extrabold tabular-nums">{g.conversion}%</div><div className="mt-2"><Meter value={g.conversion} max={Math.max(d.gstin.with.conversion, d.gstin.without.conversion, 1)} tone={l === "With GSTIN" ? "green" : "red"} /></div><div className="mt-2 text-xs text-muted-foreground">{cac(g.cac)} per activation</div></div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">That is why the customer app shows a GSTIN help card whenever a missing GSTIN keeps products out of the plan, and why the advisor lists exactly what a GSTIN would unlock.</p>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {d.segments.map((s) => (
                <Panel key={s.segment} title={s.segment} action={<Pill>{s.shareOfLeads}% of leads</Pill>}>
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    {[["Converts", `${s.conversion}%`], ["Cost / activation", cac(s.cac)], ["6-mo churn", `${s.churn}%`]].map(([k, v]) => <div key={k} className="rounded-2xl bg-[oklch(0.975_0.012_20)] px-2 py-3"><div className="text-[11px] text-muted-foreground">{k}</div><div className="mt-0.5 text-lg font-extrabold tabular-nums">{v}</div></div>)}
                  </div>
                  {s.advisor && (
                    <div className="mt-3 rounded-2xl bg-accent p-3.5 text-sm"><div className="text-[11px] font-semibold text-primary">What the advisor offers a typical one</div>
                      <div className="mt-0.5 font-bold">{s.advisor.bundle} · {inr(s.advisor.monthly)}/mo + GST · {s.advisor.contractMonths}-month contract</div>
                      <div className="mt-0.5 text-xs text-foreground/70">{s.advisor.basis}. They actually bought a median {inr(s.medianBought)}/mo, usually on {s.typicalContract} months.</div></div>
                  )}
                  <div className="mt-3 space-y-1.5 text-sm">
                    {s.bestChannel ? <p><b>Cheapest well-sampled channel:</b> {s.bestChannel.source}, {inr(s.bestChannel.cac)} per activation ({s.bestChannel.conversion}% convert, {s.bestChannel.leads} leads).</p> : <p className="text-muted-foreground">Not enough leads in any one channel to compare.</p>}
                    {s.costlyChannels.length > 0 && <p className="text-foreground/80"><b>Costing more than double:</b> {s.costlyChannels.map((x) => `${x.source} (${inr(x.cac)}, ${x.activations} activations)`).join("; ")}.</p>}
                    <p className="text-xs text-muted-foreground">GSTIN held by {s.gstinShare}% of these leads · {s.avgDays} days to activate on average.</p>
                  </div>
                </Panel>
              ))}
            </div>

            <Panel title="Cost per activation: segment × channel" sub={`Greener is cheaper than the quarter's ${cac(d.total.cac)} average, redder is dearer. Grey cells have fewer than ${d.minCell} leads: too few to conclude anything.`}>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-separate border-spacing-1.5 text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="px-2 py-1 font-semibold">Segment</th>{sources.map((x) => <th key={x} className="px-2 py-1 font-semibold">{x}</th>)}</tr></thead>
                <tbody>{d.segments.map((s) => (
                  <tr key={s.segment}><td className="px-2 py-1 font-semibold">{s.segment}</td>
                    {s.bySource.map((x) => <td key={x.source} className="rounded-xl px-2 py-2" style={cellStyle(x.cac, d.total.cac ?? 0, x.lowSample)}><div className={`font-bold tabular-nums ${x.lowSample ? "text-muted-foreground/60" : ""}`}>{cac(x.cac)}</div><div className="text-[11px] text-muted-foreground">{x.conversion}% of {x.leads}</div></td>)}</tr>
                ))}</tbody></table></div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Cost per activation by channel" sub="Lower is better."><HBars rows={[...d.channels].filter((c) => c.cac !== null).sort((a, b) => (a.cac ?? 0) - (b.cac ?? 0)).map((c) => ({ label: c.source, value: c.cac ?? 0 }))} fmt={inr} /></Panel>
              <Panel title="Conversion by channel" sub="Share of leads that activated."><HBars rows={[...d.channels].sort((a, b) => b.conversion - a.conversion).map((c) => ({ label: c.source, value: c.conversion }))} fmt={(n) => `${n}%`} /></Panel>
              <Panel title="Where the spend goes" sub="Share of the quarter's acquisition spend."><HBars rows={[...d.channels].sort((a, b) => b.shareOfSpend - a.shareOfSpend).map((c) => ({ label: c.source, value: c.shareOfSpend }))} fmt={(n) => `${n}%`} /></Panel>
            </div>

            <section className="space-y-3">
              <div><h2 className="text-lg font-extrabold">Signals that change a decision</h2><p className="text-sm text-muted-foreground">Computed from the leads, the GST registry and the catalogue&apos;s own rules on every load, ranked by how strong the evidence is. A suggested action appears only when the numbers point to one.</p></div>
              <InsightList data={insights} cols={2} />
            </section>

            <More summary="Channels overall (full table)">
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{["Channel", "Conv.", "CAC", "Share of spend", "6-mo churn"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{d.channels.map((c) => <tr key={c.source} className="border-t"><td className="px-3 py-2 font-medium">{c.source}</td><td className="px-3">{c.conversion}%</td><td className="px-3">{cac(c.cac)}</td><td className="px-3">{c.shareOfSpend}%</td><td className="px-3">{c.churn}%</td></tr>)}</tbody></table></div>
            </More>
          </>
        )}
      </div>
    </OpsShell>
  );
}
