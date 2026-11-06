"use client";
import Link from "next/link";
import { useState } from "react";
import { Award, ChartNoAxesColumnIncreasing, ChevronRight, Info, Store } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { inr } from "@/lib/client/format";
import { TIERS, type Rewards } from "@/lib/rewards/coins";

/** Order milestones a new order can still unlock. Coins come from milestones in lib/rewards/coins.ts, never from order size. */
const ORDER_STEPS = ["kyc", "paid", "live"] as const;

/** Home: Udyam Coins balance, tier progress, an order-coins estimator and the next things to earn. */
export function CoinsCard({ rewards }: { rewards: Rewards }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const todo = rewards.entries.filter((e) => !e.done && e.id !== "live" && e.id !== "profile").slice(0, 2);

  function estimate() {
    const amt = Number(amount);
    if (!amt) { setResult(t("coins_est_empty")); return; }
    const earn = rewards.entries.filter((e) => !e.done && (ORDER_STEPS as readonly string[]).includes(e.id)).reduce((s, e) => s + e.coins, 0);
    if (!earn) { setResult(t("coins_est_done")); return; }
    const after = rewards.balance + earn;
    const tier = [...TIERS].reverse().find((x) => after >= x.min)!;
    const line = t("coins_est").replace("{amt}", inr(amt)).replace("{n}", String(earn));
    setResult(tier.id !== rewards.tier ? `${line} ${t("coins_est_tier").replace("{tier}", t(`tier_${tier.id}`))}` : line);
  }

  return (
    <section aria-labelledby="coins-h" className="rounded-3xl border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary sm:size-12"><Award className="size-5 sm:size-6" aria-hidden /></span>
        <div className="min-w-0 flex-1 border-l pl-3">
          <div className="flex items-center gap-1">
            <h2 id="coins-h" className="whitespace-nowrap text-base font-extrabold leading-tight sm:text-lg">{t("coins_title")}</h2>
            <button type="button" title={t("coins_sub")} aria-label={t("coins_sub")} className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"><Info className="size-4" aria-hidden /></button>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{t("coins_tagline")}</p>
        </div>
        <Link href="/rewards" className="inline-flex min-h-9 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border bg-card pl-2.5 pr-1.5 text-xs font-bold sm:pl-3 sm:pr-2 text-primary shadow-card transition-colors hover:border-primary">{t("coins_history")}<ChevronRight className="size-4" aria-hidden /></Link>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="num text-[2.5rem] font-extrabold leading-none tracking-tight">{rewards.balance}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1CC] px-2.5 py-1 text-xs font-bold text-[#7A4B00]"><Award className="size-3.5" aria-hidden />{t(`tier_${rewards.tier}`)}</span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 border-l pl-3">
          <ChartNoAxesColumnIncreasing className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          {rewards.next ? (
            <div className="min-w-0 leading-tight">
              <div className="text-[0.6875rem] text-muted-foreground">{t("coins_more").replace("{n}", String(rewards.next.toGo))}</div>
              <div className="text-sm font-extrabold">{t(`tier_${rewards.next.tier}`)}</div>
            </div>
          ) : <div className="text-xs font-semibold">{t("coins_top")}</div>}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t("coins_title")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rewards.next?.pct ?? 100}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(rewards.next?.pct ?? 100, 4)}%` }} />
      </div>

      <form className="mt-4 rounded-2xl border border-primary/10 bg-accent/60 p-3" onSubmit={(e) => { e.preventDefault(); estimate(); }}>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="coins-amt" className="flex min-w-[10rem] flex-1 items-center gap-2 text-[0.8125rem] font-medium"><Store className="size-5 shrink-0 text-primary" aria-hidden />{t("coins_est_label")}</label>
          <div className="flex w-full gap-2 min-[420px]:w-auto">
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border bg-card px-3 focus-within:border-primary min-[420px]:w-28 min-[420px]:flex-none">
              <span className="text-sm text-muted-foreground" aria-hidden>₹</span>
              <input id="coins-amt" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "").slice(0, 8)); setResult(null); }} className="num w-full min-w-0 bg-transparent pl-1.5 text-sm outline-none" />
            </div>
            <button type="submit" className="h-10 shrink-0 rounded-xl bg-primary/15 px-4 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">{t("coins_calc")}</button>
          </div>
        </div>
        {result && <p role="status" className="mt-2 text-[0.8125rem] font-medium">{result}</p>}
      </form>

      {todo.length > 0 && (
        <ul className="mt-3 divide-y">
          {todo.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="size-5 shrink-0 rounded-[0.3rem] border-2 border-muted-foreground/40" aria-hidden />
              <span className="flex-1 text-[0.9375rem]">{t(`earn_${e.id}`)}</span>
              <b className="num rounded-full bg-accent px-3 py-1 text-sm text-primary">+{e.coins}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
