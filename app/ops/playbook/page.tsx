"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function Playbook() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { api<Data>("GET", "/api/ops/playbook").then(setD).catch(() => {}); }, []);
  const sources = d ? d.segments[0]?.bySource.map((s) => s.source) ?? [] : [];

  return (
    <OpsShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Segment &amp; channel playbook</h1>
          <p className="text-sm text-muted-foreground">Which customers to go after first, with which bundle, through which channel. Computed from the supplied quarter of leads (smb_leads.csv, synthetic); bundle prices come from the advisor&apos;s own rules engine. Evidence, not a forecast.</p>
        </div>
        {!d ? <Skeleton className="h-96" /> : (
          <>
            {d.waste && (
              <Card className="border-warning/50 bg-warning/10 p-4 text-sm">
                <div className="font-semibold">Biggest leak in the file</div>
                <p className="mt-1"><b>{d.waste.source}</b> on <b>{d.waste.segment}</b>: {d.waste.leads.toLocaleString("en-IN")} leads, {d.waste.activations} activations ({d.waste.conversion}%), {cac(d.waste.cac)} per activation and {inr(d.waste.spend)} spent in the quarter. The quarter&apos;s average across everything is {cac(d.total.cac)}.</p>
              </Card>
            )}

            <Card className="overflow-x-auto p-0">
              <div className="border-b p-3"><div className="text-sm font-semibold">Segments, ranked by what ₹1 of acquisition spend brings back in year one</div>
                <div className="text-xs text-muted-foreground">= average monthly bundle × 12 × (1 − observed 6-month churn) ÷ cost per activation. Revenue, not margin.</div></div>
              <table className="w-full min-w-[820px] text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["#", "Segment", "Leads", "Lead → activation", "CAC", "Avg ₹/mo", "6-mo churn", "Year-1 ₹ per ₹1", "Share of base"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>{d.segments.map((s, i) => (
                  <tr key={s.segment} className="border-t"><td className="px-3 py-1.5 font-semibold">{i + 1}</td><td className="px-3 font-medium">{s.segment}</td><td className="px-3">{s.leads.toLocaleString("en-IN")}</td><td className="px-3">{s.conversion}%</td><td className="px-3">{cac(s.cac)}</td><td className="px-3">{inr(s.arpa)}</td><td className="px-3">{s.churn}%</td><td className="px-3 font-semibold">{s.firstYearPerRupee ?? "—"}</td><td className="px-3">{s.shareOfLeads}%</td></tr>
                ))}</tbody></table>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {d.segments.map((s) => (
                <Card key={s.segment} className="space-y-2.5 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{s.segment}</h2><Badge variant="secondary">{s.shareOfLeads}% of leads</Badge></div>
                  {s.advisor && (
                    <div className="rounded-lg bg-accent p-2.5"><div className="text-[11px] uppercase tracking-wide text-muted-foreground">What the advisor offers a typical one</div>
                      <div><b>{s.advisor.bundle}</b> · {inr(s.advisor.monthly)}/mo + GST · {s.advisor.contractMonths}-month contract</div>
                      <div className="text-xs text-muted-foreground">{s.advisor.basis}. Customers in this segment actually bought a median {inr(s.medianBought)}/mo, usually on {s.typicalContract} months.</div></div>
                  )}
                  {s.bestChannel
                    ? <p><b>Cheapest well-sampled channel:</b> {s.bestChannel.source} — {inr(s.bestChannel.cac)} per activation, {s.bestChannel.conversion}% conversion ({s.bestChannel.leads} leads).</p>
                    : <p className="text-muted-foreground">Not enough leads in any one channel to compare.</p>}
                  {s.costlyChannels.length > 0 && (
                    <p><b>Costing more than double that:</b> {s.costlyChannels.map((x) => `${x.source} (${inr(x.cac)}, ${x.activations} activations, ${inr(x.spend)} spent)`).join("; ")}.</p>
                  )}
                  <p className="text-xs text-muted-foreground">GSTIN held by {s.gstinShare}% of these leads · average {s.avgDays} days to activate.</p>
                </Card>
              ))}
            </div>

            <Card className="overflow-x-auto p-0">
              <div className="border-b p-3"><div className="text-sm font-semibold">Cost per activation, segment × channel</div>
                <div className="text-xs text-muted-foreground">Cells with fewer than {d.minCell} leads are greyed: too few to conclude anything.</div></div>
              <table className="w-full min-w-[760px] text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="px-3 py-2 font-medium">Segment</th>{sources.map((s) => <th key={s} className="px-3 py-2 font-medium">{s}</th>)}</tr></thead>
                <tbody>{d.segments.map((s) => (
                  <tr key={s.segment} className="border-t"><td className="px-3 py-1.5 font-medium">{s.segment}</td>
                    {s.bySource.map((x) => <td key={x.source} className={`px-3 ${x.lowSample ? "text-muted-foreground/60" : ""}`}>{cac(x.cac)}<div className="text-[11px] text-muted-foreground">{x.conversion}% of {x.leads}</div></td>)}</tr>
                ))}</tbody></table>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="overflow-x-auto p-0">
                <div className="border-b p-3 text-sm font-semibold">Channels overall</div>
                <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["Channel", "Conv.", "CAC", "Share of spend", "6-mo churn"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody>{d.channels.map((c) => <tr key={c.source} className="border-t"><td className="px-3 py-1.5 font-medium">{c.source}</td><td className="px-3">{c.conversion}%</td><td className="px-3">{cac(c.cac)}</td><td className="px-3">{c.shareOfSpend}%</td><td className="px-3">{c.churn}%</td></tr>)}</tbody></table>
              </Card>
              <Card className="space-y-2 p-4 text-sm">
                <div className="font-semibold">GSTIN is the single biggest lever</div>
                <p>With a GSTIN: <b>{d.gstin.with.conversion}%</b> activate, {cac(d.gstin.with.cac)} per activation. Without: <b>{d.gstin.without.conversion}%</b>, {cac(d.gstin.without.cac)}.</p>
                <p className="text-xs text-muted-foreground">Why the customer app shows a GSTIN help card whenever a missing GSTIN is what keeps products out of the plan, and why the advisor lists exactly what a GSTIN would unlock.</p>
              </Card>
            </div>

            <div>
              <h2 className="text-base font-semibold">Signals that change a decision</h2>
              <p className="text-xs text-muted-foreground">Each one computed from the files on every load — leads, GST registry and the catalogue&apos;s own rules.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="space-y-2 p-4 text-sm">
                <div className="font-semibold">Partners are paid on activation, not on retention</div>
                <p>A partner lead that activates costs a median <b>{inr(d.signals.partnerPay.medianCostActivated)}</b>; one that drops costs {inr(d.signals.partnerPay.medianCostDropped)}. The payout is about <b>{d.signals.partnerPay.monthsOfRevenuePaid}× the monthly bundle</b> (field sales: {d.signals.partnerPay.fieldMonthsOfRevenue}×), up to {inr(d.signals.partnerPay.maxPayout)} for one deal — and partner customers churn <b>{d.signals.partnerPay.partnerChurn}%</b> in six months vs {d.signals.partnerPay.restChurn}% for everyone else.</p>
                <p className="text-xs text-muted-foreground">Proposal: pay half at activation and half after month 6 (claw back on early churn); partners earn the same on good deals and stop being paid for churn. Co-pilot credit in this app already records which partner actually helped.</p>
              </Card>
              <Card className="space-y-2 p-4 text-sm">
                <div className="font-semibold">Cheap channels leak before anyone speaks to the owner</div>
                <ul className="space-y-0.5">{d.signals.leadQuality.slice(0, 3).map((q) => <li key={q.source}><b>{q.source}</b>: {q.lostBeforeContact}% of leads lost as unreachable or a wrong number · {q.conversion}% convert</li>)}</ul>
                <p className="text-xs text-muted-foreground">The WhatsApp campaign isn&apos;t a bad channel, it captures bad numbers. Here the owner starts the chat (so the number is real by construction) or verifies it by SMS before a quote is saved — the drop happens in a self-serve flow, not in a sales queue.</p>
              </Card>
              <Card className="space-y-2 p-4 text-sm">
                <div className="font-semibold">Mis-selling the rules engine prevents</div>
                <p>Of {d.signals.compliance.activations} activations, <b>{d.signals.compliance.nonActiveGstin}</b> went live on a GSTIN the registry marks Cancelled or Suspended, and <b>{d.signals.compliance.ruleBreakingBundles}</b> bundles break the catalogue&apos;s own rules (tier, size, GSTIN or a missing required product).</p>
                <p className="text-xs text-muted-foreground">They churned {d.signals.compliance.churnRuleBreaking}% vs {d.signals.compliance.churnClean}% for clean bundles, so this is a compliance and audit exposure, not a churn driver — and why past bundles are not treated as ground truth for the advisor. The engine and KYC registry check block both.</p>
              </Card>
              <Card className="space-y-2 p-4 text-sm">
                <div className="font-semibold">Read the churn numbers with care</div>
                <p>With &quot;today&quot; fixed at 15 July 2026, a six-month churn flag can&apos;t yet be observed for any of the {d.signals.labels.churnNotYetObservable} activations in this quarter, and {d.signals.labels.afterToday} are dated after today.</p>
                <p className="text-xs text-muted-foreground">We use churn as the file states it, but the churn model is labelled illustrative and every churn target is a proposal to re-baseline on real 6-month data. Regional languages: {d.signals.language.weakest.map((l) => `${l.language} ${l.conversion}%`).join(", ")} vs {d.signals.language.hindiEnglish}% for Hindi/English — the next languages for the advisor after Marathi and Tamil.</p>
              </Card>
            </div>
          </>
        )}
      </div>
    </OpsShell>
  );
}
