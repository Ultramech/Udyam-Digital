"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, Headset, Layers, Phone, Rocket, ShieldCheck, Sparkles, Store, Stethoscope, Network, Wifi } from "lucide-react";
import { ProductIcon } from "@/components/brand";
import { ChannelLinks } from "@/components/customer/channel-links";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERSONAS } from "@/lib/demo/personas";
import { plainName } from "@/lib/catalogue/plain";
import { bundleName, bundleTagline } from "@/lib/i18n/bundles";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import type { BundleId, BusinessProfile } from "@/lib/rules/types";
import { inr } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import { ShopIllustration } from "./shop-illustration";

/** Where a landing action lands: the advisor, once signed in (a signed-out visitor goes through sign-in and comes back to it). */
export const advisorHref = (signedIn: boolean, q?: string) => {
  const to = `/advisor${q ? `?q=${encodeURIComponent(q.slice(0, 300))}` : ""}`;
  return signedIn ? to : `/login?next=${encodeURIComponent(to)}`;
};

/** A typed question that goes straight into the advisor. Used on the landing page and the signed-in Home. */
export function AdvisorBox({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const go = (text: string) => { window.location.assign(advisorHref(signedIn, text)); };
  return (
    <section aria-labelledby="adv-box" className={cn("surface-tint rounded-3xl border p-5 shadow-card md:p-6", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary"><Sparkles className="size-6" aria-hidden /></span>
        <div className="min-w-0">
          <h2 id="adv-box" className="text-lg font-extrabold leading-tight">{t("ld_adv_title")}</h2>
          <p className="mt-0.5 text-[0.9375rem] text-muted-foreground">{t("ld_adv_sub")}</p>
        </div>
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); go(q.trim()); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ld_adv_ph")} aria-label={t("ld_adv_ask")} maxLength={300} className="bg-card" />
        <Button type="submit" size="icon-lg" aria-label={t("ld_adv_ask")}><ArrowRight className="size-5" /></Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {[["ld_try1", "ld_try1_q"], ["ld_try2", "ld_try2_q"]].map(([label, query]) => (
          <button key={label} type="button" onClick={() => go(t(query))} className="min-h-11 rounded-full border border-input bg-card px-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary">{t(label)}</button>
        ))}
      </div>
    </section>
  );
}

const SAMPLES: { profile: BusinessProfile; perSite?: boolean; popular?: boolean }[] = [
  { profile: { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] }, popular: true },
  { profile: { businessType: "Clinic", employees: 5, sites: 1, city: "Kochi", gstin: { has: false }, needs: [] } },
  { profile: { businessType: "Restaurant chain", employees: 12, sites: 3, city: "Pune", gstin: { has: false }, needs: [] }, perSite: true },
  { profile: { businessType: "Furniture workshop", employees: 12, sites: 1, city: "Nagpur", gstin: { has: true, verified: true, status: "Active" }, needs: [] } },
];

/** Bundles priced by the same rules engine the advisor uses: nothing here is typed in by hand. */
export function useBundleSamples() {
  return useMemo(() => SAMPLES.map(({ profile, perSite, popular }) => {
    const rec = recommend(profile);
    const lines = perSite ? rec.lines.filter((l) => l.siteIndex === 0 && l.productId !== "P10") : rec.lines;
    return { id: rec.bundleId as BundleId, price: priceLines(lines).monthly, perSite: !!perSite, popular: !!popular, items: [...new Set(lines.map((l) => l.productId))].slice(0, 3) };
  }), []);
}

export function BundleCards({ signedIn }: { signedIn: boolean }) {
  const { t, lang } = useI18n();
  const cards = useBundleSamples();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <article key={c.id} className={cn("flex flex-col rounded-3xl border bg-card p-5 shadow-card", c.popular && "surface-tint")}>
          <div className="flex items-start justify-between gap-2">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary"><ProductIcon id={c.items[0]} className="size-6" /></span>
            {c.popular && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary">{t("ld_popular")}</span>}
          </div>
          <h3 className="mt-4 text-lg font-extrabold">{bundleName(c.id, lang)}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{bundleTagline(c.id, lang)}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {c.items.map((p) => <li key={p} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{plainName(p, lang)}</li>)}
          </ul>
          <div className="mt-auto flex items-end justify-between gap-2 border-t pt-4">
            <div>
              <div className="text-xs text-muted-foreground">{t("ld_from")}</div>
              <div className="num text-[1.5rem] font-extrabold leading-none">{inr(c.price)}</div>
              <div className="text-xs text-muted-foreground">{c.perSite ? t("ld_per_loc") : t("per_month")}</div>
            </div>
            <Link href={advisorHref(signedIn)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">{t("ld_view_plan")}<ArrowRight className="size-4" aria-hidden /></Link>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Welcome() {
  const { t, lang } = useI18n();
  const cats = [
    { icon: Wifi, k: "ld_cat_internet", d: "ld_cat_internet_d" },
    { icon: Phone, k: "ld_cat_mobile", d: "ld_cat_mobile_d" },
    { icon: Layers, k: "ld_cat_digital", d: "ld_cat_digital_d" },
    { icon: ShieldCheck, k: "ld_cat_security", d: "ld_cat_security_d" },
  ];
  const steps = [
    { icon: Store, a: "welcome_s1", b: "welcome_s1d" },
    { icon: Sparkles, a: "welcome_s2", b: "welcome_s2d" },
    { icon: Rocket, a: "welcome_s3", b: "welcome_s3d" },
  ];
  const inds = [
    { icon: Store, k: "ld_ind_retail", d: "ld_ind_retail_d", q: "ld_ind_retail_q" },
    { icon: Stethoscope, k: "ld_ind_office", d: "ld_ind_office_d", q: "ld_ind_office_q" },
    { icon: Network, k: "ld_ind_multi", d: "ld_ind_multi_d", q: "ld_ind_multi_q" },
  ];
  return (
    <div className="space-y-14 pb-6 md:space-y-20">
      {/* hero */}
      <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10">
        <div>
          <span className="inline-flex items-center rounded-full border border-primary/25 bg-accent px-3.5 py-1.5 text-sm font-semibold text-primary">{t("ld_pill")}</span>
          <h1 className="mt-5 text-[2.625rem] font-extrabold leading-[1.02] tracking-tight md:text-[3.75rem]">{t("ld_h1a")}<br /><span className="text-primary">{t("ld_h1b")}</span></h1>
          <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-muted-foreground">{t("ld_sub")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href={advisorHref(false)}><Button size="lg" className="w-full sm:w-auto">{t("ld_cta1")}<ArrowRight className="size-4" /></Button></Link>
            <Link href="/login?next=%2Fsupport"><Button size="lg" variant="outline" className="w-full sm:w-auto"><Headset className="size-4 text-primary" />{t("ld_cta2")}</Button></Link>
          </div>
          <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-3">
            {[[Check, "ld_fact1"], [Check, "ld_fact2"], [Check, "ld_fact3"]].map(([I, k]) => {
              const Icon = I as typeof Check;
              return <li key={String(k)} className="flex items-start gap-2 font-medium"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon className="size-3" aria-hidden /></span>{t(String(k))}</li>;
            })}
          </ul>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-br from-accent via-transparent to-accent opacity-80" aria-hidden />
          <ShopIllustration label={t("ld_h1a") + " " + t("ld_h1b")} />
          <div className="absolute left-0 top-2 flex items-center gap-2 rounded-2xl bg-card px-3 py-2 text-xs font-semibold shadow-lift sm:text-sm"><Wifi className="size-4 text-primary" aria-hidden />{t("ld_cat_internet")}<span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.6875rem] text-success">{t("home_order_live")}</span></div>
          <ul className="absolute bottom-6 right-0 hidden space-y-2 rounded-2xl bg-card p-3 text-sm font-medium shadow-lift sm:block">
            {["ld_cat_internet", "ld_cat_mobile", "ld_cat_security"].map((k) => <li key={k} className="flex items-center gap-2"><span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" aria-hidden /></span>{t(k)}</li>)}
          </ul>
        </div>
      </section>

      <AdvisorBox signedIn={false} />

      {/* what you can get */}
      <section id="solutions" className="scroll-mt-24">
        <h2 className="mb-5 text-center text-[1.625rem] font-extrabold md:text-3xl">{t("ld_cat_title")}</h2>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cats.map(({ icon: I, k, d }) => (
            <Link key={k} href={advisorHref(false)} className="group flex flex-col rounded-3xl border bg-card p-5 shadow-card transition-shadow hover:shadow-lift">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><I className="size-6" aria-hidden /></span>
              <h3 className="mt-4 text-lg font-extrabold">{t(k)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(d)}</p>
              <span className="mt-4 inline-flex size-9 items-center justify-center self-end rounded-full bg-accent text-primary transition-transform group-hover:translate-x-0.5"><ArrowRight className="size-4" aria-hidden /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="scroll-mt-24">
        <h2 className="text-center text-[1.625rem] font-extrabold md:text-3xl">{t("ld_nav_how")}</h2>
        <p className="mt-1 text-center text-muted-foreground">{t("ld_how_sub")}</p>
        <ol className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
          {steps.map(({ icon: I, a, b }, i) => (
            <li key={a} className="relative rounded-3xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="num flex size-9 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-primary">{i + 1}</span>
                <I className="size-7 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-extrabold">{t(a)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t(b)}</p>
              {i < 2 && <ArrowRight className="absolute -right-4 top-1/2 hidden size-5 -translate-y-1/2 text-primary/60 md:block" aria-hidden />}
            </li>
          ))}
        </ol>
      </section>

      {/* bundles */}
      <section id="bundles" className="scroll-mt-24">
        <div className="mb-5">
          <h2 className="text-[1.625rem] font-extrabold md:text-3xl">{t("ld_bundles_title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("ld_bundles_sub")}</p>
        </div>
        <BundleCards signedIn={false} />
        <p className="mt-3 text-xs text-muted-foreground">{t("indicative")}</p>
      </section>

      {/* industries */}
      <section>
        <h2 className="text-center text-[1.625rem] font-extrabold md:text-3xl">{t("ld_ind_title")}</h2>
        <p className="mt-1 text-center text-muted-foreground">{t("ld_ind_sub")}</p>
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
          {inds.map(({ icon: I, k, d, q }) => (
            <Link key={k} href={advisorHref(false, t(q))} className="group overflow-hidden rounded-3xl border bg-card shadow-card transition-shadow hover:shadow-lift">
              <div className="surface-tint flex h-36 items-center justify-center border-b"><I className="size-16 text-primary/80" strokeWidth={1.4} aria-hidden /></div>
              <div className="flex items-start gap-3 p-5">
                <div className="min-w-0 flex-1"><h3 className="text-lg font-extrabold">{t(k)}</h3><p className="mt-1 text-sm text-muted-foreground">{t(d)}</p></div>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><ArrowRight className="size-4" aria-hidden /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* call-out band */}
      <section className="hero-red overflow-hidden rounded-3xl p-6 md:p-10">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h2 className="text-[1.625rem] font-extrabold leading-tight md:text-3xl">{t("ld_band_title")}</h2>
            <p className="mt-2 max-w-xl text-[1.0625rem] opacity-90">{t("ld_band_sub")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login?next=%2Fsupport"><Button size="lg" className="w-full bg-white text-primary hover:bg-white/90 sm:w-auto"><Headset className="size-4" />{t("ld_cta2")}</Button></Link>
            <Link href="/login?next=%2Fsupport"><Button size="lg" variant="outline" className="w-full border-white/60 bg-transparent text-white hover:bg-white/15 sm:w-auto"><ClipboardCheck className="size-4" />{t("ld_band_cb")}</Button></Link>
          </div>
        </div>
      </section>

      <section aria-label={t("persona_title")}>
        <h2 className="text-lg font-extrabold">{t("persona_title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("persona_note")}</p>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PERSONAS.map((p) => (
            <Link key={p.id} href={`/login?next=${encodeURIComponent(`/advisor?persona=${p.id}`)}`} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card transition-colors hover:border-primary">
              <div className="min-w-0 flex-1"><div className="truncate text-[0.9375rem] font-semibold">{p.title[lang === "hi" || lang === "mr" ? "hi" : "en"]}</div><div className="truncate text-sm text-muted-foreground">{p.blurb[lang === "hi" || lang === "mr" ? "hi" : "en"]}</div></div>
              <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
            </Link>
          ))}
        </div>
        <ChannelLinks lang={lang} className="mt-5" />
      </section>
    </div>
  );
}

