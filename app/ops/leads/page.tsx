"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NEXT_ACTION, OpsShell } from "@/components/ops/shell";
import { api } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

interface Row {
  id: string; origin: "live" | "historical"; business: string; segment: string; city: string; source: string; stage: string; monthly: number; hasGstin: boolean; nextAction: string;
  owner?: string; level?: string; reasons?: string[]; outcome?: string; dropReason?: string; score?: number; band?: string; priority?: number; drivers?: { text: string; direction: string }[]; winback?: boolean;
}
const TABS = [["live", "Live"], ["escalated", "Needs a person"], ["winback", "Win-back"], ["historical", "Historical"]] as const;
const SEGMENTS = ["Micro retail & services", "Professional offices", "Small multi-site businesses", "Small manufacturers"];
const SOURCES = ["Field sales", "Channel partner", "Website form", "Inbound call", "Referral", "WhatsApp campaign"];
const STAGES = ["Lead", "Contacted", "Needs assessed", "Quote accepted", "KYC complete", "Activated"];

const BAND = { high: "bg-success/10 text-success", medium: "bg-warning/15 text-warning", low: "bg-muted text-muted-foreground" } as const;
const sel = "h-8 rounded-lg border border-input bg-card px-2 text-sm";

function Inner() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("live");
  const [f, setF] = useState({ segment: "", source: "", stage: "", q: "" });
  const qs = new URLSearchParams({ tab, limit: "100", ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
  // results remember which query they answer, so switching tab/filter shows a skeleton until the new answer arrives
  const [loaded, setLoaded] = useState<{ qs: string; total: number; rows: Row[] } | null>(null);
  const data = loaded?.qs === qs ? loaded : null;
  useEffect(() => {
    const load = () => api<{ total: number; rows: Row[] }>("GET", `/api/ops/leads?${qs}`).then((r) => setLoaded({ qs, ...r })).catch(() => setLoaded({ qs, total: 0, rows: [] }));
    load();
    if (tab === "live" || tab === "escalated") { const h = setInterval(load, 5000); return () => clearInterval(h); }
  }, [tab, qs]);
  const hist = tab === "winback" || tab === "historical";
  return (
    <OpsShell>
      <div className="space-y-4">
        <div><h1 className="text-2xl font-bold">Leads</h1><p className="text-sm text-muted-foreground">Live enquiries from the advisor, and the supplied historical leads ranked by propensity × expected value.</p></div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}><TabsList>{TABS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList></Tabs>
        {hist && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" /><Input className="h-8 w-48 pl-7" placeholder="Search business / ID" aria-label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
            <select aria-label="Segment" className={sel} value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}><option value="">All segments</option>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select>
            <select aria-label="Source" className={sel} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">All sources</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
            <select aria-label="Stage" className={sel} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}><option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        )}
        {tab === "winback" && <Card className="bg-accent p-3 text-sm">These leads dropped for reasons a digital journey directly fixes (no time for a visit, slow or confusing quote, paperwork, install delay, payment failure). Ranked by propensity × expected value.</Card>}
        {!data ? <Skeleton className="h-64" /> : data.rows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{hist ? "No leads match these filters." : "No live leads yet. Run a journey in the customer app — escalations and multi-site enquiries land here."}</Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] text-muted-foreground">{["Business", "Segment", "City", "Source", "Stage", hist ? "Why it dropped" : "Why a person", hist ? "Score" : "₹ / month", "GST", hist ? "Priority" : "Owner", "Next action"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2"><Link href={`/ops/leads/${r.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{r.business}</Link><div className="font-mono text-[10px] text-muted-foreground">{r.id}</div></td>
                    <td className="px-3">{r.segment}</td><td className="px-3">{r.city}</td><td className="px-3">{r.source}</td>
                    <td className="px-3 capitalize">{r.stage}{r.outcome === "Activated" && <Badge className="ml-1 text-[10px]">won</Badge>}</td>
                    <td className="max-w-56 px-3 text-xs text-muted-foreground">{hist ? r.dropReason || "—" : r.reasons?.map((x) => x.toLowerCase().replace(/_/g, " ")).join(", ") || "—"}</td>
                    <td className="px-3">{hist ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BAND[(r.band as keyof typeof BAND) ?? "low"]}`}>{Math.round((r.score ?? 0) * 100)}</span> : r.monthly ? inr(r.monthly) : "—"}</td>
                    <td className="px-3">{r.hasGstin ? "Yes" : "No"}</td>
                    <td className="px-3">{hist ? (r.priority ? inr(r.priority) : "—") : r.owner}</td>
                    <td className="px-3 text-xs font-medium">{NEXT_ACTION[r.nextAction] ?? r.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t p-2.5 text-xs text-muted-foreground">Showing {data.rows.length} of {data.total.toLocaleString("en-IN")}{hist ? " · propensity score is a ranking aid (class-balanced model), not a calibrated probability" : ""}</div>
          </Card>
        )}
      </div>
    </OpsShell>
  );
}
export default function LeadsPage() { return <Suspense fallback={null}><Inner /></Suspense>; }
