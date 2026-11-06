"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Bell, Building2, Download, LifeBuoy, LogOut, MapPin, MonitorSmartphone, Package, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useI18n } from "@/components/i18n-provider";
import { api, ApiError, clearJourney } from "@/lib/client/api";
import { fmtDate, fmtTime, inr } from "@/lib/client/format";
import { useVerify } from "./verify";
import { PROFILE_TYPES, profileTypeLabel } from "@/lib/i18n/profile";

interface Me {
  user: { id: string; name: string | null; email: string | null; phoneMasked: string; lang: string; profileType: string; onboarded: boolean; notifyWhatsapp: boolean; notifySms: boolean; notifyEmail: boolean; marketingOptIn: boolean; createdAt: number };
  businesses: { id: string; name: string; businessType: string | null; city: string | null; employees: number | null; sites: number | null; gstin: string | null; gstStatus: string | null; verifiedAt: number | null; locations: { id: string; label: string | null; address: string; pincode: string | null }[] }[];
  sessions: { id: string; userAgent: string | null; ipPrefix: string | null; lastSeenAt: number; current: boolean }[];
  orders: { id: string; token: string; businessName: string; bundle: string; stage: string | null; payment: string; monthly: number; goLive: string; createdAt: number }[];
  quotes: { id: string; bundle: string; orderId: string | null; createdAt: number }[];
  tickets: { id: string; status: string; category: string }[];
}

const device = (ua: string | null) => !ua ? "Unknown device" : /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android phone" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Linux/.test(ua) ? "Linux" : "Browser";

export function AccountProfile() {
  const { lang, t, setLang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const { signOut, refresh } = useVerify();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState({ name: "", email: "" });
  const [addingBiz, setAddingBiz] = useState(false);
  const [biz, setBiz] = useState({ name: "", businessType: "", city: "", employees: "" });
  const [locFor, setLocFor] = useState<string | null>(null);
  const [loc, setLoc] = useState({ address: "", pincode: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => api<Me>("GET", "/api/me").then((r) => { setMe(r); setForm({ name: r.user.name ?? "", email: r.user.email ?? "" }); }).catch(() => setMe(null)), []);
  useEffect(() => { load(); }, [load]);

  const patch = async (body: Record<string, unknown>, msg = H("Saved", "सेव हो गया")) => {
    try { await api("PATCH", "/api/me", body); toast.success(msg); await load(); await refresh(); }
    catch (e) { toast.error(e instanceof ApiError && e.code === "INVALID_INPUT" ? H("Please check the email address.", "ईमेल पता जाँचें।") : t("error_generic")); }
  };

  if (!me) return <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  const u = me.user;

  return (
    <div className="space-y-5 pb-10">
      {/* identity */}
      <Card className="flex items-center gap-3 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{(u.name?.[0] ?? "").toUpperCase() || <UserRound className="size-5" />}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{u.name || H("Your account", "आपका अकाउंट")}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><BadgeCheck className="size-3.5 text-success" />{u.phoneMasked} · {profileTypeLabel(u.profileType, lang)} · {H("member since", "सदस्य")} {fmtDate(new Date(u.createdAt).toISOString().slice(0, 10), lang)}</div>
        </div>
        <Button size="sm" variant="ghost" className="gap-1" onClick={async () => { await signOut(); toast.success(H("Signed out", "साइन आउट हो गया")); }}><LogOut className="size-4" />{H("Sign out", "साइन आउट")}</Button>
      </Card>

      {!u.onboarded && (
        <Card className="flex items-center gap-3 border-primary/30 bg-accent p-3.5 text-sm">
          <div className="flex-1">{H("Finish setting up your profile — tell us who you are and add your business.", "अपनी प्रोफ़ाइल पूरी करें — बताएँ आप कौन हैं और अपना बिज़नेस जोड़ें।")}</div>
          <Link href="/account/setup"><Button size="sm">{H("Set up", "पूरा करें")}</Button></Link>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Link href="/notifications"><Card className="flex flex-col items-center gap-1 p-3 hover:border-primary"><Bell className="size-4 text-primary" />{H("Notifications", "सूचनाएँ")}</Card></Link>
        <Link href="/support"><Card className="flex flex-col items-center gap-1 p-3 hover:border-primary"><LifeBuoy className="size-4 text-primary" />{H("Help", "मदद")}{me.tickets.filter((x) => x.status !== "resolved").length > 0 && <Badge className="h-4 px-1 text-[9px]">{me.tickets.filter((x) => x.status !== "resolved").length}</Badge>}</Card></Link>
        <Link href="/advisor"><Card className="flex flex-col items-center gap-1 p-3 hover:border-primary"><Plus className="size-4 text-primary" />{H("New plan", "नया प्लान")}</Card></Link>
      </div>

      {/* profile */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{H("Profile", "प्रोफ़ाइल")}</h2>
        <Card className="space-y-3 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="pf-name">{H("Your name", "आपका नाम")}</Label><Input id="pf-name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="pf-email">{H("Email (optional)", "ईमेल (वैकल्पिक)")}</Label><Input id="pf-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm">{H("You are the", "आप हैं")}
            <select className="h-8 rounded-md border bg-card px-2 text-sm" value={u.profileType} onChange={(e) => patch({ profileType: e.target.value })} aria-label={H("Profile type", "प्रोफ़ाइल प्रकार")}>
              {PROFILE_TYPES.map((p) => <option key={p.id} value={p.id}>{hi ? p.hi : p.en}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">{H("Language", "भाषा")}
              <select className="h-8 rounded-md border bg-card px-2 text-sm" value={u.lang} onChange={(e) => { setLang(e.target.value as "en"); patch({ lang: e.target.value }); }}>
                <option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option><option value="ta">தமிழ்</option>
              </select>
            </label>
            <Button size="sm" disabled={form.name === (u.name ?? "") && form.email === (u.email ?? "")} onClick={() => patch({ name: form.name.trim() || null, email: form.email.trim() })}>{H("Save", "सेव करें")}</Button>
          </div>
        </Card>
      </section>

      {/* businesses */}
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-primary" />{H("My businesses", "मेरे बिज़नेस")}</h2>
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setAddingBiz((x) => !x)}><Plus className="size-3.5" />{H("Add", "जोड़ें")}</Button></div>
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
        {me.businesses.map((b) => (
          <Card key={b.id} className="space-y-2 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-semibold">{b.name}</div><div className="text-xs text-muted-foreground">{[b.businessType, b.city, b.employees ? `${b.employees} ${H("staff", "स्टाफ")}` : null, b.sites ? `${b.sites} ${H("location(s)", "लोकेशन")}` : null].filter(Boolean).join(" · ") || "—"}</div></div>
              {b.gstin && <Badge variant={b.gstStatus === "Active" ? "default" : "secondary"} className="shrink-0 gap-1 font-mono text-[10px]"><BadgeCheck className="size-3" />GST {b.gstin}{b.gstStatus && b.gstStatus !== "Active" ? ` · ${b.gstStatus}` : ""}</Badge>}
            </div>
            <ul className="space-y-1 text-xs">
              {b.locations.map((l) => (
                <li key={l.id} className="flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><span className="flex-1">{l.label ? <b>{l.label}: </b> : null}{l.address}{l.pincode ? ` – ${l.pincode}` : ""}</span>
                  <button type="button" aria-label={H("Remove location", "लोकेशन हटाएँ")} className="text-muted-foreground hover:text-destructive" onClick={async () => { await api("DELETE", `/api/me/businesses/${b.id}/locations`, { locationId: l.id }).catch(() => {}); load(); }}><Trash2 className="size-3.5" /></button></li>
              ))}
            </ul>
            {locFor === b.id ? (
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-0 flex-1" placeholder={H("Address", "पता")} value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} aria-label={H("Address", "पता")} />
                <Input className="w-24" inputMode="numeric" maxLength={6} placeholder={H("Pincode", "पिनकोड")} value={loc.pincode} onChange={(e) => setLoc({ ...loc, pincode: e.target.value.replace(/\D/g, "") })} aria-label={H("Pincode", "पिनकोड")} />
                <Button size="sm" disabled={loc.address.trim().length < 5 || (loc.pincode.length > 0 && loc.pincode.length !== 6)} onClick={async () => {
                  try { await api("POST", `/api/me/businesses/${b.id}/locations`, { address: loc.address, pincode: loc.pincode || null }); setLoc({ address: "", pincode: "" }); setLocFor(null); load(); } catch { toast.error(t("error_generic")); }
                }}>{H("Add", "जोड़ें")}</Button>
              </div>
            ) : <Button size="sm" variant="outline" className="gap-1" onClick={() => setLocFor(b.id)}><Plus className="size-3.5" />{H("Add a location", "लोकेशन जोड़ें")}</Button>}
          </Card>
        ))}
      </section>

      {/* orders + quotes */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4 text-primary" />{t("my_orders")}</h2>
        {me.orders.length === 0 && <Card className="p-3.5 text-sm text-muted-foreground">{t("no_orders")}</Card>}
        {me.orders.map((o) => (
          <Link key={o.id} href={`/track/${o.id}?t=${o.token}`} className="block">
            <Card className="p-3.5 transition-colors hover:border-primary">
              <div className="flex items-center justify-between gap-2"><div className="font-semibold">{o.businessName}</div><Badge variant={o.stage === "ACTIVATED" ? "default" : o.stage === "CANCELLED" ? "destructive" : "secondary"}>{o.stage === "CANCELLED" ? H("Cancelled", "रद्द") : o.stage ? t(`stage_${o.stage}`) : o.payment}</Badge></div>
              <div className="mt-0.5 text-xs text-muted-foreground">{o.bundle} · {inr(o.monthly)} {t("per_month")} · {o.id} · {t("expected_by")} {fmtDate(o.goLive, lang)}</div>
            </Card>
          </Link>
        ))}
        {me.quotes.filter((q) => !q.orderId).length > 0 && <div className="pt-1 text-xs font-semibold text-muted-foreground">{t("my_quotes")}</div>}
        {me.quotes.filter((q) => !q.orderId).map((q) => (
          <Link key={q.id} href={`/quote/${q.id}`} className="block"><Card className="flex items-center justify-between p-3 text-sm hover:border-primary"><span>{q.bundle} · <span className="font-mono text-xs">{q.id}</span></span><span className="text-xs text-muted-foreground">{fmtTime(q.createdAt, lang)}</span></Card></Link>
        ))}
      </section>

      {/* notifications */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{H("How we update you", "हम आपको कैसे बताएँ")}</h2>
        <Card className="divide-y p-0 text-sm">
          {([["notifyWhatsapp", H("Order updates on WhatsApp", "WhatsApp पर ऑर्डर अपडेट")], ["notifySms", H("Order updates by SMS", "SMS पर ऑर्डर अपडेट")], ["notifyEmail", H("Order updates by email", "ईमेल पर ऑर्डर अपडेट")], ["marketingOptIn", H("Offers and new products (marketing)", "ऑफ़र और नए प्रोडक्ट (मार्केटिंग)")]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-3 px-3.5 py-3"><span>{label}</span><Switch checked={u[k]} onCheckedChange={(c) => patch({ [k]: !!c })} aria-label={label} /></label>
          ))}
        </Card>
        <p className="text-[11px] text-muted-foreground">{H("Service updates are about your own orders. Marketing is separate and stays off unless you turn it on.", "सर्विस अपडेट सिर्फ़ आपके ऑर्डर के बारे में होते हैं। मार्केटिंग अलग है और आपके चालू किए बिना बंद रहती है।")}</p>
      </section>

      {/* devices */}
      <section className="space-y-2">
        <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><MonitorSmartphone className="size-4 text-primary" />{H("Signed-in devices", "साइन-इन डिवाइस")}</h2>
          {me.sessions.length > 1 && <Button size="sm" variant="ghost" onClick={async () => { await api("DELETE", "/api/me/sessions", { others: true }); toast.success(H("Other devices signed out", "दूसरे डिवाइस साइन आउट")); load(); }}>{H("Sign out others", "बाकी साइन आउट")}</Button>}</div>
        <Card className="divide-y p-0 text-sm">
          {me.sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <div><div>{device(s.userAgent)}{s.current && <Badge variant="secondary" className="ml-2 text-[10px]">{H("This device", "यह डिवाइस")}</Badge>}</div><div className="text-[11px] text-muted-foreground">{H("last active", "आख़िरी बार")} {fmtTime(s.lastSeenAt, lang)}</div></div>
              {!s.current && <Button size="sm" variant="ghost" onClick={async () => { await api("DELETE", "/api/me/sessions", { id: s.id }); load(); }}>{H("Sign out", "साइन आउट")}</Button>}
            </div>
          ))}
        </Card>
      </section>

      {/* privacy */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t("my_data")}</h2>
        <a href="/api/me/export" className="block"><Button variant="outline" className="w-full gap-2"><Download className="size-4" />{H("Download my data (JSON)", "मेरा डेटा डाउनलोड करें (JSON)")}</Button></a>
        <p className="text-xs text-muted-foreground">{H("Deleting your account erases your profile, businesses, conversations, plans, KYC details, consent records and support requests. Orders are contract records and are kept anonymised.", "अकाउंट हटाने पर आपकी प्रोफ़ाइल, बिज़नेस, बातचीत, प्लान, KYC जानकारी, सहमति और सहायता अनुरोध मिट जाते हैं। ऑर्डर अनुबंध रिकॉर्ड हैं और गुमनाम रूप में रखे जाते हैं।")}</p>
        <Button variant="outline" className="w-full gap-2 text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />{H("Delete my account", "मेरा अकाउंट हटाएँ")}</Button>
      </section>

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
