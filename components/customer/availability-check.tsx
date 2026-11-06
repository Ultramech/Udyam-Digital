"use client";
import Link from "next/link";
import { useState } from "react";
import { MapPin, Wifi, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { api, ApiError } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

interface Result { pincode: string; fibre: boolean; basis: "ops_coverage" | "post_office" | "policy"; confirmed: boolean; area: { district: string; state: string } | null; fallback: { name: string; priceFrom: number } | null }

/** Answers "can I even get this where I am?" before any questions — from the same feasibility layers the order flow uses. */
export function AvailabilityCheck({ lang }: { lang: string }) {
  const hi = lang === "hi" || lang === "mr";
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [r, setR] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function check() {
    setBusy(true); setErr(null); setR(null);
    try { setR(await api<Result>("GET", `/api/availability?pincode=${pin}`)); }
    catch (e) { setErr(e instanceof ApiError && e.status === 400 ? (hi ? "6 अंकों का पिनकोड डालें।" : "Enter a 6-digit pincode.") : (hi ? "अभी जाँच नहीं हो पाई — दोबारा कोशिश करें।" : "Couldn't check just now — please try again.")); }
    setBusy(false);
  }
  const basis = (b: Result["basis"], confirmed: boolean) =>
    confirmed ? (hi ? "हमारी नेटवर्क टीम से पुष्ट" : "Confirmed by our network team")
      : b === "post_office" ? (hi ? "डाक पिनकोड डेटा पर आधारित अनुमान — इंस्टॉलेशन से पहले इंजीनियर पक्का करेंगे" : "Estimate from postal-area data — an engineer confirms before install")
        : (hi ? "अनुमान — इंस्टॉलेशन से पहले पक्का होगा" : "Estimate — confirmed before install");

  return (
    <Card className="space-y-3 p-4" aria-labelledby="avail-h">
      <div className="flex items-center gap-2"><MapPin className="size-4" /><h2 id="avail-h" className="text-[0.9375rem] font-bold">{t("home_check_title")}</h2></div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (pin.length === 6) check(); }}>
        <Input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder={t("home_check_ph")} aria-label={hi ? "पिनकोड" : "Pincode"} />
        <Button type="submit" disabled={busy || pin.length !== 6}>{busy ? "…" : t("home_check_btn")}</Button>
      </form>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      {r && (
        <div className="space-y-1.5 text-sm" role="status">
          <div className="flex items-start gap-2">
            {r.fibre ? <Wifi className="mt-0.5 size-4 shrink-0 text-success" /> : <Radio className="mt-0.5 size-4 shrink-0 text-warning" />}
            <div>
              <div className="font-medium">
                {r.fibre ? (hi ? "फ़ाइबर मिलने की संभावना है" : "Fibre is likely at this pincode") : (hi ? "इस पिनकोड पर फ़ाइबर की संभावना कम है" : "Fibre is unlikely at this pincode")}
                {r.area ? <span className="font-normal text-muted-foreground"> · {r.area.district}, {r.area.state}</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">{basis(r.basis, r.confirmed)}</div>
            </div>
          </div>
          {r.fallback && <p className="text-xs text-muted-foreground">{hi ? `ऐसे में वायरलेस विकल्प: ${r.fallback.name}, ${inr(r.fallback.priceFrom)}/माह से (आपके शहर में उपलब्धता सलाहकार जाँचेगा)।` : `Wireless alternative: ${r.fallback.name}, from ${inr(r.fallback.priceFrom)}/month (the advisor checks it's offered in your city).`}</p>}
          <Link href="/advisor" className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">{hi ? "अपना प्लान बनवाएँ →" : "Get my plan →"}</Link>
        </div>
      )}
    </Card>
  );
}
