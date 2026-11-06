"use client";
import { useState } from "react";
import { Receipt } from "lucide-react";
import { inr } from "@/lib/client/format";

interface Cmp { read: boolean; currentMonthly: number | null; planMonthlyInclGst: number; difference: number | null; verdict: "cheaper" | "same" | "costlier" | "unknown"; adds: string[]; provider: string | null }

/** Upload the current phone/internet bill → honest comparison (incl. GST on both sides). The photo is not stored. */
export function BillCompare({ quoteId, lang }: { quoteId: string; lang: string }) {
  const hi = lang === "hi" || lang === "mr";
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Cmp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function upload(f: File) {
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.set("file", f);
    try {
      const res = await fetch(`/api/quote/${quoteId}/bill`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error === "BILL_READER_UNAVAILABLE" ? (hi ? "बिल पढ़ने की सेवा अभी उपलब्ध नहीं है।" : "The bill reader isn't available right now.") : d.error === "UNSUPPORTED_TYPE" ? (hi ? "फ़ोटो (JPG/PNG) या PDF भेजें।" : "Please use a photo (JPG/PNG) or a PDF.") : (hi ? "बिल नहीं पढ़ा जा सका।" : "We couldn't read that bill."));
      setR(d);
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
    setBusy(false);
  }
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><Receipt className="size-4" />{hi ? "अपने मौजूदा बिल से तुलना करें" : "Compare with your current bill"}</div>
      <p className="text-xs text-muted-foreground">{hi ? "फ़ोन/इंटरनेट बिल की फ़ोटो डालें। हम सिर्फ़ मासिक रकम पढ़ते हैं; फ़ोटो सेव नहीं होती।" : "Add a photo of your phone or internet bill. We only read the monthly amount; the photo isn't saved."}</p>
      <label className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-xs font-medium hover:bg-accent">
        {busy ? (hi ? "पढ़ रहे हैं…" : "Reading…") : (hi ? "बिल चुनें" : "Choose bill")}
        <input type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} />
      </label>
      {err && <p role="alert" className="text-xs text-destructive">{err}</p>}
      {r && (r.verdict === "unknown" ? <p className="text-xs">{hi ? "इस बिल में मासिक रकम साफ़ नहीं दिखी।" : "We couldn't find a clear monthly amount on this bill."}</p> : (
        <div className="space-y-1 text-sm" aria-live="polite">
          <div>{hi ? "आपका मौजूदा बिल" : "Your current bill"}{r.provider ? ` (${r.provider})` : ""}: <b>{inr(r.currentMonthly!)}</b>{hi ? "/माह" : "/month"} · {hi ? "यह प्लान GST सहित" : "This plan incl. GST"}: <b>{inr(r.planMonthlyInclGst)}</b></div>
          <div className={r.verdict === "cheaper" ? "text-success" : ""}>
            {r.verdict === "cheaper" ? (hi ? `आप हर महीने ${inr(-r.difference!)} बचाएँगे।` : `You'd pay ${inr(-r.difference!)} less every month.`)
              : r.verdict === "same" ? (hi ? "लगभग उतना ही खर्च।" : "About the same as you pay today.")
              : (hi ? `यह हर महीने ${inr(r.difference!)} ज़्यादा है` : `This costs ${inr(r.difference!)} more a month`) + (r.adds.length ? (hi ? ` — पर इसमें जुड़ता है: ${r.adds.join(", ")}।` : ` — and adds: ${r.adds.join(", ")}.`) : ".")}
          </div>
        </div>
      ))}
    </div>
  );
}
