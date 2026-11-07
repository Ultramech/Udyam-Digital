"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, FileText, Globe2, Hash, IdCard, Mail, MapPin, MapPinned, Phone, ShieldCheck, Store, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";
import { AuthScreen, BackButton, IconField, Segments, Wordmark } from "@/components/start/parts";
import { api, ApiError } from "@/lib/client/api";
import { PROFILE_TYPES, type ProfileType } from "@/lib/i18n/profile";
import { profileError } from "@/lib/i18n/profileErrors";
import { BUSINESS_TYPE_NAMES, OTHER, SERVED_CITIES, setupErrors, type SetupInput } from "@/lib/accounts/profileRules";

const safeNext = () => { const n = new URLSearchParams(window.location.search).get("next"); return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/account/setup") ? n : "/advisor"; };
/** Which fields live on which step, so an error always takes you to the step that owns it. */
const STEPS: string[][] = [
  ["name", "business.name"],
  ["profileType", "business.type", "business.typeOther", "business.employees", "business.sites", "business.city", "business.cityOther"],
  ["business.address", "business.pincode", "business.gstin", "business.udyam", "email"],
];

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  function advance() {
    const keys = STEPS[step - 1];
    setTouched((t) => ({ ...t, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    if (keys.some((k) => errs[k])) { toast.error(H("Please fix the highlighted fields.", "कृपया लाल निशान वाले खाने ठीक करें।")); return; }
    setStep((step + 1) as 2 | 3);
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
        const owner = STEPS.findIndex((keys) => keys.some((k) => fields[k]));
        if (owner >= 0) setStep((owner + 1) as 1 | 2 | 3);
        toast.error(H("Please fix the highlighted fields.", "कृपया लाल निशान वाले खाने ठीक करें।"));
      } else toast.error(H("Couldn't save. Try again.", "सेव नहीं हुआ। फिर कोशिश करें।"));
      setBusy(false);
    }
  }

  if (!account || account.onboarded) return <AuthScreen><div className="space-y-3 pt-10"><Skeleton className="h-10" /><Skeleton className="h-64" /></div></AuthScreen>;
  const b = v.business;
  const e = (k: string) => { const m = err(k); return m ? profileError(m, lang) : undefined; };
  const copy = [
    { t: H("Create Business Account", "बिज़नेस अकाउंट बनाएँ"), d: H("Tell us a bit about your business to get started.", "शुरू करने के लिए अपने बिज़नेस के बारे में थोड़ा बताइए।") },
    { t: H("Business Profile", "बिज़नेस प्रोफ़ाइल"), d: H("Help us understand your business better.", "अपने बिज़नेस को बेहतर समझने में हमारी मदद करें।") },
    { t: H("Business Details", "बिज़नेस की जानकारी"), d: H("Where you are and your registrations. We verify them at KYC.", "आप कहाँ हैं और आपके रजिस्ट्रेशन। KYC में इनकी पुष्टि होती है।") },
  ][step - 1];
  const back = () => (step > 1 ? setStep((step - 1) as 1 | 2) : router.push("/login"));
  return (
    <AuthScreen>
      <div className="flex items-center"><BackButton label={H("Back", "पीछे")} onClick={back} /><div className="flex-1 pl-2"><Segments step={step} total={3} /></div><span className="size-11" aria-hidden /></div>
      <div className="mt-3 flex justify-center"><Wordmark /></div>
      <h1 className="mt-8 text-[1.75rem] font-extrabold leading-tight tracking-tight">{copy.t}</h1>
      <p className="mt-1.5 text-[1.0625rem] leading-snug text-foreground/70">{copy.d}</p>
      <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="size-4 shrink-0" aria-hidden />{H(`Phone ${account.phoneMasked} verified`, `फ़ोन ${account.phoneMasked} वेरिफाई हो गया`)}</p>

      <form className="mt-5 flex flex-1 flex-col" noValidate onSubmit={(ev) => { ev.preventDefault(); if (step < 3) advance(); else finish(); }}>
        <div className="space-y-3.5">
          {step === 1 && (
            <>
              <IconField id="su-name" label={H("Full name", "पूरा नाम")} icon={User} error={e("name")}>
                <input id="su-name" autoComplete="name" value={v.name} maxLength={60} onBlur={() => touch("name")} onChange={(ev) => setP({ name: ev.target.value })} aria-invalid={!!err("name")} />
              </IconField>
              <IconField id="su-phone" label={H("Mobile number", "मोबाइल नंबर")} icon={Phone}>
                <input id="su-phone" readOnly value={`+91\u00a0${account.phoneMasked}`} className="text-muted-foreground" />
              </IconField>
              <IconField id="su-biz" label={H("Business name", "बिज़नेस का नाम")} icon={Store} error={e("business.name")}>
                <input id="su-biz" value={b.name} maxLength={80} onBlur={() => touch("business.name")} onChange={(ev) => setB({ name: ev.target.value })} aria-invalid={!!err("business.name")} />
              </IconField>
            </>
          )}
          {step === 2 && (
            <>
              <IconField id="su-type" label={H("Type of business", "बिज़नेस का प्रकार")} icon={Store} select error={e("business.type")}>
                <select id="su-type" value={b.type} onBlur={() => touch("business.type")} onChange={(ev) => { setB({ type: ev.target.value }); touch("business.type"); }} aria-invalid={!!err("business.type")}>
                  <option value="">{H("Choose…", "चुनें…")}</option>
                  {BUSINESS_TYPE_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value={OTHER}>{H("Something else", "कुछ और")}</option>
                </select>
              </IconField>
              {b.type === OTHER && (
                <IconField id="su-type-other" label={H("Describe your business", "अपना बिज़नेस बताएँ")} icon={Building2} error={e("business.typeOther")}>
                  <input id="su-type-other" value={b.typeOther} maxLength={60} onChange={(ev) => setB({ typeOther: ev.target.value })} />
                </IconField>
              )}
              <IconField id="su-staff" label={H("People working (including you)", "काम करने वाले लोग (आप समेत)")} icon={Users} error={e("business.employees")}>
                <input id="su-staff" inputMode="numeric" value={b.employees} onBlur={() => touch("business.employees")} onChange={(ev) => setB({ employees: ev.target.value.replace(/\D/g, "").slice(0, 5) })} aria-invalid={!!err("business.employees")} />
              </IconField>
              <IconField id="su-sites" label={H("Locations", "लोकेशन")} icon={MapPinned} error={e("business.sites")}>
                <input id="su-sites" inputMode="numeric" value={b.sites} onBlur={() => touch("business.sites")} onChange={(ev) => setB({ sites: ev.target.value.replace(/\D/g, "").slice(0, 3) })} aria-invalid={!!err("business.sites")} />
              </IconField>
              <IconField id="su-city" label={H("City", "शहर")} icon={MapPin} select error={e("business.city")}>
                <select id="su-city" value={b.city} onBlur={() => touch("business.city")} onChange={(ev) => { setB({ city: ev.target.value }); touch("business.city"); }} aria-invalid={!!err("business.city")}>
                  <option value="">{H("Choose…", "चुनें…")}</option>
                  {SERVED_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value={OTHER}>{H("My city isn't listed", "मेरा शहर सूची में नहीं है")}</option>
                </select>
              </IconField>
              {b.city === OTHER && (
                <>
                  <IconField id="su-city-other" label={H("Your city", "आपका शहर")} icon={MapPin} error={e("business.cityOther")}>
                    <input id="su-city-other" value={b.cityOther} maxLength={40} onChange={(ev) => setB({ cityOther: ev.target.value })} />
                  </IconField>
                  <p className="px-1 text-xs text-muted-foreground">{H("We're not fully online in your city yet — a specialist will help you with your plan.", "आपके शहर में अभी पूरी ऑनलाइन सेवा नहीं है — एक विशेषज्ञ प्लान में मदद करेंगे।")}</p>
                </>
              )}
              <IconField id="su-role" label={H("You are the…", "आप हैं…")} icon={Briefcase} select error={e("profileType")}>
                <select id="su-role" value={v.profileType} onChange={(ev) => setP({ profileType: ev.target.value as ProfileType })}>
                  {PROFILE_TYPES.map((p) => <option key={p.id} value={p.id}>{hi ? p.hi : p.en}</option>)}
                </select>
              </IconField>
            </>
          )}
          {step === 3 && (
            <>
              <IconField id="su-addr" label={H("Business address (shop/building, street, area)", "बिज़नेस का पता (दुकान/बिल्डिंग, गली, इलाका)")} icon={MapPin} error={e("business.address")}>
                <input id="su-addr" autoComplete="street-address" value={b.address} maxLength={200} onBlur={() => touch("business.address")} onChange={(ev) => setB({ address: ev.target.value })} aria-invalid={!!err("business.address")} />
              </IconField>
              <IconField id="su-pin" label={H("Pincode", "पिनकोड")} icon={Hash} error={e("business.pincode")}>
                <input id="su-pin" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={b.pincode} onBlur={() => touch("business.pincode")} onChange={(ev) => setB({ pincode: ev.target.value.replace(/\D/g, "").slice(0, 6) })} aria-invalid={!!err("business.pincode")} />
              </IconField>
              <IconField id="su-gst" label={H("GSTIN (optional)", "GSTIN (वैकल्पिक)")} icon={FileText} error={e("business.gstin")}>
                <input id="su-gst" className="font-mono uppercase" maxLength={15} placeholder="27ABCDE1234F1Z5" value={b.gstin} onBlur={() => touch("business.gstin")} onChange={(ev) => setB({ gstin: ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15) })} aria-invalid={!!err("business.gstin")} />
              </IconField>
              <IconField id="su-udyam" label={H("Udyam number (optional)", "उद्यम नंबर (वैकल्पिक)")} icon={IdCard} error={e("business.udyam")}>
                <input id="su-udyam" className="font-mono uppercase" maxLength={22} placeholder="UDYAM-MH-00-1234567" value={b.udyam} onBlur={() => touch("business.udyam")} onChange={(ev) => setB({ udyam: ev.target.value.toUpperCase() })} aria-invalid={!!err("business.udyam")} />
              </IconField>
              <IconField id="su-email" label={H("Email (optional, for invoices)", "ईमेल (वैकल्पिक, बिल के लिए)")} icon={Mail} error={e("email")}>
                <input id="su-email" type="email" autoComplete="email" value={v.email} onBlur={() => touch("email")} onChange={(ev) => setP({ email: ev.target.value })} aria-invalid={!!err("email")} />
              </IconField>
              <IconField id="su-lang" label={H("Language", "भाषा")} icon={Globe2} select>
                <select id="su-lang" value={lang} onChange={(ev) => setLang(ev.target.value as "en")}>
                  <option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option><option value="ta">தமிழ்</option>
                </select>
              </IconField>
              <p className="px-1 text-xs text-muted-foreground">{H("GST and Udyam are checked for format now and verified against the official records at KYC, when you order.", "GST और उद्यम का फ़ॉर्मेट अभी जाँचा जाता है; सरकारी रिकॉर्ड से पुष्टि ऑर्डर के समय KYC में होती है।")}</p>
            </>
          )}
        </div>
        <div className="sticky bottom-0 mt-auto pb-3 pt-6">
          <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-lg shadow-lift" disabled={busy}>
            {step < 3 ? H("Continue", "आगे बढ़ें") : busy ? H("Checking…", "जाँच हो रही है…") : H("Finish and continue", "पूरा करें और आगे बढ़ें")}
          </Button>
        </div>
      </form>
    </AuthScreen>
  );
}

export default function SetupPage() { return <CustomerShell><Setup /></CustomerShell>; }
