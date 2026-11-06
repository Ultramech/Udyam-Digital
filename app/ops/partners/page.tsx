"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsShell } from "@/components/ops/shell";
import { api } from "@/lib/client/api";
import { inr } from "@/lib/client/format";
import type { PartnerSummary } from "@/lib/leads/partners";

type P = PartnerSummary & { name: string };

export default function Partners() {
  const [d, setD] = useState<P[] | null>(null);
  useEffect(() => { api<{ partners: P[] }>("GET", "/api/ops/partners").then((r) => setD(r.partners)).catch(() => setD([])); }, []);
  return (
    <OpsShell>
      <div className="max-w-5xl space-y-5">
        <div><h1 className="text-2xl font-bold">Partner book</h1><p className="text-sm text-muted-foreground">Every lead a partner brought or was assigned, where it stands and what it is worth. Figures come from real paid orders only.</p></div>
        {!d ? <Skeleton className="h-64" /> : d.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No partner data.</Card> : d.map((p) => (
          <section key={p.partnerId} className="space-y-3" aria-label={p.name}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">{p.name}<Badge variant="outline" className="font-mono text-[10px]">{p.partnerId}</Badge></h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {([["Leads", p.totals.leads], ["Still open", p.totals.open], ["Paid orders", p.totals.ordersPaid], ["Activated", p.totals.activated], ["Activated MRR", inr(p.totals.mrrActivated)]] as const).map(([l, v]) => (
                <Card key={l} className="p-3"><div className="text-[11px] uppercase text-muted-foreground">{l}</div><div className="text-xl font-bold">{v}</div></Card>
              ))}
            </div>
            <Card className="p-3 text-sm"><p>
              {p.commissionPercent === null
                ? <>Earnings: <b>not shown</b> — Accel Business hasn’t set a commission rate (<code>PARTNER_COMMISSION_PERCENT</code>), so none is assumed.</>
                : <>Earnings on activated orders: <b>{inr(p.totals.earningsActivated ?? 0)}</b> <span className="text-muted-foreground">({p.commissionPercent}% of the first month’s recurring charge, excl. GST — set by Accel Business)</span></>}
            </p></Card>
            {p.rows.length === 0 ? <Card className="p-5 text-center text-sm text-muted-foreground">No leads yet.</Card> : (
              <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-left text-sm">
                <thead className="border-b text-[11px] uppercase text-muted-foreground"><tr><th className="p-2">Business</th><th className="p-2">City</th><th className="p-2">Stage</th><th className="p-2 text-right">Monthly</th></tr></thead>
                <tbody>{p.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0"><td className="p-2"><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/ops/leads/${r.id}`}>{r.business}</Link></td><td className="p-2">{r.city || "—"}</td>
                    <td className="p-2"><Badge variant={r.activated ? "secondary" : "outline"} className="text-[10px]">{r.stage.replace(/_/g, " ").toLowerCase()}</Badge></td><td className="p-2 text-right">{inr(r.monthly)}</td></tr>
                ))}</tbody></table></div>
            )}
          </section>
        ))}
      </div>
    </OpsShell>
  );
}
