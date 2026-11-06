"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";

/** Only same-site paths are accepted for ?next= (no open redirects). */
const next = () => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") ? n : "/account"; };
/** First sign-in (= sign-up) goes through the short profile setup, then back to where they were. */
const dest = (onboarded: boolean) => (onboarded ? next() : `/account/setup?next=${encodeURIComponent(next())}`);

/** Sign in with your mobile number (SMS code). New numbers get an account automatically. ?next= returns you where you were. */
function Login() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const router = useRouter();
  const { account, ensureVerified } = useVerify();
  useEffect(() => { if (account) router.replace(dest(account.onboarded)); }, [account, router]);
  return (
    <div className="space-y-5 pt-6">
      <div className="space-y-1 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><Smartphone className="size-6" /></span>
        <h1 className="pt-2 text-2xl font-bold">{hi ? "साइन इन करें या अकाउंट बनाएँ" : "Sign in or create an account"}</h1>
        <p className="text-sm text-muted-foreground">{hi ? "अपना मोबाइल नंबर डालें — हम एक कोड SMS करेंगे। पासवर्ड की ज़रूरत नहीं।" : "Enter your mobile number and we'll text you a code. New here? The same step creates your account — no password needed."}</p>
      </div>
      <Button size="lg" className="w-full" onClick={() => ensureVerified()}>{hi ? "मोबाइल नंबर से जारी रखें" : "Continue with mobile number"}</Button>
      <Card className="flex gap-2.5 p-3.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <span>{hi ? "आपके ऑर्डर, प्लान और बिज़नेस किसी भी फ़ोन पर दिखेंगे। आप कभी भी अपना डेटा डाउनलोड या डिलीट कर सकते हैं।" : "Your orders, plans and businesses follow you to any phone. You can download or delete your data at any time from My account."}</span>
      </Card>
      <p className="text-center text-xs text-muted-foreground">{hi ? "बिना साइन इन के भी प्लान देख सकते हैं — सिर्फ़ ऑर्डर करते समय नंबर चाहिए।" : "You can explore plans without signing in — we only need your number to save or order."}</p>
    </div>
  );
}

export default function LoginPage() { return <CustomerShell><Login /></CustomerShell>; }
