"use client";
import { useState } from "react";
import { ChevronDown, FileDown, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { plainName, type Lang } from "@/lib/catalogue/plain";
import { areaLabel, areaWhat, HORIZON, roadmapText } from "@/lib/i18n/maturity";
import type { Maturity } from "@/lib/maturity/score";

/** Advisory digital-maturity score, before vs with this plan, plus the roadmap. Download = the personalised business report. */
export function MaturityCard({ m, quoteId, lang }: { m: Maturity; quoteId: string; lang: Lang }) {
  const [open, setOpen] = useState(false);
  const hi = lang === "hi" || lang === "mr";
  return (
    <Card className="space-y-3 p-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"><Gauge className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{hi ? "आपका डिजिटल स्कोर" : "Your digital score"}</div>
          <div className="mt-0.5 flex items-baseline gap-2" aria-label={hi ? `आज ${m.before.total}, इस प्लान के साथ ${m.after.total}, 100 में से` : `Today ${m.before.total}, with this plan ${m.after.total}, out of 100`}>
            <span className="text-2xl font-extrabold text-muted-foreground">{m.before.total}</span>
            <span className="text-sm text-muted-foreground">→</span>
            <span className="text-2xl font-extrabold text-primary">{m.after.total}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="text-xs text-muted-foreground">{hi ? "आज → इस प्लान के साथ" : "Today → with this plan"}</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {m.after.areas.map((a, i) => {
          const b = m.before.areas[i].score;
          return (
            <div key={a.area}>
              <div className="flex justify-between text-xs"><span>{areaLabel(a.area, lang)}</span><span className="text-muted-foreground">{b} → <b className="text-foreground">{a.score}</b> / 20</span></div>
              <div className="relative h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="absolute inset-y-0 left-0 bg-primary/35" style={{ width: `${(a.score / 20) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 bg-muted-foreground/60" style={{ width: `${(b / 20) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="flex w-full items-center justify-between text-xs font-medium text-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {hi ? "सबसे बड़ी कमियाँ और आगे का रास्ता" : "Biggest gaps and your roadmap"}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 text-xs">
          {m.gaps.length > 0 && <ul className="space-y-1.5">{m.gaps.map((g) => (
            <li key={g.area} className="rounded-lg bg-muted/60 p-2">
              <div className="font-medium">{areaLabel(g.area, lang)} <span className="font-normal text-muted-foreground">· {areaWhat(g.area, lang)}</span></div>
              <div className="text-muted-foreground">{g.fixedBy.length ? `${hi ? "यह प्लान भरता है" : "This plan closes it with"}: ${g.fixedBy.map((p) => plainName(p, lang).split(" (")[0]).join(", ")}` : hi ? "इस प्लान में अभी कुछ नहीं" : "Nothing in this plan yet"}
                {g.couldAdd.length > 0 && ` · ${hi ? "जोड़ सकते हैं" : "could add"}: ${g.couldAdd.slice(0, 3).map((p) => plainName(p, lang).split(" (")[0]).join(", ")}`}</div>
            </li>))}</ul>}
          <ol className="space-y-1.5">{m.roadmap.filter((r) => r.items.length).map((r) => (
            <li key={r.horizon}><b>{hi ? HORIZON[r.horizon].hi : HORIZON[r.horizon].en}:</b> {r.items.map((it) => roadmapText(it.code, it.products, it.params, lang)).join(" · ")}</li>
          ))}</ol>
          <p className="text-xs text-muted-foreground">{hi ? "यह सलाह के लिए एक अनुमानित स्कोर है, कोई आधिकारिक प्रमाणपत्र नहीं। आपने जो नहीं बताया उसे मौजूद नहीं माना गया है।" : "An advisory score, not an official certification. Anything you didn't mention is assumed not in place today."}</p>
        </div>
      )}
      <a href={`/api/quote/${quoteId}/report`} target="_blank" rel="noopener" className="block">
        <Button variant="outline" size="sm" className="w-full gap-1.5"><FileDown className="size-4" />{hi ? "बिज़नेस रिपोर्ट डाउनलोड करें (PDF, अंग्रेज़ी)" : "Download my business report (PDF)"}</Button>
      </a>
    </Card>
  );
}
