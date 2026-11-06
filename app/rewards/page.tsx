"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowRight, BadgeCheck, CalendarCheck, Check, ChevronRight, CloudUpload, Coins, Crown, Flame, Gift, Info, Percent, Rocket, ShoppingCart, Ticket, UserRound,
  UsersRound, Video, Wallet, FileCheck2, Disc3,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerShell } from "@/components/customer/shell";
import { useI18n } from "@/components/i18n-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useRewards } from "@/lib/client/use-rewards";
import { TIERS, type RewardEntry } from "@/lib/rewards/coins";
import { cn } from "@/lib/utils";

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;
const HREF: Record<RewardEntry["id"], string> = { profile: "/account", plan: "/advisor", kyc: "/orders", paid: "/orders", live: "/orders", referral: "/orders" };
const ICON: Record<RewardEntry["id"], Icon> = { profile: UserRound, plan: FileCheck2, kyc: BadgeCheck, paid: ShoppingCart, live: Rocket, referral: UsersRound };
const SUB: Record<RewardEntry["id"], [string, string]> = {
  profile: ["Tell us about you and your business", "अपने और बिज़नेस के बारे में बताएँ"], plan: ["Get a plan from the advisor", "सलाहकार से प्लान लें"],
  kyc: ["Verify your business to earn coins", "बिज़नेस वेरिफ़ाई करके कॉइन पाएँ"], paid: ["Subscribe to any business plan", "कोई भी बिज़नेस प्लान लें"],
  live: ["Your services switched on", "आपकी सेवाएँ चालू"], referral: ["A business you refer places a paid order", "आपका रेफ़र किया बिज़नेस ऑर्डर दे"],
};

/** Per-device daily check-in: real visits on this phone, nothing invented. */
function useDaily() {
  const [state, setState] = useState<{ streak: number; offerSeen: boolean }>({ streak: 1, offerSeen: false });
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const raw = JSON.parse(localStorage.getItem("ud-daily") ?? "{}") as { last?: string; streak?: number; offer?: string };
      const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      const streak = raw.last === today ? raw.streak ?? 1 : raw.last === yest ? (raw.streak ?? 0) + 1 : 1;
      localStorage.setItem("ud-daily", JSON.stringify({ ...raw, last: today, streak }));
      setState({ streak, offerSeen: raw.offer === today }); // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* storage blocked: defaults are fine */ }
  }, []);
  const markOffer = () => {
    try { const raw = JSON.parse(localStorage.getItem("ud-daily") ?? "{}"); localStorage.setItem("ud-daily", JSON.stringify({ ...raw, offer: new Date().toISOString().slice(0, 10) })); } catch {}
    setState((s) => ({ ...s, offerSeen: true }));
  };
  return { ...state, markOffer };
}

export default function RewardsPage() { return <CustomerShell><Rewards /></CustomerShell>; }

function Rewards() {
  const { t, lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const r = useRewards();
  const daily = useDaily();
  const [tiers, setTiers] = useState(false);
  const [history, setHistory] = useState(false);
  const soon = () => toast.info(H("Coming soon. Keep earning coins until then!", "जल्द आ रहा है। तब तक कॉइन कमाते रहें!"));

  if (!r) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-14 w-2/3" /><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-28" /><Skeleton className="h-40" /></div>;
  const planDone = r.entries.find((e) => e.id === "plan")?.done ?? false;
  const tasks = [{ en: "Login to SYNC", hi: "SYNC में लॉगिन", done: true }, { en: "Explore a plan", hi: "प्लान देखें", done: planDone }, { en: "View an offer", hi: "ऑफ़र देखें", done: daily.offerSeen }];
  const todo = r.entries.filter((e) => !e.done || e.id === "referral");
  const done = r.entries.filter((e) => e.done);
  const offers = [
    { icon: Percent, tone: "from-[#FFE3E6] to-[#FFF4F4] text-primary", title: H("₹500 off", "₹500 की छूट"), sub: H("on your next business plan", "अगले बिज़नेस प्लान पर"), tag: H("Bronze exclusive", "ब्रॉन्ज़ खास"), art: Gift },
    { icon: CloudUpload, tone: "from-[#ECE6FF] to-[#F6F2FF] text-[#6D4FD8]", title: H("Free Cloud Add-on", "मुफ़्त क्लाउड ऐड-ऑन"), sub: H("for 1 month", "1 महीने के लिए"), art: CloudUpload },
    { icon: Video, tone: "from-[#DFF0FF] to-[#F1F8FF] text-[#2167C5]", title: H("10% off", "10% छूट"), sub: H("on CCTV devices", "CCTV डिवाइस पर"), art: Video },
  ];

  return (
    <div className="space-y-5 pb-6">
      <header className="relative min-h-[4.5rem] pr-28">
        <Image src="/rewards-gift.png" alt="" width={160} height={104} priority className="pointer-events-none absolute -right-2 -top-3 w-32 mix-blend-multiply [mask-image:radial-gradient(closest-side,black_65%,transparent)]" />
        <h1 className="flex items-center gap-2 text-[1.875rem] font-extrabold leading-tight tracking-tight">{H("Rewards", "रिवॉर्ड")}<Gift className="size-7 text-primary" /></h1>
        <p className="mt-1 text-sm text-muted-foreground">{H("Earn Udyam Coins, cashback & exclusive business offers", "उद्यम कॉइन, कैशबैक और खास बिज़नेस ऑफ़र पाएँ")}</p>
      </header>

      {/* coins */}
      <section className="hero-red rounded-3xl p-5" aria-label={t("coins_title")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold">{t("coins_title")}<Info className="size-4 opacity-80" aria-hidden /></h2>
          <button type="button" onClick={() => setTiers(true)} className="inline-flex min-h-9 items-center gap-0.5 rounded-full border border-white/40 bg-white/10 pl-3.5 pr-2 text-sm font-semibold backdrop-blur hover:bg-white/20">{H("View Tiers", "टियर देखें")}<ChevronRight className="size-4" /></button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_28%,#FFE9A8,#F4B52E_55%,#C98A0B)] text-[#7A4B00] shadow-[inset_0_-3px_0_rgba(0,0,0,.15)]" aria-hidden><Coins className="size-6" /></span>
          <span className="num text-[2.5rem] font-extrabold leading-none">{r.balance}</span>
          <span className="mx-1 h-8 w-px bg-white/40" aria-hidden />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE7B0] px-3.5 py-1.5 text-sm font-bold text-[#7A4B00]"><Crown className="size-4" />{t(`tier_${r.tier}`)}</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.next?.pct ?? 100}>
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#FFC93C,#F4A100)]" style={{ width: `${Math.max(r.next?.pct ?? 100, 4)}%` }} />
          </div>
          {r.next && <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-white/85 text-[#8A8F99]"><Crown className="size-3.5" /></span>{t(`tier_${r.next.tier}`)}</span>}
        </div>
        <p className="mt-2 text-sm text-white/90">{r.next ? t("coins_togo").replace("{n}", String(r.next.toGo)).replace("{tier}", t(`tier_${r.next.tier}`)) : t("coins_top")}</p>
      </section>

      {/* quick tiles */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { icon: Ticket, label: H("Offers & Cashback", "ऑफ़र और कैशबैक"), sub: "", bg: "from-[#FFE3E6] to-[#FFF5F5] text-primary", on: () => { document.getElementById("offers")?.scrollIntoView({ behavior: "smooth", block: "start" }); daily.markOffer(); } },
          { icon: Disc3, label: H("Spin & Win", "घुमाएँ और जीतें"), sub: H("Soon", "जल्द"), bg: "from-[#ECE6FF] to-[#F7F4FF] text-[#6D4FD8]", on: soon },
          { icon: Wallet, label: H("Scratch Card", "स्क्रैच कार्ड"), sub: H("Soon", "जल्द"), bg: "from-[#FFF0CC] to-[#FFF9EA] text-[#B87400]", on: soon },
          { icon: CalendarCheck, label: H("Daily Challenge", "दैनिक चुनौती"), sub: `${tasks.filter((x) => x.done).length}/3`, bg: "from-[#DFF0FF] to-[#F2F8FF] text-[#2167C5]", on: () => document.getElementById("daily")?.scrollIntoView({ behavior: "smooth", block: "center" }) },
        ] as const).map(({ icon: I, label, sub, bg, on }) => (
          <button key={label} type="button" onClick={on} className={cn("flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-b px-1.5 py-3 text-center shadow-card transition-transform active:scale-95 dark:from-card dark:to-card", bg)}>
            <I className="size-8" strokeWidth={1.75} />
            <span className="text-[0.75rem] font-bold leading-tight text-foreground">{label}</span>
            {sub && <span className="text-[0.625rem] font-semibold text-muted-foreground">{sub}</span>}
          </button>
        ))}
      </div>

      {/* daily challenges */}
      <section id="daily" aria-labelledby="daily-h" className="ai-card rounded-3xl border p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#6D4FD8] shadow-card"><CalendarCheck className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 id="daily-h" className="text-base font-extrabold">{H("Daily Challenges", "दैनिक चुनौतियाँ")}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFE9D6] px-2 py-0.5 text-[0.6875rem] font-bold text-[#C2410C] dark:bg-warning-soft dark:text-warning"><Flame className="size-3" />{H(`Streak: ${daily.streak} ${daily.streak === 1 ? "day" : "days"}`, `लगातार: ${daily.streak} दिन`)}</span></div>
            <p className="text-xs text-muted-foreground">{H("Complete 3 simple tasks today", "आज 3 आसान काम पूरे करें")}</p>
          </div>
          <span className="num shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#6D4FD8]">{tasks.filter((x) => x.done).length}/3</span>
        </div>
        <ol className="mt-4 grid grid-cols-3">
          {tasks.map((x, i) => (
            <li key={x.en} className="relative flex flex-col items-center text-center">
              {i > 0 && <span aria-hidden className={cn("absolute top-[0.7rem] h-0.5 w-[calc(100%-1.6rem)] right-[calc(50%+0.8rem)]", x.done ? "bg-success" : "bg-muted-foreground/25")} />}
              <span className={cn("relative z-10 flex size-6 items-center justify-center rounded-full border-2", x.done ? "border-success bg-success text-white" : "border-muted-foreground/40 bg-card")}>{x.done && <Check className="size-3.5" strokeWidth={3} />}</span>
              <span className="mt-1.5 text-[0.6875rem] font-semibold leading-tight">{hi ? x.hi : x.en}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* offers */}
      <section id="offers" aria-labelledby="offers-h" className="scroll-mt-20 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="offers-h" className="text-lg font-extrabold">{H("Offers for you", "आपके लिए ऑफ़र")} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 align-middle text-[0.625rem] font-bold text-muted-foreground">{H("Preview", "प्रीव्यू")}</span></h2>
          <button type="button" onClick={soon} className="inline-flex min-h-9 items-center gap-1 text-sm font-bold text-primary">{H("View all offers", "सभी ऑफ़र")}<ArrowRight className="size-4" /></button>
        </div>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {offers.map((o) => (
            <article key={o.title} className={cn("relative flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-3.5 shadow-card dark:from-card dark:to-card", o.tone)}>
              <o.art className="pointer-events-none absolute -bottom-2 -right-2 size-20 opacity-15" strokeWidth={1.25} aria-hidden />
              <div className="flex items-center justify-between gap-1"><span className="flex size-9 items-center justify-center rounded-xl bg-white/90 shadow-card"><o.icon className="size-5" /></span>
                {o.tag && <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[0.5625rem] font-bold text-[#B87400]"><Crown className="size-2.5" />{o.tag}</span>}</div>
              <div className="mt-2.5 text-lg font-extrabold leading-tight text-foreground">{o.title}</div>
              <div className="text-xs text-muted-foreground">{o.sub}</div>
              <button type="button" onClick={() => { daily.markOffer(); soon(); }} className="relative mt-3 inline-flex min-h-8 w-fit items-center gap-0.5 rounded-full bg-white px-3 text-xs font-bold text-primary shadow-card">{H("Claim Now", "अभी लें")}<ChevronRight className="size-3.5" /></button>
            </article>
          ))}
        </div>
      </section>

      {/* ways to earn */}
      <section aria-labelledby="earn-h" className="space-y-3">
        <h2 id="earn-h" className="text-lg font-extrabold">{H("Ways to earn more coins", "और कॉइन कमाने के तरीके")}</h2>
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-card">
          {todo.map((e) => {
            const I = ICON[e.id];
            return (
              <li key={e.id}>
                <Link href={HREF[e.id]} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><I className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-bold">{t(`earn_${e.id}`)}</span><span className="block truncate text-xs text-muted-foreground">{hi ? SUB[e.id][1] : SUB[e.id][0]}</span></span>
                  <span className="num shrink-0 rounded-full bg-[#FFF1CC] px-2.5 py-1 text-xs font-bold text-[#7A4B00]">+{e.coins} {H("Coins", "कॉइन")}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* recent activity */}
      <section aria-labelledby="act-h" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="act-h" className="text-lg font-extrabold">{H("Recent activity", "हाल की गतिविधि")}</h2>
          <button type="button" onClick={() => setHistory(true)} className="inline-flex min-h-9 items-center gap-1 text-sm font-bold text-primary">{H("View history", "इतिहास देखें")}<ArrowRight className="size-4" /></button>
        </div>
        {done.length === 0 ? <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">{H("Your coins will show up here as you earn them.", "कमाए गए कॉइन यहाँ दिखेंगे।")}</p> : (
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card shadow-card">
            {done.slice(0, 3).map((e) => <Activity key={e.id} e={e} t={t} />)}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">{t("rw_note")}</p>

      <Sheet open={tiers} onOpenChange={setTiers}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-6">
          <SheetHeader><SheetTitle>{H("Tiers", "टियर")}</SheetTitle></SheetHeader>
          <ul className="space-y-2 px-4">
            {TIERS.map((x) => (
              <li key={x.id} className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3", r.tier === x.id && "border-primary bg-accent")}>
                <Crown className={cn("size-5", r.tier === x.id ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("flex-1", r.tier === x.id ? "font-extrabold" : "font-medium")}>{t(`tier_${x.id}`)}</span>
                <span className="num text-sm text-muted-foreground">{x.min}+ {H("coins", "कॉइन")}</span>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
      <Sheet open={history} onOpenChange={setHistory}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-3xl pb-6">
          <SheetHeader><SheetTitle>{H("Coin history", "कॉइन इतिहास")}</SheetTitle></SheetHeader>
          <ul className="mx-4 divide-y overflow-hidden rounded-2xl border">{done.map((e) => <Activity key={e.id} e={e} t={t} />)}</ul>
          <p className="px-4 pt-1 text-xs text-muted-foreground"><span className="num font-bold text-foreground">{r.balance}</span> {H("coins in total", "कुल कॉइन")}</p>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Activity({ e, t }: { e: RewardEntry; t: (k: string) => string }) {
  const total = e.id === "referral" ? e.coins * (e.count ?? 0) : e.coins;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><Coins className="size-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-bold">{t(`earn_${e.id}`)}</span><span className="block text-xs text-muted-foreground">{t("rw_done")}{e.id === "referral" && e.count ? ` ×${e.count}` : ""}</span></span>
      <span className="num shrink-0 text-sm font-bold text-success">+{total} {t("coins")}</span>
    </li>
  );
}
