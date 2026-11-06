"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsShell } from "@/components/ops/shell";
import { api } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

type Band = "high" | "medium" | "low";
interface Risk { probability: number; band: Band; drivers: { text: string; direction: "up" | "down" }[]; actions: string[] }
interface Data {
  options: Record<"segment" | "tier" | "source" | "language" | "month", string[]>;
  n: number;
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

const Tile = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <Card className="p-3.5"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold leading-none">{value}</div>{sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}</Card>
);
/** Single-series horizontal bars: one hue, thin, rounded data-end, value in text ink, hover tooltip via title. */
function Bars({ rows, fmt }: { rows: { label: string; value: number; note?: string }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_8.5rem] items-center gap-2 text-xs" title={`${r.label}: ${fmt(r.value)}${r.note ? ` · ${r.note}` : ""}`}>
          <span className="truncate text-muted-foreground">{r.label}</span>
          <span className="h-3 rounded-r bg-muted"><span className="block h-3 rounded-r bg-primary/80 transition-[width]" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums">{fmt(r.value)}{r.note ? <span className="ml-1 text-muted-foreground">{r.note}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}
const BAND_V = { high: "destructive", medium: "secondary", low: "outline" } as const;

export default function Analytics() {
  const [f, setF] = useState<Record<string, string>>({});
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    api<Data>("GET", `/api/ops/analytics${qs ? `?${qs}` : ""}`).then(setD).catch(() => {});
  }, [f]);
  const sel = "h-9 rounded-md border bg-card px-2 text-sm";
  const L: Record<string, string> = { segment: "All segments", tier: "All city tiers", source: "All sources", language: "All languages", month: "All months" };

  return (
    <OpsShell>
      <div className="space-y-5">
        <div><h1 className="text-xl font-bold">Business analytics</h1><p className="text-sm text-muted-foreground">Computed from the supplied quarter of leads (smb_leads.csv, Apr–Jun 2026, synthetic). Live prototype activity is on Overview, kept separate on purpose.</p></div>
        {/* filters: one row above the charts */}
        <div className="flex flex-wrap gap-2">
          {d && (Object.keys(L) as (keyof Data["options"])[]).map((k) => (
            <select key={k} className={sel} value={f[k] ?? ""} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} aria-label={L[k]}>
              <option value="">{L[k]}</option>{d.options[k].map((o) => <option key={o} value={o}>{k === "tier" ? `Tier ${o}` : o}</option>)}
            </select>
          ))}
          {Object.values(f).some(Boolean) && <button type="button" className="text-sm text-primary underline" onClick={() => setF({})}>Clear filters</button>}
        </div>
        {!d ? <Skeleton className="h-96" /> : d.n === 0 ? <Card className="p-6 text-sm text-muted-foreground">No leads match these filters.</Card> : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              <Tile label="Leads" value={d.totals.leads.toLocaleString("en-IN")} />
              <Tile label="Lead → activation" value={`${d.totals.conversion}%`} sub={`${d.totals.activations} activated`} />
              <Tile label="Days to activate" value={d.totals.avgDaysToActivate} sub="average, activated" />
              <Tile label="Status chases" value={d.totals.avgChases} sub="per activated customer" />
              <Tile label="CAC / activation" value={inr(d.totals.cac)} sub={d.totals.paybackMonths ? `revenue payback ≈ ${d.totals.paybackMonths} mo (not margin)` : undefined} />
              <Tile label="6-month churn" value={`${d.totals.churn6m}%`} sub={`${d.totals.retainedCustomers} retained`} />
              <Tile label="MRR activated" value={inr(d.totals.mrrActivated)} sub={`${inr(d.totals.mrrRetained)} still active at 6 mo`} />
              <Tile label="ARPA" value={inr(d.totals.arpa)} sub="avg monthly bundle" />
              <Tile label="Avg setup fee" value={inr(d.totals.avgSetup)} />
              <Tile label="NPS" value={d.nps.score ?? "—"} sub={`${d.nps.promoters} promoters · ${d.nps.passives} passives · ${d.nps.detractors} detractors`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-3 p-4"><div className="text-sm font-semibold">Funnel</div>
                <Bars rows={d.funnel.map((s) => ({ label: s.stage, value: s.leads, note: s.fromPrevious !== null ? `${s.fromPrevious}%` : undefined }))} fmt={(n) => n.toLocaleString("en-IN")} />
                <p className="text-[11px] text-muted-foreground">% = conversion from the previous stage.</p>
              </Card>
              <Card className="space-y-3 p-4"><div className="text-sm font-semibold">Monthly revenue by product (activated)</div>
                <Bars rows={d.revenueByProduct.slice(0, 10).map((p) => ({ label: `${p.id} ${p.name}`, value: p.revenue, note: `${p.customers} cust.` }))} fmt={inr} />
                <p className="text-[11px] text-muted-foreground">Each bundle&apos;s value is split across its products by catalogue list-price weight.</p>
              </Card>
              <Card className="space-y-3 p-4"><div className="text-sm font-semibold">Why leads dropped</div>
                <Bars rows={d.dropReasons.map((r) => ({ label: r.reason, value: r.n }))} fmt={(n) => n.toLocaleString("en-IN")} />
              </Card>
              <Card className="overflow-x-auto p-0"><div className="border-b p-3 text-sm font-semibold">Churn by bundle (≥ 5 customers)</div>
                <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Bundle", "Customers", "Avg ₹/mo", "6-mo churn"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody>{d.churnByBundle.map((b) => <tr key={b.bundle} className="border-t"><td className="px-3 py-1.5 font-mono text-xs">{b.bundle}</td><td className="px-3">{b.customers}</td><td className="px-3">{inr(b.avgMonthly)}</td><td className="px-3">{b.churn}%</td></tr>)}</tbody></table>
              </Card>
            </div>

            <Card className="overflow-x-auto p-0">
              <div className="border-b p-3"><div className="text-sm font-semibold">Pilot targets (proposed, not results)</div><div className="text-xs text-muted-foreground">Baselines are from the full file, not the filter.</div></div>
              <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Metric", "Baseline", "Pilot target", "What has to change"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>{d.targets.map((t) => <tr key={t.metric} className="border-t"><td className="px-3 py-1.5 font-medium">{t.metric}</td><td className="px-3">{t.baseline}</td><td className="px-3 font-semibold">{t.target}</td><td className="px-3 text-xs text-muted-foreground">{t.lever}</td></tr>)}</tbody></table>
            </Card>

            <Card className="space-y-3 p-4">
              <div>
                <div className="text-sm font-semibold">Retention risk at activation</div>
                <p className="text-xs text-muted-foreground">Logistic model on {d.churnModel.n} activated customers ({d.churnModel.churners} churned). 5-fold cross-validated AUC <b>{d.churnModel.aucCv5}</b>, top-quartile lift {d.churnModel.liftTopQuartile}×. A modest ranking signal for who to call first — correlation, not cause. Features known at activation only (no NPS).</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {d.retention.bands.map((b) => <div key={b.band} className="rounded-lg border p-2.5"><Badge variant={BAND_V[b.band]} className="capitalize">{b.band} risk</Badge><div className="mt-1">{b.customers} customers</div><div className="text-xs text-muted-foreground">actual churn {b.actualChurn}%</div></div>)}
              </div>
              {d.liveAtRisk.length > 0 && (
                <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live activated customers</div>
                  <ul className="space-y-1.5 text-sm">{d.liveAtRisk.map((c) => <li key={c.id} className="rounded-lg border p-2.5"><div className="flex items-center justify-between gap-2"><span><b>{c.business}</b> · {c.id} · {inr(c.monthly)}/mo</span><Badge variant={BAND_V[c.risk.band]} className="capitalize">{c.risk.band}</Badge></div>
                    <div className="text-xs text-muted-foreground">{c.risk.drivers.map((x) => `${x.direction === "up" ? "↑" : "↓"} ${x.text}`).join(" · ")}</div>{c.risk.actions.map((a) => <div key={a} className="text-xs">→ {a}</div>)}</li>)}</ul></div>
              )}
              <div className="overflow-x-auto"><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highest-risk historical customers (actual outcome shown for transparency)</div>
                <table className="w-full min-w-[720px] text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Customer", "Segment / source", "₹/mo", "Risk", "Drivers", "Suggested action", "Actually churned"].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                  <tbody>{d.retention.top.map((c) => <tr key={c.id} className="border-t align-top"><td className="px-2 py-1.5">{c.business}<div className="font-mono text-[10px] text-muted-foreground">{c.id}</div></td><td className="px-2 text-xs">{c.segment}<div className="text-muted-foreground">{c.source}</div></td><td className="px-2">{inr(c.monthly)}</td><td className="px-2"><Badge variant={BAND_V[c.risk.band]}>{Math.round(c.risk.probability * 100)}</Badge></td><td className="px-2 text-xs">{c.risk.drivers.map((x) => `${x.direction === "up" ? "↑" : "↓"} ${x.text}`).join(" · ")}</td><td className="px-2 text-xs">{c.risk.actions[0] ?? "—"}</td><td className="px-2">{c.churned ? "Yes" : "No"}</td></tr>)}</tbody></table>
              </div>
            </Card>
          </>
        )}
      </div>
    </OpsShell>
  );
}
