"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Cloud, FileCheck2, LayoutDashboard, Languages, Receipt, ScanSearch, ShieldCheck, Sparkles, Truck, Wifi, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitch } from "@/components/customer/app-nav";
import { Mark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { Wordmark } from "./parts";
import { ChatArt, ShopArt, TrackArt } from "./art";

const SEEN = "ud_splash_seen";
const SPLASH_MS = 2200;

/** First screen for a signed-out visitor: a red splash for a moment (once per visit), then the swipeable welcome. */
export function Intro() {
  const [stage, setStage] = useState<"init" | "splash" | "welcome">("init");
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN) === "1"; } catch { /* private mode: just show the splash */ }
    // state is only ever set from timer callbacks, never synchronously in the effect body
    if (seen) { const t = setTimeout(() => setStage("welcome"), 0); return () => clearTimeout(t); }
    const a = setTimeout(() => setStage("splash"), 0);
    const b = setTimeout(() => { try { sessionStorage.setItem(SEEN, "1"); } catch { /* ignore */ } setStage("welcome"); }, SPLASH_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (stage === "welcome") return <Welcome />;
  return <Splash onSkip={() => { try { sessionStorage.setItem(SEEN, "1"); } catch { /* ignore */ } setStage("welcome"); }} live={stage === "splash"} />;
}

/** The red launch screen shown while the session is being checked, so the very first paint is already the splash. */
export const LaunchScreen = () => <Splash onSkip={() => {}} live={false} />;

function Splash({ onSkip, live }: { onSkip: () => void; live: boolean }) {
  const { lang } = useI18n();
  const H = (en: string, h: string) => (lang === "hi" || lang === "mr" ? h : en);
  return (
    <button type="button" onClick={onSkip} aria-label={H("Continue", "आगे बढ़ें")} disabled={!live}
      className="relative flex min-h-dvh w-full cursor-pointer flex-col overflow-hidden bg-[radial-gradient(120%_75%_at_50%_0%,oklch(0.62_0.24_27),oklch(0.5_0.22_27)_65%,oklch(0.42_0.19_27))] px-8 text-left text-white">
      <svg aria-hidden viewBox="0 0 400 260" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full">
        <path d="M0 150C80 90 150 90 220 140s130 60 180 10v110H0z" fill="#fff" opacity="0.07" />
        <path d="M0 190c90-60 170-30 240 20s110 30 160-10v100H0z" fill="#fff" opacity="0.08" />
      </svg>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="flex flex-col items-center">
          <Mark tone="white" className="size-24" />
          <div className="mt-2 flex items-center gap-3 leading-none">
            <span className="text-[2.75rem] font-extrabold lowercase tracking-tight">airtel</span>
            <span aria-hidden className="h-10 w-px bg-white/60" />
            <span className="text-[2.75rem] font-extrabold tracking-tight">SYNC</span>
          </div>
          <span className="mt-4 rounded-full bg-white/20 px-6 py-2 text-lg font-bold ring-1 ring-white/30">Business</span>
        </div>
        <div className="mt-24">
          <h1 className="text-[2.25rem] font-extrabold leading-[1.1] tracking-tight">{H("Your Business.", "आपका बिज़नेस।")}<br />{H("Better Connected.", "बेहतर कनेक्टेड।")}</h1>
          <p className="mt-4 max-w-xs text-lg leading-snug text-white/85">{H("Connectivity, security and digital solutions for businesses.", "बिज़नेस के लिए कनेक्टिविटी, सुरक्षा और डिजिटल समाधान।")}</p>
        </div>
      </div>
      <div className="relative mx-auto mb-8 flex gap-2" aria-hidden>
        <span className="size-2.5 rounded-full bg-white" /><span className="size-2.5 rounded-full bg-white/45" /><span className="size-2.5 rounded-full bg-white/45" />
      </div>
    </button>
  );
}

const SLIDE_MS = 5200;

interface Item { icon: LucideIcon; en: string; hi: string }
interface Slide { title: [string, string, string]; titleHi: [string, string, string]; sub: string; subHi: string; items: Item[] }
const SLIDES: Slide[] = [
  {
    title: ["All your business", "connectivity in", "one place."], titleHi: ["आपके बिज़नेस की", "पूरी कनेक्टिविटी", "एक जगह।"],
    sub: "Internet, calling, security and more — tailored for your business.", subHi: "इंटरनेट, कॉलिंग, सुरक्षा और बहुत कुछ — आपके बिज़नेस के हिसाब से।",
    items: [
      { icon: Wifi, en: "High-speed internet & calling", hi: "हाई-स्पीड इंटरनेट और कॉलिंग" }, { icon: ShieldCheck, en: "Secure your business", hi: "अपने बिज़नेस को सुरक्षित रखें" },
      { icon: Cloud, en: "Cloud & productivity tools", hi: "क्लाउड और प्रोडक्टिविटी टूल्स" }, { icon: LayoutDashboard, en: "AI-powered recommendations", hi: "AI से सही सुझाव" },
    ],
  },
  {
    title: ["One clear price,", "in your own", "language."], titleHi: ["एक साफ़ कीमत,", "आपकी अपनी", "भाषा में।"],
    sub: "Tell us about your business in Hindi, Marathi, Tamil or English — no jargon.", subHi: "अपने बिज़नेस के बारे में हिन्दी, मराठी, तमिल या अंग्रेज़ी में बताइए — कोई मुश्किल शब्द नहीं।",
    items: [
      { icon: Languages, en: "Chat in your language", hi: "अपनी भाषा में बात करें" }, { icon: Sparkles, en: "A plan picked for your business", hi: "आपके बिज़नेस के लिए चुना प्लान" },
      { icon: Receipt, en: "One monthly price, GST shown", hi: "एक मासिक कीमत, GST अलग दिखता है" }, { icon: LayoutDashboard, en: "Add or remove items any time", hi: "जब चाहें आइटम जोड़ें या हटाएँ" },
    ],
  },
  {
    title: ["Buy, sign and", "track, all on", "your phone."], titleHi: ["फ़ोन पर ही खरीदें,", "साइन करें और", "ट्रैक करें।"],
    sub: "We check your GST and Udyam first, then ask only for what is missing.", subHi: "हम पहले आपका GST और उद्यम देखते हैं, फिर सिर्फ़ वही माँगते हैं जो कम है।",
    items: [
      { icon: ScanSearch, en: "Instant GST & Udyam lookup", hi: "तुरंत GST और उद्यम जाँच" }, { icon: FileCheck2, en: "Upload documents, we read them", hi: "दस्तावेज़ अपलोड करें, हम पढ़ लेंगे" },
      { icon: ShieldCheck, en: "Sign with a code, pay securely", hi: "कोड से साइन, सुरक्षित भुगतान" }, { icon: Truck, en: "Track your installation live", hi: "इंस्टॉलेशन लाइव ट्रैक करें" },
    ],
  },
];

/** The first screens after the splash. Slide 1 follows the supplied reference; slides 2 and 3 use the same layout with their own picture. */
function Welcome() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const router = useRouter();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false); // prefers-reduced-motion: no auto-advance
  const rail = useRef<HTMLDivElement>(null);
  const goTo = (n: number) => { const el = rail.current; if (el) el.scrollTo({ left: n * el.clientWidth, behavior: still ? "auto" : "smooth" }); };

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(q.matches);
    const t = setTimeout(sync, 0);
    q.addEventListener("change", sync);
    return () => { clearTimeout(t); q.removeEventListener("change", sync); };
  }, []);
  // Auto-advance. Any touch, hover or focus pauses it; changing slide (by hand or by timer) restarts the clock.
  useEffect(() => {
    if (paused || still) return;
    const t = setTimeout(() => goTo((i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, paused, still]); // eslint-disable-line react-hooks/exhaustive-deps

  const art = [
    <ShopArt key="s" label={H("An Airtel Business shop with a red awning and a wifi sign", "लाल शामियाने और वाई-फ़ाई साइन वाली Airtel Business की दुकान")} />,
    <ChatArt key="c" label={H("A phone chat in Hindi with the AI advisor, language tiles and a rupee coin", "AI सलाहकार से हिन्दी चैट वाला फ़ोन, भाषा टाइल और रुपये का सिक्का")} />,
    <TrackArt key="t" label={H("An installation van on its way to your door, with verified documents", "आपके दरवाज़े की ओर जाती इंस्टॉलेशन वैन, वेरिफाई दस्तावेज़ों के साथ")} />,
  ];

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_58%,oklch(0.975_0.016_20)_100%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-4 pt-5">
        <header className="relative flex items-center justify-center">
          <Wordmark />
          <span className="absolute right-0"><LanguageSwitch className="[&_select]:h-9 [&_select]:w-10 [&_select]:pl-8 [&_select]:pr-0 [&_select]:text-transparent" /></span>
        </header>

        <div ref={rail} onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); }}
          onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
          className="-mx-6 mt-5 flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SLIDES.map((s, n) => (
            <section key={n} aria-roledescription="slide" aria-label={`${n + 1} / ${SLIDES.length}`} aria-hidden={n !== i} className="flex w-full shrink-0 snap-center flex-col px-6">
              <h1 className="text-[2.125rem] font-extrabold leading-[1.12] tracking-tight">
                {(hi ? s.titleHi : s.title).map((l, k, a) => <span key={k} className={cn("block", k === a.length - 1 && "text-primary")}>{l}</span>)}
              </h1>
              <p className="mt-3 max-w-[20rem] text-[1.125rem] leading-snug text-foreground/85">{hi ? s.subHi : s.sub}</p>
              <div className="-mx-1 grid flex-1 place-items-center py-2">{art[n]}</div>
              <ul className="space-y-3">
                {s.items.map((it) => (
                  <li key={it.en} className="flex items-center gap-4 text-[0.9375rem] font-medium">
                    <span className="grid h-9 w-11 shrink-0 place-items-center rounded-2xl bg-[oklch(0.955_0.03_20)] text-primary"><it.icon className="size-5" strokeWidth={1.75} aria-hidden /></span>{hi ? it.hi : it.en}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-3" role="tablist" aria-label={H("Welcome slides", "वेलकम स्लाइड")}>
          {SLIDES.map((_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`${n + 1}`} onClick={() => goTo(n)} className="flex size-6 items-center justify-center">
              <span className={cn("block rounded-full transition-all", n === i ? "size-2.5 bg-primary" : "size-2.5 bg-foreground/20")} />
            </button>
          ))}
        </div>
        <Button size="lg" onClick={() => router.push("/login")}
          className="mt-3 h-14 w-full rounded-2xl bg-[linear-gradient(180deg,oklch(0.56_0.2_27),oklch(0.45_0.18_27))] text-lg text-white shadow-[0_12px_24px_-10px_rgb(150_20_20/0.65)] hover:brightness-105">
          {H("Get Started", "शुरू करें")}<ArrowRight className="size-5" aria-hidden />
        </Button>
        <p className="mt-1 text-center text-sm">
          <Link href="/explore" className="inline-flex min-h-11 items-center font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{H("Explore plans first", "पहले प्लान देखें")}</Link>
        </p>
      </div>
    </div>
  );
}
