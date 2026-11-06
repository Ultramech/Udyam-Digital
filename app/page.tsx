"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, LayoutGrid, MessageSquareText, UserRoundCheck } from "lucide-react";
import { AvailabilityCheck } from "@/components/customer/availability-check";
import { ChannelLinks } from "@/components/customer/channel-links";
import { OrderStatus, Row, SectionTitle, StageTrack } from "@/components/customer/kit";
import { CustomerShell } from "@/components/customer/shell";
import { TalkToPerson } from "@/components/customer/talk-person";
import { useVerify } from "@/components/customer/verify";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PERSONAS } from "@/lib/demo/personas";
import { bundleName } from "@/lib/i18n/bundles";
import { plainName } from "@/lib/catalogue/plain";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import { api, useJourney } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";
import type { BusinessProfile } from "@/lib/rules/types";

interface Me {
  user: { name: string | null };
  businesses: { id: string; name: string; city: string | null }[];
  orders: { id: string; token: string; businessName: string; bundle: string; stage: string | null; payment: string; monthly: number; goLive: string }[];
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
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("GET", "/api/me").then(setMe).catch(() => setMe({ user: { name }, businesses: [], orders: [], quotes: [] })); }, [name]);

  const business = me?.businesses[0];
  const active = me?.orders.find((o) => o.stage !== "ACTIVATED" && o.stage !== "CANCELLED");
  const open = me?.quotes.find((q) => !q.orderId);
  const quoteId = open?.id ?? (journey?.quoteId && !me?.quotes.some((q) => q.id === journey.quoteId && q.orderId) ? journey.quoteId : undefined);
  const recent = (me?.orders ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{t("hello")}{name ? `, ${name.split(" ")[0]}` : ""}</h1>
        {business ? <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">{business.name}{business.city ? `, ${business.city}` : ""}</p> : null}
      </div>

      {!me ? <Skeleton className="h-52" /> : active ? (
        <section aria-label={t("track_order")} className="rounded-3xl bg-foreground p-5 text-background">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm opacity-70">{active.bundle}</span>
            <span className="rounded-full bg-background/15 px-3 py-1 text-xs font-semibold">{active.stage ? t(`stage_${active.stage}`) : t("order_unpaid")}</span>
          </div>
          <div className="mt-4 text-[1.375rem] font-extrabold leading-tight">{t("home_goes_live")}</div>
          <div className="num text-[2rem] font-extrabold leading-tight tracking-tight">{fmtDate(active.goLive, lang)}</div>
          <StageTrack stage={active.stage} className="mt-5 text-background" />
          <Link href={`/track/${active.id}?t=${active.token}`} className="mt-5 block">
            <Button size="lg" className="w-full">{t("home_track")}<ArrowRight className="size-4" /></Button>
          </Link>
        </section>
      ) : quoteId ? (
        <section className="rounded-3xl bg-foreground p-5 text-background">
          <div className="text-[1.375rem] font-extrabold leading-tight">{t("home_continue_title")}</div>
          <p className="mt-1.5 text-[0.9375rem] opacity-75">{open ? open.bundle : t("home_continue_sub")}</p>
          <Link href={`/quote/${quoteId}`} className="mt-5 block"><Button size="lg" className="w-full">{t("home_continue")}<ArrowRight className="size-4" /></Button></Link>
        </section>
      ) : (
        <section className="rounded-3xl bg-foreground p-5 text-background">
          <div className="text-[1.375rem] font-extrabold leading-tight">{t("home_new_title")}</div>
          <p className="mt-1.5 text-[0.9375rem] opacity-75">{t("home_new_sub")}</p>
          <Link href="/advisor" className="mt-5 block"><Button size="lg" className="w-full">{t("home_get_plan")}<ArrowRight className="size-4" /></Button></Link>
        </section>
      )}

      <section aria-label={t("home_quick")}>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/advisor" className="flex min-h-24 flex-col justify-between rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
            <MessageSquareText className="size-6" aria-hidden /><span className="text-[0.9375rem] font-bold">{t("home_q_advisor")}</span>
          </Link>
          <Link href="/catalogue" className="flex min-h-24 flex-col justify-between rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
            <LayoutGrid className="size-6" aria-hidden /><span className="text-[0.9375rem] font-bold">{t("home_q_browse")}</span>
          </Link>
        </div>
      </section>

      <AvailabilityCheck lang={lang} />

      {recent.length > 0 && (
        <section>
          <SectionTitle action={<Link href="/orders" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">{t("view_all")}</Link>}>{t("orders_title")}</SectionTitle>
          <div className="space-y-2">
            {recent.map((o) => (
              <Row key={o.id} href={`/track/${o.id}?t=${o.token}`} title={o.bundle} sub={`${o.businessName}, ${inr(o.monthly)}${t("per_month")}`} right={<OrderStatus stage={o.stage} payment={o.payment} />} />
            ))}
          </div>
        </section>
      )}

      <Card className="flex-row items-center gap-3 p-4">
        <UserRoundCheck className="size-6 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1"><div className="text-[0.9375rem] font-bold">{t("home_help_title")}</div><p className="text-sm text-muted-foreground">{t("home_help_sub")}</p></div>
        <TalkToPerson compact />
      </Card>

      <ChannelLinks lang={lang} />
    </div>
  );
}

/* ------------------------------------------------------------------ signed out */

const EXAMPLE: BusinessProfile = { businessType: "Pharmacy", employees: 3, sites: 1, city: "Indore", gstin: { has: false }, needs: ["payments", "cctv"] };

function Welcome() {
  const { t, lang } = useI18n();
  // the example is the real rules engine's answer for a real profile, not a drawing
  const example = useMemo(() => {
    const rec = recommend(EXAMPLE);
    return { bundle: bundleName(rec.bundleId, "en"), id: rec.bundleId, monthly: priceLines(rec.lines).monthly, items: [...new Set(rec.lines.map((l) => l.productId))].slice(0, 5) };
  }, []);
  const steps = [["welcome_s1", "welcome_s1d"], ["welcome_s2", "welcome_s2d"], ["welcome_s3", "welcome_s3d"]];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center md:gap-14 md:py-8">
      <div>
        <h1 className="text-[2.25rem] font-extrabold leading-[1.05] tracking-tight md:text-[3.25rem]">{t("welcome_title")}</h1>
        <p className="mt-4 max-w-md text-[1.0625rem] text-muted-foreground">{t("welcome_sub")}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/login?next=%2Fadvisor"><Button size="lg" className="w-full sm:w-auto">{t("welcome_cta")}<ArrowRight className="size-4" /></Button></Link>
          <Link href="/login"><Button size="lg" variant="outline" className="w-full sm:w-auto">{t("welcome_have")}</Button></Link>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">{t("welcome_chat")}</p>
        <ChannelLinks lang={lang} className="mt-2" />
      </div>

      <Card className="gap-4 p-5" aria-label={t("welcome_example")}>
        <div className="text-sm font-medium text-muted-foreground">{t("welcome_example")}</div>
        <div>
          <div className="text-lg font-extrabold">{example.bundle}</div>
          <div className="mt-1 flex items-baseline gap-1.5"><span className="price-xl">{inr(example.monthly)}</span><span className="text-sm text-muted-foreground">{t("per_month")}, {t("gst_extra")}</span></div>
        </div>
        <ul className="space-y-2.5 border-t pt-4">
          {example.items.map((p) => <li key={p} className="flex items-center gap-3 text-[0.9375rem]"><ProductIcon id={p} className="size-5 text-foreground" />{plainName(p, lang)}</li>)}
        </ul>
        <p className="border-t pt-3 text-xs text-muted-foreground">{t("indicative")}</p>
      </Card>

      <section className="md:col-span-2" aria-label={t("welcome_how")}>
        <h2 className="mb-3 text-lg font-extrabold">{t("welcome_how")}</h2>
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
          {steps.map(([a, b], i) => (
            <li key={a} className="flex gap-3 rounded-2xl border bg-card p-4">
              <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">{i + 1}</span>
              <div><div className="font-bold">{t(a)}</div><p className="mt-0.5 text-sm text-muted-foreground">{t(b)}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="md:col-span-2">
        <h2 className="text-lg font-extrabold">{t("persona_title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("persona_note")}</p>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
          {PERSONAS.map((p) => (
            <Link key={p.id} href={`/login?next=${encodeURIComponent(`/advisor?persona=${p.id}`)}`} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-muted/60">
              <div className="min-w-0 flex-1"><div className="truncate text-[0.9375rem] font-semibold">{p.title[lang === "hi" || lang === "mr" ? "hi" : "en"]}</div><div className="truncate text-sm text-muted-foreground">{p.blurb[lang === "hi" || lang === "mr" ? "hi" : "en"]}</div></div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 text-sm text-muted-foreground md:col-span-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{t("trust_line")}</p>
    </div>
  );
}

