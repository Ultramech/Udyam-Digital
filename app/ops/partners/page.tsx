"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
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
  const [qr, setQr] = useState<Record<string, string>>({});
  useEffect(() => { api<{ partners: P[] }>("GET", "/api/ops/partners").then((r) => setD(r.partners)).catch(() => setD([])); }, []);
  return (
    <OpsShell>
      <div className="max-w-5xl space-y-5">
        <div><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">Partner book</h1><p className="mt-1 max-w-3xl text-[0.9375rem] text-muted-foreground">Every lead a partner brought or was assigned, where it stands and what it is worth. Figures come from real paid orders only.</p></div>
        {!d ? <Skeleton className="h-64" /> : d.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No partner data.</Card> : d.map((p) => (
          <section key={p.partnerId} className="space-y-3" aria-label={p.name}>
            <h2 className="flex items-center gap-2 text-lg font-semibold">{p.name}<Badge variant="outline" className="font-mono text-[10px]">{p.partnerId}</Badge></h2>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
              <button className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" onClick={async () => { const link = `${window.location.origin}/?partner=${encodeURIComponent(p.partnerId)}`; const image = await QRCode.toDataURL(link, { width: 256, margin: 2, errorCorrectionLevel: "M" }); setQr((v) => ({ ...v, [p.partnerId]: image })); }}>Generate store counter QR</button>
              {qr[p.partnerId] && <><Image unoptimized width={128} height={128} className="size-32 rounded bg-white p-1" src={qr[p.partnerId]} alt={`Store counter referral QR for ${p.name}`} /><a className="text-sm font-medium text-primary underline" download={`${p.partnerId}-counter-qr.png`} href={qr[p.partnerId]}>Download QR kit</a><span className="text-xs text-muted-foreground">Opens the advisor with this partner&apos;s referral code.</span></>}
            </div>
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
