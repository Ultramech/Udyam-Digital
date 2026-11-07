"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsShell } from "@/components/ops/shell";
import { Kpi, Panel } from "@/components/ops/kit";
import { ColumnChart, HBars, StackBar } from "@/components/ops/charts";
import { Activity, ShieldCheck, Users } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";
import type { AuditEntry } from "@/lib/store/types";

type Row = AuditEntry & { actorName: string };

export default function AuditLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [actors, setActors] = useState<{ id: string; name: string; role: string }[]>([]);
  const [actor, setActor] = useState("");
  const [entity, setEntity] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const qs = new URLSearchParams({ ...(actor ? { actor } : {}), ...(entity ? { entity } : {}) }).toString();
    api<{ rows: Row[]; actors: typeof actors }>("GET", `/api/ops/audit${qs ? `?${qs}` : ""}`).then((r) => { setRows(r.rows); setActors(r.actors); })
      .catch((e) => { setErr(e instanceof ApiError && e.status === 403 ? "The audit log is visible to admins only." : "Could not load the audit log."); setRows([]); });
  }, [actor, entity]);
  const entities = [...new Set((rows ?? []).map((r) => r.entity))];
  const sel = "h-9 rounded-md border bg-card px-2 text-sm";
  return (
    <OpsShell>
      <div className="space-y-4">
        <div><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">Audit log</h1><p className="mt-1 max-w-3xl text-[0.9375rem] text-muted-foreground">Append-only record of staff actions: KYC decisions, lead and order changes, catalogue edits, support replies, cancellations. It stores ids only — never raw identifiers.</p></div>
        {err && <Card className="p-4 text-sm">{err}</Card>}
        {rows && rows.length > 0 && (() => {
          const day = (t: number) => new Date(t).toISOString().slice(0, 10);
          const last = Math.max(...rows.map((r) => r.at));
          const days = Array.from({ length: 14 }, (_, i) => day(last - (13 - i) * 86_400_000));
          const by = (k: (r: Row) => string) => Object.entries(rows.reduce<Record<string, number>>((m, r) => ({ ...m, [k(r)]: (m[k(r)] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Kpi icon={Activity} label="Actions in view" value={rows.length} />
                <Kpi icon={Users} label="People acting" value={new Set(rows.map((r) => r.actorName)).size} />
                <Kpi icon={ShieldCheck} label="Kinds of action" value={new Set(rows.map((r) => r.action)).size} />
                <Kpi icon={Activity} label="Latest" value={<span className="text-base">{fmtTime(last)}</span>} />
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <Panel title="Activity per day" sub="The 14 days up to the latest action."><ColumnChart height={190} data={days.map((d) => ({ label: d.slice(8) + "/" + d.slice(5, 7), value: rows.filter((r) => day(r.at) === d).length }))} /></Panel>
                <Panel title="What staff did"><HBars rows={by((r) => r.action).slice(0, 6).map(([label, value]) => ({ label, value }))} /><div className="mt-5"><div className="mb-2 text-xs font-semibold text-muted-foreground">Who</div><StackBar parts={by((r) => r.actorName).slice(0, 5).map(([label, value]) => ({ label, value }))} /></div></Panel>
              </div>
            </div>
          );
        })()}
        <div className="flex flex-wrap gap-2">
          <select className={sel} value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Actor"><option value="">Everyone</option>{actors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}</select>
          <select className={sel} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Entity"><option value="">All records</option>{entities.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        </div>
        {!rows ? <Skeleton className="h-64" /> : rows.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">No staff actions recorded yet.</Card> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm"><thead><tr className="text-left text-[11px] text-muted-foreground">{["When", "Who", "Role", "Action", "Record"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id} className="border-t"><td className="px-3 py-1.5 text-xs">{fmtTime(r.at)}</td><td className="px-3">{r.actorName}</td><td className="px-3 capitalize">{r.role}</td><td className="px-3 font-mono text-xs">{r.action}</td><td className="px-3 font-mono text-xs">{r.entity} {r.entityId}</td></tr>)}</tbody></table>
          </Card>
        )}
      </div>
    </OpsShell>
  );
}
