"use client";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, ArrowLeftRight, ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronDown, Cloud, Flame, LayoutGrid, MapPin, Phone, Plus,
  Search, Settings, ShieldCheck, Sparkles, Store, Video, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { advisorHref, useBundleSamples } from "@/components/landing/welcome";
import { CustomerShell } from "@/components/customer/shell";
import { plainBenefit, plainName, plainUnit, type Lang } from "@/lib/catalogue/plain";
import { api, ApiError, useJourney } from "@/lib/client/api";
import { inr } from "@/lib/client/format";
import { CATALOGUE } from "@/lib/catalogue";
import { bundleName, bundleTagline } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { cityTier } from "@/lib/rules/normalise";
import type { Ref } from "@/lib/rules/types";
import { cn } from "@/lib/utils";

interface Item {
  id: string; category: string; unit: string; priceMin: number; priceMax: number; setup: number; minContract: number; tiers: number[];
  minEmployees: number; minSites: number; requiresGstin: boolean; requiresOneOf: string[]; installDays: number; paused: boolean;
  status?: "included" | "addable" | "unavailable" | "swap"; reason?: Ref;
}

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;
const CATS: { id: string; en: string; hi: string; icon: Icon }[] = [
  { id: "all", en: "All", hi: "सभी", icon: LayoutGrid },
  { id: "Connectivity", en: "Internet", hi: "इंटरनेट", icon: Wifi },
  { id: "Communication", en: "Calling", hi: "कॉलिंग", icon: Phone },
  { id: "Cloud & Productivity", en: "Cloud", hi: "क्लाउड", icon: Cloud },
  { id: "Security", en: "Security", hi: "सुरक्षा", icon: ShieldCheck },
  { id: "IoT & Physical", en: "Devices", hi: "डिवाइस", icon: Video },
];
const PRICE_BANDS = [{ id: "all", max: Infinity }, { id: "500", max: 500 }, { id: "1500", max: 1500 }, { id: "5000", max: 5000 }] as const;
type Band = (typeof PRICE_BANDS)[number]["id"];

/** Who each service is for, from the catalogue's target segments (product_catalogue.csv). */
const SEGMENTS = new Map(CATALOGUE.map((p) => [p.id, p.segments]));
/** Tags: one set by who it suits, one set by what makes it easy. Each is a plain rule on catalogue data. */
const TAGS: { id: string; en: string; hi: string; kind: "who" | "perk"; test: (p: Item) => boolean }[] = [
  { id: "micro", en: "For shops", hi: "दुकानों के लिए", kind: "who", test: (p) => !!SEGMENTS.get(p.id)?.includes("micro") },
  { id: "prof", en: "For offices", hi: "ऑफिस के लिए", kind: "who", test: (p) => !!SEGMENTS.get(p.id)?.includes("prof") },
  { id: "multi", en: "Multi-store", hi: "कई दुकानें", kind: "who", test: (p) => !!SEGMENTS.get(p.id)?.includes("multi") },
  { id: "mfg", en: "Factories", hi: "फ़ैक्ट्री", kind: "who", test: (p) => !!SEGMENTS.get(p.id)?.includes("mfg") },
  { id: "cheap", en: "Under ₹500", hi: "₹500 से कम", kind: "perk", test: (p) => p.priceMin < 500 },
  { id: "free", en: "Free setup", hi: "मुफ़्त सेटअप", kind: "perk", test: (p) => p.setup === 0 },
  { id: "fast", en: "Live in 3 days", hi: "3 दिन में चालू", kind: "perk", test: (p) => p.installDays <= 3 },
  { id: "nogst", en: "No GST needed", hi: "GST ज़रूरी नहीं", kind: "perk", test: (p) => !p.requiresGstin },
];
const FIRST_PAGE = 6;
type Sort = "rec" | "low" | "high";
type Where = "any" | "1" | "2";

export default function CataloguePage() {
  return <Suspense fallback={<CustomerShell wide><Skeleton className="h-64" /></CustomerShell>}><Catalogue /></Suspense>;
}

function Catalogue() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const sp = useSearchParams();
  const journey = useJourney();
  const quoteId = sp.get("quote") ?? journey?.quoteId ?? null;
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("s") ?? ""));
  const [cat, setCat] = useState("all");
  const [band, setBand] = useState<Band>("all");
  const [sort, setSort] = useState<Sort>("rec");
  const [where, setWhere] = useState<Where>("any");
  const [city, setCity] = useState<string | null>(null);
  const [tag, setTag] = useState("all");
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ products: Item[] }>("GET", `/api/catalogue${quoteId ? `?quote=${quoteId}` : ""}`).then((r) => setItems(r.products)).catch(() => setItems([]));
  }, [quoteId]);
  useEffect(load, [load]);
  // "My location" defaults to the tier of the owner's own business city when we know it
  useEffect(() => {
    api<{ businesses: { city: string | null }[] }>("GET", "/api/me").then((m) => {
      const c = m.businesses[0]?.city ?? null;
      const tier = c ? cityTier(c) : null;
      setCity(c);
      if (tier) setWhere(String(tier) as Where);
    }).catch(() => {});
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const max = PRICE_BANDS.find((b) => b.id === band)!.max;
    const tagTest = TAGS.find((x) => x.id === tag)?.test;
    const list = (items ?? []).filter((p) =>
      (cat === "all" || p.category === cat) && p.priceMin <= max && (where === "any" || p.tiers.includes(Number(where))) && (!tagTest || tagTest(p)) &&
      (!needle || [plainName(p.id, "en"), plainName(p.id, "hi"), plainBenefit(p.id, "en"), plainBenefit(p.id, lang), p.category].some((s) => s.toLowerCase().includes(needle))));
    if (sort === "low") return [...list].sort((a, b) => a.priceMin - b.priceMin);
    if (sort === "high") return [...list].sort((a, b) => b.priceMin - a.priceMin);
    return list;
  }, [items, q, cat, band, where, sort, tag, lang]);
  // "Show all" belongs to the filters it was pressed under; any new filter starts again from a short list
  const filterKey = [q, cat, band, where, sort, tag].join("|");
  const visible = expandedFor === filterKey || comparing ? shown : shown.slice(0, FIRST_PAGE);

  async function add(id: string) {
    if (!quoteId) return;
    setBusy(id);
    try {
      const r = await api<{ blocked: (Ref & { productId?: string }) | null; notices?: Ref[] }>("PATCH", `/api/quote/${quoteId}`, { op: "edit", edit: { type: "add", productId: id } });
      if (r.blocked) toast.warning(ruleReason({ code: r.blocked.code, params: r.blocked.params, productId: r.blocked.productId }, lang));
      else { toast.success(H("Added to your plan", "प्लान में जोड़ा गया")); for (const n of r.notices ?? []) toast.info(ruleReason(n, lang)); load(); }
    } catch (e) { toast.error(e instanceof ApiError && e.code === "QUOTE_INVALID" ? H("That combination isn't allowed.", "यह कॉम्बिनेशन संभव नहीं है।") : H("Something went wrong", "कुछ गलत हुआ")); }
    setBusy(null);
  }
  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? (toast.info(H("Compare up to 3 services at a time.", "एक बार में 3 सेवाओं तक तुलना करें।")), p) : [...p, id]));
  }
  const compareItems = (items ?? []).filter((p) => picked.includes(p.id));

  return (
    <CustomerShell wide>
      <div className="space-y-5 pb-24">
        {/* hero */}
        <section className="relative isolate min-h-[9.5rem] overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#E3192C,#B8102A)] p-5 text-white shadow-lift">
          <Image src="/plans-hero-shop.png" alt="" width={276} height={144} priority className="absolute inset-y-0 right-0 -z-10 h-full w-[52%] object-cover object-right [mask-image:linear-gradient(to_right,transparent,black_30%)] sm:w-[40%]" />
          <h1 className="max-w-[58%] text-[1.375rem] font-extrabold leading-[1.15] tracking-tight sm:text-[1.75rem]">{H("Find the right plan for your business", "अपने बिज़नेस के लिए सही प्लान चुनें")}</h1>
          <p className="mt-2.5 text-sm text-white/85">{H("Internet · Calling · Security · Cloud", "इंटरनेट · कॉलिंग · सुरक्षा · क्लाउड")}</p>
          {quoteId && <Link href={`/quote/${quoteId}`} className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-xs font-bold backdrop-blur hover:bg-white/25"><ArrowLeft className="size-3.5" />{H("My plan", "मेरा प्लान")}</Link>}
        </section>

        {/* search */}
        <form role="search" className="flex h-14 items-center gap-2 rounded-full border bg-card pl-4 pr-2 shadow-card focus-within:border-primary" onSubmit={(e) => e.preventDefault()}>
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={H("Search for plans", "प्लान खोजें")} placeholder={H("Search for plans, e.g. “CCTV”, “Wi-Fi”, “Email”", "प्लान खोजें, जैसे “CCTV”, “Wi-Fi”, “ईमेल”")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <Link href={advisorHref(true, q.trim() || undefined)} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-primary hover:bg-accent"><Sparkles className="size-4" aria-hidden />{H("Ask AI", "AI से पूछें")}</Link>
        </form>

        {/* categories */}
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={H("Category", "श्रेणी")}>
          {CATS.map(({ id, en, hi: h, icon: I }) => (
            <button key={id} type="button" onClick={() => setCat(id)} aria-pressed={cat === id}
              className={cn("flex h-[4.75rem] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold shadow-card transition-all active:scale-95",
                cat === id ? "border-primary bg-primary text-primary-foreground shadow-lift" : "bg-card text-foreground hover:border-primary/50")}>
              <I className={cn("size-6", cat !== id && "text-primary")} strokeWidth={1.75} />{hi ? h : en}
            </button>
          ))}
        </div>

        {/* filters */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Pill icon={null} label={H("Price", "कीमत")} value={band} onChange={(v) => setBand(v as Band)}
            options={[{ v: "all", l: H("Any price", "कोई भी कीमत") }, ...PRICE_BANDS.slice(1).map((b) => ({ v: b.id, l: H(`Up to ₹${b.max.toLocaleString("en-IN")}`, `₹${b.max.toLocaleString("en-IN")} तक`) }))]} />
          <Pill icon={MapPin} label={H("My location", "मेरी लोकेशन")} value={where} onChange={(v) => setWhere(v as Where)}
            options={[{ v: "any", l: H("Any city", "कोई भी शहर") }, { v: "1", l: city && cityTier(city) === 1 ? city : H("Tier 1 cities", "टियर 1 शहर") }, { v: "2", l: city && cityTier(city) === 2 ? city : H("Tier 2 cities", "टियर 2 शहर") }]} />
          <button type="button" onClick={() => { setComparing((c) => !c); setPicked([]); }} aria-pressed={comparing}
            className={cn("ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors", comparing ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 bg-accent text-primary hover:border-primary")}>
            <ArrowLeftRight className="size-4" aria-hidden />{comparing ? H("Done", "हो गया") : H("Compare", "तुलना")}
          </button>
        </div>

        {/* recommended bundles */}
        {!sp.get("quote") && <Bundles lang={lang} H={H} />}

        {/* all services */}
        <section aria-labelledby="all-h" id="all-services" className="scroll-mt-20 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="all-h" className="text-xl font-extrabold">{H("All services", "सभी सेवाएँ")} <span className="num font-semibold text-muted-foreground" aria-live="polite">({items ? shown.length : "…"})</span></h2>
            <Pill icon={null} label="" value={sort} onChange={(v) => setSort(v as Sort)} small
              options={[{ v: "rec", l: H("Sort: Recommended", "क्रम: सुझाए गए") }, { v: "low", l: H("Sort: Price low to high", "क्रम: कम से ज़्यादा") }, { v: "high", l: H("Sort: Price high to low", "क्रम: ज़्यादा से कम") }]} />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={H("Filter by tag", "टैग से छाँटें")}>
            {[{ id: "all", en: "All", hi: "सभी", kind: "all" as const }, ...TAGS].map((x, i, arr) => (
              <span key={x.id} className="contents">
                {i > 0 && arr[i - 1].kind !== x.kind && <span className="my-1.5 w-px shrink-0 bg-border" aria-hidden />}
                <button type="button" onClick={() => setTag(x.id)} aria-pressed={tag === x.id}
                  className={cn("min-h-9 shrink-0 rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors", tag === x.id ? "border-primary bg-primary text-primary-foreground" : "border-primary/15 bg-card text-foreground hover:border-primary/50")}>
                  {hi ? x.hi : x.en}
                </button>
              </span>
            ))}
          </div>
          {comparing && <p className="rounded-xl bg-accent px-3 py-2 text-xs font-medium text-primary">{H("Tap up to 3 services to compare them side by side.", "साथ में तुलना के लिए 3 सेवाएँ तक चुनें।")}</p>}
          {!items ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
            : shown.length === 0 ? <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">{H("No services match these filters.", "इन फ़िल्टर से कोई सेवा नहीं मिली।")}</p>
            : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {visible.map((p) => (
                  <ServiceRow key={p.id} p={p} lang={lang} busy={busy === p.id} comparing={comparing} picked={picked.includes(p.id)}
                    onPick={() => togglePick(p.id)} onAdd={quoteId && p.status === "addable" ? () => add(p.id) : undefined} />
                ))}
              </ul>
            )}
          {items && visible.length < shown.length && (
            <button type="button" onClick={() => setExpandedFor(filterKey)} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-primary/20 bg-card text-sm font-bold text-primary shadow-card hover:border-primary">
              {H(`Show all ${shown.length} services`, `सभी ${shown.length} सेवाएँ देखें`)}<ChevronDown className="size-4" aria-hidden />
            </button>
          )}
          <p className="text-xs text-muted-foreground">{H("Indicative prices, GST extra. Final availability is confirmed after your location check.", "सांकेतिक कीमतें, GST अलग। अंतिम उपलब्धता आपकी लोकेशन जाँच के बाद पक्की होती है।")}</p>
        </section>
      </div>

      {/* floating actions */}
      {comparing && picked.length > 0 ? (
        <div className="fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-foreground p-3 pl-4 text-background shadow-lift md:bottom-6">
          <span className="flex-1 text-sm font-semibold">{H(`${picked.length} selected`, `${picked.length} चुनी गईं`)}</span>
          <Button size="sm" disabled={picked.length < 2} onClick={() => setSheet(true)}>{H("Compare", "तुलना करें")}</Button>
        </div>
      ) : (
        <Link href={advisorHref(true)} className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-[0.9375rem] font-bold text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95 md:bottom-8 md:right-8">
          <Sparkles className="size-5" aria-hidden />{H("Ask SYNC AI", "SYNC AI से पूछें")}
        </Link>
      )}

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader><SheetTitle>{H("Compare services", "सेवाओं की तुलना")}</SheetTitle></SheetHeader>
          <div className="grid gap-3 px-4 pb-6" style={{ gridTemplateColumns: `repeat(${Math.max(compareItems.length, 1)}, minmax(0, 1fr))` }}>
            {compareItems.map((p) => (
              <div key={p.id} className="space-y-2 rounded-2xl border bg-card p-3 text-xs">
                <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary"><ProductIcon id={p.id} className="size-5" /></span>
                <div className="text-sm font-bold leading-snug">{plainName(p.id, lang)}</div>
                <Fact k={H("Monthly", "हर महीने")} v={priceText(p)} sub={plainUnit(p.unit, lang)} />
                <Fact k={H("Setup", "सेटअप")} v={p.setup ? inr(p.setup) : H("Free", "मुफ़्त")} />
                <Fact k={H("Contract", "कॉन्ट्रैक्ट")} v={`${p.minContract} ${H("months", "माह")}`} />
                <Fact k={H("Live in", "चालू होने में")} v={`${p.installDays} ${H("days", "दिन")}`} />
                <Fact k={H("Needs GST", "GST ज़रूरी")} v={p.requiresGstin ? H("Yes", "हाँ") : H("No", "नहीं")} />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </CustomerShell>
  );
}

const priceText = (p: Item) => (p.priceMin === p.priceMax ? inr(p.priceMin) : `${inr(p.priceMin)} – ${inr(p.priceMax)}`);

function Fact({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return <div className="border-t pt-2"><div className="text-muted-foreground">{k}</div><div className="num font-bold">{v}</div>{sub && <div className="text-muted-foreground">{sub}</div>}</div>;
}

/** A pill-shaped native select: real keyboard and screen-reader behaviour, styled like the design's dropdown chips. */
function Pill({ icon: I, label, value, onChange, options, small }: { icon: Icon | null; label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; small?: boolean }) {
  const current = options.find((o) => o.v === value);
  const text = label && value === options[0].v ? label : current?.l ?? label;
  return (
    <label className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card font-semibold shadow-card focus-within:border-primary", small ? "h-9 px-3 text-xs" : "h-10 px-3.5 text-sm")}>
      {I && <I className="size-4 text-muted-foreground" />}
      <span className="max-w-[8.5rem] truncate">{text}</span>
      <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label || current?.l} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function ServiceRow({ p, lang, busy, comparing, picked, onPick, onAdd }: { p: Item; lang: Lang; busy: boolean; comparing: boolean; picked: boolean; onPick: () => void; onAdd?: () => void }) {
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const off = p.status === "unavailable" || p.paused;
  const name = plainName(p.id, lang);
  const actionCls = "flex size-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] transition-colors active:scale-95";
  let action;
  if (comparing) action = <button type="button" onClick={onPick} aria-pressed={picked} aria-label={H(`Compare ${name}`, `${name} की तुलना`)} className={cn(actionCls, picked ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary hover:bg-accent")}>{picked ? <Check className="size-4" /> : <Plus className="size-4" />}</button>;
  else if (p.status === "included") action = <span className={cn(actionCls, "border-success bg-success-soft text-success")} title={H("In your plan", "आपके प्लान में")}><Check className="size-4" aria-label={H("In your plan", "आपके प्लान में")} /></span>;
  else if (onAdd) action = <button type="button" onClick={onAdd} disabled={busy} aria-label={H(`Add ${name} to my plan`, `${name} प्लान में जोड़ें`)} className={cn(actionCls, "border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50")}><Plus className="size-4" /></button>;
  else if (!off) action = <Link href={advisorHref(true, H(`I want ${name.split(" (")[0]}`, `मुझे ${name.split(" (")[0]} चाहिए`))} aria-label={H(`Get ${name}`, `${name} लें`)} className={cn(actionCls, "border-primary text-primary hover:bg-primary hover:text-primary-foreground")}><Plus className="size-4" /></Link>;

  return (
    <li className={cn("rounded-2xl border bg-card p-3 shadow-card transition-all hover:border-primary/40", off && "opacity-70", picked && "border-primary ring-2 ring-primary/15")}>
      <div className="flex items-center gap-2.5">
      <span className="flex size-11 shrink-0 items-center justify-center self-start rounded-xl bg-accent text-primary"><ProductIcon id={p.id} className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-snug">{name}</div>
        <div className="line-clamp-1 text-xs text-muted-foreground">{plainBenefit(p.id, lang)}</div>
      </div>
      <div className="max-w-[5.5rem] shrink-0 text-right">
        <div className="num text-[0.8125rem] font-extrabold leading-tight">{priceText(p)}</div>
        <div className="text-[0.6875rem] text-muted-foreground">{plainUnit(p.unit, lang)}</div>
      </div>
      {action}
      </div>
      <div className="pl-[3.375rem]">
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          {[TAGS.find((x) => x.kind === "who" && x.test(p)), ...TAGS.filter((x) => (x.id === "free" || x.id === "fast") && x.test(p))].filter(Boolean).map((x) => (
            <span key={x!.id} className={cn("rounded-full px-2 py-0.5 text-[0.625rem] font-bold", x!.kind === "who" ? "bg-accent text-primary" : "bg-success-soft text-success")}>{hi ? x!.hi : x!.en}</span>
          ))}
          {p.setup > 0 && <span className="inline-flex items-center gap-1"><Settings className="size-3" aria-hidden />{H("Setup", "सेटअप")} {inr(p.setup)}</span>}
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" aria-hidden />{p.minContract} {H("mo", "माह")}{p.installDays > 3 ? ` · ${H("live in", "चालू")} ${p.installDays} ${H("d", "दिन")}` : ""}</span>
        </div>
        {p.status === "unavailable" && p.reason && <div className="mt-1 text-[0.6875rem] text-warning">{ruleReason({ code: p.reason.code, params: p.reason.params, productId: p.id }, lang)}</div>}
        {p.paused && <div className="mt-1 text-[0.6875rem] text-warning">{H("Paused for now", "अभी बंद")}</div>}
      </div>
    </li>
  );
}

const BUNDLE_ICON: Icon[] = [Store, BriefcaseBusiness, LayoutGrid, ShieldCheck];

const SLIDE_MS = 2500;

/** Recommended bundles: red-themed cards that auto-slide every 2.5s (looping), pause while touched, hovered or focused, and swipe by hand. */
function Bundles({ lang, H }: { lang: Lang; H: (en: string, h: string) => string }) {
  const samples = useBundleSamples();
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const held = useRef(false);
  const resumeAt = useRef(0);
  const step = () => { const card = ref.current?.querySelector<HTMLElement>("[data-bundle]"); return card ? card.offsetWidth + 12 : 0; };
  const current = () => { const el = ref.current, s = step(); return el && s ? Math.min(samples.length - 1, Math.round(el.scrollLeft / s)) : 0; };
  const onScroll = () => setIdx(current());
  const go = (k: number) => { const el = ref.current; if (el) el.scrollTo({ left: k * step(), behavior: "smooth" }); };
  const hold = () => { held.current = true; };
  const release = () => { held.current = false; resumeAt.current = Date.now() + 3000; };

  useEffect(() => {
    if (samples.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (held.current || document.hidden || Date.now() < resumeAt.current) return;
      go((current() + 1) % samples.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [samples.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section aria-labelledby="rec-h" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="rec-h" className="text-lg font-extrabold leading-tight sm:text-xl">{H("Recommended bundles for you", "आपके लिए सुझाए गए बंडल")}</h2>
        <Link href={advisorHref(true)} className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-bold text-primary">{H("See all", "सभी देखें")}<ArrowRight className="size-4" aria-hidden /></Link>
      </div>
      <div ref={ref} onScroll={onScroll} onPointerEnter={hold} onPointerLeave={release} onTouchStart={hold} onTouchEnd={release} onFocus={hold} onBlur={release} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {samples.map((c, i) => {
          const first = i === 0;
          const I = BUNDLE_ICON[i % BUNDLE_ICON.length];
          return (
            <article key={c.id} data-bundle className="surface-tint relative flex w-[85%] max-w-sm shrink-0 snap-start flex-col overflow-hidden rounded-3xl border p-4 shadow-card">
              {first ? (
                <>
                  <Image src="/plans-bundle-shop.png" alt="" width={150} height={160} className="pointer-events-none absolute -right-1 top-1/2 h-32 w-auto -translate-y-1/2 mix-blend-multiply [mask-image:radial-gradient(closest-side,black_72%,transparent)]" />
                  <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-primary"><Flame className="size-3.5" aria-hidden />{H("Most popular", "सबसे लोकप्रिय")}</span>
                </>
              ) : (
                <>
                  <span className="pointer-events-none absolute -right-3 top-1/2 flex size-28 -translate-y-1/2 items-center justify-center rounded-3xl bg-white/60 text-primary/30" aria-hidden><I className="size-14" strokeWidth={1.25} /></span>
                  <span className="relative flex size-8 items-center justify-center rounded-lg bg-white/80 text-primary" aria-hidden><I className="size-4.5" /></span>
                </>
              )}
              <h3 className="relative mt-2.5 max-w-[62%] text-xl font-extrabold leading-tight">{bundleName(c.id, lang)}</h3>
              <p className="relative mt-1 line-clamp-2 max-w-[62%] text-[0.8125rem] leading-snug text-muted-foreground">{bundleTagline(c.id, lang)}</p>
              <div className="relative mt-3"><span className="num text-[1.625rem] font-extrabold leading-none">{inr(c.price)}</span> <span className="text-sm text-muted-foreground">{c.perSite ? H("/location", "/लोकेशन") : H("/month", "/माह")}</span></div>
              <Link href={advisorHref(true)} className="relative mt-3 inline-flex min-h-10 w-fit min-w-[60%] items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]">
                {H("View bundle", "बंडल देखें")}<ArrowRight className="size-4" aria-hidden />
              </Link>
            </article>
          );
        })}
      </div>
      {samples.length > 1 && (
        <div className="flex justify-center gap-1">
          {samples.map((c, k) => (
            <button key={c.id} type="button" onClick={() => go(k)} aria-label={H(`Bundle ${k + 1}`, `बंडल ${k + 1}`)} aria-current={k === idx} className="flex size-6 items-center justify-center">
              <span className={cn("block size-2 rounded-full transition-colors", k === idx ? "bg-primary" : "bg-muted-foreground/25")} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
