"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { OpsShell } from "@/components/ops/shell";
import { api, ApiError } from "@/lib/client/api";
import { kycReason, slotName } from "@/lib/i18n/reasons";
import type { KycView } from "@/lib/store/kycView";

type Row = KycView & { business: string; orderId: string | null; needsReview: boolean };
const SEV = { block: "destructive", reupload: "secondary", review: "default", info: "outline" } as const;

function Case({ r, onDone }: { r: Row; onDone: () => void }) {
  const [note, setNote] = useState("");
  const decide = async (decision: "approved" | "rejected" | "correction") => {
    if (decision !== "approved" && !note.trim()) { toast.error("Add a note so the customer knows what to do."); return; }
    try { await api("POST", `/api/ops/kyc/${r.id}`, { decision, note }); toast.success(`Recorded: ${decision}`); onDone(); } catch (e) { toast.error(e instanceof ApiError && e.status === 403 ? "Only KYC reviewers can decide." : "Couldn't save the decision."); }
  };
  const issues = r.checks.filter((c) => c.severity !== "info" || c.code === "DOC_SEEN_ELSEWHERE");
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="font-semibold">{r.business}</div><div className="font-mono text-xs text-muted-foreground">{r.id} · quote {r.quoteId}{r.orderId ? ` · order ${r.orderId}` : ""}</div></div>
        <div className="flex gap-1.5"><Badge variant={r.status === "review" ? "default" : "secondary"} className="capitalize">{r.status}</Badge>{r.review && <Badge variant="outline">{r.review.decision}</Badge>}</div>
      </div>
      {r.score && (
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm"><span className="text-xs font-semibold text-muted-foreground">Review score </span><b className={`text-lg ${r.score.band === "high" ? "text-success" : r.score.band === "medium" ? "text-warning" : "text-destructive"}`}>{r.score.score}</b><span className="text-xs text-muted-foreground"> / 100 · {r.score.band}</span></div>
            <span className="text-[11px] text-muted-foreground">Triage signal only — a high score is not an approval.</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {r.score.components.map((c) => (
              <div key={c.key} title={c.causes.join(", ") || "no issues"}>
                <div className="flex justify-between"><span className="capitalize">{c.key}</span><span className="text-muted-foreground">{c.score}/{c.max}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-1.5 rounded-full ${c.score / c.max >= 0.75 ? "bg-success" : c.score / c.max >= 0.4 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${(c.score / c.max) * 100}%` }} /></div>
                {c.causes.length > 0 && <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{c.causes.join(", ")}</div>}
              </div>
            ))}
          </div>
          {r.score.anomalies.length > 0 && <div className="mt-2 text-xs text-warning">Anomaly indicators (−10 each, not proof of fraud): {r.score.anomalies.join(", ")}</div>}
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Registry & uploads</div>
          {r.gstName && <div className="rounded-lg bg-secondary p-2.5 text-sm"><b>{r.gstName}</b> · GST {r.gstStatus} <span className="font-mono text-xs text-muted-foreground">{r.gstinMasked}</span></div>}
          {Object.values(r.docs).map((d) => (
            <div key={d.slot} className="rounded-lg border p-2.5 text-xs"><div className="mb-1 flex items-center justify-between font-medium"><span>{slotName(d.slot)} <span className="font-mono text-[10px] text-muted-foreground">{d.file ?? ""}</span></span>
              <span className="text-muted-foreground">{d.legibility} · confidence {Math.round(d.confidence * 100)}%{d.sharpness !== undefined ? ` · sharpness ${d.sharpness}` : ""}{d.seenInOtherApplications ? ` · also in ${d.seenInOtherApplications} other application(s)` : ""}</span></div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">{Object.entries(d.fields).filter(([k]) => k !== "document").map(([k, v]) => <div key={k}><dt className="text-[10px] uppercase text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd className="truncate">{v ?? <span className="text-destructive">blank</span>}</dd></div>)}</dl></div>
          ))}
        </div>
        <div className="space-y-2"><div className="text-xs font-semibold text-muted-foreground">Why it&apos;s here</div>
          {issues.length === 0 ? <div className="flex items-center gap-1.5 text-sm text-success"><CheckCircle2 className="size-4" />All checks passed</div> : issues.map((c, i) => { const k = kycReason(c.code, c.params, "en"); return <div key={i} className="rounded-lg border p-2.5 text-sm"><div className="flex items-start justify-between gap-2"><span className="font-medium">{c.slot ? `${slotName(c.slot)}: ` : ""}{k.reason}</span><Badge variant={SEV[c.severity]} className="shrink-0 text-[10px]">{c.severity}</Badge></div><div className="font-mono text-[10px] text-muted-foreground">{c.code}</div></div>; })}
        </div>
      </div>
      {!r.review && (
        <div className="space-y-2 border-t pt-3"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note (shown to the customer if you request a correction or reject)" aria-label="Reviewer note" />
          <div className="flex flex-wrap gap-2"><Button onClick={() => decide("approved")}>Approve</Button><Button variant="outline" onClick={() => decide("correction")}>Request correction</Button><Button variant="outline" className="text-destructive" onClick={() => decide("rejected")}>Reject</Button></div></div>
      )}
      {r.review && <div className="border-t pt-2 text-xs text-muted-foreground">Decision by {r.review.by}: <b>{r.review.decision}</b>{r.review.note ? ` — “${r.review.note}”` : ""}</div>}
    </Card>
  );
}

export default function KycQueue() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [all, setAll] = useState(false);
  const [denied, setDenied] = useState(false);
  const load = useCallback(() => api<{ rows: Row[] }>("GET", `/api/ops/kyc${all ? "?all=1" : ""}`).then((r) => setRows(r.rows)).catch((e) => { if (e instanceof ApiError && e.status === 403) setDenied(true); setRows([]); }), [all]);
  useEffect(() => { load(); const h = setInterval(load, 5000); return () => clearInterval(h); }, [load]);
  return (
    <OpsShell>
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="size-6 text-primary" />KYC review</h1><p className="text-sm text-muted-foreground">Cases flagged for a person. Your decision appears on the customer&apos;s screen and order tracker.</p></div>
          <Button variant="outline" size="sm" onClick={() => setAll((a) => !a)}>{all ? "Show open only" : "Show all cases"}</Button></div>
        {denied && <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm">Your role can&apos;t review KYC. Sign in as KYC ops or admin.</Card>}
        {!rows ? <Skeleton className="h-64" /> : rows.length === 0 && !denied ? <Card className="p-8 text-center text-sm text-muted-foreground">Nothing waiting. Run the &ldquo;Dr. Menon&rdquo; or &ldquo;Vindhya Tours&rdquo; demo to create a case.</Card> : rows.map((r) => <Case key={r.id} r={r} onDone={load} />)}
      </div>
    </OpsShell>
  );
}
