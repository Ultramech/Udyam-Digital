"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, ArrowRight, ChevronDown, ChevronRight, MapPin, TrendingUp, Gauge, Gift, Headset, Layers, LayoutGrid, ReceiptText, ShoppingBag, Store, UserRoundCheck, Users, Wifi } from "lucide-react";
import { AvailabilityCheck } from "@/components/customer/availability-check";
import { OrderStatus, Row, SectionTitle } from "@/components/customer/kit";
import { BotCards } from "@/components/customer/bot-cards";
import { SearchLauncher } from "@/components/customer/search-sheet";
import { AdvisorBox, advisorHref, useBundleSamples, Welcome } from "@/components/landing/welcome";
import { CustomerShell } from "@/components/customer/shell";
import { PromoCarousel } from "@/components/customer/promo-carousel";
import { CuratedTrain } from "@/components/customer/curated-train";
import { CoinsCard } from "@/components/customer/coins-card";
import { TalkToPerson } from "@/components/customer/talk-person";
import { useVerify } from "@/components/customer/verify";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, useJourney } from "@/lib/client/api";
import { useRewards } from "@/lib/client/use-rewards";
import { CATALOGUE } from "@/lib/catalogue";
import { plainName } from "@/lib/catalogue/plain";
import { areaLabel } from "@/lib/i18n/maturity";
import { cn } from "@/lib/utils";
import type { QuoteView } from "@/lib/client/types";
import { fmtDate, inr } from "@/lib/client/format";

interface Me {
  user: { name: string | null };
  businesses: { id: string; name: string; city: string | null; businessType?: string | null }[];
  orders: { id: string; token: string; businessName: string; bundle: string; stage: string | null; payment: string; kycStatus: string; monthly: number; goLive: string }[];
  quotes: { id: string; bundle: string; orderId: string | null; createdAt: number }[];
}

export default function Home() {
  return <CustomerShell><HomeBody /></CustomerShell>;
}

function HomeBody() {
  const { account, verified } = useVerify();
  if (verified === null) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-9 w-2/3" /><Skeleton className="h-52" /><Skeleton className="h-28" /></div>;
  return account ? <Dashboard name={account.name} /> : <Welcome />;
}

/* ------------------------------------------------------------------ signed in */

function Dashboard({ name }: { name: string | null }) {
  const { t, lang } = useI18n();
  const journey = useJourney();
  const samples = useBundleSamples();
  const rewards = useRewards();
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<QuoteView | null>(null);
  const [cat, setCat] = useState("all");
  useEffect(() => { api<Me>("GET", "/api/me").then(setMe).catch(() => setMe({ user: { name }, businesses: [], orders: [], quotes: [] })); }, [name]);

  const business = me?.businesses[0];
  const order = me?.orders.find((o) => o.stage !== "CANCELLED");
  const open = me?.quotes.find((q) => !q.orderId);
  const quoteId = open?.id ?? (journey?.quoteId && !me?.quotes.some((q) => q.id === journey.quoteId && q.orderId) ? journey.quoteId : undefined) ?? me?.quotes[0]?.id;
  useEffect(() => { if (quoteId) api<QuoteView>("GET", `/api/quote/${quoteId}`).then(setView).catch(() => setView(null)); }, [quoteId]);
  const live = order?.stage === "ACTIVATED";

  // setup progress is read from real state: profile, plan, KYC, payment, live
  const done = [true, !!(open || quoteId || order), !!order && (order.kycStatus === "verified" || order.kycStatus === "approved"), !!order && order.payment === "success", live];
  const pct = Math.round((done.filter(Boolean).length / done.length) * 100);
  const next = live ? "next_live" : !order ? (quoteId ? "next_review" : "next_choose") : order.payment !== "success" ? "next_pay" : !done[2] ? "next_kyc" : "next_wait";
  const href = order ? `/track/${order.id}?t=${order.token}` : quoteId ? `/quote/${quoteId}` : "/advisor";
  const tiles = [
    { href: "/advisor", icon: ShoppingBag, k: "home_t_buy" }, { href: "/orders", icon: Layers, k: "home_t_orders" },
    { href: "/support", icon: Headset, k: "home_t_support" }, { href: "/catalogue", icon: LayoutGrid, k: "q_plans" },
    { href: "#fibre", icon: Wifi, k: "q_fibre" }, { href: quoteId ? `/quote/${quoteId}` : "/advisor", icon: ReceiptText, k: "q_bill" },
    { href: "/rewards", icon: Gift, k: "q_rewards" }, { href: live && order ? `/track/${order.id}?t=${order.token}` : "/rewards", icon: Users, k: "q_refer" },
  ];
  const maturity = view?.maturity;
  const cats = ["all", ...new Set(CATALOGUE.map((p) => p.category))].slice(0, 6);
  const seen = new Set<string>();
  // one tile per distinct service name (the 100/300/1000 Mbps variants share a name here; the catalogue page lists each)
  const shelf = CATALOGUE.filter((p) => cat === "all" || p.category === cat).filter((p) => { const n = plainName(p.id, lang).split(" (")[0]; if (seen.has(n)) return false; seen.add(n); return true; }).slice(0, 6);
  const profileFor = business?.businessType ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.875rem] font-extrabold leading-tight tracking-tight">{t("hello")}{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <Link href="/account" className="mt-1 inline-flex min-h-9 max-w-full items-center gap-1.5 text-[0.9375rem] text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden /><span className="truncate">{business ? `${business.name}${business.city ? `, ${business.city}` : ""}` : t("home_sub")}</span><ChevronDown className="size-4 shrink-0" aria-hidden />
          </Link>
        </div>
        {rewards && <Link href="/rewards" className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#FFF1CC] px-3.5 py-2 text-sm font-bold text-[#7A4B00] shadow-card"><Award className="size-4" aria-hidden />{t(`tier_${rewards.tier}`)}, <span className="num">{rewards.balance}</span></Link>}
      </div>

      <SearchLauncher />

      {!me ? <Skeleton className="h-48 rounded-3xl" /> : (
        <PromoCarousel setup={live ? null : { pct, href, next: `${t(next)}${order ? ` ${t("home_goes_live")}: ${fmtDate(order.goLive, lang)}` : ""}` }} />
      )}

      <section aria-label={t("home_quick")} className="grid grid-cols-4 gap-2.5">
        {tiles.map(({ href: h, icon: I, k }) => (
          <Link key={k} href={h} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border bg-card shadow-card px-1 py-3 text-center shadow-card transition-colors hover:border-primary">
            <I className="size-7 text-primary" strokeWidth={1.75} aria-hidden /><span className="text-[0.8125rem] font-semibold leading-tight">{t(k)}</span>
          </Link>
        ))}
      </section>

      {rewards && <CoinsCard rewards={rewards} />}

      <section aria-label={t("growth_title")}>
        <SectionTitle action={quoteId ? <Link href={`/quote/${quoteId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t("growth_roadmap")}</Link> : undefined}>{t("growth_title")}</SectionTitle>
        {maturity ? (
          <Card className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-0 p-4">
            <div className="pr-4"><p className="text-sm text-muted-foreground">{t("growth_score")}</p>
              <div className="num mt-1 flex items-baseline gap-1.5"><span className="text-[2.5rem] font-extrabold leading-none text-primary">{maturity.after.total}</span><span className="text-muted-foreground">/100</span></div>
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success"><TrendingUp className="size-3.5" aria-hidden />+{Math.max(0, maturity.after.total - maturity.before.total)} <span className="font-semibold">{t("growth_with").replace("/100 ", "")}</span></span></div>
            <div className="space-y-3 border-l pl-4">
              {maturity.after.areas.slice(0, 3).map((a, i) => (
                <div key={a.area} className="text-sm"><span className="block truncate">{areaLabel(a.area, lang)}</span>
                  <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden><div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${(a.score / 20) * 100}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(maturity.before.areas[i].score / 20) * 100}%` }} /></div></div>
              ))}
            </div>
          </Card>
        ) : (
          <Link href="/advisor" className="flex items-center gap-3 rounded-2xl border bg-card shadow-card p-4 shadow-card"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><Gauge className="size-6" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block font-bold">{t("growth_none_t")}</span><span className="block text-sm text-muted-foreground">{t("growth_none_s")}</span></span><ChevronRight className="size-5 text-muted-foreground" aria-hidden /></Link>
        )}
      </section>

      <AdvisorBox signedIn />

      <section>
        <SectionTitle action={<Link href="/catalogue" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">{t("view_all")}<ArrowRight className="size-4" aria-hidden /></Link>}>{t("cur_title")}</SectionTitle>
        <CuratedTrain samples={samples} href={advisorHref(true)} badge={profileFor ? t("cur_for").replace("{type}", profileFor) : t("ld_popular")} />
      </section>

      <section>
        <SectionTitle action={<Link href="/catalogue" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t("exp_all").replace("{n}", String(CATALOGUE.length))}</Link>}>{t("exp_title")}</SectionTitle>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" role="group" aria-label={t("exp_title")}>
          {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{c === "all" ? t("filter_all") : c}</button>)}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {shelf.map((p) => (
            <Link key={p.id} href={`/catalogue?s=${encodeURIComponent(plainName(p.id, lang).split(" (")[0])}`} className="flex flex-col gap-1.5 rounded-2xl border bg-card shadow-card p-3 shadow-card transition-colors hover:border-primary">
              <ProductIcon id={p.id} className="size-6 text-primary" /><span className="line-clamp-2 text-[0.8125rem] font-bold leading-tight">{plainName(p.id, lang).split(" (")[0]}</span><span className="text-xs text-muted-foreground">{t("exp_from")} {inr(p.priceMin)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label={t("grp_title")}>
        <SectionTitle>{t("grp_title")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Link href={advisorHref(true, t("ld_ind_multi_q"))} className="flex flex-col rounded-3xl border bg-card shadow-card p-4 shadow-card"><Store className="size-6 text-primary" aria-hidden /><h3 className="mt-2 font-extrabold">{t("grp_group")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("grp_group_d")}</p><span className="mt-auto pt-3 text-sm font-bold text-primary">{t("grp_branch")}</span></Link>
          <Link href={live && order ? `/track/${order.id}?t=${order.token}` : "/rewards"} className="hero-red flex flex-col rounded-3xl p-4"><Gift className="size-6" aria-hidden /><h3 className="mt-2 font-extrabold">{t("grp_refer")}</h3><p className="mt-1 text-sm opacity-90">{t("grp_refer_d")}</p><span className="mt-auto pt-3 text-sm font-bold">{live ? t("grp_link") : t("grp_refer_wait")}</span></Link>
        </div>
      </section>

      <div id="fibre" className="scroll-mt-20"><AvailabilityCheck lang={lang} /></div>

      {(me?.orders.length ?? 0) > 0 && (
        <section>
          <SectionTitle action={<Link href="/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t("view_all")}</Link>}>{t("orders_title")}</SectionTitle>
          <div className="space-y-2.5">{me!.orders.slice(0, 2).map((o) => <Row key={o.id} href={`/track/${o.id}?t=${o.token}`} icon={<ProductIcon id="P01" className="size-5" />} title={o.bundle} sub={`${o.businessName}, ${inr(o.monthly)}${t("per_month")}`} right={<OrderStatus stage={o.stage} payment={o.payment} />} />)}</div>
        </section>
      )}

      <BotCards />

      <Card className="flex-row items-center gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><UserRoundCheck className="size-6" aria-hidden /></span>
        <div className="min-w-0 flex-1"><div className="text-[0.9375rem] font-bold">{t("home_help_title")}</div><p className="text-sm text-muted-foreground">{t("home_help_sub")}</p></div>
        <TalkToPerson compact />
      </Card>
    </div>
  );
}
