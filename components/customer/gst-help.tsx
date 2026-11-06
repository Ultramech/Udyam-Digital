"use client";
import { ExternalLink, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getProduct } from "@/lib/catalogue";
import { plainName } from "@/lib/catalogue/plain";
import { inr } from "@/lib/client/format";
import type { Counterfactual } from "@/lib/rules/types";

/**
 * Shown when the plan excludes products only because the business has no verified, active GSTIN (activation is 9.6% with a GSTIN vs 2.0%
 * without). Everything named here comes from the rules engine's own counterfactual, so it can't promise what the catalogue wouldn't allow.
 * GST registration itself is free and self-service on the official portal — no agent is needed.
 */
export function GstinHelp({ counterfactuals, lang }: { counterfactuals: Counterfactual[]; lang: string }) {
  const cf = counterfactuals.find((c) => c.condition === "GST_VERIFIED");
  if (!cf) return null;
  const hi = lang === "hi" || lang === "mr";
  const items = cf.unlocks.map((id) => ({ id, name: plainName(id, lang as "en"), price: getProduct(id).priceMin }));
  const steps = hi
    ? ["gst.gov.in खोलें → Services → Registration → New Registration", "PAN, आधार, बिज़नेस पते का प्रमाण और बैंक खाते का प्रमाण तैयार रखें", "ARN (आवेदन नंबर) मिलेगा; मंज़ूरी के बाद GSTIN मिल जाएगा", "KYC में GSTIN डालें — प्लान अपने आप अपडेट हो जाएगा"]
    : ["Open gst.gov.in → Services → Registration → New Registration", "Keep ready: PAN, Aadhaar, proof of business address, bank-account proof", "You get an ARN (application number); the GSTIN is issued once it is approved", "Enter the GSTIN in KYC here — your plan updates by itself"];
  return (
    <Card className="space-y-2.5 border-primary/30 bg-accent/60 p-3.5" aria-labelledby="gst-h">
      <div className="flex items-center gap-2"><FileText className="size-4 text-primary" /><h2 id="gst-h" className="text-sm font-semibold">{hi ? "GSTIN के बिना कुछ सेवाएँ नहीं मिलतीं" : "A GSTIN would unlock more for you"}</h2></div>
      <p className="text-xs text-muted-foreground">{hi ? "इन सेवाओं के लिए वैध और चालू GSTIN ज़रूरी है:" : "These need a valid, active GSTIN:"}</p>
      <ul className="space-y-1 text-sm">{items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.name}</span><span className="text-muted-foreground">{hi ? "से " : "from "}{inr(i.price)}{hi ? "/माह" : "/mo"}</span></li>)}</ul>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <p className="text-xs text-muted-foreground">{hi ? "GST पंजीकरण सरकारी पोर्टल पर मुफ़्त है और छोटे कारोबार भी स्वेच्छा से करवा सकते हैं। आप अभी आगे बढ़ सकते हैं — GSTIN बाद में जोड़ने पर प्लान बदल जाएगा।" : "Registration is free on the government portal, and small businesses may register voluntarily. You can continue now and add the GSTIN later — the plan will update."}</p>
      <a href="https://www.gst.gov.in/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline">{hi ? "आधिकारिक GST पोर्टल" : "Official GST portal"}<ExternalLink className="size-3" /></a>
    </Card>
  );
}
