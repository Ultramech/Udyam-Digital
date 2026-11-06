"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, ArrowRight, Check, ChevronRight, Circle, Gauge, Gift, Headset, Layers, LayoutGrid, ReceiptText, ShoppingBag, Store, UserRoundCheck, Users, Wifi } from "lucide-react";
import { AvailabilityCheck } from "@/components/customer/availability-check";
import { OrderStatus, Row, SectionTitle } from "@/components/customer/kit";
import { BotCards } from "@/components/customer/bot-cards";
import { SearchLauncher } from "@/components/customer/search-sheet";
import { AdvisorBox, advisorHref, useBundleSamples, Welcome } from "@/components/landing/welcome";
import { CustomerShell } from "@/components/customer/shell";
import { TalkToPerson } from "@/components/customer/talk-person";
import { useVerify } from "@/components/customer/verify";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { bundleName, bundleTagline } from "@/lib/i18n/bundles";
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
  const steps = ["step_profile", "step_plan", "step_kyc", "step_pay", "step_live"];
  const tiles = [
    { href: "/advisor", icon: ShoppingBag, k: "home_t_buy" }, { href: "/orders", icon: Layers, k: "home_t_orders" },
    { href: "/support", icon: Headset, k: "home_t_support" }, { href: "/catalogue", icon: LayoutGrid, k: "q_plans" },
    { href: "#fibre", icon: Wifi, k: "q_fibre" }, { href: quoteId ? `/quote/${quoteId}` : "/advisor", icon: ReceiptText, k: "q_bill" },
    { href: "/rewards", icon: Gift, k: "q_rewards" }, { href: live && order ? `/track/${order.id}?t=${order.token}` : "/rewards", icon: Users, k: "q_refer" },
  ];
  const todo = (rewards?.entries ?? []).filter((e) => !e.done && e.id !== "live" && e.id !== "profile").slice(0, 3);
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
          <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">{t("hello")}{name ? `, ${name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 truncate text-[0.9375rem] text-muted-foreground">{business ? `${business.name}${business.city ? `, ${business.city}` : ""}` : t("home_sub")}</p>
        </div>
        {rewards && <Link href="/rewards" className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[oklch(0.96_0.06_85)] px-3 py-1.5 text-xs font-bold text-[oklch(0.42_0.1_70)]"><Award className="size-4" aria-hidden />{t(`tier_${rewards.tier}`)}, <span className="num">{rewards.balance}</span></Link>}
      </div>

      <SearchLauncher />

      {!me ? <Skeleton className="h-44 rounded-3xl" /> : (
        <Link href={href} aria-label={t("setup_pct").replace("{n}", String(pct))} className="hero-red block rounded-3xl p-5 transition-transform active:scale-[0.99]">
          <div className="text-[1.125rem] font-extrabold leading-snug">{t("setup_pct").replace("{n}", String(pct))}</div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/15"><ArrowRight className="size-5" aria-hidden /></span>
          </div>
          <ol className="mt-3 flex gap-1.5" aria-hidden>{steps.map((k, i) => <li key={k} className={cn("flex-1 text-center text-[0.6875rem] font-semibold", done[i] ? "opacity-100" : "opacity-70")}><i className={cn("mb-1 block h-1.5 rounded-full", done[i] ? "bg-white" : "bg-white/30")} />{t(k)}</li>)}</ol>
          <p className="mt-3 text-[0.9375rem] opacity-90">{t(next)}{order && !live ? ` ${t("home_goes_live")}: ${fmtDate(order.goLive, lang)}` : ""}</p>
        </Link>
      )}

      <section aria-label={t("home_quick")} className="grid grid-cols-4 gap-2.5">
        {tiles.map(({ href: h, icon: I, k }) => (
          <Link key={k} href={h} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-1 py-3 text-center shadow-card transition-colors hover:border-primary">
            <I className="size-6 text-primary" aria-hidden /><span className="text-[0.8125rem] font-semibold leading-tight">{t(k)}</span>
          </Link>
        ))}
      </section>

      {rewards && (
        <section aria-label={t("coins_title")}>
          <SectionTitle action={<Link href="/rewards" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t("coins_see")}</Link>}>{t("coins_title")}</SectionTitle>
          <Card className="gap-4 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_28%,#FFE9A8,#F4B52E_55%,#C98A0B)] text-xl font-extrabold text-[#7A4B00] shadow-[inset_0_-3px_0_rgba(0,0,0,.12)]" aria-hidden>U</span>
              <div className="min-w-0 flex-1"><div className="num text-[1.75rem] font-extrabold leading-none">{rewards.balance}</div><p className="mt-1 text-sm text-muted-foreground">{t("coins_sub")}</p></div>
              <span className="rounded-full bg-[oklch(0.96_0.06_85)] px-3 py-1 text-xs font-bold text-[oklch(0.42_0.1_70)]">{t(`tier_${rewards.tier}`)}</span>
            </div>
            {rewards.next ? (
              <div><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rewards.next.pct}><div className="h-full rounded-full bg-gradient-to-r from-[#F4B52E] to-primary" style={{ width: `${rewards.next.pct}%` }} /></div>
                <p className="mt-1.5 text-sm text-muted-foreground">{t("coins_togo").replace("{n}", String(rewards.next.toGo)).replace("{tier}", t(`tier_${rewards.next.tier}`))}</p></div>
            ) : <p className="text-sm text-muted-foreground">{t("coins_top")}</p>}
            {todo.length > 0 && (
              <ul className="space-y-2.5 border-t pt-3 text-[0.9375rem]">
                {todo.map((e) => <li key={e.id} className="flex items-center gap-2.5"><Circle className="size-[1.125rem] text-muted-foreground/60" aria-hidden /><span className="flex-1">{t(`earn_${e.id === "paid" ? "paid" : e.id}`)}</span><b className="num text-primary">+{e.coins}</b></li>)}
              </ul>
            )}
          </Card>
        </section>
      )}

      <section aria-label={t("growth_title")}>
        <SectionTitle action={quoteId ? <Link href={`/quote/${quoteId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t("growth_roadmap")}</Link> : undefined}>{t("growth_title")}</SectionTitle>
        {maturity ? (
          <Card className="gap-3 p-4">
            <div><p className="text-sm text-muted-foreground">{t("growth_score")}</p><div className="num mt-0.5 flex items-baseline gap-2"><span className="text-[2rem] font-extrabold leading-none">{maturity.before.total}</span><span className="text-muted-foreground">→</span><span className="text-[2rem] font-extrabold leading-none text-primary">{maturity.after.total}</span><span className="text-sm text-muted-foreground">{t("growth_with")}</span></div></div>
            <div className="space-y-2.5">
              {maturity.after.areas.slice(0, 3).map((a, i) => (
                <div key={a.area} className="flex items-center gap-3 text-sm"><span className="w-28 shrink-0 truncate">{areaLabel(a.area, lang)}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden><div className="absolute inset-y-0 left-0 rounded-full bg-primary/35" style={{ width: `${(a.score / 20) * 100}%` }} /><div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(maturity.before.areas[i].score / 20) * 100}%` }} /></div></div>
              ))}
            </div>
          </Card>
        ) : (
          <Link href="/advisor" className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><Gauge className="size-6" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block font-bold">{t("growth_none_t")}</span><span className="block text-sm text-muted-foreground">{t("growth_none_s")}</span></span><ChevronRight className="size-5 text-muted-foreground" aria-hidden /></Link>
        )}
      </section>

      <AdvisorBox signedIn />

      <section>
        <SectionTitle action={<Link href="/catalogue" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">{t("view_all")}<ArrowRight className="size-4" aria-hidden /></Link>}>{t("cur_title")}</SectionTitle>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {samples.map((c, i) => (
            <article key={c.id} className={cn("flex w-64 shrink-0 snap-start flex-col rounded-3xl border bg-card p-4 shadow-card", i === 0 && "surface-tint")}>
              {i === 0 && <span className="mb-3 w-fit rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">{profileFor ? t("cur_for").replace("{type}", profileFor) : t("ld_popular")}</span>}
              <h3 className="text-lg font-extrabold">{bundleName(c.id, lang)}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{bundleTagline(c.id, lang)}</p>
              <ul className="mt-3 space-y-1.5 text-sm">{c.items.slice(0, 3).map((p) => <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{plainName(p, lang)}</li>)}</ul>
              <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                <div><div className="text-xs text-muted-foreground">{t("ld_from")}</div><div className="num text-xl font-extrabold leading-none">{inr(c.price)}</div><div className="text-xs text-muted-foreground">{c.perSite ? t("ld_per_loc") : t("per_month")}</div></div>
                <Link href={advisorHref(true)} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">{t("cur_view")}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle action={<Link href="/catalogue" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">{t("exp_all").replace("{n}", String(CATALOGUE.length))}</Link>}>{t("exp_title")}</SectionTitle>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]" role="group" aria-label={t("exp_title")}>
          {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{c === "all" ? t("filter_all") : c}</button>)}
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {shelf.map((p) => (
            <Link key={p.id} href={`/catalogue?s=${encodeURIComponent(plainName(p.id, lang).split(" (")[0])}`} className="flex flex-col gap-1.5 rounded-2xl border bg-card p-3 shadow-card transition-colors hover:border-primary">
              <ProductIcon id={p.id} className="size-6 text-primary" /><span className="line-clamp-2 text-[0.8125rem] font-bold leading-tight">{plainName(p.id, lang).split(" (")[0]}</span><span className="text-xs text-muted-foreground">{t("exp_from")} {inr(p.priceMin)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label={t("grp_title")}>
        <SectionTitle>{t("grp_title")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Link href={advisorHref(true, t("ld_ind_multi_q"))} className="flex flex-col rounded-3xl border bg-card p-4 shadow-card"><Store className="size-6 text-primary" aria-hidden /><h3 className="mt-2 font-extrabold">{t("grp_group")}</h3><p className="mt-1 text-sm text-muted-foreground">{t("grp_group_d")}</p><span className="mt-auto pt-3 text-sm font-bold text-primary">{t("grp_branch")}</span></Link>
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
