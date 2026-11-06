"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Headset, Layers, LayoutGrid, ShoppingBag, UserRoundCheck } from "lucide-react";
import { AvailabilityCheck } from "@/components/customer/availability-check";
import { ChannelLinks } from "@/components/customer/channel-links";
import { SectionTitle } from "@/components/customer/kit";
import { AdvisorBox, advisorHref, useBundleSamples, Welcome } from "@/components/landing/welcome";
import { CustomerShell } from "@/components/customer/shell";
import { TalkToPerson } from "@/components/customer/talk-person";
import { useVerify } from "@/components/customer/verify";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { bundleName } from "@/lib/i18n/bundles";
import { api, useJourney } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";

interface Me {
  user: { name: string | null };
  businesses: { id: string; name: string; city: string | null }[];
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
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("GET", "/api/me").then(setMe).catch(() => setMe({ user: { name }, businesses: [], orders: [], quotes: [] })); }, [name]);

  const business = me?.businesses[0];
  const order = me?.orders.find((o) => o.stage !== "CANCELLED");
  const open = me?.quotes.find((q) => !q.orderId);
  const quoteId = open?.id ?? (journey?.quoteId && !me?.quotes.some((q) => q.id === journey.quoteId && q.orderId) ? journey.quoteId : undefined);
  const live = order?.stage === "ACTIVATED";

  // setup progress is read from real state: profile, plan, KYC, payment, live
  const done = [true, !!(open || quoteId || order), !!order && (order.kycStatus === "verified" || order.kycStatus === "approved"), !!order && order.payment === "success", live];
  const pct = Math.round((done.filter(Boolean).length / done.length) * 100);
  const next = live ? "next_live" : !order ? (quoteId ? "next_review" : "next_choose") : order.payment !== "success" ? "next_pay" : !done[2] ? "next_kyc" : "next_wait";
  const href = live || order ? `/track/${order!.id}?t=${order!.token}` : quoteId ? `/quote/${quoteId}` : "/advisor";
  const tiles = [
    { href: "/advisor", icon: ShoppingBag, k: "home_t_buy" },
    { href: "/orders", icon: Layers, k: "home_t_orders" },
    { href: "/support", icon: Headset, k: "home_t_support" },
    { href: "/catalogue", icon: LayoutGrid, k: "home_t_more" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">{t("hello")}{name ? `, ${name.split(" ")[0]}` : ""}</h1>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">{business ? `${business.name}${business.city ? `, ${business.city}` : ""}` : t("home_sub")}</p>
      </div>

      {!me ? <Skeleton className="h-40 rounded-3xl" /> : (
        <Link href={href} aria-label={t("setup_pct").replace("{n}", String(pct))} className="hero-red block rounded-3xl p-5 transition-transform active:scale-[0.99]">
          <div className="text-[1.125rem] font-extrabold leading-snug">{t("setup_pct").replace("{n}", String(pct))}</div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/50 bg-white/15"><ArrowRight className="size-5" aria-hidden /></span>
          </div>
          <p className="mt-3 text-[0.9375rem] opacity-90">{t(next)}{order && !live ? `  ${t("home_goes_live")}: ${fmtDate(order.goLive, lang)}` : ""}</p>
        </Link>
      )}

      <section aria-label={t("home_quick")} className="grid grid-cols-4 gap-2.5">
        {tiles.map(({ href: h, icon: I, k }) => (
          <Link key={k} href={h} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-1 py-3 text-center shadow-card transition-colors hover:border-primary">
            <I className="size-6 text-primary" aria-hidden /><span className="text-[0.8125rem] font-semibold leading-tight">{t(k)}</span>
          </Link>
        ))}
      </section>

      <AdvisorBox signedIn />

      <section>
        <SectionTitle action={<Link href="/catalogue" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">{t("view_all")}<ArrowRight className="size-4" aria-hidden /></Link>}>{t("home_rec")}</SectionTitle>
        <div className="space-y-2.5">
          {samples.slice(0, 3).map((c) => (
            <Link key={c.id} href={advisorHref(true, undefined)} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-card transition-colors hover:border-primary">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><ProductIcon id={c.items[0]} className="size-6" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-bold">{bundleName(c.id, lang)}</span><span className="block truncate text-sm text-muted-foreground">{t("ld_from")} {inr(c.price)} {c.perSite ? t("ld_per_loc") : t("per_month")}</span></span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <AvailabilityCheck lang={lang} />

      <Card className="flex-row items-center gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><UserRoundCheck className="size-6" aria-hidden /></span>
        <div className="min-w-0 flex-1"><div className="text-[0.9375rem] font-bold">{t("home_help_title")}</div><p className="text-sm text-muted-foreground">{t("home_help_sub")}</p></div>
        <TalkToPerson compact />
      </Card>

      <ChannelLinks lang={lang} />
    </div>
  );
}
