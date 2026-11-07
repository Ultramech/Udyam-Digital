"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { OpsShell } from "@/components/ops/shell";
import { Kpi, Panel } from "@/components/ops/kit";
import { BandRange, ColumnChart, DonutLegend } from "@/components/ops/charts";
import { Boxes, Clock, PauseCircle, SlidersHorizontal } from "lucide-react";
import { plainName } from "@/lib/catalogue/plain";
import { api, ApiError } from "@/lib/client/api";
import { fmtTime, inr } from "@/lib/client/format";
import type { CatalogueChange, Override } from "@/lib/catalogue/overrides";
import type { Product } from "@/lib/catalogue/types";

type Row = Product & { original: { priceMin: number; setup: number; installDays: number }; override: Override | null };
interface Draft { priceMin: string; setup: string; installDays: string; paused: boolean; note: string }

const FIELD: Record<CatalogueChange["field"], string> = { paused: "Paused", priceMin: "Indicative price", setup: "Setup fee", installDays: "Install days" };

export default function CatalogueAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [history, setHistory] = useState<CatalogueChange[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ products: Row[]; history: CatalogueChange[] }>("GET", "/api/ops/catalogue")
      .then((r) => { setRows(r.products); setHistory(r.history); setDrafts({}); })
      .catch((e) => setErr(e instanceof ApiError && e.status === 403 ? "Catalogue admin is for ops and admin roles." : "Could not load the catalogue."));
  }, []);
  useEffect(load, [load]);

  const draft = (p: Row): Draft => drafts[p.id] ?? { priceMin: String(p.priceMin), setup: String(p.setup), installDays: String(p.installDays), paused: !!p.paused, note: "" };
  const setD = (p: Row, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [p.id]: { ...draft(p), ...patch } }));
  const shown = useMemo(() => (rows ?? []).filter((p) => !filter || `${p.id} ${p.csvName} ${p.category}`.toLowerCase().includes(filter.toLowerCase())), [rows, filter]);

  async function save(p: Row, reset = false) {
    const d = draft(p);
    if (!reset && d.note.trim().length < 3) { toast.warning("Add a short reason — it goes into the change history."); return; }
    try {
      const r = await api<{ changed: number }>("PUT", "/api/ops/catalogue", reset
        ? { productId: p.id, reset: true, note: d.note.trim().length >= 3 ? d.note : "Reset to published catalogue" }
        : { productId: p.id, paused: d.paused, priceMin: Number(d.priceMin), setup: Number(d.setup), installDays: Number(d.installDays), note: d.note });
      toast.success(r.changed ? `${p.id}: ${r.changed} change(s) saved — live for new quotes now` : "Nothing changed");
      load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "ERROR";
      toast.error(code === "PRICE_OUTSIDE_PUBLISHED_BAND" ? `Price must stay within the published band ${inr(p.original.priceMin)}–${inr(p.priceMax)}` : code);
    }
  }

  return (
    <OpsShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">Catalogue</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">Pause a product or move its indicative price inside the published band. Changes apply to every new quote and advisor answer within seconds; placed orders keep the price they were sold at.
            Eligibility rules and dependencies are locked to <code>product_catalogue.csv</code> — they are the contract the rules engine is tested against, so changing them is a code + test change.</p>
        </div>
        {err && <Card className="p-4 text-sm">{err}</Card>}
        {rows && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={Boxes} label="Products" value={rows.length} />
              <Kpi icon={PauseCircle} label="Paused" value={rows.filter((r) => r.paused).length} sub="not offered to new quotes" />
              <Kpi icon={SlidersHorizontal} label="Price adjusted" value={rows.filter((r) => r.priceMin !== r.original.priceMin).length} sub="inside the published band" />
              <Kpi icon={Clock} label="Average install" value={`${(rows.reduce((t, r) => t + r.installDays, 0) / Math.max(1, rows.length)).toFixed(1)} days`} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <Panel title="By category"><DonutLegend centre={String(rows.length)} sub="products" parts={Object.entries(rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.category]: (m[r.category] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value }))} /></Panel>
              <Panel title="Install time" sub="Days from order to live, by product."><ColumnChart height={190} data={rows.map((r) => ({ label: r.id, value: r.installDays }))} format={(n) => `${n}d`} /></Panel>
            </div>
            <Panel title="Where each price sits in its published band" sub="The marker is today's indicative price; the faint tick is the published original.">
              <div className="grid max-h-[26rem] gap-x-8 gap-y-4 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((r) => <div key={r.id}><div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-semibold">{r.id} · {r.csvName}</span>{r.paused && <span className="rounded-full bg-warning/15 px-2 text-[10px] font-bold text-warning">paused</span>}</div><BandRange min={r.original.priceMin} max={r.priceMax} value={r.priceMin} original={r.original.priceMin} /></div>)}
              </div>
            </Panel>
          </div>
        )}
        <Input placeholder="Filter by id, name or category" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
        {rows && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[960px] text-sm">
              <thead><tr className="text-left text-[11px] text-muted-foreground">{["Product", "Rules (locked)", "Published band", "Indicative ₹/mo", "Setup ₹", "Install days", "Paused", "Reason", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((p) => {
                  const d = draft(p);
                  const edited = !!p.override;
                  return (
                    <tr key={p.id} className="border-t align-top">
                      <td className="px-3 py-2"><div className="font-medium">{p.id} · {p.csvName}</div><div className="text-xs text-muted-foreground">{plainName(p.id)} · {p.category}</div>{edited && <Badge variant="secondary" className="mt-1">edited</Badge>}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">Tier {p.tiers.join("/")} · ≥{p.minEmployees} staff · ≥{p.minSites} site{p.minSites > 1 ? "s" : ""}{p.requiresGstin ? " · GSTIN" : ""}{p.requiresOneOf.length ? ` · needs ${p.requiresOneOf.join("/")}` : ""}</td>
                      <td className="px-3 py-2 text-xs">{inr(p.original.priceMin)}–{inr(p.priceMax)}<div className="text-muted-foreground">setup {inr(p.original.setup)} · {p.original.installDays}d</div></td>
                      <td className="px-3 py-2"><Input className="h-8 w-24" inputMode="numeric" value={d.priceMin} onChange={(e) => setD(p, { priceMin: e.target.value.replace(/\D/g, "") })} aria-label={`${p.id} indicative price`} /></td>
                      <td className="px-3 py-2"><Input className="h-8 w-24" inputMode="numeric" value={d.setup} onChange={(e) => setD(p, { setup: e.target.value.replace(/\D/g, "") })} aria-label={`${p.id} setup fee`} /></td>
                      <td className="px-3 py-2"><Input className="h-8 w-16" inputMode="numeric" value={d.installDays} onChange={(e) => setD(p, { installDays: e.target.value.replace(/\D/g, "") })} aria-label={`${p.id} install days`} /></td>
                      <td className="px-3 py-2"><Switch checked={d.paused} onCheckedChange={(c) => setD(p, { paused: !!c })} aria-label={`${p.id} paused`} /></td>
                      <td className="px-3 py-2"><Input className="h-8 w-44" placeholder="Why?" value={d.note} onChange={(e) => setD(p, { note: e.target.value })} aria-label={`${p.id} reason`} /></td>
                      <td className="space-x-1 whitespace-nowrap px-3 py-2"><Button size="sm" disabled={!drafts[p.id]} onClick={() => save(p)}>Save</Button>{edited && <Button size="sm" variant="ghost" onClick={() => save(p, true)}>Reset</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
        <Card className="overflow-x-auto p-0">
          <div className="border-b p-3 text-sm font-semibold">Change history</div>
          {history.length === 0 ? <div className="p-3 text-sm text-muted-foreground">No changes yet — the catalogue matches the published CSV.</div> : (
            <table className="w-full text-sm"><thead><tr className="text-left text-[11px] text-muted-foreground">{["When", "Who", "Product", "Field", "From → to", "Reason"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{history.map((h) => <tr key={h.id} className="border-t"><td className="px-3 py-1.5 text-xs">{fmtTime(h.at)}</td><td className="px-3">{h.by}</td><td className="px-3">{h.productId}</td><td className="px-3">{FIELD[h.field]}</td><td className="px-3">{String(h.from)} → <b>{String(h.to)}</b></td><td className="px-3 text-xs text-muted-foreground">{h.note}</td></tr>)}</tbody></table>
          )}
        </Card>
      </div>
    </OpsShell>
  );
}
