"use client";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, FlaskConical, Landmark, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { CheckList, DocSlot } from "@/components/customer/kyc-parts";
import { DelegateCard } from "@/components/customer/delegate-card";
import { Collapse } from "@/components/customer/kit";
import { plainName } from "@/lib/catalogue/plain";
import { api, ApiError } from "@/lib/client/api";
import { inr } from "@/lib/client/format";
import type { QuoteView } from "@/lib/client/types";
import { getPersona } from "@/lib/demo/personas";
import { kycReason } from "@/lib/i18n/reasons";
import { SLOTS, type Slot } from "@/lib/kyc/types";
import type { KycView } from "@/lib/store/kycView";

const SAMPLE_SETS = ["D01", ...Array.from({ length: 12 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`)];

export default function KycPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const router = useRouter();
  const [k, setK] = useState<KycView | null>(null);
  const [q, setQ] = useState<QuoteView | null>(null);
  const [gstin, setGstin] = useState("");
  const [udyam, setUdyam] = useState("");
  const [busy, setBusy] = useState(false);
  const [removed, setRemoved] = useState<{ productId: string }[]>([]);
  const [chosenSet, setSet] = useState<string | null>(null);
  const [dlLive, setDlLive] = useState(false); // DigiLocker is connected on the server
  const [purposes, setPurposes] = useState<{ kyc: boolean; service: boolean; digilocker: boolean; marketing: boolean } | null>(null);
  useEffect(() => {
    Promise.all([api<{ services: { id: string; mode: string }[] }>("GET", "/api/status"), api<{ quote: { consentId?: string } }>("GET", `/api/quote/${id}`)])
      .then(async ([st, qv]) => {
        setDlLive(st.services.find((x) => x.id === "digilocker")?.mode === "live");
        if (!qv.quote.consentId) return;
        const c = await api<{ receipt: { purposes: { kyc: boolean; service: boolean; digilocker: boolean; marketing: boolean } } }>("GET", `/api/consent?id=${qv.quote.consentId}`).catch(() => null);
        if (c) setPurposes(c.receipt.purposes);
      }).catch(() => {});
    const r = new URLSearchParams(window.location.search).get("digilocker");
    if (r) toast[r === "ok" ? "success" : "info"](r === "ok" ? "Document fetched from DigiLocker." : r === "none" ? "No matching document in your DigiLocker — please upload it." : r === "declined" ? "DigiLocker access was not granted." : "DigiLocker didn't respond — please upload instead.");
  }, [id]);

  const persona = getPersona(q?.quote.attribution.source?.startsWith("demo:") ? q.quote.attribution.source.slice(5) : undefined);
  // the owner's pick wins; otherwise the demo persona's own documents; otherwise the generic demo set
  const set = chosenSet ?? persona?.applicant ?? "D01";

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await api<{ kyc: KycView; quote: QuoteView; removed?: { productId: string }[] }>("POST", `/api/kyc/${id}`, body);
      setK(r.kyc); setQ(r.quote); if (r.removed?.length) setRemoved(r.removed);
      return r;
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      toast.error(code === "DOCUMENT_READER_UNAVAILABLE" ? ((lang === "hi" || lang === "mr") ? "दस्तावेज़ पढ़ने की सेवा अभी उपलब्ध नहीं है। थोड़ी देर बाद कोशिश करें।" : "Document reading isn't available right now. Please try again shortly.") : code === "GSTIN_FORMAT" ? ((lang === "hi" || lang === "mr") ? "GST नंबर 15 अक्षरों का होता है।" : "A GST number has 15 characters.") : code === "UDYAM_FORMAT" ? (kycReason("UDYAM_FORMAT", {}, lang).reason) : code === "KYC_CONSENT_REQUIRED" ? t("consent_needed") : t("error_generic"));
      if (code === "KYC_CONSENT_REQUIRED") router.replace(`/order/${id}/consent`);
    } finally { setBusy(false); }
  }, [id, lang, router, t]);

  useEffect(() => {
    (async () => {
      const [kv, qv] = await Promise.all([api<{ kyc: KycView; consent: boolean }>("GET", `/api/kyc/${id}`), api<QuoteView>("GET", `/api/quote/${id}`)]);
      if (!kv.consent) { router.replace(`/order/${id}/consent`); return; }
      setK(kv.kyc); setQ(qv);
      await post({ action: "claims", claimsUdyam: !!qv.quote.profile.udyam?.has || kv.kyc.claimsUdyam });
    })().catch(() => toast.error(t("error_generic")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // a reviewer's decision shows up here without the owner doing anything
  useEffect(() => {
    if (k?.status !== "review" || k.review) return;
    const h = setInterval(() => api<{ kyc: KycView }>("GET", `/api/kyc/${id}`).then((r) => setK(r.kyc)).catch(() => {}), 5000);
    return () => clearInterval(h);
  }, [k?.status, k?.review, id]);

  /** Something came back from a delegate's phone: refresh what is on screen without touching the owner's own work. */
  const refreshKyc = useCallback(() => { api<{ kyc: KycView }>("GET", `/api/kyc/${id}`).then((r) => setK(r.kyc)).catch(() => {}); api<QuoteView>("GET", `/api/quote/${id}`).then(setQ).catch(() => {}); }, [id]);

  async function upload(slot: Slot, f: File) {
    setBusy(true);
    try {
      const fd = new FormData(); fd.set("slot", slot); fd.set("file", f);
      const res = await fetch(`/api/kyc/${id}/doc`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error ?? "ERROR");
      setK(data.kyc);
      setQ(await api<QuoteView>("GET", `/api/quote/${id}`));
    } catch (e) { toast.error(e instanceof ApiError && e.code === "DOCUMENT_READER_UNAVAILABLE" ? ((lang === "hi" || lang === "mr") ? "दस्तावेज़ पढ़ने की सेवा अभी उपलब्ध नहीं है। थोड़ी देर बाद कोशिश करें।" : "Document reading isn't available right now. Please try again shortly.") : e instanceof ApiError && e.status === 415 ? ((lang === "hi" || lang === "mr") ? "सिर्फ़ PNG/JPG फोटो या PDF अपलोड करें।" : "Please upload a PNG/JPG photo or a PDF.") : e instanceof ApiError && e.status === 413 ? ((lang === "hi" || lang === "mr") ? "फ़ाइल 5 MB से छोटी होनी चाहिए।" : "The file must be under 5 MB.") : e instanceof ApiError && e.code === "SAME_FILE_AGAIN" ? ((lang === "hi" || lang === "mr") ? "यह वही फ़ाइल है जिसमें पहले समस्या थी — कृपया नई फोटो लें।" : "That's the same file that had a problem before — please take a new photo.") : t("error_generic")); }
    setBusy(false);
  }
  /** Aadhaar offline e-KYC: ZIP + share phrase, verified on the server against UIDAI's key. Returns true when it was accepted. */
  async function aadhaar(slot: Slot, f: File, phrase: string): Promise<boolean> {
    setBusy(true);
    try {
      const fd = new FormData(); fd.set("slot", slot); fd.set("file", f); fd.set("phrase", phrase);
      const res = await fetch(`/api/kyc/${id}/aadhaar`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new ApiError(res.status, data.error ?? "ERROR");
      setK(data.kyc);
      setQ(await api<QuoteView>("GET", `/api/quote/${id}`));
      toast.success("Aadhaar verified with UIDAI's digital signature.");
      return true;
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast.error(c === "AADHAAR_WRONG_PHRASE" ? "That share phrase doesn't open the file. Check it and try again."
        : c === "AADHAAR_SIGNATURE_INVALID" ? "This file's UIDAI signature doesn't check out, so it can't be used. Download a fresh one."
        : c === "AADHAAR_NOT_A_ZIP" || c === "AADHAAR_NO_XML" || c === "AADHAAR_NOT_UIDAI_XML" || c === "AADHAAR_MALFORMED" ? "That isn't an Aadhaar offline e-KYC file. Use the ZIP from myaadhaar.uidai.gov.in."
        : c === "FILE_TOO_LARGE" ? "The file is too large (limit 2 MB)." : t("error_generic"));
      return false;
    } finally { setBusy(false); }
  }
  /** Starts DigiLocker / EntityLocker for one slot. The optional DigiLocker consent is recorded right here if it was left off. */
  async function startLocker(slot: Slot) {
    setBusy(true);
    try {
      if (!purposes?.digilocker) {
        const r = await api<{ receipt: { purposes: NonNullable<typeof purposes> } }>("POST", "/api/consent", { quoteId: id, lang, purposes: { kyc: true, service: true, marketing: purposes?.marketing ?? false, digilocker: true } });
        setPurposes(r.receipt.purposes);
      }
      // a full-page navigation on purpose: this is an API redirect to DigiLocker, not a Next.js page
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/digilocker/start?quoteId=${id}&slot=${slot}`);
    } catch { toast.error(t("error_generic")); setBusy(false); }
  }
  async function attachSet() {
    setBusy(true);
    for (const slot of SLOTS) {
      try { const r = await api<{ kyc: KycView; quote: QuoteView }>("POST", `/api/kyc/${id}`, { action: "specimen", applicant: set, slot }); setK(r.kyc); setQ(r.quote); } catch { /* this applicant has no document for this slot (e.g. K05 has no Udyam certificate) */ }
    }
    setBusy(false);
  }

  if (!k || !q) return <CustomerShell step={5}><div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-52" /></div></CustomerShell>;

  const gstDeclared = q.quote.profile.gstin.has;
  const gstBlocked = k.checks.some((c) => ["GSTIN_CANCELLED", "GSTIN_SUSPENDED", "GSTIN_NOT_FOUND"].includes(c.code)) && !k.requeued;
  const visible = (s: Slot) => !!k.docs[s] || k.neededSlots.includes(s) || (s === "gst_certificate" && gstDeclared && !k.gstEligible && !k.requeued);
  const ready = ["verified", "approved", "review"].includes(k.status) && q.issues.length === 0 && !gstBlocked;
  const checks = k.checks;
  const ORDER: Slot[] = ["gst_certificate", "udyam_certificate", "signatory_id", "address_proof"]; // the ID first: it is what DigiLocker fills
  const shown = ORDER.filter(visible);
  const showFast = dlLive && shown.some((s) => !k.docs[s]);
  const toGo = shown.filter((s) => !k.docs[s]).length;
  // checks that no card on screen already explains (cards show their own problems, so this never repeats them)
  const loose = checks.filter((c) => c.severity !== "info" && !(c.slot && shown.includes(c.slot)));

  return (
    <CustomerShell step={5}>
      <div className="space-y-4 pb-28">
        <div><h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{t("kyc_title")}</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{toGo > 0
            ? ((lang === "hi" || lang === "mr") ? `${toGo} दस्तावेज़ बाकी। सबसे तेज़ तरीका: DigiLocker (लगभग एक मिनट)।` : `${toGo} ${toGo === 1 ? "document" : "documents"} to go. The fastest way is DigiLocker (about a minute).`)
            : k.status === "verified" || k.review?.decision === "approved" ? ((lang === "hi" || lang === "mr") ? "सब कुछ सत्यापित है। आगे बढ़ें।" : "Everything is verified. You can continue.")
            : k.status === "review" ? ((lang === "hi" || lang === "mr") ? "सारे दस्तावेज़ मिल गए। एक समीक्षक उन्हें देखेगा। आप आगे बढ़ सकते हैं।" : "All documents are in. A reviewer will look at them. You can still continue.")
            : t("kyc_sub")}</p></div>

        {k.review && (
          <Card className={`p-3 text-sm ${k.review.decision === "approved" ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}>
            <div className="font-semibold">{t("decision_by")}: {t(k.review.decision)}</div>{k.review.note && <p className="mt-0.5 text-xs text-muted-foreground">“{k.review.note}” — {k.review.by}</p>}
          </Card>
        )}

        {/* 1. lookups beat uploads */}
        {(gstDeclared || k.gstName) && (
          <Card className="space-y-3 p-3.5">
            <div className="text-sm font-semibold">{t("gstin")}</div>
            <div className="flex gap-2">
              <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15))} placeholder="22AAAAA0000A1Z5" aria-label={t("gstin")} className="font-mono" maxLength={15} />
              <Button disabled={busy || gstin.length !== 15} className="gap-1.5" onClick={() => post({ action: "lookup", gstin })}><Search className="size-3.5" />{t("lookup")}</Button>
            </div>
            {persona?.gstin && !k.gstName && <Button variant="ghost" size="sm" onClick={() => setGstin(persona.gstin!)}>{(lang === "hi" || lang === "mr") ? "डेमो GSTIN भरें" : "Fill demo GSTIN"}</Button>}
            {k.gstName && (
              <div className="rounded-lg bg-secondary p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2"><div className="font-medium">{k.gstName}</div><Badge variant={k.gstStatus === "Active" ? "default" : "destructive"}>{k.gstStatus}</Badge></div>
                <div className="font-mono text-xs text-muted-foreground">{k.gstinMasked}</div>
                {k.gstEligible && <div className="mt-1 flex items-center gap-1 text-xs text-success"><BadgeCheck className="size-3.5" />{t("verified_gst")}</div>}
              </div>
            )}
          </Card>
        )}

        <Card className="space-y-3 p-3.5">
          <div className="flex items-center justify-between"><Label htmlFor="u-claim" className="text-sm font-semibold">{t("have_udyam")}</Label><Switch id="u-claim" checked={k.claimsUdyam} onCheckedChange={(c) => post({ action: "claims", claimsUdyam: !!c })} /></div>
          {k.claimsUdyam && (
            <>
              <div className="flex gap-2"><Input value={udyam} onChange={(e) => setUdyam(e.target.value.toUpperCase())} placeholder="UDYAM-MH-00-0000000" aria-label={t("udyam")} className="font-mono" /><Button disabled={busy || udyam.length < 18} onClick={() => post({ action: "lookup", udyam })}>{t("lookup")}</Button></div>
              {persona?.udyam && !k.udyamName && <Button variant="ghost" size="sm" onClick={() => setUdyam(persona.udyam!)}>{(lang === "hi" || lang === "mr") ? "डेमो उद्यम भरें" : "Fill demo Udyam"}</Button>}
              {k.udyamName && <div className="flex items-center gap-1 text-xs text-success"><BadgeCheck className="size-3.5" />{k.udyamName}</div>}
            </>
          )}
        </Card>

        {/* GST can't be used → live re-quote */}
        {gstBlocked && (
          <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-3.5">
            <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="size-4 text-destructive" />{t("requote_title")}</div>
            <p className="text-sm">{t("requote_body")}</p>
            <Button onClick={() => post({ action: "requote" })} disabled={busy}>{(lang === "hi" || lang === "mr") ? "GST प्रोडक्ट के बिना आगे बढ़ें" : "Continue without GST products"}</Button>
          </Card>
        )}
        {k.requeued && removed.length > 0 && (
          <Card className="space-y-1 border-success/40 bg-success/5 p-3.5 text-sm">
            <div className="font-semibold">{t("removed_items")}:</div>
            <ul className="list-disc pl-5 text-xs">{removed.map((r) => <li key={r.productId}>{plainName(r.productId, lang)}</li>)}</ul>
            <div className="pt-1">{t("price_now")}: <b>{inr(q.pricing.monthly)}</b> {t("per_month")} <span className="text-xs text-muted-foreground">{t("gst_extra")}</span></div>
          </Card>
        )}

        {/* fastest route: DigiLocker for identity, EntityLocker for the business's own registrations */}
        {showFast && (
          <Card className="space-y-3 border-primary/30 bg-accent/40 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><ShieldCheck className="size-5" aria-hidden /></span>
              <div className="min-w-0"><div className="font-bold">{(lang === "hi" || lang === "mr") ? "तेज़ी से सत्यापित करें — फ़ोटो की ज़रूरत नहीं" : "Verify faster, no photos needed"}</div>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {((lang === "hi" || lang === "mr") ? ["DigiLocker में लॉगिन करें", "जो साझा करना है चुनें", "यहाँ लौट आएँ, बस"] : ["Log in to DigiLocker", "Choose what to share", "You land back here, done"]).map((x) => <li key={x}>{x}</li>)}
                </ol>
                <p className="mt-1 text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "हम सिर्फ़ ज़रूरी जानकारी रखते हैं।" : "We keep only what verification needs."}</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {SLOTS.filter(visible).some((s) => (s === "signatory_id" || s === "address_proof") && !k.docs[s]) && (
                <Button className="gap-2" disabled={busy} onClick={() => startLocker("signatory_id")}><ShieldCheck className="size-4" aria-hidden />{(lang === "hi" || lang === "mr") ? "DigiLocker से आधार लाएँ" : "Fetch Aadhaar from DigiLocker"}</Button>
              )}
              {(["gst_certificate", "udyam_certificate"] as Slot[]).filter((s) => visible(s) && !k.docs[s]).map((s) => (
                <Button key={s} variant="outline" className="gap-2" disabled={busy} onClick={() => startLocker(s)}><Landmark className="size-4" aria-hidden />{s === "gst_certificate" ? "Fetch GST from EntityLocker" : "Fetch Udyam from EntityLocker"}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "या नीचे फ़ोटो/PDF अपलोड करें, या आधार ऑफ़लाइन e-KYC ZIP दें।" : "Or upload a photo or PDF below, or use an Aadhaar offline e-KYC ZIP."}</p>
          </Card>
        )}

        {/* someone else holds the papers? send them a link */}
        <DelegateCard quoteId={id} missing={shown.filter((s) => !k.docs[s])} onChanged={refreshKyc} />

        {/* 2. only the documents still needed */}
        <section className="space-y-3">
          {shown.map((s) => (
            <DocSlot key={s} slot={s} doc={k.docs[s]} checks={checks} busy={busy} quiet={showFast} onFile={(f) => upload(s, f)}
              onAadhaar={s === "signatory_id" || s === "address_proof" ? (f, phrase) => aadhaar(s, f, phrase) : undefined}
              onDigilocker={dlLive ? () => startLocker(s) : undefined} digilockerLabel={s === "gst_certificate" || s === "udyam_certificate" ? "EntityLocker" : "DigiLocker"} />
          ))}
          {SLOTS.filter(visible).length === 0 && k.status === "verified" && <Card className="flex flex-row items-center gap-2 p-3.5 text-sm text-success"><BadgeCheck className="size-4" />{t("kyc_ok")}</Card>}
        </section>

        {/* demo: attach any supplied specimen set (K01–K12) to see each planted problem */}
        <Collapse title={(lang === "hi" || lang === "mr") ? "डेमो: नमूना दस्तावेज़ आज़माएँ" : "Demo: try sample documents"}>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FlaskConical className="size-3.5" />{t("sample_hint")}</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select aria-label="Sample document set" value={set} onChange={(e) => setSet(e.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-base">{SAMPLE_SETS.map((s) => <option key={s} value={s}>{s === "D01" ? "D01 · Sharma Medical Store (demo)" : s}</option>)}</select>
            <Button variant="outline" disabled={busy} onClick={attachSet}>{(lang === "hi" || lang === "mr") ? "सेट जोड़ें" : "Attach set"}</Button>
          </div>
        </Collapse>

        {/* 3. the verdict, with reasons */}
        {loose.length > 0 && (
          <section className="space-y-2"><h2 className="flex items-center gap-2 text-sm font-semibold">{(lang === "hi" || lang === "mr") ? "और ध्यान देने की बातें" : "Also needs attention"}</h2><CheckList checks={loose} /></section>
        )}
        {k.status === "review" && !k.review && <Card className="bg-info/5 p-3 text-sm">{t("kyc_review_note")}</Card>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card"><div className="mx-auto max-w-xl space-y-1 px-4 py-3">
        {!ready && <p className="text-center text-xs text-muted-foreground">{toGo > 0 ? ((lang === "hi" || lang === "mr") ? "आगे बढ़ने के लिए ऊपर के दस्तावेज़ जोड़ें।" : "Add the documents above to continue.") : t("kyc_not_ready")}</p>}
        <Button size="lg" className="w-full" disabled={!ready || busy} onClick={() => router.push(`/order/${id}/checkout`)}>{t("kyc_continue")}</Button>
      </div></div>
    </CustomerShell>
  );
}
