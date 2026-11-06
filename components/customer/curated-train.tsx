"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { bundleName } from "@/lib/i18n/bundles";
import { plainName } from "@/lib/catalogue/plain";
import { inr } from "@/lib/client/format";
import { cn } from "@/lib/utils";
import type { useBundleSamples } from "@/components/landing/welcome";

type Sample = ReturnType<typeof useBundleSamples>[number];

const SPEED_PX_S = 32;     // gentle train speed
const RESUME_MS = 1800;    // wait after a swipe/hover before rolling again

/**
 * "Curated for you" as a moving train: compact cards roll sideways once the row is on screen and loop forever (the list is
 * rendered twice and the scroll position wraps by one set's width). Hover, touch or keyboard focus pauses it; a swipe moves it
 * by hand and it carries on from there. Reduced-motion users get a plain swipeable row.
 */
export function CuratedTrain({ samples, href, badge }: { samples: Sample[]; href: string; badge: string }) {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || samples.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = false, held = false, selfScroll = false, resumeAt = 0, raf = 0, last = 0;
    let pos = el.scrollLeft;
    const setWidth = () => {
      const kids = el.querySelectorAll<HTMLElement>("[data-card]");
      return kids.length > samples.length ? kids[samples.length].offsetLeft - kids[0].offsetLeft : 0;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 64) : 0;
      last = now;
      if (!visible || held || now < resumeAt) { pos = el.scrollLeft; return; }
      const w = setWidth();
      if (!w) return;
      pos += (SPEED_PX_S * dt) / 1000;
      if (pos >= w) pos -= w;
      selfScroll = true;
      el.scrollLeft = pos;
    };
    const hold = () => { held = true; };
    const release = () => { held = false; resumeAt = performance.now() + RESUME_MS; };
    // a manual swipe past either end wraps too, so the row never "ends"
    const onScroll = () => {
      if (selfScroll) { selfScroll = false; return; }
      const w = setWidth();
      if (!w) return;
      if (el.scrollLeft >= w) el.scrollLeft -= w;
      else if (el.scrollLeft <= 0) el.scrollLeft += w;
    };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.35 });
    io.observe(el);
    el.addEventListener("pointerenter", hold);
    el.addEventListener("pointerleave", release);
    el.addEventListener("touchstart", hold, { passive: true });
    el.addEventListener("touchend", release);
    el.addEventListener("focusin", hold);
    el.addEventListener("focusout", release);
    el.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      el.removeEventListener("pointerenter", hold); el.removeEventListener("pointerleave", release);
      el.removeEventListener("touchstart", hold); el.removeEventListener("touchend", release);
      el.removeEventListener("focusin", hold); el.removeEventListener("focusout", release);
      el.removeEventListener("scroll", onScroll);
    };
  }, [samples.length]);

  const loop = samples.length > 1 ? [...samples, ...samples] : samples;
  return (
    <div
      ref={ref}
      className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-2.5rem),transparent)]"
    >
      {loop.map((c, k) => {
        const copy = k >= samples.length;
        const first = k % samples.length === 0;
        return (
          <Link
            key={`${c.id}-${k}`}
            data-card
            href={href}
            aria-hidden={copy || undefined}
            tabIndex={copy ? -1 : undefined}
            className={cn(
              "group flex w-[11.5rem] shrink-0 flex-col rounded-2xl border bg-card p-3.5 shadow-card transition duration-200 ease-out hover:-translate-y-1 hover:border-primary hover:shadow-lift active:scale-[0.97]",
              first && "surface-tint",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex -space-x-1.5">
                {c.items.map((p) => (
                  <span key={p} className="flex size-8 items-center justify-center rounded-full bg-accent text-primary ring-2 ring-card transition-transform duration-200 group-hover:scale-110"><ProductIcon id={p} className="size-4" /></span>
                ))}
              </div>
              {first && <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground" title={badge}><Sparkles className="size-3.5" aria-hidden /></span>}
            </div>
            {first && <span className="mt-2.5 truncate text-[0.6875rem] font-bold uppercase tracking-wide text-primary">{badge}</span>}
            <h3 className={cn("line-clamp-1 text-[0.9375rem] font-extrabold", first ? "mt-0.5" : "mt-2.5")}>{bundleName(c.id, lang)}</h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">{c.items.map((p) => plainName(p, lang).split(" (")[0]).join(" · ")}</p>
            <div className="mt-auto flex items-end justify-between gap-2 pt-3">
              <div className="min-w-0">
                <div className="truncate text-[0.6875rem] text-muted-foreground">{c.perSite ? `${t("ld_from")}, ${t("ld_per_loc")}` : t("ld_from")}</div>
                <div className="whitespace-nowrap leading-tight"><span className="num text-lg font-extrabold">{inr(c.price)}</span><span className="text-[0.6875rem] text-muted-foreground">{t("per_month")}</span></div>
              </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden><ArrowRight className="size-4" aria-hidden /></span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
