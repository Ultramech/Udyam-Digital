"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, PenLine, QrCode, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { LinesList } from "@/components/customer/bundle-card";
import { useVerify } from "@/components/customer/verify";
import { bundleName } from "@/lib/i18n/bundles";
import { getPersona } from "@/lib/demo/personas";
import { api, ApiError, readJourney, writeJourney } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";
import type { QuoteView } from "@/lib/client/types";
import { splitFirstPayment } from "@/lib/payments/deposit";
import { cn } from "@/lib/utils";

interface RzOrder { enabled?: boolean; test?: boolean; keyId?: string; razorpayOrderId?: string; amount?: number; currency?: string }
function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => resolve(); s.onerror = () => reject(new Error("razorpay_script"));
    document.body.appendChild(s);
  });
}
type Phase = "review" | "signed" | "failed" | "pending";

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const router = useRouter();
  const { ensureVerified } = useVerify();
  const [q, setQ] = useState<QuoteView | null>(null);
  const [name, setName] = useState("");
  const [order, setOrder] = useState<{ id: string; token: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [busy, setBusy] = useState(false);
  const [rzTest, setRzTest] = useState(false);
  const [plan, setPlan] = useState<"full" | "deposit">("full");
  const [signStep, setSignStep] = useState<"idle" | "prepared" | "sent">("idle");
  const [agreed, setAgreed] = useState(false);
  const [signCode, setSignCode] = useState("");
  const [signOtpId, setSignOtpId] = useState<string | null>(null);
  const [docHash, setDocHash] = useState<string | null>(null);

  useEffect(() => {
    api<{ services: { id: string; mode: string; detail: string }[] }>("GET", "/api/status").then((r) => {
      const p = r.services.find((x) => x.id === "payments");
      setRzTest(p?.mode === "live" && /TEST/.test(p.detail));
    }).catch(() => {});
    api<QuoteView>("GET", `/api/quote/${id}`).then((r) => {
      setQ(r);
      const p = getPersona(r.quote.attribution.source?.startsWith("demo:") ? r.quote.attribution.source.slice(5) : undefined);
      if (p) setName(p.title.en.split(" · ")[1] ?? "");
      if (r.quote.orderId) { // resume: only treat as signed if the server says the order really carries a signature
        const j = readJourney().orders.find((x) => x.id === r.quote.orderId);
        if (j) {
          setOrder({ id: j.id, token: j.token });
          api<{ order: { esign?: unknown } }>("GET", `/api/orders/${j.id}?t=${j.token}`).then((v) => { if (v.order.esign) setPhase("signed"); }).catch(() => {});
        }
      }
    }).catch(() => toast.error(t("error_generic")));
  }, [id, t]);

  const explain = (e: unknown) => {
    const code = e instanceof ApiError ? e.code : "";
    const m: Record<string, string> = {
      KYC_INCOMPLETE: (lang === "hi" || lang === "mr") ? "पहले KYC की बातें ठीक करें।" : "Please finish the KYC checks first.", NEEDS_SPECIALIST: (lang === "hi" || lang === "mr") ? "इसके लिए विशेषज्ञ चाहिए — हम आपको कॉल करेंगे।" : "This needs a specialist — we'll call you.",
      SITES_NOT_CHECKED: (lang === "hi" || lang === "mr") ? "पहले लोकेशन जाँचें।" : "Please check your locations first.", CONSENT_REQUIRED: t("consent_needed"), QUOTE_INVALID: (lang === "hi" || lang === "mr") ? "प्लान में बदलाव ज़रूरी है।" : "Your plan needs a change before you can order.",
      PRICE_CHANGED: (lang === "hi" || lang === "mr") ? "इस प्लान की कीमत अभी बदली है। नई कीमत दिखा रहे हैं — कृपया देखकर आगे बढ़ें।" : "The price of this plan just changed. We're showing the new price — please review it before continuing.",
    };
    toast.error(m[code] ?? t("error_generic"));
    if (code === "PRICE_CHANGED") api<QuoteView>("GET", `/api/quote/${id}`).then(setQ).catch(() => {});
  };

  async function ensureOrder() {
    if (order) return order;
    const r = await api<{ orderId: string; token: string }>("POST", "/api/orders", { quoteId: id, businessName: name.trim(), lang, expectedMonthly: q?.pricing.monthly, expectedSetup: q?.pricing.setup });
    const o = { id: r.orderId, token: r.token };
    setOrder(o);
    const j = readJourney();
    writeJourney({ orders: [{ id: o.id, token: o.token, name: name.trim() }, ...j.orders.filter((x) => x.id !== o.id)] });
    return o;
  }
  /** Step 1: create the order and build the exact document the owner will sign. */
  async function prepareDoc() {
    if (name.trim().length < 2) { toast.error((lang === "hi" || lang === "mr") ? "बिज़नेस का नाम डालें।" : "Please enter your business name."); return; }
    if (!(await ensureVerified())) return;
    setBusy(true);
    try {
      const o = await ensureOrder();
      const r = await api<{ docHash: string }>("POST", `/api/orders/${o.id}/esign`, { t: o.token, step: "prepare" });
      setDocHash(r.docHash); setSignStep("prepared");
    } catch (e) { explain(e); }
    setBusy(false);
  }
  /** Step 2: text a one-time code to the verified phone, bound to this document's hash. */
  async function sendSignCode() {
    if (!order) return;
    setBusy(true);
    try {
      const r = await api<{ otpId: string }>("POST", `/api/orders/${order.id}/esign`, { t: order.token, step: "send" });
      setSignOtpId(r.otpId); setSignStep("sent");
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast.error(c === "OTP_TOO_SOON" ? "Please wait 30 seconds before asking for another code." : c === "OTP_LIMIT" ? "Too many codes requested. Try again later." : t("error_generic"));
    }
    setBusy(false);
  }
  /** Step 3: the code proves the owner agreed; the server signs the document and issues the certificate. */
  async function confirmSign() {
    if (!order || !signOtpId) return;
    setBusy(true);
    try {
      await api("PUT", `/api/orders/${order.id}/esign`, { t: order.token, otpId: signOtpId, code: signCode, agreed: true });
      setPhase("signed");
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      if (c === "WRONG_OTP") toast.error("That code isn't right");
      else if (c === "OTP_EXPIRED" || c === "OTP_ATTEMPTS") { setSignStep("prepared"); setSignCode(""); toast.error("That code expired. Request a new one."); }
      else explain(e);
    }
    setBusy(false);
  }

  async function pay() {
    const o = order ?? (() => { const j = readJourney().orders[0]; return j ? { id: j.id, token: j.token } : null; })();
    if (!o) return;
    setBusy(true);
    try {
      // Real Razorpay. The amount is computed on the server; the browser only opens Checkout and returns the signed result.
      const rz = await api<RzOrder>("POST", `/api/orders/${o.id}/razorpay`, { t: o.token, plan });
      {
        setRzTest(!!rz.test);
        await loadRazorpay();
        await new Promise<void>((resolve) => {
          const w = window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open(): void; on(ev: string, cb: () => void): void } };
          const inst = new w.Razorpay({
            key: rz.keyId, amount: rz.amount, currency: rz.currency, order_id: rz.razorpayOrderId, name: "Accel Business",
            description: q ? bundleName(q.quote.bundleId, lang) : "Order", theme: { color: "#e40000" },
            handler: async (resp: Record<string, string>) => {
              try {
                await api("PUT", `/api/orders/${o.id}/razorpay`, { t: o.token, ...resp });
                router.push(`/track/${o.id}?t=${o.token}&new=1`);
              } catch (e) { setPhase("failed"); explain(e); }
              resolve();
            },
            modal: { ondismiss: () => resolve() },
          });
          inst.on("payment.failed", () => { setPhase("failed"); });
          inst.open();
        });
        setBusy(false);
        return;
      }
    } catch (e) { explain(e); }
    setBusy(false);
  }
  if (!q) return <CustomerShell step={6}><Skeleton className="h-96" /></CustomerShell>;
  const p = q.pricing;
  const split = splitFirstPayment(p.firstPayment);
  const payNow = plan === "deposit" && split.offered ? split.deposit : p.firstPayment;
  const hiL = lang === "hi" || lang === "mr";
  return (
    <CustomerShell step={6}>
      <div className="space-y-4 pb-32">
        <div><h1 className="text-xl font-bold">{t("checkout_title")}</h1><p className="text-sm text-muted-foreground">{bundleName(q.quote.bundleId, lang)} · {p.contractMonths} {t("months")}</p></div>
        <LinesList lines={q.quote.lines} />
        <Card className="space-y-1.5 p-3.5 text-sm">
          <R l={t("monthly_charge")} r={inr(p.monthly)} /><R l={`${t("gst_18")}`} r={inr(p.gstMonthly)} />
          <R l={t("setup_charges")} r={inr(p.setup)} /><R l={`${t("gst_18")} · ${t("setup_charges")}`} r={inr(p.gstSetup)} />
          <hr className="my-1" /><R l={t("total_today")} r={inr(p.firstPayment)} bold />
          <div className="pt-1 text-[11px] text-muted-foreground">{t("go_live")}: {fmtDate(q.schedule.date, lang)} · {t("indicative")}</div>
        </Card>

        <Card className="space-y-2 p-3.5">
          <Label htmlFor="bn" className="text-sm font-semibold">{t("biz_name")}</Label>
          <Input id="bn" value={name} onChange={(e) => setName(e.target.value)} disabled={phase !== "review"} maxLength={80} autoComplete="organization" />
        </Card>

        <Card className="space-y-2 p-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold"><PenLine className="size-4 text-primary" />{t("esign")}{phase !== "review" && <span className="ml-auto flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" />{t("signed")}</span>}</div>
          {phase === "review" && signStep === "idle" && (
            <>
              <p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "हम आपका ऑर्डर फ़ॉर्म PDF बनाएँगे। आप उसे पढ़कर अपने वेरिफाई किए हुए नंबर पर आए कोड से साइन करेंगे।" : "We'll prepare your order form as a PDF. You read it, then sign with a code texted to your verified number."}</p>
              <Button variant="outline" disabled={busy} onClick={prepareDoc}>{(lang === "hi" || lang === "mr") ? "फ़ॉर्म तैयार करें" : "Prepare my order form"}</Button>
            </>
          )}
          {phase === "review" && signStep !== "idle" && order && (
            <div className="space-y-2.5">
              <a className="block text-sm font-medium text-primary underline" target="_blank" rel="noreferrer" href={`/api/orders/${order.id}/esign?t=${order.token}`}>{(lang === "hi" || lang === "mr") ? "ऑर्डर फ़ॉर्म (PDF) खोलकर पढ़ें" : "Open and read the order form (PDF)"}</a>
              {docHash && <p className="break-all font-mono text-[10px] text-muted-foreground">SHA-256 {docHash}</p>}
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />{(lang === "hi" || lang === "mr") ? "मैंने फ़ॉर्म पढ़ लिया है और इस ऑर्डर के लिए सहमत हूँ।" : "I have read the order form and agree to this order."}</label>
              {signStep === "prepared" && <Button disabled={busy || !agreed} onClick={sendSignCode}>{(lang === "hi" || lang === "mr") ? "साइन करने के लिए कोड भेजें" : "Text me a code to sign"}</Button>}
              {signStep === "sent" && (
                <div className="space-y-2">
                  <Label htmlFor="signcode" className="text-xs">{t("otp_code")}</Label>
                  <Input id="signcode" inputMode="numeric" maxLength={6} value={signCode} onChange={(e) => setSignCode(e.target.value.replace(/\D/g, ""))} autoFocus />
                  <Button disabled={busy || !agreed || signCode.length < 6} onClick={confirmSign}>{(lang === "hi" || lang === "mr") ? "साइन करें" : "Sign order"}</Button>
                </div>
              )}
            </div>
          )}
          {phase !== "review" && order && <a className="block text-xs font-medium text-primary underline" target="_blank" rel="noreferrer" href={`/api/orders/${order.id}/esign?t=${order.token}&signed=1`}>{(lang === "hi" || lang === "mr") ? "साइन किया हुआ PDF और सर्टिफ़िकेट" : "Signed PDF with certificate"}</a>}
        </Card>

        {phase !== "review" && (
          <Card className="space-y-3 p-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold"><QrCode className="size-4 text-primary" />{rzTest ? ((lang === "hi" || lang === "mr") ? "ऑनलाइन भुगतान करें" : "Pay online") : t("pay_upi")}</div>
            <p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "टेस्ट मोड — असली पैसे नहीं कटेंगे। Netbanking चुनें → कोई भी बैंक → Success।" : "TEST MODE — no real money moves. Choose Netbanking → any bank → Success (or Failure to see a failed payment)."}</p>
            {split.offered && phase !== "pending" && (
              <div role="radiogroup" aria-label={hiL ? "भुगतान का तरीका" : "How to pay"} className="space-y-2">
                {([["full", hiL ? "पूरा अभी चुकाएँ" : "Pay in full now", p.firstPayment, hiL ? "सबसे सरल" : "Simplest"], ["deposit", hiL ? "अभी आरक्षित करें, बाकी सेवा चालू होने से पहले" : "Reserve now, pay the rest before go-live", split.deposit, hiL ? `बाकी ${inr(split.balance)} बाद में — कुल वही ${inr(p.firstPayment)}` : `Remaining ${inr(split.balance)} later — same ${inr(p.firstPayment)} in total`]] as const).map(([k, label, amt, sub]) => (
                  <button key={k} type="button" role="radio" aria-checked={plan === k} onClick={() => setPlan(k)} className={cn("flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-sm", plan === k ? "border-primary bg-accent" : "bg-card")}>
                    <span><span className="block font-medium">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span><span className="shrink-0 text-base font-bold">{inr(amt)}</span>
                  </button>
                ))}
                {plan === "deposit" && <p className="text-xs text-muted-foreground">{hiL ? "आपकी सेवाएँ तब चालू होंगी जब बाकी राशि ट्रैकर में चुका दी जाए। कोई अतिरिक्त शुल्क नहीं।" : "Your services switch on once the balance is paid in your tracker. No extra charge for splitting."}</p>}
              </div>
            )}
            {phase === "failed" && <div className="flex gap-2 rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive"><XCircle className="mt-0.5 size-4 shrink-0" />{t("pay_failed_msg")}</div>}
            {phase === "pending" && <div className="flex gap-2 rounded-lg bg-warning/15 p-2.5 text-sm"><Clock className="mt-0.5 size-4 shrink-0" />{t("pay_pending_msg")}</div>}
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card"><div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <div><div className="text-[11px] text-muted-foreground">{t("total_today")}</div><div className="text-xl font-extrabold leading-none">{inr(phase === "review" ? p.firstPayment : payNow)}</div></div>
        {phase === "review" ? <Button size="lg" className="flex-1" disabled variant="outline">{(lang === "hi" || lang === "mr") ? "पहले ऑर्डर साइन करें" : "Sign your order to continue"}</Button>
          : <Button size="lg" className="flex-1" disabled={busy} onClick={pay}>{phase === "failed" ? t("retry") : t("pay_now")}</Button>}
      </div></div>
    </CustomerShell>
  );
}
const R = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => <div className={`flex justify-between gap-3 ${bold ? "text-base font-bold" : ""}`}><span>{l}</span><span>{r}</span></div>;
