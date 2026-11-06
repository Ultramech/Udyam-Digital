"use client";
import Link from "next/link";
import { Award, Check, Circle } from "lucide-react";
import { PageTitle, SectionTitle } from "@/components/customer/kit";
import { CustomerShell } from "@/components/customer/shell";
import { useI18n } from "@/components/i18n-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRewards } from "@/lib/client/use-rewards";
import { TIERS } from "@/lib/rewards/coins";
import { cn } from "@/lib/utils";

const HREF: Record<string, string> = { profile: "/account", plan: "/advisor", kyc: "/orders", paid: "/orders", live: "/orders", referral: "/orders" };

export default function RewardsPage() { return <CustomerShell><Rewards /></CustomerShell>; }

function Rewards() {
  const { t } = useI18n();
  const r = useRewards();
  if (!r) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-9 w-1/2" /><Skeleton className="h-44 rounded-3xl" /><Skeleton className="h-48" /></div>;
  return (
    <div>
      <PageTitle title={t("rw_title")} sub={t("rw_sub")} />
      <section className="hero-red rounded-3xl p-5" aria-label={t("coins_title")}>
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_28%,#FFE9A8,#F4B52E_55%,#C98A0B)] text-2xl font-extrabold text-[#7A4B00]" aria-hidden>U</span>
          <div className="min-w-0 flex-1"><div className="num text-[2.25rem] font-extrabold leading-none">{r.balance}</div><div className="mt-1 text-sm opacity-90">{t("coins_title")}</div></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold"><Award className="size-4" aria-hidden />{t(`tier_${r.tier}`)}</span>
        </div>
        {r.next ? (
          <div className="mt-5"><div className="h-2.5 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.next.pct}><div className="h-full rounded-full bg-white" style={{ width: `${r.next.pct}%` }} /></div>
            <p className="mt-2 text-sm opacity-90">{t("coins_togo").replace("{n}", String(r.next.toGo)).replace("{tier}", t(`tier_${r.next.tier}`))}</p></div>
        ) : <p className="mt-4 text-sm opacity-90">{t("coins_top")}</p>}
      </section>

      <SectionTitle>{t("rw_ways")}</SectionTitle>
      <ul className="space-y-2.5">
        {r.entries.map((e) => {
          const total = e.id === "referral" ? e.coins * (e.count ?? 0) : e.coins;
          return (
            <li key={e.id}>
              <Link href={HREF[e.id]} className={cn("flex min-h-16 items-center gap-3 rounded-2xl border bg-card shadow-card px-4 py-3 shadow-card", e.done && "bg-success-soft")}>
                {e.done ? <Check className="size-6 shrink-0 text-success" aria-hidden /> : <Circle className="size-6 shrink-0 text-muted-foreground/60" aria-hidden />}
                <span className="min-w-0 flex-1"><span className="block font-semibold">{t(`earn_${e.id}`)}</span><span className="block text-sm text-muted-foreground">{e.done ? t("rw_done") : t("rw_todo")}{e.id === "referral" && e.count ? ` ×${e.count}` : ""}</span></span>
                <b className={cn("num text-lg", e.done ? "text-success" : "text-primary")}>+{e.done ? total : e.coins}</b>
              </Link>
            </li>
          );
        })}
      </ul>

      <SectionTitle>{t("rw_tiers")}</SectionTitle>
      <Card className="gap-0 divide-y p-0">
        {TIERS.map((tier) => (
          <div key={tier.id} className={cn("flex items-center gap-3 px-4 py-3.5", r.tier === tier.id && "bg-accent")}>
            <Award className={cn("size-5", r.tier === tier.id ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span className={cn("flex-1", r.tier === tier.id ? "font-extrabold" : "font-medium")}>{t(`tier_${tier.id}`)}</span>
            <span className="num text-sm text-muted-foreground">{tier.min}+ {t("coins")}</span>
          </div>
        ))}
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">{t("rw_note")}</p>
    </div>
  );
}
