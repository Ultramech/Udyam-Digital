"use client";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { plainName, type Lang } from "@/lib/catalogue/plain";
import { inr } from "@/lib/client/format";
import { needLabel } from "@/lib/i18n/needs";
import type { PackageId, PackageOption } from "@/lib/rules/packages";
import { cn } from "@/lib/utils";

const NAME: Record<PackageId, { en: string; hi: string }> = {
  basic: { en: "Basic", hi: "बेसिक" }, recommended: { en: "Recommended", hi: "सुझाया गया" }, premium: { en: "Premium", hi: "प्रीमियम" },
};
const FIT: Record<PackageId, { en: string; hi: string }> = {
  basic: { en: "Just the essentials", hi: "सिर्फ़ ज़रूरी चीज़ें" },
  recommended: { en: "Best match for what you told us", hi: "आपकी बताई ज़रूरतों से सबसे अच्छा मेल" },
  premium: { en: "Extra protection and backup", hi: "ज़्यादा सुरक्षा और बैकअप" },
};
const short = (id: string, lang: Lang) => plainName(id, lang).split(" (")[0];

/** Side-by-side Basic / Recommended / Premium. Every number comes from the server's rules engine; this only lays it out. */
export function PackageCompare({ options, lang, busy, onChoose }: { options: PackageOption[]; lang: Lang; busy: boolean; onChoose: (id: PackageId) => void }) {
  if (options.length < 2) return null;
  const hi = lang === "hi" || lang === "mr";
  const L = (r: { en: string; hi: string }) => (hi ? r.hi : r.en);
  const needs = [...new Set(options.flatMap((o) => [...o.covered, ...o.missed]))];
  const rec = options.find((o) => o.id === "recommended")!;

  return (
    <Card className="space-y-3 p-3">
      <div>
        <div className="text-sm font-semibold">{hi ? "पैकेज की तुलना करें" : "Compare packages"}</div>
        <p className="text-xs text-muted-foreground">{hi ? "तीनों पैकेज आपकी लोकेशन, स्टाफ और GST के नियमों पर खरे हैं।" : "All three pass the same eligibility rules for your city, staff and GST."}</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,1fr))] gap-x-1.5 text-xs" role="table" aria-label={hi ? "पैकेज तुलना" : "Package comparison"}>
        <div role="columnheader" />
        {options.map((o) => (
          <div key={o.id} role="columnheader" className={cn("min-w-0 rounded-t-lg px-0.5 pt-2 text-center", o.id === "recommended" && "bg-accent")}>
            <div className="break-words text-xs font-semibold leading-tight sm:text-xs">{L(NAME[o.id])}</div>
            {o.current && <Badge variant="secondary" className="mt-0.5 h-4 px-1 text-[9px]">{hi ? "अभी चुना" : "Selected"}</Badge>}
          </div>
        ))}

        <Cell label={hi ? "हर महीने" : "Monthly"} options={options} render={(o) => <b className="text-sm">{inr(o.monthly)}</b>} />
        <Cell label={hi ? "फ़र्क" : "Difference"} options={options} render={(o) => (o.delta === 0 ? "—" : <span className={o.delta < 0 ? "text-success" : ""}>{o.delta > 0 ? "+" : ""}{inr(o.delta)}</span>)} />
        <Cell label={hi ? "सेटअप (एक बार)" : "Setup (once)"} options={options} render={(o) => (o.setup ? inr(o.setup) : hi ? "मुफ़्त" : "Free")} />
        <Cell label={hi ? "कॉन्ट्रैक्ट" : "Contract"} options={options} render={(o) => `${o.contractMonths} ${hi ? "माह" : "mo"}`} />
        <Cell label={hi ? "सेवाएँ" : "Services"} options={options} render={(o) => o.services} />
        {needs.map((n) => (
          <Cell key={n} label={needLabel(n, lang)} options={options} render={(o) => (o.covered.includes(n)
            ? <Check className="mx-auto size-4 text-success" aria-label={hi ? "शामिल" : "covered"} />
            : <Minus className="mx-auto size-4 text-muted-foreground" aria-label={hi ? "शामिल नहीं" : "not covered"} />)} />
        ))}
        <div />
        {options.map((o) => (
          <div key={o.id} className={cn("rounded-b-lg px-1 pb-2 pt-1.5", o.id === "recommended" && "bg-accent")}>
            <Button size="sm" className="h-7 w-full px-1 text-xs" variant={o.current ? "secondary" : o.id === "recommended" ? "default" : "outline"} disabled={busy || o.current} onClick={() => onChoose(o.id)}>
              {o.current ? (hi ? "चुना" : "Chosen") : hi ? "चुनें" : "Choose"}
            </Button>
          </div>
        ))}
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {options.map((o) => (
          <li key={o.id}><b className="text-foreground">{L(NAME[o.id])}:</b> {L(FIT[o.id])}
            {o.drops.length > 0 && <> · {hi ? "इसमें नहीं" : "leaves out"} {o.drops.map((d) => short(d, lang)).join(", ")}</>}
            {o.adds.length > 0 && <> · {hi ? "इसमें अतिरिक्त" : "adds"} {o.adds.map((d) => short(d, lang)).join(", ")}</>}
            {o.missed.length > 0 && o.id !== "premium" && <> · <span className="text-warning">{hi ? "पूरी नहीं होती" : "doesn't cover"}: {o.missed.map((m) => needLabel(m, lang)).join(", ")}</span></>}
          </li>
        ))}
        {rec.missed.length > 0 && <li>{hi ? "कुछ ज़रूरतें किसी पैकेज में नहीं — कारण नीचे \"आपके लिए उपलब्ध नहीं\" में है।" : "Some needs aren't covered by any package — the reason is under \"Not available for you\"."}</li>}
      </ul>
    </Card>
  );
}

function Cell({ label, options, render }: { label: string; options: PackageOption[]; render: (o: PackageOption) => React.ReactNode }) {
  return (
    <>
      <div role="rowheader" className="border-t py-1.5 pr-1 leading-tight text-muted-foreground">{label}</div>
      {options.map((o) => <div key={o.id} role="cell" className={cn("border-t py-1.5 text-center", o.id === "recommended" && "bg-accent")}>{render(o)}</div>)}
    </>
  );
}
