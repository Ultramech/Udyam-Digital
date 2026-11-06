"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { plainBenefit, plainName, plainUnit, type Lang } from "@/lib/catalogue/plain";
import { api, ApiError, useJourney } from "@/lib/client/api";
import { inr } from "@/lib/client/format";
import { ruleReason } from "@/lib/i18n/reasons";
import type { Ref } from "@/lib/rules/types";
import { cn } from "@/lib/utils";

interface Item {
  id: string; category: string; unit: string; priceMin: number; priceMax: number; setup: number; minContract: number; tiers: number[];
  minEmployees: number; minSites: number; requiresGstin: boolean; requiresOneOf: string[]; installDays: number; paused: boolean;
  status?: "included" | "addable" | "unavailable" | "swap"; reason?: Ref;
}

const CAT: Record<string, { en: string; hi: string }> = {
  Connectivity: { en: "Internet & mobile", hi: "इंटरनेट और मोबाइल" }, Communication: { en: "Talk to customers", hi: "ग्राहकों से बात" },
  "Cloud & Productivity": { en: "Cloud & office", hi: "क्लाउड और ऑफिस" }, Security: { en: "Security", hi: "सुरक्षा" }, "IoT & Physical": { en: "Cameras & devices", hi: "कैमरा और डिवाइस" },
};
const PRICE_BANDS = [{ id: "all", max: Infinity }, { id: "500", max: 500 }, { id: "1500", max: 1500 }, { id: "5000", max: 5000 }] as const;

export default function CataloguePage() {
  return <Suspense fallback={<CustomerShell wide><Skeleton className="h-64" /></CustomerShell>}><Catalogue /></Suspense>;
}

function Catalogue() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const sp = useSearchParams();
  const journey = useJourney();
  const quoteId = sp.get("quote") ?? journey?.quoteId ?? null;
  const [items, setItems] = useState<Item[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [band, setBand] = useState<(typeof PRICE_BANDS)[number]["id"]>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ products: Item[] }>("GET", `/api/catalogue${quoteId ? `?quote=${quoteId}` : ""}`).then((r) => setItems(r.products)).catch(() => setItems([]));
  }, [quoteId]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const max = PRICE_BANDS.find((b) => b.id === band)!.max;
    return (items ?? []).filter((p) =>
      (cat === "all" || p.category === cat) && p.priceMin <= max &&
      (!onlyMine || p.status === "addable" || p.status === "included") &&
      (!needle || [plainName(p.id, "en"), plainName(p.id, "hi"), plainBenefit(p.id, "en"), plainBenefit(p.id, lang), p.category].some((s) => s.toLowerCase().includes(needle))));
  }, [items, q, cat, band, onlyMine, lang]);

  async function add(id: string) {
    if (!quoteId) return;
    setBusy(id);
    try {
      const r = await api<{ blocked: (Ref & { productId?: string }) | null; notices?: Ref[] }>("PATCH", `/api/quote/${quoteId}`, { op: "edit", edit: { type: "add", productId: id } });
      if (r.blocked) toast.warning(ruleReason({ code: r.blocked.code, params: r.blocked.params, productId: r.blocked.productId }, lang));
      else { toast.success(hi ? "प्लान में जोड़ा गया" : "Added to your plan"); for (const n of r.notices ?? []) toast.info(ruleReason(n, lang)); load(); }
    } catch (e) { toast.error(e instanceof ApiError && e.code === "QUOTE_INVALID" ? (hi ? "यह कॉम्बिनेशन संभव नहीं है।" : "That combination isn't allowed.") : (hi ? "कुछ गलत हुआ" : "Something went wrong")); }
    setBusy(null);
  }

  return (
    <CustomerShell wide>
      <div className="space-y-4 pb-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{hi ? "सभी सेवाएँ" : "All business services"}</h1>
            <p className="text-sm text-muted-foreground">{hi ? "25 सेवाएँ, साफ़ कीमत और शर्तों के साथ।" : "25 services with clear prices, setup fees and conditions."}</p>
          </div>
          {quoteId && <Link href={`/quote/${quoteId}`}><Button size="sm" variant="outline" className="gap-1"><ArrowLeft className="size-3.5" />{hi ? "मेरा प्लान" : "My plan"}</Button></Link>}
        </div>

        <div className="space-y-2">
          <div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder={hi ? "खोजें: CCTV, ईमेल, Wi-Fi…" : "Search: CCTV, email, Wi-Fi…"} value={q} onChange={(e) => setQ(e.target.value)} aria-label={hi ? "खोजें" : "Search"} /></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={hi ? "श्रेणी" : "Category"}>
            {["all", ...Object.keys(CAT)].map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c}
                className={cn("min-h-10 rounded-full border px-4 text-sm font-medium", cat === c ? "border-foreground bg-foreground text-background" : "border-input bg-card text-foreground hover:bg-muted")}>
                {c === "all" ? (hi ? "सभी" : "All") : hi ? CAT[c].hi : CAT[c].en}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">{hi ? "कीमत" : "Price"}
              <select value={band} onChange={(e) => setBand(e.target.value as typeof band)} className="h-7 rounded-md border bg-card px-1.5">
                <option value="all">{hi ? "कोई भी" : "Any"}</option>
                {PRICE_BANDS.slice(1).map((b) => <option key={b.id} value={b.id}>{hi ? `₹${b.max} तक` : `Up to ₹${b.max}`}</option>)}
              </select>
            </label>
            {quoteId && <label className="flex items-center gap-1.5"><Switch checked={onlyMine} onCheckedChange={(c) => setOnlyMine(!!c)} />{hi ? "सिर्फ़ जो मुझे मिल सकता है" : "Only what I can get"}</label>}
          </div>
          {!quoteId && <p className="text-xs text-muted-foreground">{hi ? "अपने बिज़नेस के लिए क्या मिलेगा यह देखने के लिए " : "To see what your business qualifies for, "}<Link href="/advisor" className="text-primary underline">{hi ? "सलाहकार से बात करें" : "talk to the advisor"}</Link>.</p>}
        </div>

        {!items ? <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div> : (
          <>
            <div className="text-xs text-muted-foreground" aria-live="polite">{shown.length} {hi ? "सेवाएँ" : shown.length === 1 ? "service" : "services"}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {shown.map((p) => <ProductCard key={p.id} p={p} lang={lang} busy={busy === p.id} onAdd={quoteId ? () => add(p.id) : undefined} />)}
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">{hi ? "सांकेतिक कीमतें, GST अलग। अंतिम उपलब्धता आपकी लोकेशन जाँच के बाद पक्की होती है।" : "Indicative prices, GST extra. Final availability is confirmed after your location check."}</p>
      </div>
    </CustomerShell>
  );
}

function ProductCard({ p, lang, busy, onAdd }: { p: Item; lang: Lang; busy: boolean; onAdd?: () => void }) {
  const hi = lang === "hi" || lang === "mr";
  const conds: string[] = [];
  if (p.tiers.length === 1) conds.push(hi ? "सिर्फ़ बड़े (टियर-1) शहर" : "Big (Tier-1) cities only");
  if (p.minEmployees > 1) conds.push(hi ? `${p.minEmployees}+ लोग` : `${p.minEmployees}+ staff`);
  if (p.minSites > 1) conds.push(hi ? `${p.minSites}+ लोकेशन` : `${p.minSites}+ locations`);
  if (p.requiresGstin) conds.push(hi ? "चालू GST नंबर" : "Active GST number");
  if (p.requiresOneOf.length) conds.push(hi ? `इनमें से एक इंटरनेट चाहिए: ${p.requiresOneOf.map((x) => plainName(x, lang).split(" (")[0]).filter((v, i, a) => a.indexOf(v) === i).join(" / ")}` : `Needs ${p.requiresOneOf.map((x) => plainName(x, lang).split(" (")[0]).filter((v, i, a) => a.indexOf(v) === i).join(" / ")}`);
  const price = p.priceMin === p.priceMax ? inr(p.priceMin) : `${inr(p.priceMin)}–${inr(p.priceMax)}`;
  return (
    <Card className={cn("flex flex-col gap-2 p-3.5", (p.status === "unavailable" || p.paused) && "bg-muted/40")}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"><ProductIcon id={p.id} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-snug">{plainName(p.id, lang)}</div>
          <div className="text-xs text-muted-foreground">{plainBenefit(p.id, lang)}</div>
        </div>
        {p.status === "included" && <Badge variant="success" className="shrink-0 gap-0.5"><Check className="size-3" />{hi ? "प्लान में" : "In plan"}</Badge>}
        {p.paused && <Badge variant="secondary" className="shrink-0">{hi ? "अभी बंद" : "Paused"}</Badge>}
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2 text-xs">
        <div><div className="text-muted-foreground">{hi ? "हर महीने" : "Monthly"}</div><div className="font-semibold">{price}</div><div className="text-muted-foreground">{plainUnit(p.unit, lang)}</div></div>
        <div><div className="text-muted-foreground">{hi ? "सेटअप" : "Setup"}</div><div className="font-semibold">{p.setup ? inr(p.setup) : hi ? "मुफ़्त" : "Free"}</div></div>
        <div><div className="text-muted-foreground">{hi ? "कॉन्ट्रैक्ट / चालू" : "Contract / live in"}</div><div className="font-semibold">{p.minContract} {hi ? "माह" : "mo"} · {p.installDays} {hi ? "दिन" : "d"}</div></div>
      </div>
      {conds.length > 0 && <div className="text-xs text-muted-foreground">{hi ? "शर्तें: " : "Conditions: "}{conds.join(" · ")}</div>}
      {p.status === "unavailable" && p.reason && <div className="text-xs text-warning">{ruleReason({ code: p.reason.code, params: p.reason.params, productId: p.id }, lang)}</div>}
      {p.status === "swap" && <div className="text-xs text-muted-foreground">{hi ? "इंटरनेट/मोबाइल प्लान बदलने के लिए सलाहकार से कहें — लोकेशन जाँच ज़रूरी है।" : "To switch your internet or mobile plan, ask the advisor — it needs a location check."}</div>}
      {onAdd && p.status === "addable" && <Button size="sm" variant="outline" className="mt-auto gap-1 self-start" disabled={busy} onClick={onAdd}><Plus className="size-3.5" />{hi ? "प्लान में जोड़ें" : "Add to my plan"}</Button>}
    </Card>
  );
}
