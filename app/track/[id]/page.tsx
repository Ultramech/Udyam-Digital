"use client";
import Link from "next/link";
import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, HardHat, Headset, PartyPopper, Phone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapse, SectionTitle, StageTrack } from "@/components/customer/kit";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { plainName } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { api, ApiError } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";
import { STAGES, type ItemStatus, type Order, type OrderEvent, type Stage } from "@/lib/store/types";
import type { KycView } from "@/lib/store/kycView";
import { cn } from "@/lib/utils";
import { ChannelLinks } from "@/components/customer/channel-links";
import { BalanceCard } from "@/components/customer/balance-card";
import { OrderActions } from "@/components/customer/order-actions";

interface View { order: Order & { phoneMasked?: string }; events: OrderEvent[]; kyc: KycView | null }

/** Plain-language text for every action code the order can carry (never show a raw code to an owner). */
function actionText(a: { code: string; params?: Record<string, string | number> } | undefined, lang: string): string {
  const hi = lang === "hi" || lang === "mr";
  switch (a?.code) {
    case "BALANCE_DUE": return hi ? `सेवा चालू करने के लिए बाकी ₹${Number(a.params?.amount ?? 0).toLocaleString("en-IN")} चुकाएँ।` : `Pay the remaining ₹${Number(a.params?.amount ?? 0).toLocaleString("en-IN")} so we can switch your services on.`;
    case "NO_ENGINEER_AVAILABLE": return hi ? "आपके इलाके में अभी कोई इंजीनियर खाली नहीं है — हमारी टीम जल्द स्लॉट तय करेगी।" : "No engineer is free in your area yet — our team is arranging a slot.";
    case "KYC_ACTION_NEEDED": return hi ? "एक दस्तावेज़ ठीक करना है।" : "One document needs fixing.";
    default: return hi ? "हमारी टीम को आपसे एक चीज़ चाहिए — हम संपर्क करेंगे।" : "Our team needs one thing from you — we'll be in touch.";
  }
}

function Inner({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const isNew = params.get("new") === "1";
  const [v, setV] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ date: string; window: string }[] | null>(null);
  const [referral, setReferral] = useState<string | null>(null);

  const load = useCallback(() => api<View>("GET", `/api/orders/${id}?t=${token}`).then((r) => { setV(r); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.code : "ERROR")), [id, token]);
  useEffect(() => { load(); const h = setInterval(load, 4000); return () => clearInterval(h); }, [load]); // the tracker reads live state, so it keeps itself fresh

  const loadSlots = useCallback(() => api<{ open: boolean; slots: { date: string; window: string }[] }>("GET", `/api/orders/${id}/slots?t=${token}`).then((r) => setSlots(r.open ? r.slots : null)).catch(() => setSlots(null)), [id, token]);
  const stageNow = v?.order.stage;
  const slotsOpen = !!stageNow && stageNow !== "INSTALL_IN_PROGRESS" && stageNow !== "ACTIVATED" && !v?.order.cancelled;
  useEffect(() => { if (slotsOpen) loadSlots(); }, [slotsOpen, loadSlots]);
  async function book(date: string, window: string) {
    try { await api("POST", `/api/orders/${id}/slots`, { t: token, date, window }); toast.success((lang === "hi" || lang === "mr") ? "स्लॉट तय हो गया।" : "Slot booked."); load(); loadSlots(); }
    catch (e) { toast.error(e instanceof ApiError && e.code === "SLOT_TAKEN" ? ((lang === "hi" || lang === "mr") ? "यह स्लॉट अभी भर गया — दूसरा चुनें।" : "That slot was just taken — pick another.") : t("error_generic")); loadSlots(); }
  }

  async function getReferral() {
    try { setReferral((await api<{ url: string }>("GET", `/api/orders/${id}/referral?t=${token}`)).url); } catch { toast.error(t("error_generic")); }
  }

  async function callback() {
    try { await api("POST", `/api/orders/${id}/chase`, { t: token }); toast.success((lang === "hi" || lang === "mr") ? "कॉलबैक का अनुरोध दर्ज हुआ।" : "Callback requested."); load(); } catch { toast.error(t("error_generic")); }
  }

  if (error === "INVALID_TRACKING_LINK" || error === "ORDER_NOT_FOUND") return <Card className="p-4 text-sm">{(lang === "hi" || lang === "mr") ? "यह ट्रैकिंग लिंक सही नहीं है। अपने ऑर्डर का पूरा लिंक खोलें।" : "This tracking link isn't valid. Please open the full link from your order confirmation."}</Card>;
  if (!v) return <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  const { order: o, events, kyc } = v;
  const idx = o.stage ? STAGES.indexOf(o.stage) : -1;
  const done = o.stage === "ACTIVATED";
  const sites = [...new Set(o.items.map((i) => i.siteIndex ?? 0))].sort();
  const statusLabel: Record<ItemStatus, string> = { waiting: t("st_waiting"), scheduled: t("st_scheduled"), in_progress: t("st_in_progress"), live: t("st_live") };
  const statusCls: Record<ItemStatus, string> = { waiting: "bg-muted text-muted-foreground", scheduled: "bg-info/10 text-info", in_progress: "bg-warning/15 text-warning", live: "bg-success/10 text-success" };
  const last = events.at(-1);

  return (
    <div className="space-y-4 pb-10">
      {isNew && o.payment.status === "success" && (
        <Card className="space-y-1 border-success/40 bg-success/5 p-4"><div className="flex items-center gap-2 text-lg font-bold"><PartyPopper className="size-5 text-success" />{t("order_placed")}</div>
          <div className="text-sm">{t("order_id")} <b className="font-mono">{o.id}</b> · {bundleName(o.bundleId, lang)}</div><p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "इस पेज को बुकमार्क करें — कॉल करने की ज़रूरत नहीं, यहीं पूरी स्थिति दिखेगी।" : "Bookmark this page — you won't need to call us. Everything is tracked here."}</p></Card>
      )}

      <section aria-label={t("track_title")} className="rounded-3xl bg-foreground p-5 text-background">
        <h1 className="sr-only">{t("track_title")}</h1>
        <div className="flex items-center justify-between gap-3 text-sm opacity-75"><span className="truncate">{bundleName(o.bundleId, lang)}</span><span className="shrink-0 font-mono text-xs">{o.id}</span></div>
        <div className="mt-3 text-[1.5rem] font-extrabold leading-tight">{o.cancelled ? t("order_cancelled") : done ? t("stage_ACTIVATED") : o.stage ? t(`stage_${o.stage}`) : t("order_unpaid")}</div>
        {!o.cancelled && (
          <>
            <div className="mt-1 text-sm opacity-75">{done ? o.businessName : `${t("expected_by")} ${fmtDate(o.goLive, lang as "en")}`}</div>
            <StageTrack stage={o.stage ?? null} className="mt-4 text-background" />
          </>
        )}
        {!o.stage && !o.cancelled && (
          <>
            <p className="mt-3 text-sm opacity-85">{o.payment.status === "failed" ? t("pay_failed_msg") : o.payment.status === "processing" ? t("pay_pending_msg") : t("pay_to_place")}</p>
            <Link href={`/order/${o.quoteId}/checkout`} className="mt-4 block"><Button size="lg" className="w-full">{t("pay_now")}</Button></Link>
          </>
        )}
        {last && !o.cancelled && <div className="mt-4 border-t border-background/20 pt-3 text-sm opacity-75">{t("last_update")}: {fmtDate(last.at, lang as "en")}</div>}
      </section>

      {o.cancelled && <OrderActions o={o} token={token} lang={lang} onChange={load} />}

      {o.delayed && !o.cancelled && <Card className="flex flex-row gap-2 border-warning/50 bg-warning/10 p-3.5 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /><div><div className="font-semibold">{t("delayed")}</div><p>{o.delayed.reason}. {t("expected_by")} <b>{fmtDate(o.delayed.newEta, lang as "en")}</b>. {(lang === "hi" || lang === "mr") ? "कॉल करने की ज़रूरत नहीं।" : "No need to call us."}</p></div></Card>}

      {!o.cancelled && ((o.actionNeeded && o.actionNeeded.code !== "BALANCE_DUE") || o.kycStatus === "reupload" || o.kycStatus === "review") && (
        <Card className="space-y-2 border-warning/30 bg-warning-soft p-4 text-sm">
          <div className="font-semibold">{t("action_needed")}</div>
          <p>{o.kycStatus === "review" ? t("kyc_review_note") : o.kycStatus === "reupload" ? ((lang === "hi" || lang === "mr") ? "एक दस्तावेज़ दोबारा चाहिए।" : "One document needs to be re-uploaded.") : actionText(o.actionNeeded, lang)}</p>
          {o.kycStatus === "reupload" && <Link href={`/order/${o.quoteId}/kyc`}><Button size="sm">{t("upload")}</Button></Link>}
        </Card>
      )}

      {o.payment.balance?.status === "due" && !o.cancelled && <BalanceCard orderId={o.id} token={token} amount={o.payment.balance.amount} lang={lang} onPaid={load} />}

      {/* stages */}
      <Card className="p-4">
        <ol className="space-y-0">
          {STAGES.map((s: Stage, i) => {
            const reached = i <= idx, current = i === idx && !done;
            return (
              <li key={s} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn("flex size-6 items-center justify-center rounded-full border-2 text-xs", reached ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground", current && "ring-4 ring-primary/20")}>{reached ? <Check className="size-3.5" /> : i + 1}</span>
                  {i < STAGES.length - 1 && <span className={cn("w-0.5 flex-1", i < idx ? "bg-primary" : "bg-border")} style={{ minHeight: 22 }} />}
                </div>
                <div className="pb-4"><div className={cn("text-sm font-medium", !reached && "text-muted-foreground")}>{t(`stage_${s}`)}</div><div className="text-xs text-muted-foreground">{reached && o.stageHistory.find((h) => h.stage === s) ? fmtDate(o.stageHistory.find((h) => h.stage === s)!.at, lang as "en") : fmtDate(o.stageDates[s], lang as "en")}</div></div>
              </li>
            );
          })}
        </ol>
        <p className="border-t pt-2 text-xs text-muted-foreground">{t("demo_timeline")}{last ? ` · ${t("last_update")}: ${fmtDate(last.at, lang as "en")}` : ""}</p>
      </Card>

      {/* per-location, per-product lanes */}
      {o.stage && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold">{t("per_product")}</h2>
          {sites.map((s) => (
            <Card key={s} className="p-3">
              {sites.length > 1 && <div className="mb-2 text-xs font-semibold text-muted-foreground">{t("site_n")} {s + 1}{o.sites[s]?.address ? ` · ${o.sites[s].address.slice(0, 40)}` : ""}</div>}
              <ul className="space-y-2">
                {o.items.filter((i) => (i.siteIndex ?? 0) === s).map((i, k) => (
                  <li key={k} className="flex items-center gap-2.5"><ProductIcon id={i.productId} className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1"><div className="truncate text-sm">{plainName(i.productId, lang)}{i.qty > 1 ? ` × ${i.qty}` : ""}</div><div className="text-xs text-muted-foreground">{fmtDate(i.etaDate, lang as "en")}</div></div>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusCls[i.status])}>{statusLabel[i.status]}</span></li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      )}

      {slotsOpen && slots && slots.length > 0 && (
        <Card className="space-y-2 p-3.5">
          <div className="text-sm font-semibold">{o.engineer ? ((lang === "hi" || lang === "mr") ? "स्लॉट बदलें" : "Change your installation slot") : ((lang === "hi" || lang === "mr") ? "इंस्टॉलेशन का समय चुनें" : "Choose your installation slot")}</div>
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => {
              const cur = o.engineer?.date === s.date && o.engineer?.window === s.window;
              return <Button key={`${s.date}${s.window}`} size="sm" variant={cur ? "default" : "outline"} onClick={() => book(s.date, s.window)}>{fmtDate(s.date, lang)} · {s.window}</Button>;
            })}
          </div>
        </Card>
      )}
      {o.engineer && (
        <Card className="flex flex-row items-center gap-3 p-3.5"><span className="flex size-10 items-center justify-center rounded-full bg-secondary text-foreground"><HardHat className="size-5" /></span>
          <div className="flex-1 text-sm"><div className="text-xs text-muted-foreground">{t("engineer")}</div><div className="font-semibold">{o.engineer.name}</div><div className="text-xs text-muted-foreground">{t("slot")}: {o.engineer.slot}</div>{o.engineer.enRoute && <Badge className="mt-1 gap-1" role="status"><HardHat className="size-3" />{(lang === "hi" || lang === "mr") ? "रास्ते में हैं" : "On the way"}</Badge>}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="size-3.5" />{o.engineer.phoneMasked}</div></Card>
      )}

      <Collapse title={t("qc_details")}>
        <dl className="space-y-2 text-[0.9375rem]">
          {([[t("order_id"), o.id], [t("kyc_status"), kyc?.review ? `${o.kycStatus}, ${t(kyc.review.decision)}` : o.kycStatus], [t("payment"), o.payment.status], [t("per_month"), inr(o.totals.monthly)]] as const).map(([k, val]) => (
            <div key={k} className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="num text-right font-semibold">{val}</dd></div>
          ))}
        </dl>
      </Collapse>

      <section>
        <SectionTitle>{t("updates")}</SectionTitle>
        {events.length === 0 ? <p className="text-sm text-muted-foreground">{t("upd_none")}</p> : (
          <ol className="space-y-4 border-l-2 border-border pl-5">
            {[...events].reverse().map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[1.6rem] top-2 size-2.5 rounded-full bg-foreground" aria-hidden />
                <div className="whitespace-pre-wrap text-[0.9375rem]">{e.text}</div>
                <div className="num mt-0.5 text-xs text-muted-foreground">{fmtDate(e.at, lang as "en")}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!o.cancelled && <OrderActions o={o} token={token} lang={lang} onChange={load} />}
      {o.stage && !done && !o.cancelled && <Button variant="outline" className="w-full gap-2" onClick={callback}><Headset className="size-4" />{t("request_callback")}</Button>}
      {o.stage && !done && !o.cancelled && <div className="space-y-1.5"><p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "अपडेट चैट पर पाएँ (वही नंबर इस्तेमाल करें जिससे ऑर्डर किया):" : "Get updates on chat (use the number you ordered with):"}</p><ChannelLinks lang={lang} prefill="track" /></div>}
      {done && (
        <Card className="space-y-2 p-3.5 text-sm">
          <div className="font-semibold">{(lang === "hi" || lang === "mr") ? "किसी और बिज़नेस को बताएँ" : "Know another business owner?"}</div>
          <p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "अपना रेफ़रल लिंक भेजें — उनकी पूछताछ आपके नाम से दर्ज होगी।" : "Send your referral link — their enquiry is recorded as your referral."}</p>
          {!referral ? <Button size="sm" variant="outline" onClick={getReferral}>{(lang === "hi" || lang === "mr") ? "मेरा रेफ़रल लिंक" : "Get my referral link"}</Button>
            : <div className="flex flex-wrap items-center gap-2"><input readOnly value={referral} aria-label="Referral link" className="min-w-0 flex-1 rounded-md border bg-muted px-2 py-1.5 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} /><a className="inline-flex h-8 items-center rounded-md bg-[#008069] px-3 text-xs font-medium text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(referral)}`}>WhatsApp</a></div>}
        </Card>
      )}
      {done && <div className="flex gap-2"><Link href="/account" className="flex-1"><Button className="w-full">{t("add_service")}</Button></Link><Link href="/advisor" className="flex-1"><Button variant="outline" className="w-full">{t("referral_after")}</Button></Link></div>}
    </div>
  );
}

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CustomerShell><Suspense fallback={<Skeleton className="h-64" />}><Inner id={id} /></Suspense></CustomerShell>;
}
