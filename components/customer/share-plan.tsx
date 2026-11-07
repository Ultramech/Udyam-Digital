"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";

/** One tap → a read-only link to this live plan for a partner, spouse or CA (WhatsApp-ready), plus a PDF. */
export function SharePlan({ quoteId, lang }: { quoteId: string; lang: string }) {
  const hi = lang === "hi" || lang === "mr";
  const [shared, setShared] = useState<{ url: string; summary?: { plan: string; monthly: number; gstMonthly: number; setup: number; gstSetup: number; firstPayment: number } } | null>(null);
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try { setShared(await api<{ url: string; summary?: { plan: string; monthly: number; gstMonthly: number; setup: number; gstSetup: number; firstPayment: number } }>("POST", `/api/quote/${quoteId}/share`)); }
    catch { toast.error(hi ? "लिंक नहीं बन पाया, फिर कोशिश करें।" : "Couldn't create the link. Please try again."); }
    setBusy(false);
  }
  async function copy() {
    if (!shared) return;
    try { await navigator.clipboard.writeText(shared.url); toast.success(hi ? "लिंक कॉपी हो गया" : "Link copied"); } catch { toast.info(shared.url); }
  }
  const url = shared?.url;
  const breakdown = shared?.summary ? `${shared.summary.plan} | Monthly ₹${shared.summary.monthly.toLocaleString("en-IN")} + GST ₹${shared.summary.gstMonthly.toLocaleString("en-IN")} | One-time setup ₹${shared.summary.setup.toLocaleString("en-IN")} + GST ₹${shared.summary.gstSetup.toLocaleString("en-IN")} | Pay today ₹${shared.summary.firstPayment.toLocaleString("en-IN")}` : "";
  const resume = url?.replace(/\/p\/([^/?#]+).*/, "/api/share/$1/resume");
  const pdf = url?.replace(/\/p\/([^/?#]+).*/, "/api/share/$1/pdf");
  const msg = url ? (hi ? `बिज़नेस प्लान सारांश: ${breakdown}\nप्रोफ़ॉर्मा कोट: ${pdf}\nफिर से खोलें: ${resume}` : `Business plan summary: ${breakdown}\nProforma quote: ${pdf}\nResume your quote: ${resume}`) : "";
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="text-sm font-semibold">{hi ? "पार्टनर या CA से राय लें" : "Ask your partner or CA"}</div>
      <div className="text-xs font-semibold text-primary">{hi ? "WhatsApp पर सेव करें और बाद में फिर शुरू करें" : "Save & resume on WhatsApp"}</div>
      <p className="text-xs text-muted-foreground">{hi ? "सारांश, मौजूदा कीमत और फिर से खोलने वाला लिंक WhatsApp में तैयार होगा। भेजने से पहले आप संदेश देख सकते हैं।" : "WhatsApp opens with the current monthly breakdown and a one-tap resume link. Review and send it to yourself."}</p>
      {!url ? (
        <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={create}><Share2 className="size-3.5" />{hi ? "शेयर लिंक बनाएँ" : "Create share link"}</Button>
      ) : (
        <div className="space-y-2">
          <input readOnly value={url} aria-label="Share link" className="w-full rounded-md border bg-muted px-2 py-1.5 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-8 items-center rounded-md bg-[#008069] px-3 text-xs font-medium text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(msg)}`}>{hi ? "WhatsApp पर सेव करें" : "Send summary to WhatsApp"}</a>
            <Button size="sm" variant="outline" onClick={copy}>{hi ? "कॉपी करें" : "Copy link"}</Button>
            <a className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium" target="_blank" rel="noreferrer" href={`${url.replace("/p/", "/api/share/")}/pdf`}>PDF</a>
          </div>
        </div>
      )}
    </div>
  );
}
