"use client";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, FlaskConical, Search, ShieldAlert } from "lucide-react";
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
import { CheckList, DocSlot, VerdictChip } from "@/components/customer/kyc-parts";
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
  const [dl, setDl] = useState(false); // DigiLocker configured on the server AND the owner opted into that purpose
  useEffect(() => {
    Promise.all([api<{ services: { id: string; mode: string }[] }>("GET", "/api/status"), api<{ quote: { consentId?: string } }>("GET", `/api/quote/${id}`)])
      .then(async ([st, qv]) => {
        if (st.services.find((x) => x.id === "digilocker")?.mode !== "live" || !qv.quote.consentId) return;
        const c = await api<{ receipt: { purposes: { digilocker: boolean } } }>("GET", `/api/consent?id=${qv.quote.consentId}`).catch(() => null);
        setDl(!!c?.receipt.purposes.digilocker);
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

  return (
    <CustomerShell step={5}>
      <div className="space-y-4 pb-28">
        <div><h1 className="text-xl font-bold">{t("kyc_title")}</h1><p className="text-sm text-muted-foreground">{t("kyc_sub")}</p></div>

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

        {/* 2. only the documents still needed */}
        <section className="space-y-3">
          {SLOTS.filter(visible).map((s) => (
            <DocSlot key={s} slot={s} doc={k.docs[s]} checks={checks} busy={busy} onFile={(f) => upload(s, f)}
              onSample={() => api<{ kyc: KycView; quote: QuoteView }>("POST", `/api/kyc/${id}`, { action: "specimen", applicant: set, slot: s }).then((r) => { setK(r.kyc); setQ(r.quote); }).catch(() => toast.info((lang === "hi" || lang === "mr") ? "इस सेट में यह दस्तावेज़ नहीं है।" : `Sample set ${set} has no document for this slot.`))}
              sampleLabel={`${t("use_sample")} (${set})`} digilockerHref={dl ? `/api/digilocker/start?quoteId=${id}&slot=${s}` : undefined} />
          ))}
          {SLOTS.filter(visible).length === 0 && k.status === "verified" && <Card className="flex items-center gap-2 p-3.5 text-sm text-success"><BadgeCheck className="size-4" />{t("kyc_ok")}</Card>}
        </section>

        {/* demo: attach any supplied specimen set (K01–K12) to see each planted problem */}
        <Card className="space-y-2 border-dashed p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FlaskConical className="size-3.5" />Demo · {t("sample_hint")}</div>
          <div className="flex gap-2">
            <select aria-label="Sample document set" value={set} onChange={(e) => setSet(e.target.value)} className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm">{SAMPLE_SETS.map((s) => <option key={s} value={s}>{s === "D01" ? "D01 · Sharma Medical Store (demo)" : s}</option>)}</select>
            <Button size="sm" variant="outline" disabled={busy} onClick={attachSet}>{(lang === "hi" || lang === "mr") ? "सेट जोड़ें" : "Attach set"}</Button>
          </div>
        </Card>

        {/* 3. the verdict, with reasons */}
        {checks.some((c) => c.severity !== "info") && (
          <section className="space-y-2"><h2 className="flex items-center gap-2 text-sm font-semibold">{(lang === "hi" || lang === "mr") ? "जाँच के नतीजे" : "Check results"}<VerdictChip severity={k.status === "blocked" ? "block" : k.status === "reupload" ? "reupload" : k.status === "review" ? "review" : "ok"} /></h2><CheckList checks={checks} /></section>
        )}
        {k.status === "review" && !k.review && <Card className="bg-info/5 p-3 text-sm">{t("kyc_review_note")}</Card>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card"><div className="mx-auto max-w-xl space-y-1 px-4 py-3">
        {!ready && <p className="text-center text-[11px] text-muted-foreground">{t("kyc_not_ready")}</p>}
        <Button size="lg" className="w-full" disabled={!ready || busy} onClick={() => router.push(`/order/${id}/checkout`)}>{t("kyc_continue")}</Button>
      </div></div>
    </CustomerShell>
  );
}
