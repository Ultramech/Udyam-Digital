"use client";
import { useState } from "react";
import { CheckCircle2, ClipboardCopy, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { OpsShell } from "@/components/ops/shell";
import { BundleCard } from "@/components/customer/bundle-card";
import { RichText } from "@/components/rich-text";
import { api } from "@/lib/client/api";
import type { AdvisorTurn } from "@/lib/advisor/orchestrator";

const EXAMPLES = [
  "I run a pharmacy in Indore, 3 staff, 1 shop, no GST. I want WhatsApp for customers and billing.",
  "We are a 3-branch restaurant chain in Pune with 12 employees and GST. Need CCTV and billing in every branch.",
  "I only want 4 business SIMs for my team. Salon in Jaipur, 4 staff.",
  "Textile unit in Surat, 40 employees, GST registered, want machine monitoring for 5 machines.",
  "Salon in Surat, 2 staff, no GST, budget under ₹1,500, want billing and CCTV.",
  "I run a clinic in Dehradun with 6 staff and GST.",
  "मेरी लखनऊ में किराना दुकान है, 2 लोग, UPI और बिलिंग चाहिए, जीएसटी नहीं है।",
];

export default function Lab() {
  const [text, setText] = useState(EXAMPLES[0]);
  const [gst, setGst] = useState<"auto" | "yes" | "no">("auto");
  const [res, setRes] = useState<{ turn: AdvisorTurn; violations: unknown[] } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(t = text) {
    setBusy(true);
    try { setRes(await api("POST", "/api/lab", { text: t, lang: /[ऀ-ॿ]/.test(t) ? "hi" : "en", gst })); } catch { toast.error("Couldn't run that scenario."); }
    setBusy(false);
  }
  const t = res?.turn;
  const testSnippet = t?.profile ? `it("${text.slice(0, 60).replace(/"/g, "'")}…", () => {\n  const r = recommend(${JSON.stringify(t.profile)});\n  expect(r.bundleId).toBe("${t.recommendation?.bundleId}");\n  expect(r.lines.map(l => l.productId + "x" + l.qty)).toEqual(${JSON.stringify(t.recommendation?.lines.map((l) => l.productId + "x" + l.qty))});\n});` : "";
  return (
    <OpsShell>
      <div className="max-w-5xl space-y-4">
        <div><h1 className="text-2xl font-bold">Scenario Lab</h1><p className="text-sm text-muted-foreground">Paste any business description. See what the advisor extracted, every rule it applied, and the priced plan. Nothing is saved.</p></div>
        <Card className="space-y-3 p-4">
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Business description" />
          <div className="flex flex-wrap items-center gap-2">{EXAMPLES.map((e, i) => <button key={i} type="button" onClick={() => { setText(e); run(e); }} className="rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary">Example {i + 1}</button>)}</div>
          <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">GST override<select className="h-8 rounded-lg border border-input bg-card px-2" value={gst} onChange={(e) => setGst(e.target.value as typeof gst)}><option value="auto">from text</option><option value="yes">has GST</option><option value="no">no GST</option></select></label>
            <Button onClick={() => run()} disabled={busy || text.trim().length < 3} className="gap-1.5"><Play className="size-3.5" />Run scenario</Button></div>
        </Card>
        {t && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Card className="space-y-2 p-4 text-sm"><div className="font-semibold">Extracted facts</div>
                <pre className="overflow-x-auto rounded-lg bg-muted p-2.5 text-xs">{JSON.stringify(t.facts, null, 1)}</pre>
                {t.missing.length > 0 && <div className="text-xs text-warning">Still missing: {t.missing.join(", ")} — the advisor would ask next.</div>}
                <div className="rounded-lg bg-secondary p-2.5 text-sm"><div className="mb-0.5 text-[11px] uppercase text-muted-foreground">Advisor reply</div><RichText text={t.reply} /></div></Card>
              <Card className="flex items-center gap-2 p-3 text-sm">{res!.violations.length === 0 ? <><CheckCircle2 className="size-4 text-success" />0 rule violations in this bundle</> : <><XCircle className="size-4 text-destructive" />{res!.violations.length} violations</>}</Card>
              {testSnippet && <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard?.writeText(testSnippet); toast.success("Regression test copied — paste it into tests/rules"); }}><ClipboardCopy className="size-3.5" />Copy as regression test</Button>}
            </div>
            <div>{t.recommendation && t.profile ? <BundleCard rec={t.recommendation} profile={t.profile} /> : <Card className="p-4 text-sm text-muted-foreground">Not enough information for a plan yet.</Card>}</div>
          </div>
        )}
      </div>
    </OpsShell>
  );
}
