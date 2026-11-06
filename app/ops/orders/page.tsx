"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsShell } from "@/components/ops/shell";
import { api, ApiError } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";
import { bundleName } from "@/lib/i18n/bundles";
import { STAGES } from "@/lib/store/types";
import type { BundleId } from "@/lib/rules/types";

interface Row { id: string; business: string; bundleId: BundleId; stage: string | null; payment: string; kycStatus: string; goLive: string; monthly: number; sites: number; delayed: { reason: string; newEta: string } | null; actionNeeded: { code: string } | null; chases: number; engineer: string | null; balanceDue: number | null; enRoute: boolean; token: string }
const COLS = [{ key: "AWAITING", label: "Payment pending" }, ...STAGES.map((s) => ({ key: s, label: s.replace(/_/g, " ").toLowerCase() }))];
const BLOCK: Record<string, string> = { KYC_REVIEW_PENDING: "KYC is in review — approve it first (or force).", KYC_ACTION_NEEDED: "Customer must fix a document first.", PAYMENT_PENDING: "Payment hasn't succeeded.", ALREADY_ACTIVE: "Already active.", BALANCE_PENDING: "Customer still owes the balance — activation is held until it is paid (or force).", NO_VISIT_TO_START: "No installation visit is booked yet.", ALREADY_EN_ROUTE: "Already marked on the way." };

export default function Orders() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => api<{ rows: Row[] }>("GET", "/api/ops/orders").then((r) => setRows(r.rows)).catch(() => setRows([])), []);
  useEffect(() => { load(); const h = setInterval(load, 4000); return () => clearInterval(h); }, [load]);

  async function act(id: string, body: Record<string, unknown>) {
    try {
      const r = await api<{ blocked: string | null }>("POST", `/api/ops/orders/${id}`, body);
      if (r.blocked) toast.warning(BLOCK[r.blocked] ?? r.blocked); else toast.success("Updated — the customer's tracker reflects it now.");
      load();
    } catch (e) { toast.error(e instanceof ApiError && e.status === 403 ? "Only ops/admin can change orders." : "Couldn't update the order."); }
  }
  return (
    <OpsShell>
      <div className="space-y-4">
        <div><h1 className="text-2xl font-bold">Orders</h1><p className="text-sm text-muted-foreground">Advance an order and the customer&apos;s tracker, timeline and WhatsApp-style updates change with it. Delays post a proactive message.</p></div>
        {!rows ? <Skeleton className="h-64" /> : rows.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No orders yet. Complete a customer journey to place one.</Card> : (
          <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label="Orders by stage">
            {COLS.map((c) => {
              const items = rows.filter((r) => (c.key === "AWAITING" ? !r.stage : r.stage === c.key));
              return (
                <div key={c.key} role="listitem" className="w-56 shrink-0 space-y-2 rounded-xl bg-muted/50 p-2"><div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>{c.label}</span><span className="rounded-full bg-card px-1.5">{items.length}</span></div>
                  {items.map((r) => (
                    <Card key={r.id} className="space-y-1.5 p-2.5 text-xs">
                      <div className="font-semibold">{r.business}</div><div className="font-mono text-[10px] text-muted-foreground">{r.id}</div>
                      <div>{bundleName(r.bundleId, "en")} · {inr(r.monthly)}/mo{r.sites > 1 ? ` · ${r.sites} sites` : ""}</div>
                      <div className="flex flex-wrap gap-1"><Badge variant={["verified", "approved"].includes(r.kycStatus) ? "secondary" : "default"} className="text-[10px]">KYC {r.kycStatus}</Badge><Badge variant="outline" className="text-[10px]">pay {r.payment}</Badge>{r.chases > 0 && <Badge variant="outline" className="text-[10px]">{r.chases} chase</Badge>}</div>
                      <div className="text-muted-foreground">ETA {fmtDate(r.goLive)}{r.engineer ? ` · ${r.engineer}` : ""}</div>
                      {r.delayed && <div className="flex gap-1 text-warning"><AlertTriangle className="size-3.5 shrink-0" />Delayed → {fmtDate(r.delayed.newEta)}</div>}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {r.payment === "processing" && <Button size="xs" onClick={() => act(r.id, { action: "resolve_payment", outcome: "success" })}>Confirm payment</Button>}
                        {r.balanceDue !== null && <Badge variant="destructive" className="text-[10px]">Balance due {inr(r.balanceDue)}</Badge>}
                        {r.engineer && !r.enRoute && (r.stage === "INSTALL_SCHEDULED" || r.stage === "INSTALL_IN_PROGRESS") && <Button size="xs" variant="secondary" onClick={() => act(r.id, { action: "en_route" })}>Engineer on the way</Button>}
                        {r.stage && r.stage !== "ACTIVATED" && <><Button size="xs" onClick={() => act(r.id, { action: "advance" })}>Advance →</Button><Button size="xs" variant="outline" onClick={() => act(r.id, { action: "delay", reason: "a delay with our installation partner" })}>Delay</Button></>}
                        <Link href={`/track/${r.id}?t=${r.token}`} target="_blank"><Button size="xs" variant="ghost" className="gap-1"><ExternalLink className="size-3" />Tracker</Button></Link>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OpsShell>
  );
}
