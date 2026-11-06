"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BookOpen, FileText, History, LifeBuoy, Package, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";
import { AccountProfile } from "@/components/customer/account-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { bundleName } from "@/lib/i18n/bundles";
import { api, clearJourney, useJourney, type Journey } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";
import type { BundleId } from "@/lib/rules/types";
import type { Order } from "@/lib/store/types";

interface Mine { quotes: { quoteId: string; bundleId: BundleId; orderId: string | null; consent: { id: string; purposes: { marketing: boolean; digilocker: boolean } } | null }[] }

function DeviceAccount() {
  const { t, lang } = useI18n();
  const [orders, setOrders] = useState<(Order & { phoneMasked?: string })[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const journey = useJourney(); // null until mounted: localStorage is never read during render/hydration
  const j: Journey = journey ?? { orders: [] };
  const [confirm, setConfirm] = useState(false);
  const orderKey = journey ? journey.orders.map((o) => `${o.id}:${o.token}`).join(",") : null;

  useEffect(() => {
    if (orderKey === null) return;
    const list = orderKey ? orderKey.split(",").map((x) => { const [id, token] = x.split(":"); return { id, token }; }) : [];
    Promise.all(list.map((o) => api<{ order: Order }>("GET", `/api/orders/${o.id}?t=${o.token}`).then((r) => r.order).catch(() => null))).then((r) => setOrders(r.filter(Boolean) as Order[]));
  }, [orderKey]);
  useEffect(() => { api<Mine>("GET", "/api/account").then(setMine).catch(() => setMine({ quotes: [] })); }, []);

  async function marketing(consentId: string, on: boolean) {
    try { await api("PATCH", "/api/consent", { id: consentId, marketing: on }); toast.success(t("consent_saved")); setMine((m) => m && { quotes: m.quotes.map((q) => (q.consent?.id === consentId ? { ...q, consent: { ...q.consent, purposes: { ...q.consent.purposes, marketing: on } } } : q)) }); } catch { toast.error(t("error_generic")); }
  }
  async function erase() {
    try { const r = await api<{ deleted: number }>("DELETE", "/api/account"); clearJourney(); setMine({ quotes: [] }); setOrders([]); toast.success((lang === "hi" || lang === "mr") ? `${r.deleted} रिकॉर्ड हटाए गए।` : `${r.deleted} records erased.`); } catch { toast.error(t("error_generic")); }
    setConfirm(false);
  }

  return (
    <>
      <div className="space-y-5 pb-10">
        <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{t("account_title")}</h1>
        <SignInPrompt />
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Link href="/notifications"><Card className="flex flex-col items-center gap-1 p-3 hover:border-primary"><Bell className="size-4" />{(lang === "hi" || lang === "mr") ? "सूचनाएँ" : "Notifications"}</Card></Link>
          <Link href="/support"><Card className="flex flex-col items-center gap-1 p-3 hover:border-primary"><LifeBuoy className="size-4" />{(lang === "hi" || lang === "mr") ? "मदद" : "Help"}</Card></Link>
          <Link href="/catalogue"><Card className="flex flex-col items-center gap-1 p-3 hover:border-primary"><BookOpen className="size-4" />{(lang === "hi" || lang === "mr") ? "सेवाएँ" : "Services"}</Card></Link>
        </div>

        <section className="space-y-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4" />{t("my_orders")}</h2>
          {orders.length === 0 && <Card className="p-3.5 text-sm text-muted-foreground">{t("no_orders")}</Card>}
          {orders.map((o) => {
            const tok = j.orders.find((x) => x.id === o.id)?.token ?? "";
            return (
              <Link key={o.id} href={`/track/${o.id}?t=${tok}`} className="block">
                <Card className="p-3.5 transition-colors hover:border-primary">
                  <div className="flex items-center justify-between gap-2"><div className="font-semibold">{o.businessName}</div><Badge variant={o.stage === "ACTIVATED" ? "default" : o.cancelled ? "destructive" : "secondary"}>{o.cancelled ? ((lang === "hi" || lang === "mr") ? "रद्द" : "Cancelled") : o.stage ? t(`stage_${o.stage}`) : o.payment.status}</Badge></div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{bundleName(o.bundleId, lang)} · {inr(o.totals.monthly)} {t("per_month")} {t("gst_extra")} · {o.id}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t("kyc_status")}: {o.kycStatus} · {t("expected_by")} {fmtDate(o.goLive, lang as "en")}</div>
                </Card>
              </Link>
            );
          })}
        </section>

        <section className="space-y-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4" />{t("my_quotes")}</h2>
          {j.quoteId && <Link href={`/quote/${j.quoteId}`}><Button variant="outline" className="w-full justify-start gap-2"><FileText className="size-4" />{t("resume")}</Button></Link>}
          {mine?.quotes.filter((q) => q.quoteId !== j.quoteId).map((q) => (
            <Link key={q.quoteId} href={`/quote/${q.quoteId}`} className="block"><Card className="flex flex-row items-center justify-between p-3 text-sm transition-colors hover:border-primary"><span>{bundleName(q.bundleId, lang)} · <span className="font-mono text-xs">{q.quoteId}</span></span><Badge variant="secondary">{q.orderId ? ((lang === "hi" || lang === "mr") ? "ऑर्डर हुआ" : "Ordered") : ((lang === "hi" || lang === "mr") ? "सेव" : "Saved")}</Badge></Card></Link>
          ))}
          {j.conversationId && <Link href={`/advisor?c=${j.conversationId}`}><Button variant="ghost" className="w-full justify-start">{t("cta_advisor")}</Button></Link>}
          {!j.quoteId && !j.conversationId && <Card className="p-3.5 text-sm text-muted-foreground">—</Card>}
        </section>

        <section className="space-y-2"><h2 className="text-sm font-semibold">{t("my_data")}</h2>
          {mine?.quotes.filter((q) => q.consent).map((q) => (
            <Card key={q.quoteId} className="space-y-2 p-3.5 text-sm">
              <div className="text-xs text-muted-foreground">{bundleName(q.bundleId, lang)} · {q.consent!.id}</div>
              <div className="flex items-center justify-between"><span>{t("withdraw_marketing")}</span><Switch checked={q.consent!.purposes.marketing} onCheckedChange={(c) => marketing(q.consent!.id, !!c)} aria-label={t("withdraw_marketing")} /></div>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "हटाने पर आपकी बातचीत, प्लान, KYC जानकारी और सहमति मिट जाती है। ऑर्डर एक अनुबंध रिकॉर्ड है और गुमनाम रूप में रखा जाता है।" : "Deleting erases your conversation, plans, KYC details and consent record. An order is a contract record and is kept in anonymised form."}</p>
          <Button variant="outline" className="w-full gap-2 text-destructive" onClick={() => setConfirm(true)}><Trash2 className="size-4" />{t("delete_request")}</Button>
        </section>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("delete_request")}</AlertDialogTitle><AlertDialogDescription>{(lang === "hi" || lang === "mr") ? "क्या आप सच में अपना डेटा हटाना चाहते हैं? यह वापस नहीं होगा।" : "Erase your data from this device and our records? This can't be undone."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={erase}>{t("delete_request")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SignInPrompt() {
  const { lang } = useI18n();
  const { ensureVerified } = useVerify();
  const hi = lang === "hi" || lang === "mr";
  return (
    <Card className="flex flex-row items-center gap-3 border-primary/30 bg-accent p-3.5 text-sm">
      <div className="flex-1">{hi ? "साइन इन करें ताकि आपके ऑर्डर, बिज़नेस और प्लान हर फ़ोन पर दिखें।" : "Sign in so your orders, businesses and plans follow you to any phone."}</div>
      <Button size="sm" onClick={() => ensureVerified()}>{hi ? "साइन इन" : "Sign in"}</Button>
    </Card>
  );
}

/** Signed in → full profile from the server; otherwise what this device holds. */
function Account() {
  const { account, verified } = useVerify();
  if (verified === null) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>;
  return account ? <AccountProfile /> : <DeviceAccount />;
}

export default function AccountPage() { return <CustomerShell><Account /></CustomerShell>; }
