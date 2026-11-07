"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitch } from "@/components/customer/app-nav";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";
import { AuthScreen, BackButton, Flag, Wordmark } from "@/components/start/parts";
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
  const [mode, setMode] = useState<"login" | "signup">("login");
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

  const title = sent ? H("Enter the code", "कोड डालें") : mode === "login" ? H("Log in to your Business Account", "अपने बिज़नेस अकाउंट में लॉग इन करें") : H("Create your Business Account", "अपना बिज़नेस अकाउंट बनाएँ");
  const sub = sent
    ? <>{H("We sent a 6-digit code to", "6 अंकों का कोड भेजा गया")} <span className="num font-semibold text-foreground">+91 {pretty(phone)}</span></>
    : mode === "login" ? H("Access your business dashboard, orders and support.", "अपना बिज़नेस डैशबोर्ड, ऑर्डर और सपोर्ट देखें।") : H("Enter your mobile number. We text you a code, no password to remember.", "अपना मोबाइल नंबर डालें। हम कोड SMS करते हैं, पासवर्ड याद नहीं रखना।");
  const field = "flex h-14 items-center gap-3 rounded-2xl border bg-card px-4 shadow-card focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25";

  return (
    <AuthScreen>
      <div className="flex items-center justify-between">
        <BackButton label={H("Back", "पीछे")} onClick={() => (sent ? (setSent(false), setCode(""), setErr(null)) : router.push("/"))} />
        <LanguageSwitch />
      </div>
      <div className="mt-4 flex justify-center"><Wordmark /></div>
      <h1 className="mt-10 text-[1.875rem] font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mt-2 text-[1.0625rem] leading-snug text-foreground/70">{sub}</p>

      {!sent ? (
        <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="login-phone" className="sr-only">{H("Mobile number", "मोबाइल नंबर")}</label>
          <div className={field}>
            <Flag /><span className="text-base font-semibold" aria-hidden>+91</span><span aria-hidden className="h-6 w-px bg-border" />
            <input id="login-phone" inputMode="numeric" autoComplete="tel-national" autoFocus maxLength={10} placeholder={H("Enter mobile number", "मोबाइल नंबर डालें")} value={phone} aria-invalid={!!err}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setErr(null); }} className="num min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground" />
          </div>
          {err && <p role="alert" className="px-1 text-sm font-medium text-destructive">{err}</p>}
          <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-lg shadow-lift" disabled={busy || phone.length < 10}>{busy ? H("Sending…", "भेज रहे हैं…") : H("Send OTP", "OTP भेजें")}</Button>
        </form>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) check(code); }}>
          <label htmlFor="login-code" className="sr-only">{H("6-digit code", "6 अंकों का कोड")}</label>
          <div className={field + " h-16 justify-center"}>
            <input id="login-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} placeholder="••••••" value={code} aria-invalid={!!err}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); setErr(null); if (v.length === 6) check(v); }} className="num w-full bg-transparent text-center text-2xl font-semibold tracking-[0.5em] outline-none" />
          </div>
          {err && <p role="alert" className="px-1 text-sm font-medium text-destructive">{err}</p>}
          <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-lg shadow-lift" disabled={busy || code.length < 6}>{busy ? H("Checking…", "जाँच हो रही है…") : H("Verify and continue", "वेरिफाई करें और आगे बढ़ें")}</Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setSent(false); setCode(""); setErr(null); }} className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">{H("Change number", "नंबर बदलें")}</button>
            <button type="button" disabled={wait > 0 || busy} onClick={send} className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline">
              {wait > 0 ? <span className="num">{H(`Resend in ${wait}s`, `${wait} सेकंड में दोबारा भेजें`)}</span> : H("Resend code", "कोड दोबारा भेजें")}
            </button>
          </div>
        </form>
      )}

      {DEMO && !sent && (
        <div className="mt-6">
          <div className="flex items-center gap-4 text-sm text-muted-foreground"><span className="h-px flex-1 bg-border" />{H("or", "या")}<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" size="lg" variant="outline" className="mt-5 h-14 w-full rounded-2xl text-base shadow-card" disabled={demoBusy} onClick={tryDemo}>
            <PlayCircle className="size-5 text-primary" />{demoBusy ? H("Opening demo…", "डेमो खुल रहा है…") : H("Try the demo, no sign-in needed", "डेमो देखें, साइन इन की ज़रूरत नहीं")}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">{H("Opens a sample account for a pharmacy in Indore.", "इंदौर की एक फ़ार्मेसी का सैंपल अकाउंट खुलता है।")}</p>
        </div>
      )}

      {!sent && (
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          {[H("A real SMS code. Nobody else can sign in as you.", "असली SMS कोड। आपकी जगह कोई और साइन इन नहीं कर सकता।"), H("Download or delete your data any time from Account.", "अकाउंट से कभी भी अपना डेटा डाउनलोड या डिलीट करें।")].map((x) => (
            <li key={x} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{x}</li>
          ))}
        </ul>
      )}

      {!sent && (
        <p className="mt-auto pt-8 text-center text-[0.9375rem] text-foreground/70">
          {mode === "login" ? H("New to Airtel SYNC?", "Airtel SYNC में नए हैं?") : H("Already have an account?", "पहले से अकाउंट है?")}{" "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(null); }} className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
            {mode === "login" ? H("Create Account", "अकाउंट बनाएँ") : H("Log in", "लॉग इन करें")}
          </button>
        </p>
      )}
    </AuthScreen>
  );
}

export default function LoginPage() { return <CustomerShell><Login /></CustomerShell>; }
