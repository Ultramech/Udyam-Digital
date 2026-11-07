"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { OpsShell } from "@/components/ops/shell";
import { Kpi, Panel } from "@/components/ops/kit";
import { ColumnChart, DonutLegend } from "@/components/ops/charts";
import { AlertCircle, CheckCircle2, Inbox, UserX } from "lucide-react";
import { api } from "@/lib/client/api";
import { fmtTime, inr } from "@/lib/client/format";
import type { PublicTicket } from "@/lib/support/tickets";
import { cn } from "@/lib/utils";

export default function SupportQueue() {
  const [tickets, setTickets] = useState<PublicTicket[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const load = useCallback(() => { api<{ tickets: PublicTicket[] }>("GET", "/api/ops/support").then((r) => setTickets(r.tickets)).catch(() => setTickets([])); }, []);
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const shown = (tickets ?? []).filter((t) => showResolved || t.status !== "resolved");
  const cur = tickets?.find((t) => t.id === sel) ?? shown[0];

  async function patch(body: Record<string, unknown>, msg: string) {
    if (!cur) return;
    try { await api("PATCH", `/api/ops/support/${cur.id}`, body); toast.success(msg); setReply(""); load(); } catch { toast.error("Could not update"); }
  }

  return (
    <OpsShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">Support requests</h1><p className="mt-1 max-w-3xl text-[0.9375rem] text-muted-foreground">Raised from the customer Help page. Each one carries the order context and what the owner already asked — don&apos;t make them repeat it.</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />Show resolved</label>
        </div>
        {tickets && tickets.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={Inbox} label="Open requests" value={tickets.filter((t) => t.status !== "resolved").length} />
              <Kpi icon={AlertCircle} label="High priority" value={tickets.filter((t) => t.status !== "resolved" && t.priority === "high").length} />
              <Kpi icon={UserX} label="Unassigned" value={tickets.filter((t) => t.status !== "resolved" && !t.assignedTo).length} />
              <Kpi icon={CheckCircle2} label="Resolved" value={tickets.filter((t) => t.status === "resolved").length} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="What owners ask about" sub="Requests by category."><DonutLegend centre={String(tickets.length)} sub="requests" parts={Object.entries(tickets.reduce<Record<string, number>>((m, t) => ({ ...m, [t.category]: (m[t.category] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value }))} /></Panel>
              <Panel title="How long open requests have waited" sub="Time since the owner raised them.">
                <ColumnChart height={170} data={[["< 1 h", 0, 1], ["1–4 h", 1, 4], ["4–24 h", 4, 24], ["1–3 d", 24, 72], ["> 3 d", 72, 1e9]].map(([label, lo, hi]) => ({ label: label as string, value: tickets.filter((t) => t.status !== "resolved" && (Date.now() - t.createdAt) / 3.6e6 >= (lo as number) && (Date.now() - t.createdAt) / 3.6e6 < (hi as number)).length }))} />
              </Panel>
            </div>
          </div>
        )}
        {tickets && shown.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No open requests. </Card>}
        {shown.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <ul className="space-y-2">
              {shown.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setSel(t.id)} className={cn("w-full rounded-lg border bg-card p-3 text-left text-sm", cur?.id === t.id && "border-primary")}>
                    <div className="flex items-center justify-between gap-2"><b>{t.id}</b><span className="flex gap-1">{t.priority === "high" && <Badge variant="destructive">high</Badge>}<Badge variant="secondary">{t.status.replace("_", " ")}</Badge></span></div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.category} · {t.context.businessName ?? "no order"} · {fmtTime(t.createdAt)}</div>
                    <div className="mt-1 line-clamp-2 text-xs">{t.messages.filter((m) => m.by === "customer").at(-1)?.text}</div>
                  </button>
                </li>
              ))}
            </ul>
            {cur && (
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{cur.id} · {cur.category}{cur.assignedTo ? ` · owner ${cur.assignedTo}` : " · unassigned"}</div>
                  <div className="flex gap-1.5">
                    {!cur.assignedTo && <Button size="sm" variant="outline" onClick={() => patch({ assignToMe: true }, "Assigned to you")}>Assign to me</Button>}
                    {cur.status !== "resolved" ? <Button size="sm" variant="outline" onClick={() => patch({ status: "resolved" }, "Resolved")}>Mark resolved</Button> : <Button size="sm" variant="outline" onClick={() => patch({ status: "open" }, "Reopened")}>Reopen</Button>}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-sm">
                  <div className="mb-1 text-[11px] font-semibold text-muted-foreground">Handoff context</div>
                  <ul className="list-disc space-y-0.5 pl-4">{cur.context.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  {cur.orderId && <div className="mt-2 flex flex-wrap gap-3 text-xs"><span>Monthly {cur.context.monthly ? inr(cur.context.monthly) : "—"}</span><span>Go-live {cur.context.goLive ?? "—"}</span><Link className="text-primary underline" href="/ops/orders">Open orders board →</Link></div>}
                </div>
                <ul className="space-y-2 text-sm">
                  {cur.messages.map((m, i) => (
                    <li key={i} className={cn("rounded-lg px-3 py-2", m.by === "staff" ? "ml-8 bg-accent" : m.by === "assistant" ? "bg-muted/50 text-muted-foreground" : "mr-8 bg-muted")}>
                      <div className="text-[10px] text-muted-foreground">{m.by === "staff" ? m.name : m.by} · {fmtTime(m.at)}</div>{m.text}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the owner (also posted on their order timeline)…" />
                  <Button disabled={reply.trim().length < 2} onClick={() => patch({ reply }, "Reply sent")}>Send reply</Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </OpsShell>
  );
}
