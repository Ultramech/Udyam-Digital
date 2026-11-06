"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";
import { api, ApiError } from "@/lib/client/api";

/** Only same-site paths are accepted for ?next= (no open redirects). */
const next = () => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : "/"; };
/** First sign-in (= sign-up) goes through the short profile setup, then back to where they were. */
const dest = (onboarded: boolean) => (onboarded ? next() : `/account/setup?next=${encodeURIComponent(next())}`);

const WAIT = 30;
/** One-click demo account (server refuses it when DEMO_MODE=false). */
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
const pretty = (p: string) => `${p.slice(0, 5)} ${p.slice(5)}`;

/** Sign in or sign up with a mobile number: number, then the 6-digit SMS code, on one screen. The same step creates a new account. */
function Login() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const router = useRouter();
  const { account, refresh } = useVerify();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const otpId = useRef<string | null>(null);

  useEffect(() => { if (account) router.replace(dest(account.onboarded)); }, [account, router]);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const [demoBusy, setDemoBusy] = useState(false);
  async function tryDemo() {
    setDemoBusy(true); setErr(null);
    try { await api("POST", "/api/demo/signin"); await refresh(); }
    catch { setErr(H("The demo isn't available right now. Please try again.", "डेमो अभी उपलब्ध नहीं है। फिर कोशिश करें।")); setDemoBusy(false); }
  }

  const valid = /^[6-9]\d{9}$/.test(phone);
  async function send() {
    if (!valid) { setErr(H("Enter a valid 10-digit mobile number.", "10 अंकों का सही मोबाइल नंबर डालें।")); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<{ otpId: string }>("POST", "/api/otp", { phone });
      otpId.current = r.otpId; setSent(true); setCode(""); setWait(WAIT);
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      setErr(c === "OTP_TOO_SOON" ? H("Please wait 30 seconds before asking for another code.", "दूसरा कोड माँगने से पहले 30 सेकंड रुकें।")
        : c === "OTP_LIMIT" ? H("Too many codes requested. Try again in an hour.", "बहुत ज़्यादा कोड माँगे गए। एक घंटे बाद कोशिश करें।")
        : H("We couldn't send the code. Please try again.", "कोड नहीं भेज पाए। फिर कोशिश करें।"));
    }
    setBusy(false);
  }
  const check = useCallback(async (c: string) => {
    if (!otpId.current) { setSent(false); return; }
    setBusy(true); setErr(null);
    try { await api("PUT", "/api/otp", { otpId: otpId.current, code: c }); await refresh(); }
    catch (e) {
      const k = e instanceof ApiError ? e.code : "";
      if (k === "OTP_EXPIRED" || k === "OTP_ATTEMPTS") { setSent(false); setCode(""); setErr(H("That code expired. Ask for a new one.", "वह कोड एक्सपायर हो गया। नया कोड माँगें।")); }
      else { setErr(k === "WRONG_OTP" ? H("That code isn't right. Check the SMS and try again.", "कोड सही नहीं है। SMS देखकर फिर कोशिश करें।") : H("Something went wrong. Try again.", "कुछ गड़बड़ हुई। फिर कोशिश करें।")); setCode(""); }
    }
    setBusy(false);
  }, [refresh, hi]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto w-full max-w-md pt-4 md:pt-12">
      <h1 className="text-[1.875rem] font-extrabold leading-tight tracking-tight">{sent ? H("Enter the code", "कोड डालें") : H("Sign in or create an account", "साइन इन करें या अकाउंट बनाएँ")}</h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        {sent ? <>{H("We sent a 6-digit code to", "6 अंकों का कोड भेजा गया")} <span className="num font-semibold text-foreground">+91 {pretty(phone)}</span></> : H("Your mobile number is all it takes. We text you a code, no password to remember.", "बस आपका मोबाइल नंबर चाहिए। हम कोड SMS करते हैं, पासवर्ड याद नहीं रखना।")}
      </p>

      {!sent ? (
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="login-phone">{H("Mobile number", "मोबाइल नंबर")}</Label>
            <div className="flex gap-2">
              <span className="flex h-12 items-center rounded-xl border border-input bg-muted px-3.5 text-base font-semibold" aria-hidden>+91</span>
              <Input id="login-phone" inputMode="numeric" autoComplete="tel-national" autoFocus maxLength={10} placeholder="98765 43210" value={phone} aria-invalid={!!err}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setErr(null); }} className="num text-lg tracking-wide" />
            </div>
          </div>
          {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || phone.length < 10}>{busy ? H("Sending…", "भेज रहे हैं…") : H("Send code", "कोड भेजें")}</Button>
        </form>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) check(code); }}>
          <div className="space-y-1.5">
            <Label htmlFor="login-code">{H("6-digit code", "6 अंकों का कोड")}</Label>
            <Input id="login-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="••••••" value={code} aria-invalid={!!err}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); setErr(null); if (v.length === 6) check(v); }} className="num h-14 text-center text-2xl tracking-[0.5em]" />
          </div>
          {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>{busy ? H("Checking…", "जाँच हो रही है…") : H("Verify and continue", "वेरिफाई करें और आगे बढ़ें")}</Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setSent(false); setCode(""); setErr(null); }} className="inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline"><Pencil className="size-4" />{H("Change number", "नंबर बदलें")}</button>
            <button type="button" disabled={wait > 0 || busy} onClick={send} className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline">
              {wait > 0 ? <span className="num">{H(`Resend in ${wait}s`, `${wait} सेकंड में दोबारा भेजें`)}</span> : H("Resend code", "कोड दोबारा भेजें")}
            </button>
          </div>
        </form>
      )}

      {DEMO && !sent && (
        <div className="mt-5">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span className="h-px flex-1 bg-border" />{H("or", "या")}<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" size="lg" variant="outline" className="mt-4 w-full" disabled={demoBusy} onClick={tryDemo}>
            <PlayCircle className="size-5 text-primary" />{demoBusy ? H("Opening demo…", "डेमो खुल रहा है…") : H("Try the demo, no sign-in needed", "डेमो देखें, साइन इन की ज़रूरत नहीं")}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">{H("Opens a sample account for a pharmacy in Indore.", "इंदौर की एक फ़ार्मेसी का सैंपल अकाउंट खुलता है।")}</p>
        </div>
      )}

      <ul className="mt-8 space-y-2.5 border-t pt-6 text-sm text-muted-foreground">
        {[H("A real SMS code. Nobody else can sign in as you.", "असली SMS कोड। आपकी जगह कोई और साइन इन नहीं कर सकता।"), H("Your plans and orders follow you to any phone.", "आपके प्लान और ऑर्डर किसी भी फ़ोन पर दिखेंगे।"), H("Download or delete your data any time from Account.", "अकाउंट से कभी भी अपना डेटा डाउनलोड या डिलीट करें।")].map((x) => (
          <li key={x} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{x}</li>
        ))}
      </ul>
      <p className="mt-6 text-center"><Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{H("Back to home", "होम पर वापस")}</Link></p>
    </div>
  );
}

export default function LoginPage() { return <CustomerShell><Login /></CustomerShell>; }
