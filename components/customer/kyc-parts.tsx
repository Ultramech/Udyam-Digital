"use client";
import { useRef } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileImage, Upload, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { kycReason, slotName } from "@/lib/i18n/reasons";
import type { Check, Severity, Slot } from "@/lib/kyc/types";
import type { KycView } from "@/lib/store/kycView";
import { cn } from "@/lib/utils";

const SEV: Record<Severity, { key: string; cls: string; Icon: typeof CheckCircle2 }> = {
  block: { key: "v_blocked", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  reupload: { key: "v_reupload", cls: "bg-warning/15 text-warning", Icon: AlertTriangle },
  review: { key: "v_review", cls: "bg-info/10 text-info", Icon: Clock },
  info: { key: "v_verified", cls: "bg-success/10 text-success", Icon: CheckCircle2 },
};

export function VerdictChip({ severity }: { severity: Severity | "ok" }) {
  const { t } = useI18n();
  const s = severity === "ok" ? { key: "v_verified", cls: "bg-success/10 text-success", Icon: CheckCircle2 } : SEV[severity];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", s.cls)}><s.Icon className="size-3" />{t(s.key)}</span>;
}

/** Every failed check says what's wrong and exactly how to fix it, in the owner's language. */
export function CheckList({ checks, slot }: { checks: Check[]; slot?: Slot }) {
  const { t, lang } = useI18n();
  const rows = checks.filter((c) => (slot ? c.slot === slot : true) && c.severity !== "info");
  if (!rows.length) return null;
  return (
    <ul className="space-y-2">
      {rows.map((c, i) => {
        const { reason, fix } = kycReason(c.code, c.params, lang);
        return (
          <li key={i} className="rounded-lg border bg-card p-2.5 text-sm">
            <div className="flex items-start justify-between gap-2"><div className="font-medium leading-snug">{!slot && c.slot ? `${slotName(c.slot, lang)}: ` : ""}{reason}</div><VerdictChip severity={c.severity} /></div>
            {fix && <div className="mt-1 text-xs text-muted-foreground"><b>{t("fix")}:</b> {fix}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export function DocSlot({ slot, doc, checks, busy, onFile, onSample, sampleLabel, digilockerHref }: {
  slot: Slot; doc?: KycView["docs"][string]; checks: Check[]; busy: boolean; onFile: (f: File) => void; onSample?: () => void; sampleLabel?: string; digilockerHref?: string;
}) {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const mine = checks.filter((c) => c.slot === slot && c.severity !== "info");
  const worst: Severity | "ok" | null = !doc && !mine.length ? null : (["block", "reupload", "review"] as Severity[]).find((s) => mine.some((c) => c.severity === s)) ?? "ok";
  return (
    <Card className="space-y-2.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><FileImage className="size-4 text-primary" />{t(`doc_${slot}`)}</div>
        {worst && <VerdictChip severity={worst} />}
      </div>
      {doc && (
        <div className="rounded-lg bg-secondary p-2.5 text-xs">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>{(lang === "hi" || lang === "mr") ? "हमने यह पढ़ा" : "What we read"}</span><Badge variant="outline" className="text-[10px]">{(lang === "hi" || lang === "mr") ? "AI द्वारा पढ़ा गया" : "read by AI (Gemini)"}</Badge></div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(doc.fields).filter(([k]) => k !== "document").map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd className="truncate font-medium">{v ?? <span className="text-destructive">—</span>}</dd></div>)}
          </dl>
        </div>
      )}
      {mine.length > 0 && <CheckList checks={checks} slot={slot} />}
      <div className="flex flex-wrap gap-2">
        <input ref={ref} type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" aria-label={`${t("upload")} ${t(`doc_${slot}`)}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <Button size="sm" variant="outline" disabled={busy} className="gap-1.5" onClick={() => ref.current?.click()}><Upload className="size-3.5" />{doc ? ((lang === "hi" || lang === "mr") ? "दोबारा अपलोड" : "Replace") : t("take_photo")}</Button>
        {digilockerHref && <a href={digilockerHref} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">DigiLocker</a>}
        {onSample && <Button size="sm" variant="ghost" disabled={busy} onClick={onSample}>{sampleLabel ?? t("use_sample")}</Button>}
      </div>
      {busy ? <p className="text-[11px] text-primary" role="status">{(lang === "hi" || lang === "mr") ? "पढ़ा जा रहा है… (10–30 सेकंड)" : "Reading your document… (10–30 seconds)"}</p>
        : !doc && <p className="text-[11px] text-muted-foreground">{(lang === "hi" || lang === "mr") ? "PNG, JPG या PDF · 5 MB तक · समतल जगह, अच्छी रोशनी, चारों कोने दिखें" : "PNG, JPG or PDF · up to 5 MB · lay it flat, good light, all four corners in view"}</p>}
    </Card>
  );
}
