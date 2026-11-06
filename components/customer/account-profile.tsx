"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Bell, BriefcaseBusiness, Building2, ChevronRight, CreditCard, Crown, Download, FileText, FlaskConical, Headset, Languages, LogOut, MapPin,
  Moon, Plus, Settings, ShieldCheck, Trash2, UsersRound,
} from "lucide-react";
import { openDemoTools } from "@/components/customer/app-nav";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useI18n } from "@/components/i18n-provider";
import { api, ApiError, clearJourney } from "@/lib/client/api";
import { fmtDate, fmtTime } from "@/lib/client/format";
import { loadNotes, seenSet } from "@/lib/client/notifications";
import { cn } from "@/lib/utils";
import { useVerify } from "./verify";
import { PROFILE_TYPES, profileTypeLabel } from "@/lib/i18n/profile";

interface Me {
  user: { id: string; name: string | null; email: string | null; phoneMasked: string; lang: string; profileType: string; onboarded: boolean; notifyWhatsapp: boolean; notifySms: boolean; notifyEmail: boolean; marketingOptIn: boolean; createdAt: number };
  businesses: { id: string; name: string; businessType: string | null; city: string | null; employees: number | null; sites: number | null; gstin: string | null; gstStatus: string | null; verifiedAt: number | null; locations: { id: string; label: string | null; address: string; pincode: string | null }[] }[];
  sessions: { id: string; userAgent: string | null; ipPrefix: string | null; lastSeenAt: number; current: boolean }[];
  orders: { id: string; token: string; businessName: string; bundle: string; stage: string | null; payment: string; kycStatus: string; monthly: number; goLive: string; createdAt: number }[];
  quotes: { id: string; bundle: string; orderId: string | null; createdAt: number }[];
  tickets: { id: string; status: string; category: string }[];
}
type Panel = null | "profile" | "business" | "devices" | "updates" | "data";
type Icon = ComponentType<{ className?: string }>;
const LANGS = [{ v: "en", l: "English" }, { v: "hi", l: "हिन्दी" }, { v: "mr", l: "मराठी" }, { v: "ta", l: "தமிழ்" }];

const device = (ua: string | null) => !ua ? "Unknown device" : /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android phone" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Linux/.test(ua) ? "Linux" : "Browser";

export function AccountProfile() {
  const { lang, t, setLang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const { signOut, refresh } = useVerify();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [addingBiz, setAddingBiz] = useState(false);
  const [biz, setBiz] = useState({ name: "", businessType: "", city: "", employees: "" });
  const [locFor, setLocFor] = useState<string | null>(null);
  const [loc, setLoc] = useState({ address: "", pincode: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => api<Me>("GET", "/api/me").then((r) => { setMe(r); setForm({ name: r.user.name ?? "", email: r.user.email ?? "" }); }).catch(() => setMe(null)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setMounted(true); loadNotes().then((n) => { const seen = seenSet(); setUnread(n.filter((x) => !seen.has(x.id)).length); }).catch(() => {}); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const patch = async (body: Record<string, unknown>, msg = H("Saved", "सेव हो गया")) => {
    try { await api("PATCH", "/api/me", body); toast.success(msg); await load(); await refresh(); }
    catch (e) { toast.error(e instanceof ApiError && e.code === "INVALID_INPUT" ? H("Please check the email address.", "ईमेल पता जाँचें।") : t("error_generic")); }
  };

  if (!me) return <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  const u = me.user;
  const b = me.businesses[0];
  const verified = !!b?.verifiedAt;
  const kycOrder = me.orders.find((o) => o.stage !== "CANCELLED");
  const locations = me.businesses.reduce((s, x) => s + x.locations.length, 0);
  const openTickets = me.tickets.filter((x) => x.status !== "resolved").length;
  const title = b?.name || u.name || H("Your account", "आपका अकाउंट");
  const dark = mounted && resolvedTheme === "dark";

  const tiles: { icon: Icon; label: string; on: () => void }[] = [
    { icon: Building2, label: H("Business profile", "बिज़नेस प्रोफ़ाइल"), on: () => setPanel("profile") },
    { icon: UsersRound, label: H("Team & access", "टीम और एक्सेस"), on: () => setPanel("devices") },
    { icon: CreditCard, label: H("Billing & payments", "बिलिंग और भुगतान"), on: () => router.push("/orders") },
    { icon: Settings, label: H("Plan settings", "प्लान सेटिंग"), on: () => setPanel("updates") },
  ];

  return (
    <div className="space-y-4 pb-10">
      {/* identity */}
      <button type="button" onClick={() => setPanel("profile")} className="surface-tint relative flex w-full items-center gap-4 overflow-hidden rounded-3xl border p-4 text-left shadow-card">
        <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-24 w-56 -rotate-12 rounded-full bg-[linear-gradient(90deg,transparent,oklch(0.62_0.2_25/.35))]" />
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-3xl font-bold text-primary">{title[0]?.toUpperCase()}</span>
        <span className="relative min-w-0 flex-1">
          <span className="flex items-center gap-1.5"><span className="truncate text-xl font-extrabold">{title}</span>{verified && <BadgeCheck className="size-5 shrink-0 text-primary" aria-label={H("Verified", "वेरिफ़ाइड")} />}</span>
          <span className="block text-sm text-muted-foreground">{H("Business Account", "बिज़नेस अकाउंट")}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {b?.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{b.city}</span>}
            {b && <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="size-3.5" />{[b.businessType, `${Math.max(locations, b.sites ?? 1)} ${H(locations === 1 ? "location" : "locations", "लोकेशन")}`].filter(Boolean).join(" · ")}</span>}
          </span>
        </span>
        <ChevronRight className="relative size-5 shrink-0 text-muted-foreground" />
      </button>

      {!u.onboarded && (
        <Card className="flex flex-row items-center gap-3 border-primary/30 bg-accent p-3.5 text-sm">
          <div className="flex-1">{H("Finish setting up your profile — tell us who you are and add your business.", "अपनी प्रोफ़ाइल पूरी करें — बताएँ आप कौन हैं और अपना बिज़नेस जोड़ें।")}</div>
          <Link href="/account/setup"><Button size="sm">{H("Set up", "पूरा करें")}</Button></Link>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-2">
        {tiles.map(({ icon: I, label, on }) => (
          <button key={label} type="button" onClick={on} className="flex min-h-[6.25rem] flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-1 py-3 text-center shadow-card transition-colors hover:border-primary/40 active:scale-95">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><I className="size-6" /></span>
            <span className="text-[0.75rem] font-semibold leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* verification */}
      <div className="flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-card">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", verified ? "bg-success-soft text-success" : "bg-accent text-primary")}>{verified ? <ShieldCheck className="size-6" /> : <Crown className="size-6" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold">{verified ? H("Business verified", "बिज़नेस वेरिफ़ाइड") : H("Business verification", "बिज़नेस वेरिफ़िकेशन")}</span>
          <span className="block text-xs leading-snug text-muted-foreground">{verified ? H("Your GST and Udyam details are confirmed.", "आपकी GST और उद्यम जानकारी पक्की है।") : H("Complete verification for higher limits and exclusive benefits.", "ज़्यादा सीमा और खास फ़ायदों के लिए वेरिफ़िकेशन पूरा करें।")}</span>
        </span>
        {!verified && <Link href={kycOrder ? `/order/${kycOrder.id}/kyc` : "/advisor"} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground">{H("Verify now", "अभी करें")}<ChevronRight className="size-4" /></Link>}
      </div>

      {/* list */}
      <div className="divide-y overflow-hidden rounded-3xl border bg-card shadow-card">
        <Item icon={MapPin} title={H("My locations", "मेरी लोकेशन")} sub={H("Manage your business locations", "अपनी बिज़नेस लोकेशन संभालें")} onClick={() => setPanel("business")} />
        <Item icon={FileText} title={H("Documents", "दस्तावेज़")} sub={H("KYC, GST and other business documents", "KYC, GST और अन्य दस्तावेज़")} href={kycOrder ? `/order/${kycOrder.id}/kyc` : "/orders"} />
        <Item icon={Headset} title={H("Support & help", "मदद और सहायता")} sub={H("Get help, raise a request or track it", "मदद लें, अनुरोध करें या ट्रैक करें")} href="/support" right={openTickets ? <Badge variant="info">{openTickets}</Badge> : undefined} />
        <Item icon={Bell} title={H("Notifications", "सूचनाएँ")} href="/notifications" right={unread ? <span className="num flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{unread}</span> : undefined} />
        <label className="flex min-h-16 items-center gap-3 px-4 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Languages className="size-5" /></span>
          <span className="flex-1 text-[0.9375rem] font-bold">{H("Language", "भाषा")}</span>
          <select value={u.lang} onChange={(e) => { setLang(e.target.value as "en"); patch({ lang: e.target.value }, H("Language changed", "भाषा बदली")); }} className="h-9 rounded-full border bg-card px-3 text-sm font-semibold" aria-label={H("Language", "भाषा")}>
            {LANGS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
          </select>
        </label>
        <label className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Moon className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-bold">{H("Dark mode", "डार्क मोड")}</span><span className="block text-xs text-muted-foreground">{H("Easier on the eyes at night", "रात में आँखों के लिए आरामदायक")}</span></span>
          <Switch checked={dark} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} aria-label={H("Dark mode", "डार्क मोड")} />
        </label>
        <Item icon={ShieldCheck} title={H("Your data & privacy", "आपका डेटा और गोपनीयता")} sub={H("Download or delete your data", "डेटा डाउनलोड करें या हटाएँ")} onClick={() => setPanel("data")} />
      </div>

      {process.env.NEXT_PUBLIC_DEMO_MODE !== "false" && (
        <Button variant="outline" size="lg" className="w-full rounded-2xl" onClick={openDemoTools}><FlaskConical className="size-4" />{t("demo_tools")}</Button>
      )}
      <button type="button" onClick={async () => { await signOut(); toast.success(H("Signed out", "साइन आउट हो गया")); }} className="flex min-h-16 w-full items-center gap-3 rounded-3xl border bg-card px-4 text-left shadow-card hover:border-primary/40">
        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><LogOut className="size-5" /></span>
        <span className="text-base font-bold text-primary">{H("Log out", "लॉग आउट")}</span>
      </button>

      {/* panels: the full settings, one tap away */}
      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl pb-8">
          <SheetHeader><SheetTitle>{panel === "profile" ? H("Business profile", "बिज़नेस प्रोफ़ाइल") : panel === "business" ? H("My businesses & locations", "मेरे बिज़नेस और लोकेशन") : panel === "devices" ? H("Team & access", "टीम और एक्सेस") : panel === "updates" ? H("Plan settings", "प्लान सेटिंग") : H("Your data & privacy", "आपका डेटा और गोपनीयता")}</SheetTitle></SheetHeader>
          <div className="space-y-3 px-4">
            {panel === "profile" && (
              <>
                <Card className="space-y-3 p-3.5">
                  <div className="text-xs text-muted-foreground"><BadgeCheck className="mr-1 inline size-3.5 text-success" />{u.phoneMasked} · {profileTypeLabel(u.profileType, lang)} · {H("member since", "सदस्य")} {fmtDate(new Date(u.createdAt).toISOString().slice(0, 10), lang)}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="pf-name">{H("Your name", "आपका नाम")}</Label><Input id="pf-name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="pf-email">{H("Email (optional)", "ईमेल (वैकल्पिक)")}</Label><Input id="pf-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                  <label className="flex flex-wrap items-center gap-2 text-sm">{H("You are the", "आप हैं")}
                    <select className="h-8 rounded-md border bg-card px-2 text-sm" value={u.profileType} onChange={(e) => patch({ profileType: e.target.value })} aria-label={H("Profile type", "प्रोफ़ाइल प्रकार")}>
                      {PROFILE_TYPES.map((p) => <option key={p.id} value={p.id}>{hi ? p.hi : p.en}</option>)}
                    </select>
                  </label>
                  <Button size="sm" disabled={form.name === (u.name ?? "") && form.email === (u.email ?? "")} onClick={() => patch({ name: form.name.trim() || null, email: form.email.trim() })}>{H("Save", "सेव करें")}</Button>
                </Card>
                <Button variant="outline" className="w-full" onClick={() => setPanel("business")}><Building2 className="size-4" />{H("Businesses & locations", "बिज़नेस और लोकेशन")}</Button>
              </>
            )}

            {panel === "business" && (
              <>
                <div className="flex justify-end"><Button size="sm" variant="ghost" className="gap-1" onClick={() => setAddingBiz((x) => !x)}><Plus className="size-3.5" />{H("Add business", "बिज़नेस जोड़ें")}</Button></div>
                {addingBiz && (
                  <Card className="space-y-2 p-3.5">
                    <Input placeholder={H("Business name", "बिज़नेस का नाम")} value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} aria-label={H("Business name", "बिज़नेस का नाम")} />
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder={H("Type (e.g. clinic)", "प्रकार")} value={biz.businessType} onChange={(e) => setBiz({ ...biz, businessType: e.target.value })} aria-label={H("Business type", "प्रकार")} />
                      <Input placeholder={H("City", "शहर")} value={biz.city} onChange={(e) => setBiz({ ...biz, city: e.target.value })} aria-label={H("City", "शहर")} />
                      <Input placeholder={H("Staff", "स्टाफ")} inputMode="numeric" value={biz.employees} onChange={(e) => setBiz({ ...biz, employees: e.target.value.replace(/\D/g, "") })} aria-label={H("Staff", "स्टाफ")} />
                    </div>
                    <Button size="sm" disabled={biz.name.trim().length < 2} onClick={async () => {
                      try { await api("POST", "/api/me/businesses", { name: biz.name, businessType: biz.businessType || null, city: biz.city || null, employees: biz.employees ? Number(biz.employees) : null }); setBiz({ name: "", businessType: "", city: "", employees: "" }); setAddingBiz(false); load(); toast.success(H("Business added", "बिज़नेस जोड़ा गया")); }
                      catch { toast.error(t("error_generic")); }
                    }}>{H("Save business", "बिज़नेस सेव करें")}</Button>
                  </Card>
                )}
                {me.businesses.length === 0 && !addingBiz && <Card className="p-3.5 text-sm text-muted-foreground">{H("Your business appears here after your first order — or add one now.", "पहले ऑर्डर के बाद आपका बिज़नेस यहाँ दिखेगा — या अभी जोड़ें।")}</Card>}
                {me.businesses.map((x) => (
                  <Card key={x.id} className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div><div className="font-semibold">{x.name}</div><div className="text-xs text-muted-foreground">{[x.businessType, x.city, x.employees ? `${x.employees} ${H("staff", "स्टाफ")}` : null, x.sites ? `${x.sites} ${H("location(s)", "लोकेशन")}` : null].filter(Boolean).join(" · ") || "—"}</div></div>
                      {x.gstin && <Badge variant={x.gstStatus === "Active" ? "default" : "secondary"} className="shrink-0 gap-1 font-mono text-xs"><BadgeCheck className="size-3" />GST {x.gstin}{x.gstStatus && x.gstStatus !== "Active" ? ` · ${x.gstStatus}` : ""}</Badge>}
                    </div>
                    <ul className="space-y-1 text-xs">
                      {x.locations.map((l) => (
                        <li key={l.id} className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><span className="flex-1">{l.label ? <b>{l.label}: </b> : null}{l.address}{l.pincode ? ` – ${l.pincode}` : ""}</span>
                          <button type="button" aria-label={H("Remove location", "लोकेशन हटाएँ")} className="text-muted-foreground hover:text-destructive" onClick={async () => { await api("DELETE", `/api/me/businesses/${x.id}/locations`, { locationId: l.id }).catch(() => {}); load(); }}><Trash2 className="size-3.5" /></button></li>
                      ))}
                    </ul>
                    {locFor === x.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Input className="min-w-0 flex-1" placeholder={H("Address", "पता")} value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} aria-label={H("Address", "पता")} />
                        <Input className="w-24" inputMode="numeric" maxLength={6} placeholder={H("Pincode", "पिनकोड")} value={loc.pincode} onChange={(e) => setLoc({ ...loc, pincode: e.target.value.replace(/\D/g, "") })} aria-label={H("Pincode", "पिनकोड")} />
                        <Button size="sm" disabled={loc.address.trim().length < 5 || (loc.pincode.length > 0 && loc.pincode.length !== 6)} onClick={async () => {
                          try { await api("POST", `/api/me/businesses/${x.id}/locations`, { address: loc.address, pincode: loc.pincode || null }); setLoc({ address: "", pincode: "" }); setLocFor(null); load(); } catch { toast.error(t("error_generic")); }
                        }}>{H("Add", "जोड़ें")}</Button>
                      </div>
                    ) : <Button size="sm" variant="outline" className="gap-1" onClick={() => setLocFor(x.id)}><Plus className="size-3.5" />{H("Add a location", "लोकेशन जोड़ें")}</Button>}
                  </Card>
                ))}
              </>
            )}

            {panel === "devices" && (
              <>
                <p className="text-sm text-muted-foreground">{H("Phones and computers signed in to this account.", "इस अकाउंट में साइन-इन फ़ोन और कंप्यूटर।")}</p>
                <Card className="divide-y p-0 text-sm">
                  {me.sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                      <div><div>{device(s.userAgent)}{s.current && <Badge variant="secondary" className="ml-2 text-xs">{H("This device", "यह डिवाइस")}</Badge>}</div><div className="text-xs text-muted-foreground">{H("last active", "आख़िरी बार")} {fmtTime(s.lastSeenAt, lang)}</div></div>
                      {!s.current && <Button size="sm" variant="ghost" onClick={async () => { await api("DELETE", "/api/me/sessions", { id: s.id }); load(); }}>{H("Sign out", "साइन आउट")}</Button>}
                    </div>
                  ))}
                </Card>
                {me.sessions.length > 1 && <Button variant="outline" className="w-full" onClick={async () => { await api("DELETE", "/api/me/sessions", { others: true }); toast.success(H("Other devices signed out", "दूसरे डिवाइस साइन आउट")); load(); }}>{H("Sign out all other devices", "बाकी सभी डिवाइस साइन आउट")}</Button>}
              </>
            )}

            {panel === "updates" && (
              <>
                <Card className="divide-y p-0 text-sm">
                  {([["notifyWhatsapp", H("Order updates on WhatsApp", "WhatsApp पर ऑर्डर अपडेट")], ["notifySms", H("Order updates by SMS", "SMS पर ऑर्डर अपडेट")], ["notifyEmail", H("Order updates by email", "ईमेल पर ऑर्डर अपडेट")], ["marketingOptIn", H("Offers and new products (marketing)", "ऑफ़र और नए प्रोडक्ट (मार्केटिंग)")]] as const).map(([k, label]) => (
                    <label key={k} className="flex items-center justify-between gap-3 px-3.5 py-3"><span>{label}</span><Switch checked={u[k]} onCheckedChange={(c) => patch({ [k]: !!c })} aria-label={label} /></label>
                  ))}
                </Card>
                <p className="text-xs text-muted-foreground">{H("Service updates are about your own orders. Marketing is separate and stays off unless you turn it on.", "सर्विस अपडेट सिर्फ़ आपके ऑर्डर के बारे में होते हैं। मार्केटिंग अलग है और आपके चालू किए बिना बंद रहती है।")}</p>
                <Link href="/catalogue" className="block"><Button variant="outline" className="w-full">{H("Change or add services", "सेवाएँ बदलें या जोड़ें")}</Button></Link>
              </>
            )}

            {panel === "data" && (
              <>
                <a href="/api/me/export" className="block"><Button variant="outline" className="w-full gap-2"><Download className="size-4" />{H("Download my data (JSON)", "मेरा डेटा डाउनलोड करें (JSON)")}</Button></a>
                <p className="text-xs text-muted-foreground">{H("Deleting your account erases your profile, businesses, conversations, plans, KYC details, consent records and support requests. Orders are contract records and are kept anonymised.", "अकाउंट हटाने पर आपकी प्रोफ़ाइल, बिज़नेस, बातचीत, प्लान, KYC जानकारी, सहमति और सहायता अनुरोध मिट जाते हैं। ऑर्डर अनुबंध रिकॉर्ड हैं और गुमनाम रूप में रखे जाते हैं।")}</p>
                <Button variant="outline" className="w-full gap-2 text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />{H("Delete my account", "मेरा अकाउंट हटाएँ")}</Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{H("Delete your account?", "अकाउंट हटाएँ?")}</AlertDialogTitle><AlertDialogDescription>{H("This erases your data and signs you out everywhere. It can't be undone.", "इससे आपका डेटा मिट जाएगा और हर जगह से साइन आउट हो जाएगा। यह वापस नहीं होगा।")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={async () => {
            try { const r = await api<{ deleted: number }>("DELETE", "/api/me"); clearJourney(); await refresh(); toast.success(H(`Account deleted (${r.deleted} records).`, `अकाउंट हटाया गया (${r.deleted} रिकॉर्ड)।`)); } catch { toast.error(t("error_generic")); }
          }}>{H("Delete account", "अकाउंट हटाएँ")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Item({ icon: I, title, sub, href, onClick, right }: { icon: Icon; title: string; sub?: string; href?: string; onClick?: () => void; right?: ReactNode }) {
  const body = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><I className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-bold">{title}</span>{sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}</span>
      {right}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </>
  );
  const cls = "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50";
  return href ? <Link href={href} className={cls}>{body}</Link> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}
