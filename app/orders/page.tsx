"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronRight, CircleX, CreditCard, FileCheck2, FileText, Layers, MapPin,
  RefreshCw, ShieldAlert, Sparkles, Store, Upload, Video, Wifi, Wrench,
} from "lucide-react";
import { Empty } from "@/components/customer/kit";
import { CustomerShell } from "@/components/customer/shell";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";
import { cn } from "@/lib/utils";

interface Order {
  id: string; token: string; businessName: string; bundle: string; stage: string | null; payment: string; kycStatus: string; monthly: number; goLive: string; createdAt: number;
  services: number; city: string | null; activatedAt: string | null; cancelledAt: number | null;
}
interface Me { orders: Order[]; quotes: { id: string; bundle: string; orderId: string | null; createdAt: number }[] }

type Tab = "all" | "progress" | "active" | "done";
type Icon = ComponentType<{ className?: string }>;
const INSTALL = ["FEASIBILITY", "INSTALL_SCHEDULED", "INSTALL_IN_PROGRESS"];
const kind = (o: Order): Exclude<Tab, "all"> => (o.stage === "CANCELLED" || o.cancelledAt ? "done" : o.stage === "ACTIVATED" ? "active" : "progress");
const kycOk = (o: Order) => o.kycStatus === "verified" || o.kycStatus === "approved";
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
function BundleIcon({ name, className }: { name: string; className?: string }) {
  if (/office/i.test(name)) return <BriefcaseBusiness className={className} />;
  if (/cctv|camera|secure/i.test(name)) return <Video className={className} />;
  if (/connect|fibre|internet/i.test(name)) return <Wifi className={className} />;
  return <Store className={className} />;
}

/** Which of the four customer-facing steps the order is on: 0 placed, 1 KYC, 2 installation, 3 activation, 4 = all done. */
function stepOf(o: Order) {
  if (o.stage === "ACTIVATED") return 4;
  if (o.stage && INSTALL.includes(o.stage)) return 2;
  if (!kycOk(o)) return 1;
  return o.payment === "success" ? 2 : 1;
}

export default function OrdersPage() { return <CustomerShell><Orders /></CustomerShell>; }

function Orders() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  useEffect(() => { api<Me>("GET", "/api/me").then(setMe).catch(() => setMe({ orders: [], quotes: [] })); }, []);

  const counts = useMemo(() => {
    const c = { all: 0, progress: 0, active: 0, done: 0 };
    for (const o of me?.orders ?? []) { c.all++; c[kind(o)]++; }
    return c;
  }, [me]);

  if (!me) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-16 w-2/3" /><Skeleton className="h-11" /><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-24" /></div>;
  const shown = me.orders.filter((o) => tab === "all" || kind(o) === tab);
  const saved = me.quotes.filter((q) => !q.orderId);
  const TABS: { id: Tab; label: string; icon: Icon }[] = [
    { id: "all", label: H("All", "सभी"), icon: Layers }, { id: "progress", label: H("In Progress", "जारी"), icon: RefreshCw },
    { id: "active", label: H("Active", "चालू"), icon: CheckCircle2 }, { id: "done", label: H("Completed", "पूरे"), icon: BriefcaseBusiness },
  ];

  return (
    <div className="space-y-5 pb-6">
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-40 w-48 rounded-bl-[6rem] bg-[radial-gradient(circle_at_100%_0%,oklch(0.62_0.2_25/.35),transparent_70%)]" />
        <h1 className="relative text-[1.875rem] font-extrabold leading-tight tracking-tight">{H("My Orders", "मेरे ऑर्डर")}</h1>
        <p className="relative mt-1 text-[0.9375rem] text-muted-foreground">{H("Track, manage and get support for your orders", "अपने ऑर्डर ट्रैक करें, संभालें और मदद पाएँ")}</p>
      </header>

      {me.orders.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={H("Order status", "ऑर्डर स्थिति")}>
          {TABS.map(({ id, label, icon: I }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold shadow-card transition-colors", tab === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40")}>
              <I className="size-4" />{label} <span className="num">({counts[id]})</span>
            </button>
          ))}
        </div>
      )}

      {me.orders.length === 0 && saved.length === 0 && (
        <Empty title={H("No orders yet", "अभी कोई ऑर्डर नहीं")} sub={H("Pick a plan and your order will appear here, with live status.", "प्लान चुनें, आपका ऑर्डर यहाँ लाइव स्थिति के साथ दिखेगा।")} action={<Link href="/advisor"><Button size="lg">{H("Get a plan", "प्लान लें")}<ArrowRight className="size-4" /></Button></Link>} />
      )}
      {me.orders.length > 0 && shown.length === 0 && <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">{H("No orders here.", "यहाँ कोई ऑर्डर नहीं।")}</p>}

      <div className="space-y-3">
        {shown.map((o) => (kind(o) === "progress" ? <ProgressCard key={o.id} o={o} H={H} lang={lang} /> : <CompactRow key={o.id} o={o} H={H} lang={lang} />))}
      </div>

      {saved.length > 0 && tab === "all" && (
        <section className="space-y-2">
          <h2 className="text-lg font-extrabold">{H("Saved plans", "सेव किए प्लान")}</h2>
          {saved.map((q) => (
            <Link key={q.id} href={`/quote/${q.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card hover:border-primary/40">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary"><FileText className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{q.bundle}</span><span className="block text-xs text-muted-foreground">{H("Saved", "सेव")} {fmtDate(iso(q.createdAt), lang)}</span></span>
              <span className="text-sm font-bold text-primary">{H("Continue", "जारी रखें")}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#D9182B,#E64A5A_70%,#F07A85)] p-5 pr-[38%] text-white shadow-lift">
        <Image src="/orders-help-bot.png" alt="" width={236} height={204} className="absolute bottom-0 right-0 -z-10 h-full w-auto max-w-[45%] object-cover object-left [mask-image:linear-gradient(to_right,transparent,black_25%)]" />
        <h2 className="text-lg font-extrabold leading-tight">{H("Need help with your order?", "ऑर्डर में मदद चाहिए?")}</h2>
        <p className="mt-1.5 text-[0.8125rem] leading-snug text-white/90">{H("Ask SYNC AI for real-time updates, KYC issues or installation support.", "लाइव अपडेट, KYC या इंस्टॉलेशन के लिए SYNC AI से पूछें।")}</p>
        <Link href="/support" className="mt-3.5 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-primary shadow-card transition-transform active:scale-[0.97]"><Sparkles className="size-4" />{H("Ask SYNC AI", "SYNC AI से पूछें")}</Link>
      </section>
    </div>
  );
}

function ProgressCard({ o, H, lang }: { o: Order; H: (en: string, h: string) => string; lang: string }) {
  const step = stepOf(o);
  const track = `/track/${o.id}?t=${o.token}`;
  const steps = [
    { label: H("Order Placed", "ऑर्डर हुआ"), sub: fmtDate(iso(o.createdAt), lang as "en") },
    { label: H("KYC Verification", "KYC जाँच"), sub: step === 1 ? (o.kycStatus === "review" ? H("In review", "जाँच में") : o.kycStatus === "reupload" ? H("Re-upload", "फिर अपलोड") : o.kycStatus === "blocked" ? H("Needs help", "मदद चाहिए") : kycOk(o) ? H("Payment due", "भुगतान बाकी") : H("Pending", "बाकी")) : undefined },
    { label: H("Installation", "इंस्टॉलेशन"), sub: step === 2 ? (o.stage === "INSTALL_IN_PROGRESS" ? H("Today", "आज") : H("Scheduled", "तय")) : undefined },
    { label: H("Activation", "चालू"), sub: undefined },
  ];

  // the one thing the owner can do next
  let call: { icon: Icon; title: string; sub: string; cta: string; href: string; tone?: "warn" };
  if (o.kycStatus === "pending") call = { icon: Upload, title: H("Upload your KYC documents", "KYC दस्तावेज़ अपलोड करें"), sub: H("Takes about 2 minutes on your phone.", "फ़ोन पर लगभग 2 मिनट।"), cta: H("Upload KYC", "KYC अपलोड"), href: `/order/${o.id}/kyc` };
  else if (o.kycStatus === "review") call = { icon: FileCheck2, title: H("KYC is under review", "KYC जाँच में है"), sub: H("We'll notify you once it's verified.", "पक्का होते ही हम बताएँगे।"), cta: H("View KYC", "KYC देखें"), href: `/order/${o.id}/kyc` };
  else if (o.kycStatus === "reupload") call = { icon: Upload, title: H("One document needs a re-upload", "एक दस्तावेज़ फिर अपलोड करें"), sub: H("We'll tell you exactly which one and why.", "कौन-सा और क्यों, हम बताएँगे।"), cta: H("Fix KYC", "KYC ठीक करें"), href: `/order/${o.id}/kyc`, tone: "warn" };
  else if (o.kycStatus === "blocked") call = { icon: ShieldAlert, title: H("KYC needs attention", "KYC पर ध्यान चाहिए"), sub: H("A person from our team will help you.", "हमारी टीम का व्यक्ति मदद करेगा।"), cta: H("Get help", "मदद लें"), href: "/support", tone: "warn" };
  else if (o.payment !== "success") call = { icon: CreditCard, title: H("Payment pending", "भुगतान बाकी"), sub: H("Pay to book your installation slot.", "इंस्टॉलेशन स्लॉट के लिए भुगतान करें।"), cta: H("Pay now", "भुगतान करें"), href: `/order/${o.id}/checkout` };
  else call = { icon: Wrench, title: H("Installation is on the way", "इंस्टॉलेशन जल्द"), sub: `${H("Expected to go live", "चालू होने की तारीख")} ${fmtDate(o.goLive, lang as "en")}`, cta: H("Track", "ट्रैक करें"), href: track };
  const CI = call.icon;

  return (
    <article className="surface-tint rounded-3xl border p-4 shadow-card">
      <Link href={track} className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-card"><BundleIcon name={o.bundle} className="size-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-extrabold leading-tight">{H("Order", "ऑर्डर")} #{o.id}</span>
          <span className="block truncate text-sm text-muted-foreground">{o.bundle}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-primary"><span className="size-2 rounded-full bg-primary" />{H("In Progress", "जारी")}</span>
      </Link>

      <ol className="mt-5 grid grid-cols-4" aria-label={H("Order progress", "ऑर्डर प्रगति")}>
        {steps.map((s, i) => {
          const done = i < step, cur = i === step;
          return (
            <li key={s.label} className="relative flex flex-col items-center text-center" aria-current={cur ? "step" : undefined}>
              {i > 0 && <span aria-hidden className={cn("absolute top-[0.8rem] h-0.5 w-[calc(100%-1.9rem)] right-[calc(50%+0.95rem)]", i <= step ? "bg-primary" : "bg-border")} />}
              <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-card", done ? "border-primary bg-primary text-primary-foreground" : cur ? "border-primary ring-4 ring-primary/15" : "border-muted-foreground/35")}>
                {done ? <Check className="size-4" strokeWidth={3} /> : cur ? <span className="size-3 rounded-full bg-primary" /> : null}
              </span>
              <span className={cn("mt-2 text-[0.6875rem] leading-tight", done || cur ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{s.label}</span>
              {done && i === 0 && <span className="mt-0.5 text-[0.625rem] text-muted-foreground">{s.sub}</span>}
              {cur && s.sub && <span className="mt-1 rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-bold text-primary">{s.sub}</span>}
            </li>
          );
        })}
      </ol>

      <div className={cn("mt-4 flex items-center gap-3 rounded-2xl border p-3", call.tone === "warn" ? "border-warning/30 bg-warning-soft" : "border-primary/10 bg-accent/60")}>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-white", call.tone === "warn" ? "text-warning" : "text-primary")}><CI className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{call.title}</span><span className="block text-xs text-muted-foreground">{call.sub}</span></span>
        <Link href={call.href} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-xs font-bold text-primary shadow-card hover:bg-accent">{call.cta}<ArrowRight className="size-3.5" /></Link>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x text-xs">
        <Meta icon={Wifi} k="" v={`${o.services} ${o.services === 1 ? H("service", "सेवा") : H("services", "सेवाएँ")}`} />
        <Meta icon={CalendarDays} k={H("Ordered on", "ऑर्डर तारीख")} v={fmtDate(iso(o.createdAt), lang as "en")} />
        <Meta icon={MapPin} k={H("Location", "लोकेशन")} v={o.city ?? "—"} />
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{H("Monthly", "हर महीने")} <b className="num text-foreground">{inr(o.monthly)}</b></span><span>{H("Goes live", "चालू")} <b className="num text-foreground">{fmtDate(o.goLive, lang as "en")}</b></span></div>
    </article>
  );
}

function Meta({ icon: I, k, v }: { icon: Icon; k: string; v: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-2 first:pl-0 last:pr-0">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><I className="size-4" /></span>
      <span className="min-w-0">{k && <span className="block truncate text-[0.625rem] text-muted-foreground">{k}</span>}<span className="block truncate font-bold">{v}</span></span>
    </div>
  );
}

function CompactRow({ o, H, lang }: { o: Order; H: (en: string, h: string) => string; lang: string }) {
  const k = kind(o);
  const date = k === "active" ? `${H("Activated on", "चालू हुआ")} ${fmtDate(o.activatedAt ?? o.goLive, lang as "en")}` : `${H("Closed on", "बंद हुआ")} ${fmtDate(iso(o.cancelledAt ?? o.createdAt), lang as "en")}`;
  return (
    <Link href={`/track/${o.id}?t=${o.token}`} className="flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-card transition-colors hover:border-primary/40">
      <span className="flex size-12 shrink-0 items-center justify-center self-start rounded-2xl bg-accent text-primary"><BundleIcon name={o.bundle} className="size-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-extrabold">{H("Order", "ऑर्डर")} #{o.id}</span>
        <span className="block truncate text-sm text-muted-foreground">{o.bundle}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{date}</span>
      </span>
      {k === "active"
        ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success"><Check className="size-3.5" />{H("Active", "चालू")}</span>
        : <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"><CircleX className="size-3.5" />{H("Cancelled", "रद्द")}</span>}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
