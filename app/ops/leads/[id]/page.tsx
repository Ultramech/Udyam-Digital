"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, Link2, MessageSquarePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { NEXT_ACTION, OpsShell } from "@/components/ops/shell";
import { LinesList } from "@/components/customer/bundle-card";
import { RichText } from "@/components/rich-text";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { api } from "@/lib/client/api";
import { fmtTime, inr } from "@/lib/client/format";
import type { QuoteView } from "@/lib/client/types";
import type { Lead } from "@/lib/store/types";

interface Live {
  origin: "live"; lead: Lead & { ownerName: string }; summary: string[]; nextAction: string; transcript: { role: string; text: string; at: number }[]; quote: QuoteView | null;
  order: { id: string; stage?: string; payment: string; kycStatus: string } | null; kyc: { id: string; status: string; review: { decision: string } | null } | null; owners: { id: string; name: string; kind: string }[];
}
interface Hist { origin: "historical"; lead: { id: string; business: string; segment: string; city: string; source: string; stage: string; outcome: string; dropReason: string; hasGstin: boolean; turnover: string; employees: number; sites: number; language: string; expectedValue: number; monthlyValue: number; priority: number; nextAction: string; winback: boolean; score: { probability: number; band: string; drivers: { text: string; direction: string }[] } } }

export default function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Live | Hist | null>(null);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const load = useCallback(() => api<Live | Hist>("GET", `/api/ops/leads/${id}`).then(setD).catch(() => toast.error("Couldn't load this lead.")), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (body: Record<string, unknown>, ok: string) => { try { await api("POST", `/api/ops/leads/${id}`, body); toast.success(ok); load(); } catch { toast.error("That action isn't allowed for your role."); } };

  if (!d) return <OpsShell><Skeleton className="h-96" /></OpsShell>;
  if (d.origin === "historical") {
    const l = d.lead;
    return (
      <OpsShell><div className="max-w-3xl space-y-4"><Link href="/ops/leads" className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Leads</Link>
        <div><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">{l.business}</h1><div className="font-mono text-xs text-muted-foreground">{l.id} · historical dataset</div></div>
        <Card className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-4">{[["Segment", l.segment], ["City", l.city], ["Source", l.source], ["Reached", l.stage], ["Outcome", l.outcome], ["GSTIN", l.hasGstin ? "Yes" : "No"], ["Turnover", l.turnover], ["People / sites", `${l.employees} / ${l.sites}`]].map(([k, v]) => <div key={k}><div className="text-[11px] uppercase text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>)}</Card>
        {l.dropReason && <Card className="p-4 text-sm"><div className="text-[11px] uppercase text-muted-foreground">Why it dropped</div><div className="font-medium">{l.dropReason}</div>{l.winback && <Badge className="mt-2">digitally fixable → win-back</Badge>}</Card>}
        <Card className="space-y-2 p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" />Propensity {Math.round(l.score.probability * 100)} · {l.score.band}</div>
          <ul className="space-y-1">{l.score.drivers.map((x, i) => <li key={i} className="flex gap-2"><span className={x.direction === "up" ? "text-success" : "text-destructive"}>{x.direction === "up" ? "▲" : "▼"}</span>{x.text}</li>)}</ul>
          <div className="text-xs text-muted-foreground">Expected value {inr(l.expectedValue)}/month · priority {inr(l.priority)} · next best action: <b>{NEXT_ACTION[l.nextAction] ?? l.nextAction}</b></div></Card></div></OpsShell>
    );
  }

  const { lead: l } = d;
  const link = typeof window !== "undefined" ? `${window.location.origin}${l.quoteId ? `/quote/${l.quoteId}` : `/advisor?c=${l.conversationId}`}` : "";
  return (
    <OpsShell>
      <div className="max-w-5xl space-y-4">
        <Link href="/ops/leads" className="flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" />Leads</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">{l.businessName ?? "New enquiry"}</h1><div className="font-mono text-xs text-muted-foreground">{l.id} · {l.profile.city} · {l.attribution.source ?? "advisor"}</div></div>
          <div className="flex flex-wrap gap-1.5"><Badge variant={l.level === "hard" ? "destructive" : "default"}>{l.level === "hard" ? "needs a person" : "specialist assist"}</Badge><Badge variant="secondary" className="capitalize">{l.status}</Badge>
            {l.assistCredit && <Badge variant="outline">assist credit → {l.assistCredit.to}</Badge>}</div>
        </div>

        <Card className="space-y-1.5 border-primary/30 bg-accent p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Summary (built from structured facts — it cannot invent anything)</div>
          <ul className="space-y-0.5 text-sm">{d.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
          <div className="pt-1 text-sm">Next best action: <b>{NEXT_ACTION[d.nextAction] ?? d.nextAction}</b></div></Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="space-y-2 p-4"><div className="text-sm font-semibold">Recommended plan</div>
              {d.quote ? <><div className="text-sm">{bundleName(l.bundleId ?? d.quote.quote.bundleId, "en")} · <b>{inr(d.quote.pricing.monthly)}</b>/month + {inr(d.quote.pricing.setup)} setup</div><LinesList lines={d.quote.quote.lines} showPrice={false} />
                {d.quote.exclusions.map((e) => <div key={e.productId + e.code} className="text-xs text-muted-foreground">✕ {ruleReason({ code: e.code, params: e.params, productId: e.productId })}</div>)}</>
                : <div className="text-sm text-muted-foreground">{l.bundleId ? `${bundleName(l.bundleId, "en")} suggested at about ${inr(l.monthly)}/month — no quote created yet.` : "No automatic plan could be built."}</div>}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard?.writeText(link); toast.success("Plan link copied — pre-attributed to this lead's owner"); }}><Link2 className="size-3.5" />Send plan link</Button>{l.conversationId && <a className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent" href={`/advisor?c=${l.conversationId}&copilot=1`} target="_blank" rel="noreferrer">Assist as co-pilot</a>}</div>
            </Card>
            <Card className="space-y-2 p-4 text-sm"><div className="font-semibold">Status</div>
              <div>Order: {d.order ? <><Link className="text-primary underline" href="/ops/orders">{d.order.id}</Link> · payment {d.order.payment} · {d.order.stage ?? "not placed"}</> : "not placed"}</div>
              <div>KYC: {d.kyc ? <>{d.kyc.status}{d.kyc.review ? ` · ${d.kyc.review.decision}` : ""}</> : "not started"}</div>
              <div>Owner: <b>{l.ownerName}</b></div>
              <select aria-label="Assign owner" className="h-8 w-full rounded-lg border border-input bg-card px-2" value={l.ownerId ?? ""} onChange={(e) => act({ action: "assign", ownerId: e.target.value }, "Lead reassigned")}>{d.owners.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.kind})</option>)}</select>
              <div className="flex gap-2 pt-1">{(["field_sales", "enterprise", "kyc_ops"] as const).map((t) => <Button key={t} size="sm" variant="outline" onClick={() => act({ action: "escalate", team: t }, `Escalated to ${t.replace("_", " ")}`)}>→ {t.replace("_", " ")}</Button>)}</div></Card>
          </div>
          <div className="space-y-4">
            <Card className="space-y-2 p-4"><div className="text-sm font-semibold">Advisor conversation</div>
              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg bg-muted p-2.5">{d.transcript.map((m, i) => <div key={i} className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}><RichText text={m.text} /></div>)}</div></Card>
            <Card className="space-y-2.5 p-4"><div className="text-sm font-semibold">Follow-up</div>
              <div className="flex gap-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" aria-label="Note" /><Button size="icon-lg" aria-label="Add note" disabled={!note.trim()} onClick={() => { act({ action: "note", text: note }, "Note added"); setNote(""); }}><MessageSquarePlus className="size-4" /></Button></div>
              <div className="flex gap-2"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Callback time" /><Button variant="outline" disabled={!when} className="gap-1.5" onClick={() => { act({ action: "callback", at: when, note: "Callback" }, "Callback scheduled"); setWhen(""); }}><CalendarPlus className="size-4" />Schedule</Button></div>
              {l.callbacks.map((c, i) => <div key={i} className="flex items-center justify-between rounded-lg border p-2 text-xs"><span>📞 {c.at.replace("T", " ")} {c.note}</span>{c.done ? <Badge variant="secondary">done</Badge> : <Button size="xs" variant="outline" onClick={() => act({ action: "done", index: i }, "Marked complete")}>Mark done</Button>}</div>)}
              {l.notes.map((n, i) => <div key={i} className="rounded-lg bg-muted p-2 text-xs"><b>{n.by}</b> · {fmtTime(n.at)}<div>{n.text}</div></div>)}</Card>
          </div>
        </div>
      </div>
    </OpsShell>
  );
}
