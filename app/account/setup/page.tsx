"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";
import { api, ApiError } from "@/lib/client/api";
import { PROFILE_TYPES, type ProfileType } from "@/lib/i18n/profile";
import { profileError } from "@/lib/i18n/profileErrors";
import { BUSINESS_TYPE_NAMES, OTHER, SERVED_CITIES, setupErrors, type SetupInput } from "@/lib/accounts/profileRules";
import { cn } from "@/lib/utils";

const safeNext = () => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/account/setup") ? n : "/advisor"; };
const STEP1 = ["name", "profileType", "email"];

/**
 * Required once after the first OTP sign-in: the app doesn't proceed until this is complete and valid.
 * Step 1 — you; step 2 — your business and its address. Every field is checked as you go and again on the server.
 */
function Setup() {
  const { lang, setLang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const router = useRouter();
  const { account, verified, refresh } = useVerify();
  const [step, setStep] = useState<1 | 2>(1);
  const [v, setV] = useState<SetupInput>({
    name: "", profileType: "owner", email: "",
    business: { name: "", type: "", typeOther: "", city: "", cityOther: "", employees: "", sites: "1", address: "", pincode: "", gstin: "", udyam: "" },
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErr, setServerErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (verified === false && !account) router.replace(`/login?next=${encodeURIComponent("/account/setup")}`);
    else if (account?.onboarded) router.replace(safeNext());
  }, [verified, account, router]);

  const errs = useMemo(() => setupErrors(v), [v]);
  const err = (k: string) => (touched[k] ? serverErr[k] ?? errs[k] : serverErr[k]);
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const setB = (patch: Partial<SetupInput["business"]>) => { setV((x) => ({ ...x, business: { ...x.business, ...patch } })); setServerErr({}); };
  const setP = (patch: Partial<SetupInput>) => { setV((x) => ({ ...x, ...patch })); setServerErr({}); };

  function next1() {
    setTouched((t) => ({ ...t, ...Object.fromEntries(STEP1.map((k) => [k, true])) }));
    if (STEP1.some((k) => errs[k])) { toast.error(H("Please fix the highlighted fields.", "कृपया लाल निशान वाले खाने ठीक करें।")); return; }
    setStep(2);
  }
  async function finish() {
    setTouched(Object.fromEntries(Object.keys({ ...errs, ...Object.fromEntries(Object.keys(v.business).map((k) => [`business.${k}`, 1])) }).map((k) => [k, true])));
    if (Object.keys(errs).length) { toast.error(H("Please fix the highlighted fields.", "कृपया लाल निशान वाले खाने ठीक करें।")); return; }
    setBusy(true);
    try {
      const r = await api<{ warnings: Record<string, string> }>("POST", "/api/me/setup", { ...v, lang });
      for (const w of Object.values(r.warnings ?? {})) toast.warning(profileError(w, lang));
      await refresh();
      toast.success(H("Your profile is ready", "आपकी प्रोफ़ाइल तैयार है"));
      router.replace(safeNext());
    } catch (e) {
      if (e instanceof ApiError && e.code === "INVALID_PROFILE") {
        const fields = (e.data.errors ?? {}) as Record<string, string>;
        setServerErr(fields);
        if (STEP1.some((k) => fields[k])) setStep(1);
        toast.error(H("Please fix the highlighted fields.", "कृपया लाल निशान वाले खाने ठीक करें।"));
      } else toast.error(H("Couldn't save. Try again.", "सेव नहीं हुआ। फिर कोशिश करें।"));
      setBusy(false);
    }
  }

  if (!account || account.onboarded) return <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-64" /></div>;
  const b = v.business;
  return (
    <div className="space-y-5 pb-10">
      <div><div className="num mb-2 text-sm font-medium text-muted-foreground">{H(`Step ${step} of 2`, `चरण ${step} / 2`)}</div><div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step}>{[1, 2].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-foreground" : "bg-border")} />)}</div></div>
      <Card className="flex-row items-center gap-2.5 border-success/30 bg-success-soft p-3.5 text-sm text-success"><ShieldCheck className="size-5 shrink-0" />{H(`Phone ${account.phoneMasked} verified. Complete your profile to continue.`, `फ़ोन ${account.phoneMasked} वेरिफाई हो गया। आगे बढ़ने के लिए प्रोफ़ाइल पूरी करें।`)}</Card>

      {step === 1 ? (
        <>
          <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{H("About you", "आपके बारे में")}</h1>
          <Card className="space-y-5 p-5">
            <Field id="su-name" label={H("Full name", "पूरा नाम")} error={err("name")} lang={lang}>
              <Input id="su-name" autoComplete="name" value={v.name} maxLength={60} onBlur={() => touch("name")} onChange={(e) => setP({ name: e.target.value })} aria-invalid={!!err("name")} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{H("You are the…", "आप हैं…")} <span className="text-destructive">*</span></legend>
              <div className="grid gap-2">
                {PROFILE_TYPES.map((p) => (
                  <label key={p.id} className={cn("flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 text-[0.9375rem]", v.profileType === p.id && "border-foreground ring-1 ring-foreground")}>
                    <input type="radio" name="profileType" className="mt-1 size-4 accent-foreground" checked={v.profileType === p.id} onChange={() => setP({ profileType: p.id as ProfileType })} />
                    <span><span className="font-medium">{hi ? p.hi : p.en}</span><span className="block text-xs text-muted-foreground">{hi ? p.note.hi : p.note.en}</span></span>
                  </label>
                ))}
              </div>
              {err("profileType") && <p className="text-xs text-destructive">{profileError(err("profileType"), lang)}</p>}
            </fieldset>
            <Field id="su-email" label={H("Email (optional — for invoices)", "ईमेल (वैकल्पिक — बिल के लिए)")} error={err("email")} lang={lang} optional>
              <Input id="su-email" type="email" autoComplete="email" value={v.email} onBlur={() => touch("email")} onChange={(e) => setP({ email: e.target.value })} aria-invalid={!!err("email")} />
            </Field>
            <label className="flex items-center gap-2 text-sm">{H("Language", "भाषा")}
              <select className="h-12 rounded-xl border border-input bg-card px-3 text-base" value={lang} onChange={(e) => setLang(e.target.value as "en")} aria-label={H("Language", "भाषा")}>
                <option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option><option value="ta">தமிழ்</option>
              </select>
            </label>
          </Card>
          <Button size="lg" className="w-full" onClick={next1}>{H("Next — your business", "आगे — आपका बिज़नेस")}</Button>
        </>
      ) : (
        <>
          <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{H("Your business", "आपका बिज़नेस")}</h1>
          <Card className="space-y-5 p-5">
            <Field id="su-biz" label={H("Business name", "बिज़नेस का नाम")} error={err("business.name")} lang={lang}>
              <Input id="su-biz" value={b.name} maxLength={80} onBlur={() => touch("business.name")} onChange={(e) => setB({ name: e.target.value })} aria-invalid={!!err("business.name")} />
            </Field>
            <Field id="su-type" label={H("Type of business", "बिज़नेस का प्रकार")} error={err("business.type")} lang={lang}>
              <select id="su-type" className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base" value={b.type} onBlur={() => touch("business.type")} onChange={(e) => { setB({ type: e.target.value }); touch("business.type"); }} aria-invalid={!!err("business.type")}>
                <option value="">{H("Choose…", "चुनें…")}</option>
                {BUSINESS_TYPE_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value={OTHER}>{H("Something else", "कुछ और")}</option>
              </select>
              {b.type === OTHER && <Input className="mt-2" placeholder={H("Describe your business", "अपना बिज़नेस बताएँ")} aria-label={H("Describe your business", "अपना बिज़नेस बताएँ")} value={b.typeOther} maxLength={60} onChange={(e) => setB({ typeOther: e.target.value })} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="su-staff" label={H("People working", "काम करने वाले लोग")} error={err("business.employees")} lang={lang}>
                <Input id="su-staff" inputMode="numeric" value={b.employees} onBlur={() => touch("business.employees")} onChange={(e) => setB({ employees: e.target.value.replace(/\D/g, "").slice(0, 5) })} aria-invalid={!!err("business.employees")} />
              </Field>
              <Field id="su-sites" label={H("Locations", "लोकेशन")} error={err("business.sites")} lang={lang}>
                <Input id="su-sites" inputMode="numeric" value={b.sites} onBlur={() => touch("business.sites")} onChange={(e) => setB({ sites: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-invalid={!!err("business.sites")} />
              </Field>
            </div>
            <Field id="su-city" label={H("City", "शहर")} error={err("business.city")} lang={lang}>
              <select id="su-city" className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base" value={b.city} onBlur={() => touch("business.city")} onChange={(e) => { setB({ city: e.target.value }); touch("business.city"); }} aria-invalid={!!err("business.city")}>
                <option value="">{H("Choose…", "चुनें…")}</option>
                {SERVED_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value={OTHER}>{H("My city isn't listed", "मेरा शहर सूची में नहीं है")}</option>
              </select>
              {b.city === OTHER && <><Input className="mt-2" placeholder={H("Your city", "आपका शहर")} aria-label={H("Your city", "आपका शहर")} value={b.cityOther} maxLength={40} onChange={(e) => setB({ cityOther: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">{H("We're not fully online in your city yet — a specialist will help you with your plan.", "आपके शहर में अभी पूरी ऑनलाइन सेवा नहीं है — एक विशेषज्ञ प्लान में मदद करेंगे।")}</p></>}
            </Field>
            <Field id="su-addr" label={H("Business address (shop/building, street, area)", "बिज़नेस का पता (दुकान/बिल्डिंग, गली, इलाका)")} error={err("business.address")} lang={lang}>
              <Input id="su-addr" autoComplete="street-address" value={b.address} maxLength={200} onBlur={() => touch("business.address")} onChange={(e) => setB({ address: e.target.value })} aria-invalid={!!err("business.address")} />
            </Field>
            <Field id="su-pin" label={H("Pincode", "पिनकोड")} error={err("business.pincode")} lang={lang}>
              <Input id="su-pin" className="w-32" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={b.pincode} onBlur={() => touch("business.pincode")} onChange={(e) => setB({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} aria-invalid={!!err("business.pincode")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="su-gst" label={H("GSTIN (optional)", "GSTIN (वैकल्पिक)")} error={err("business.gstin")} lang={lang} optional>
                <Input id="su-gst" className="font-mono uppercase" maxLength={15} placeholder="27ABCDE1234F1Z5" value={b.gstin} onBlur={() => touch("business.gstin")} onChange={(e) => setB({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) })} aria-invalid={!!err("business.gstin")} />
              </Field>
              <Field id="su-udyam" label={H("Udyam number (optional)", "उद्यम नंबर (वैकल्पिक)")} error={err("business.udyam")} lang={lang} optional>
                <Input id="su-udyam" className="font-mono uppercase" maxLength={22} placeholder="UDYAM-MH-00-1234567" value={b.udyam} onBlur={() => touch("business.udyam")} onChange={(e) => setB({ udyam: e.target.value.toUpperCase() })} aria-invalid={!!err("business.udyam")} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">{H("GST and Udyam are checked for format now and verified against the official records at KYC, when you order.", "GST और उद्यम का फ़ॉर्मेट अभी जाँचा जाता है; सरकारी रिकॉर्ड से पुष्टि ऑर्डर के समय KYC में होती है।")}</p>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" disabled={busy} onClick={() => setStep(1)}>{H("Back", "पीछे")}</Button>
            <Button size="lg" className="flex-1" disabled={busy} onClick={finish}>{busy ? H("Checking…", "जाँच हो रही है…") : H("Finish and continue", "पूरा करें और आगे बढ़ें")}</Button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ id, label, error, lang, optional, children }: { id: string; label: string; error?: string; lang: "en" | "hi" | "mr" | "ta"; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{!optional && <span className="text-destructive"> *</span>}</Label>
      {children}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{profileError(error, lang)}</p>}
    </div>
  );
}

export default function SetupPage() { return <CustomerShell><Setup /></CustomerShell>; }
