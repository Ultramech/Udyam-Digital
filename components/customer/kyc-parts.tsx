"use client";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileImage, ShieldCheck, Upload, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", s.cls)}><s.Icon className="size-3" />{t(s.key)}</span>;
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
          <li key={i} className="rounded-2xl border bg-card shadow-card p-3.5 text-[0.9375rem]">
            <div className="mb-1.5"><VerdictChip severity={c.severity} /></div><div className="font-semibold leading-snug">{!slot && c.slot ? `${slotName(c.slot, lang)}: ` : ""}{reason}</div>
            {fix && <div className="mt-1.5 text-sm text-muted-foreground"><b>{t("fix")}:</b> {fix}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** What each document is for, in plain words, so nobody has to wonder why it is being asked for. */
const DOC_INFO: Record<Slot, { title: [string, string]; why: [string, string] }> = {
  signatory_id: { title: ["Your ID", "आपकी ID"], why: ["Confirms who is signing for the business. Aadhaar, PAN or driving licence.", "बिज़नेस की ओर से कौन साइन कर रहा है, यह पक्का करता है। आधार, PAN या ड्राइविंग लाइसेंस।"] },
  address_proof: { title: ["Shop address proof", "दुकान का पता प्रमाण"], why: ["Confirms where we install. A recent electricity or phone bill (under 90 days), or your Aadhaar.", "हम कहाँ इंस्टॉल करेंगे, यह पक्का करता है। हाल का बिजली या फ़ोन बिल (90 दिन से कम), या आधार।"] },
  gst_certificate: { title: ["GST certificate", "GST सर्टिफिकेट"], why: ["Confirms your GST registration, so GST-linked services can stay in your plan.", "आपका GST रजिस्ट्रेशन पक्का करता है, ताकि GST वाली सेवाएँ प्लान में रहें।"] },
  udyam_certificate: { title: ["Udyam certificate", "उद्यम सर्टिफिकेट"], why: ["Confirms your Udyam (MSME) registration.", "आपका उद्यम (MSME) रजिस्ट्रेशन पक्का करता है।"] },
};

export function DocSlot({ slot, doc, checks, busy, onFile, onSample, sampleLabel, onDigilocker, digilockerLabel, onAadhaar, quiet }: {
  slot: Slot; doc?: KycView["docs"][string]; checks: Check[]; busy: boolean; onFile: (f: File) => void; onSample?: () => void; sampleLabel?: string;
  /** Fetch this document from DigiLocker / EntityLocker (consent is asked for on the way if needed). */
  onDigilocker?: () => void; digilockerLabel?: string;
  /** Aadhaar offline e-KYC (signatory ID and address proof only): ZIP + the owner's share phrase. */
  onAadhaar?: (f: File, phrase: string) => Promise<boolean>;
  /** Another button on the screen is the recommended action, so uploading is shown as an ordinary option (one red button per screen). */
  quiet?: boolean;
}) {
  const { t, lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const ref = useRef<HTMLInputElement>(null);
  const info = DOC_INFO[slot];
  // a document that was simply never given is "needed", not a failure: the red/amber tones are for documents that were actually checked
  const mine = checks.filter((c) => c.slot === slot && c.severity !== "info" && (doc || c.code !== "DOC_MISSING"));
  const worst: Severity | "ok" | null = !doc && !mine.length ? null : (["block", "reupload", "review"] as Severity[]).find((s) => mine.some((c) => c.severity === s)) ?? "ok";
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.9375rem] font-bold"><FileImage className="size-4 shrink-0" aria-hidden />{info.title[hi ? 1 : 0]}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{info.why[hi ? 1 : 0]}</p>
        </div>
        {worst ? <VerdictChip severity={worst} /> : <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{hi ? "ज़रूरी" : "Needed"}</span>}
      </div>
      {doc && (
        <div className="rounded-lg bg-secondary p-2.5 text-xs">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground"><span>{hi ? "हमने यह पढ़ा" : "What we read"}</span><Badge variant="outline" className="text-xs">{doc.source === "aadhaar_offline" ? (hi ? "UIDAI हस्ताक्षर सत्यापित" : "UIDAI signature verified") : (doc.source === "digilocker" || doc.source === "digilocker_aadhaar") ? (hi ? "DigiLocker से मिला" : "From DigiLocker") : hi ? "AI द्वारा पढ़ा गया" : "read by AI (Gemini)"}</Badge></div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {Object.entries(doc.fields).filter(([k]) => k !== "document").map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd className="truncate font-medium">{v ?? <span className="text-destructive">—</span>}</dd></div>)}
          </dl>
        </div>
      )}
      {mine.length > 0 && <CheckList checks={mine} slot={slot} />}
      <input ref={ref} type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" aria-label={`${t("upload")} ${info.title[0]}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      {/* one obvious action; the other ways are quieter */}
      <Button variant={doc || quiet ? "outline" : "default"} size={doc ? "sm" : "lg"} disabled={busy} className="w-full gap-2 sm:w-auto" onClick={() => ref.current?.click()}>
        <Upload className="size-4" aria-hidden />{doc ? (hi ? "दस्तावेज़ बदलें" : "Replace document") : (hi ? "फ़ोटो या PDF अपलोड करें" : "Upload a photo or PDF")}
      </Button>
      {(onDigilocker || onAadhaar || onSample) && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{doc ? (hi ? "या दोबारा लाएँ" : "Or fetch it again") : (hi ? "या इनमें से कोई तरीका" : "Or skip the photo")}</div>
          <div className="flex flex-wrap gap-2">
            {onDigilocker && <Button size="sm" variant="outline" disabled={busy} onClick={onDigilocker}>{(digilockerLabel ?? "DigiLocker") === "EntityLocker" ? (hi ? "EntityLocker से लाएँ" : "Fetch from EntityLocker") : (hi ? "DigiLocker से लाएँ" : "Fetch from DigiLocker")}</Button>}
            {onSample && <Button size="sm" variant="ghost" disabled={busy} onClick={onSample}>{sampleLabel ?? t("use_sample")}</Button>}
          </div>
          {onAadhaar && <AadhaarOffline busy={busy} onSubmit={onAadhaar} />}
        </div>
      )}
      {busy ? <p className="text-xs text-primary" role="status">{hi ? "पढ़ा जा रहा है… (10–30 सेकंड)" : "Working on it… (10 to 30 seconds)"}</p>
        : !doc && <p className="text-xs text-muted-foreground">{hi ? "PNG, JPG या PDF · 5 MB तक · समतल जगह पर, अच्छी रोशनी में" : "PNG, JPG or PDF, up to 5 MB. Lay it flat in good light. PDFs from DigiLocker work too."}</p>}
    </Card>
  );
}

/** Aadhaar Paperless Offline e-KYC: free, no number typed, no photo kept. The owner downloads UIDAI's signed ZIP and shares it with the phrase they chose. */
function AadhaarOffline({ busy, onSubmit }: { busy: boolean; onSubmit: (f: File, phrase: string) => Promise<boolean> }) {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phrase, setPhrase] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed px-3 text-left text-sm font-medium text-primary hover:bg-accent">
      <ShieldCheck className="size-4 shrink-0" aria-hidden />{hi ? "आधार ऑफ़लाइन e-KYC से सत्यापित करें (मुफ़्त)" : "Verify with Aadhaar offline e-KYC (free)"}
    </button>
  );
  return (
    <div className="space-y-2.5 rounded-xl border bg-card p-3 text-sm">
      <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" aria-hidden />{hi ? "आधार ऑफ़लाइन e-KYC" : "Aadhaar offline e-KYC"}</div>
      <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>{hi ? "myaadhaar.uidai.gov.in खोलें → Download Aadhaar → Offline e-KYC" : "Open myaadhaar.uidai.gov.in → Download Aadhaar → Paperless Offline e-KYC"}</li>
        <li>{hi ? "एक शेयर फ़्रेज़ चुनें (वही पासवर्ड है) और ZIP डाउनलोड करें" : "Choose a share phrase (it is the ZIP password) and download the ZIP"}</li>
        <li>{hi ? "ZIP और वही फ़्रेज़ यहाँ दें" : "Add the ZIP and the same phrase here"}</li>
      </ol>
      <input ref={ref} type="file" accept=".zip,.xml,application/zip,text/xml" className="sr-only" aria-label="Aadhaar offline e-KYC file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => ref.current?.click()}><Upload className="size-3.5" />{file ? file.name : (hi ? "ZIP चुनें" : "Choose the ZIP")}</Button>
      <Input type="password" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" placeholder={hi ? "शेयर फ़्रेज़" : "Share phrase"} aria-label={hi ? "शेयर फ़्रेज़" : "Share phrase"} />
      <p className="text-xs text-muted-foreground">{hi ? "हम सिर्फ़ नाम, पता और आधार के आख़िरी 4 अंक रखते हैं। फ़ोटो, फ़ाइल और फ़्रेज़ सहेजे नहीं जाते।" : "We keep only your name, address and the last 4 digits. The photo, the file and the phrase are never stored."}</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !file || phrase.length < 1} onClick={async () => { if (file && (await onSubmit(file, phrase))) { setOpen(false); setFile(null); setPhrase(""); } }}>{hi ? "सत्यापित करें" : "Verify"}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setFile(null); setPhrase(""); }}>{hi ? "रद्द करें" : "Cancel"}</Button>
      </div>
    </div>
  );
}
