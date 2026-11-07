"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Cloud, FileCheck2, LayoutGrid, Languages, Receipt, ScanSearch, ShieldCheck, Sparkles, Truck, Wifi, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitch } from "@/components/customer/app-nav";
import { Mark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { AuthScreen, Wordmark } from "./parts";
import { ChatScene, ConnectScene, TrackScene } from "./scenes";

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

const SLIDE_MS = 4800;

interface Item { icon: LucideIcon; en: string; hi: string }
interface Slide { title: [string, string, string]; titleHi: [string, string, string]; sub: string; subHi: string; items: Item[]; layout: "grid" | "list" | "steps" }
const SLIDES: Slide[] = [
  {
    layout: "grid",
    title: ["All your business", "connectivity in", "one place."], titleHi: ["आपके बिज़नेस की", "पूरी कनेक्टिविटी", "एक जगह।"],
    sub: "Internet, calling, security and more, tailored for your business.", subHi: "इंटरनेट, कॉलिंग, सुरक्षा और बहुत कुछ, आपके बिज़नेस के हिसाब से।",
    items: [
      { icon: Wifi, en: "High-speed internet & calling", hi: "हाई-स्पीड इंटरनेट और कॉलिंग" }, { icon: ShieldCheck, en: "Secure your business", hi: "बिज़नेस की सुरक्षा" },
      { icon: Cloud, en: "Cloud & productivity tools", hi: "क्लाउड और प्रोडक्टिविटी" }, { icon: LayoutGrid, en: "AI-powered recommendations", hi: "AI से सही सुझाव" },
    ],
  },
  {
    layout: "list",
    title: ["One clear price,", "in your own", "language."], titleHi: ["एक साफ़ कीमत,", "आपकी अपनी", "भाषा में।"],
    sub: "Tell us about your business in Hindi, Marathi, Tamil or English.", subHi: "अपने बिज़नेस के बारे में हिन्दी, मराठी, तमिल या अंग्रेज़ी में बताइए।",
    items: [
      { icon: Languages, en: "Chat in your language", hi: "अपनी भाषा में बात करें" }, { icon: Sparkles, en: "A plan picked for your business", hi: "आपके बिज़नेस के लिए चुना प्लान" },
      { icon: Receipt, en: "One monthly price, GST shown", hi: "एक मासिक कीमत, GST अलग दिखता है" },
    ],
  },
  {
    layout: "steps",
    title: ["Buy, sign and", "track, all on", "your phone."], titleHi: ["फ़ोन पर ही", "खरीदें, साइन करें", "और ट्रैक करें।"],
    sub: "We look up your GST and Udyam first, then ask only for what is missing.", subHi: "हम पहले आपका GST और उद्यम देखते हैं, फिर सिर्फ़ वही माँगते हैं जो कम है।",
    items: [
      { icon: ScanSearch, en: "Instant GST & Udyam lookup", hi: "तुरंत GST और उद्यम जाँच" }, { icon: FileCheck2, en: "Upload documents, we read them", hi: "दस्तावेज़ अपलोड करें, हम पढ़ लेंगे" },
      { icon: ShieldCheck, en: "Sign with a code, pay securely", hi: "कोड से साइन, सुरक्षित भुगतान" }, { icon: Truck, en: "Track the installation", hi: "इंस्टॉलेशन ट्रैक करें" },
    ],
  },
];

/** Same facts, three different layouts, so the slides don't read as one card repeated. */
function Items({ slide, hi }: { slide: Slide; hi: boolean }) {
  const text = (it: Item) => (hi ? it.hi : it.en);
  if (slide.layout === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-2.5">
        {slide.items.map((it) => (
          <li key={it.en} className="flex flex-col gap-2 rounded-2xl border border-white bg-white/80 p-3 shadow-card">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary"><it.icon className="size-5" aria-hidden /></span>
            <span className="text-[0.8125rem] font-semibold leading-snug">{text(it)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (slide.layout === "list") {
    return (
      <ul className="space-y-2.5">
        {slide.items.map((it) => (
          <li key={it.en} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3.5 py-3 text-[0.9375rem] font-semibold shadow-card">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><it.icon className="size-4" aria-hidden /></span>{text(it)}
            <Check className="ml-auto size-4 shrink-0 text-success" aria-hidden />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-2.5">
      {slide.items.map((it, n) => (
        <li key={it.en} className="flex items-center gap-2.5 text-[0.8125rem] font-semibold leading-snug">
          <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">{n + 1}</span>{text(it)}
        </li>
      ))}
    </ol>
  );
}

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

  const scenes = [
    <ConnectScene key="c" label={H("Internet, calling, security and cloud around the Airtel mark", "Airtel मार्क के चारों ओर इंटरनेट, कॉलिंग, सुरक्षा और क्लाउड")} />,
    <ChatScene key="t" label={H("A Hindi chat with the AI advisor that ends in a plan", "AI सलाहकार से हिन्दी चैट, जो प्लान पर खत्म होती है")}
      user="मेरी दुकान इंदौर में है, 3 लोग हैं" plan="Dukaan Digital" price={H("One monthly price, GST shown", "एक मासिक कीमत, GST अलग")} />,
    <TrackScene key="k" label={H("An order tracker: documents verified, signed, installation in progress", "ऑर्डर ट्रैकर: दस्तावेज़ वेरिफाई, साइन, इंस्टॉलेशन जारी")}
      rows={[H("Documents verified", "दस्तावेज़ वेरिफाई"), H("Order signed", "ऑर्डर साइन"), H("Installation", "इंस्टॉलेशन")]} eta={H("Engineer on the way", "इंजीनियर रास्ते में")} />,
  ];

  return (
    <AuthScreen className="pb-6">
      <div className="flex items-center justify-between">
        <span className="size-10" aria-hidden />
        <Wordmark />
        <LanguageSwitch className="[&_select]:h-9 [&_select]:w-10 [&_select]:pl-8 [&_select]:pr-0 [&_select]:text-transparent" />
      </div>

      <div ref={rail} onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)); }}
        onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
        className="-mx-6 mt-4 flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SLIDES.map((s, n) => (
          <section key={n} aria-roledescription="slide" aria-label={`${n + 1} / ${SLIDES.length}`} aria-hidden={n !== i} className="flex w-full shrink-0 snap-center flex-col justify-start gap-4 px-6 pt-2">
            {scenes[n]}
            <div>
              <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight">
                {(hi ? s.titleHi : s.title).map((l, k, a) => <span key={k} className={cn("block", k === a.length - 1 && "text-primary")}>{l}</span>)}
              </h1>
              <p className="mt-2 text-[0.9375rem] leading-snug text-foreground/75">{hi ? s.subHi : s.sub}</p>
            </div>
            <Items slide={s} hi={hi} />
          </section>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label={H("Welcome slides", "वेलकम स्लाइड")}>
        {SLIDES.map((_, n) => (
          <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`${n + 1}`} onClick={() => goTo(n)} className="flex h-6 items-center px-0.5">
            <span className={cn("relative block h-2 overflow-hidden rounded-full transition-all", n === i ? "w-9 bg-foreground/15" : "w-2.5 bg-foreground/20")}>
              {n === i && <span key={`${i}-${paused}`} className="ud-fill absolute inset-y-0 left-0 rounded-full bg-primary" style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused || still ? "paused" : "running", ...(still ? { width: "100%" } : null) }} />}
            </span>
          </button>
        ))}
      </div>
      <Button size="lg" className="mt-3 h-14 w-full rounded-2xl text-lg shadow-lift" onClick={() => router.push("/login")}>
        {H("Get Started", "शुरू करें")}<ArrowRight className="size-5" aria-hidden />
      </Button>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        <Link href="/explore" className="inline-flex min-h-11 items-center font-semibold text-foreground underline-offset-4 hover:underline">{H("Explore plans first", "पहले प्लान देखें")}</Link>
      </p>
    </AuthScreen>
  );
}
