"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsShell } from "@/components/ops/shell";
import { Kpi, Panel } from "@/components/ops/kit";
import { DonutLegend, HBars, StackBar } from "@/components/ops/charts";
import { Building2, CheckCircle2, UserPlus, Wallet } from "lucide-react";
import { api } from "@/lib/client/api";
import { fmtTime, inr } from "@/lib/client/format";

interface Customer {
  id: string; name: string; businesses: string[]; phoneMasked: string; city: string; segment: string; sites: number; employees: number; owner: string;
  leads: { id: string; status: string; level: string; at: number }[]; orders: { id: string; stage: string; monthly: number; kyc: string; payment: string; at: number }[];
  tickets: { id: string; status: string; category: string }[]; mrr: number; lastActivity: number; status: "prospect" | "onboarding" | "active" | "cancelled";
}
const SEG: Record<string, string> = { micro: "Micro retail", prof: "Professional", multi: "Multi-site", mfg: "Manufacturer" };
const STATUS_V = { active: "default", onboarding: "secondary", prospect: "outline", cancelled: "destructive" } as const;

export default function Customers() {
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("all");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<{ customers: Customer[] }>("GET", "/api/ops/customers").then((r) => setRows(r.customers)).catch(() => setRows([])); }, []);
  const cities = useMemo(() => [...new Set((rows ?? []).map((r) => r.city))].sort(), [rows]);
  const shown = (rows ?? []).filter((r) => (seg === "all" || r.segment === seg) && (status === "all" || r.status === status) && (city === "all" || r.city === city) && (!q || `${r.businesses.join(" ")} ${r.name} ${r.city} ${r.orders.map((o) => o.id).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const sel = "h-9 rounded-md border bg-card px-2 text-sm";
  return (
    <OpsShell>
      <div className="space-y-4">
        <div><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">Customers</h1><p className="mt-1 max-w-3xl text-[0.9375rem] text-muted-foreground">Every business from the digital journey, grouped by the phone they verified by OTP (masked). Leads, orders and support requests in one place.</p></div>
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Search name, city or order id" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={sel} value={seg} onChange={(e) => setSeg(e.target.value)} aria-label="Segment"><option value="all">All segments</option>{Object.entries(SEG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="all">All statuses</option>{["prospect", "onboarding", "active", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <select className={sel} value={city} onChange={(e) => setCity(e.target.value)} aria-label="City"><option value="all">All cities</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        {rows && rows.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Kpi icon={Building2} label="Customers" value={rows.length} />
              <Kpi icon={UserPlus} label="Onboarding" value={rows.filter((r) => r.status === "onboarding").length} />
              <Kpi icon={CheckCircle2} label="Active" value={rows.filter((r) => r.status === "active").length} />
              <Kpi icon={Wallet} label="Monthly revenue" value={inr(rows.reduce((t, r) => t + r.mrr, 0))} sub="active, before GST" />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="By segment"><DonutLegend centre={String(rows.length)} sub="customers" parts={Object.entries(rows.reduce<Record<string, number>>((m, r) => ({ ...m, [SEG[r.segment] ?? r.segment]: (m[SEG[r.segment] ?? r.segment] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value }))} /></Panel>
              <Panel title="Where they are" sub="Top cities."><HBars rows={Object.entries(rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.city]: (m[r.city] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))} /></Panel>
              <Panel title="Journey stage" sub="Prospect to active."><StackBar parts={(["prospect", "onboarding", "active", "cancelled"] as const).map((s) => ({ label: s, value: rows.filter((r) => r.status === s).length, color: ({ prospect: "oklch(0.8 0.02 60)", onboarding: "oklch(0.74 0.16 60)", active: "var(--success)", cancelled: "var(--destructive)" })[s] }))} height={18} />
                <p className="mt-4 text-xs text-muted-foreground">{rows.filter((r) => r.orders.length > 1).length} customers have more than one order · {rows.filter((r) => r.tickets.some((t) => t.status !== "resolved")).length} have an open support request.</p></Panel>
            </div>
          </div>
        )}
        {!rows ? <Skeleton className="h-64" /> : shown.length === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">No customers match. Run a demo journey from the customer app to create one.</Card> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr className="text-left text-[11px] text-muted-foreground">{["Business", "Segment", "City", "Status", "Orders", "MRR", "Owner", "Last activity"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {shown.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer border-t hover:bg-muted/50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <td className="px-3 py-2"><div className="font-medium">{r.name}</div>{r.businesses.length > 1 && <div className="text-xs text-muted-foreground">+{r.businesses.length - 1} more business{r.businesses.length > 2 ? "es" : ""}: {r.businesses.slice(1).join(", ")}</div>}<div className="font-mono text-xs text-muted-foreground">{r.phoneMasked}</div></td>
                      <td className="px-3">{SEG[r.segment] ?? r.segment}<div className="text-xs text-muted-foreground">{r.employees} staff · {r.sites} site(s)</div></td>
                      <td className="px-3">{r.city}</td>
                      <td className="px-3"><Badge variant={STATUS_V[r.status]}>{r.status}</Badge></td>
                      <td className="px-3">{r.orders.length}</td>
                      <td className="px-3">{r.mrr ? inr(r.mrr) : "—"}</td>
                      <td className="px-3">{r.owner}</td>
                      <td className="px-3 text-xs">{fmtTime(r.lastActivity)}</td>
                    </tr>
                    {open === r.id && (
                      <tr key={`${r.id}-d`} className="border-t bg-muted/30"><td colSpan={8} className="px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-3 text-xs">
                          <div><div className="mb-1 font-semibold text-muted-foreground">Orders</div>{r.orders.length ? r.orders.map((o) => <div key={o.id}>{o.id} · {o.stage} · {inr(o.monthly)}/mo · KYC {o.kyc} · pay {o.payment}</div>) : "—"}<Link href="/ops/orders" className="mt-1 block text-primary underline">Orders board →</Link></div>
                          <div><div className="mb-1 font-semibold text-muted-foreground">Leads</div>{r.leads.length ? r.leads.map((l) => <Link key={l.id} href={`/ops/leads/${l.id}`} className="block text-primary underline">{l.id} · {l.status} · {l.level}</Link>) : "—"}</div>
                          <div><div className="mb-1 font-semibold text-muted-foreground">Support</div>{r.tickets.length ? r.tickets.map((t) => <div key={t.id}>{t.id} · {t.category} · {t.status}</div>) : "—"}<Link href="/ops/support" className="mt-1 block text-primary underline">Support queue →</Link></div>
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </OpsShell>
  );
}
