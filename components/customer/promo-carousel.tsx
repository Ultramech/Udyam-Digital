"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, MessageCircle, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 3000;

interface Slide { key: string; title: string; sub: string; cta: string; href: string; art: ReactNode }
export interface SetupInfo { pct: number; next: string; href: string }

/** Home banner: light promo cards that auto-advance, pause on hover/focus/touch, swipe on phones and stay still for reduced motion. */
export function PromoCarousel({ setup }: { setup: SetupInfo | null }) {
  const { t } = useI18n();
  const slides: Slide[] = [
    { key: "grow", title: t("promo_grow_t"), sub: t("promo_grow_s"), cta: t("promo_grow_cta"), href: "/catalogue", art: <ShopArt /> },
    { key: "advisor", title: t("promo_adv_t"), sub: t("promo_adv_s"), cta: t("promo_adv_cta"), href: "/advisor", art: <AdvisorArt /> },
    ...(setup ? [{ key: "setup", title: t("promo_setup_t").replace("{n}", String(setup.pct)), sub: setup.next, cta: t("promo_setup_cta"), href: setup.href, art: <RingArt pct={setup.pct} /> }] : []),
  ];
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const cur = index % n;
  const go = useCallback((k: number) => setIndex(((k % n) + n) % n), [n]);

  // a timeout keyed on the current slide, so a manual change restarts the countdown
  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => go(cur + 1), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [cur, paused, n, go]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("promo_label")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const start = touchX.current; touchX.current = null; setPaused(false);
        if (start === null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="overflow-hidden rounded-3xl shadow-card">
        <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${cur * 100}%)` }}>
          {slides.map((s, k) => (
            <div key={s.key} role="group" aria-roledescription="slide" aria-label={`${k + 1} / ${n}`} aria-hidden={k !== cur} className="w-full shrink-0">
              <div className="surface-tint relative flex h-full min-h-48 overflow-hidden rounded-3xl border">
                <div className="relative z-10 flex w-[58%] flex-col p-5 pr-0">
                  <h2 className="text-[1.125rem] font-extrabold leading-tight tracking-tight">{s.title}</h2>
                  <p className="mb-4 mt-1.5 line-clamp-3 text-[0.8125rem] leading-snug text-muted-foreground">{s.sub}</p>
                  <Link href={s.href} tabIndex={k === cur ? 0 : -1} className="mt-auto inline-flex min-h-10 w-fit items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card transition-transform active:scale-[0.97]">
                    {s.cta}<ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[48%]">{s.art}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {slides.map((s, k) => (
            <button key={s.key} type="button" onClick={() => go(k)} aria-label={`${t("promo_goto")} ${k + 1}`} aria-current={k === cur} className="flex h-6 items-center px-1">
              <span className={cn("block h-1.5 rounded-full transition-all duration-300", k === cur ? "w-5 bg-primary" : "w-1.5 bg-primary/25")} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Storefront photo with its red swoosh; multiply blends its white edge into the card's pink tint. */
function ShopArt() {
  return <Image src="/promo-shop.png" alt="" width={330} height={318} priority className="absolute inset-y-0 right-0 h-full w-auto max-w-none object-cover mix-blend-multiply [mask-image:linear-gradient(to_right,transparent,black_14%)]" />;
}

function AdvisorArt() {
  return (
    <div className="absolute right-5 top-1/2 -translate-y-1/2">
      <div className="flex size-24 items-center justify-center rounded-full bg-white shadow-card"><Sparkles className="size-11 text-primary" strokeWidth={1.75} /></div>
      <span className="absolute -left-6 -top-2 flex size-10 items-center justify-center rounded-2xl rounded-br-sm bg-primary text-primary-foreground shadow-card"><MessageCircle className="size-5" /></span>
      <span className="absolute -bottom-1 -right-1 flex h-7 items-center gap-1 rounded-full bg-white px-2.5 shadow-card">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 rounded-full bg-primary/60" />)}</span>
    </div>
  );
}

function RingArt({ pct }: { pct: number }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="absolute right-5 top-1/2 size-28 -translate-y-1/2">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="white" stroke="currentColor" strokeWidth="10" className="text-primary/15" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="text-primary" />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-2xl font-extrabold text-primary">{pct}%</span>
    </div>
  );
}
