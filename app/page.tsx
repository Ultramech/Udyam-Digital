"use client";
import Link from "next/link";
import { ChannelLinks } from "@/components/customer/channel-links";
import { AvailabilityCheck } from "@/components/customer/availability-check";
import { useMemo } from "react";
import { ArrowRight, Check, Lock, MessageCircle, PackageSearch, ReceiptText, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { ProductIcon } from "@/components/brand";
import { PERSONAS } from "@/lib/demo/personas";
import { bundleName, bundleTagline } from "@/lib/i18n/bundles";
import { plainName } from "@/lib/catalogue/plain";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import type { BusinessProfile } from "@/lib/rules/types";
import { inr } from "@/lib/client/format";
import { useJourney } from "@/lib/client/api";

const SAMPLES: { profile: BusinessProfile; perSite?: boolean }[] = [
  { profile: { businessType: "Kirana store", employees: 2, sites: 1, city: "Indore", gstin: { has: false }, needs: [] } },
  { profile: { businessType: "Clinic", employees: 5, sites: 1, city: "Kochi", gstin: { has: false }, needs: [] } },
  { profile: { businessType: "Restaurant chain", employees: 12, sites: 3, city: "Pune", gstin: { has: false }, needs: [] }, perSite: true },
  { profile: { businessType: "Furniture workshop", employees: 12, sites: 1, city: "Nagpur", gstin: { has: true, verified: true, status: "Active" }, needs: [] } },
];

export default function Landing() {
  const { t, lang } = useI18n();
  const resume = useJourney();

  const showcase = useMemo(() => SAMPLES.map(({ profile, perSite }) => {
    const rec = recommend(profile);
    const lines = perSite ? rec.lines.filter((l) => l.siteIndex === 0 && l.productId !== "P10") : rec.lines;
    return { id: rec.bundleId, price: priceLines(lines).monthly, perSite: !!perSite, items: [...new Set(lines.map((l) => l.productId))].slice(0, 4) };
  }), []);

  return (
    <CustomerShell>
      {/* hero */}
      <section className="pb-6 pt-2">
        <Badge variant="secondary" className="mb-3 gap-1"><Lock className="size-3" /> {t("prototype")}</Badge>
        <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          {t("hero_title").split(". ")[0]}.<br /><span className="text-primary">{t("hero_title").split(". ")[1] ?? ""}</span>
        </h1>
        <p className="mt-3 max-w-prose text-pretty text-base text-muted-foreground">{t("hero_sub")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/advisor"><Button size="lg" className="gap-2">{t("cta_start")} <ArrowRight className="size-4" /></Button></Link>
          <a href="#solutions"><Button size="lg" variant="outline">{t("cta_explore")}</Button></a>
          <Link href="/advisor"><Button size="lg" variant="ghost" className="gap-2"><MessageCircle className="size-4" />{t("cta_advisor")}</Button></Link>
          <Link href="/whatsapp"><Button size="lg" variant="outline" className="gap-2 border-[#008069] text-[#008069] hover:text-[#008069]"><MessageCircle className="size-4" />{(lang === "hi" || lang === "mr") ? "WhatsApp-शैली चैट" : "Chat in WhatsApp style"}</Button></Link>
        </div>
        <ChannelLinks lang={lang} className="mt-3" />

        {/* what the advisor feels like */}
        <Card className="mt-6 space-y-2.5 p-4" aria-hidden>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
            {(lang === "hi" || lang === "mr") ? "इंदौर में मेरी दवा की दुकान है, 3 लोग, बिलिंग और CCTV चाहिए…" : "I run a pharmacy in Indore, 3 people, need billing and CCTV…"}
          </div>
          <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
            {(lang === "hi" || lang === "mr") ? <>मेरा सुझाव: <b>दुकान डिजिटल</b> — {inr(showcase[0].price + 398)} प्रति माह, एक बिल में।</> : <>I&apos;d suggest <b>Dukaan Digital</b> — {inr(showcase[0].price + 398)} a month, on one bill.</>}
          </div>
        </Card>
      </section>

      <div className="mb-5"><AvailabilityCheck lang={lang} /></div>

      {resume && (resume.quoteId || resume.orders.length > 0) && (
        <Card className="mb-5 flex items-center justify-between gap-3 border-primary/30 bg-accent p-3.5">
          <div className="text-sm font-medium">{t("resume")}</div>
          <div className="flex gap-2">
            {resume.quoteId && <Link href={`/quote/${resume.quoteId}`}><Button size="sm">{t("continue")}</Button></Link>}
            {resume.orders[0] && <Link href={`/track/${resume.orders[0].id}?t=${resume.orders[0].token}`}><Button size="sm" variant="outline">{t("track_order")}</Button></Link>}
          </div>
        </Card>
      )}

      {/* three steps */}
      <section className="grid grid-cols-3 gap-2 pb-6" aria-label="How it works">
        {[
          [PackageSearch, "step_discover"], [ScanSearch, "step_verify"], [ReceiptText, "step_activate"],
        ].map(([Icon, key], i) => {
          const I = Icon as typeof PackageSearch;
          return (
            <div key={String(key)} className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-accent text-primary"><I className="size-4" /></div>
              <div className="text-sm font-semibold">{i + 1}. {t(String(key))}</div>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t(`${key}_d`)}</p>
            </div>
          );
        })}
      </section>

      {/* solutions — prices come from the same rules engine as the advisor */}
      <section id="solutions" className="space-y-3 pb-6">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t("cta_explore")}</h2><Link href="/catalogue" className="text-sm text-primary underline-offset-4 hover:underline">{(lang === "hi" || lang === "mr") ? "सभी 25 सेवाएँ →" : "All 25 services →"}</Link></div>
        {showcase.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{bundleName(s.id, lang)}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{bundleTagline(s.id, lang)}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "से शुरू" : "from"}</div>
                <div className="text-lg font-bold leading-none">{inr(s.price)}</div>
                <div className="text-[11px] text-muted-foreground">{s.perSite ? ((lang === "hi" || lang === "mr") ? "/ लोकेशन / माह" : "/ location / month") : t("per_month")}</div>
              </div>
            </div>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {s.items.map((p) => <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground"><ProductIcon id={p} className="size-3.5 text-primary" />{plainName(p, lang)}</li>)}
            </ul>
          </Card>
        ))}
        <p className="text-xs text-muted-foreground">{t("indicative")}</p>
      </section>

      {/* demo businesses */}
      <section className="space-y-2 pb-6" aria-label={t("persona_title")}>
        <h2 className="text-lg font-semibold">{t("persona_title")}</h2>
        <p className="text-xs text-muted-foreground">{t("persona_note")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERSONAS.map((p) => (
            <Link key={p.id} href={`/advisor?persona=${p.id}`} className="group rounded-xl border bg-card p-3 transition-colors hover:border-primary">
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{p.title[(lang === "hi" || lang === "mr") ? "hi" : "en"]}</span><ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" /></div>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.blurb[(lang === "hi" || lang === "mr") ? "hi" : "en"]}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex items-start gap-2 rounded-xl bg-secondary p-3 text-xs text-muted-foreground"><Check className="mt-0.5 size-3.5 shrink-0 text-success" /><p>{t("trust_line")}</p></section>
      <div className="mt-4 text-center"><Link href="/account" className="text-sm text-primary underline-offset-4 hover:underline">{t("track_order")}</Link></div>
    </CustomerShell>
  );
}
