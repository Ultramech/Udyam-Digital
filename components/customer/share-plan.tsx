"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";

/** One tap → a read-only link to this live plan for a partner, spouse or CA (WhatsApp-ready), plus a PDF. */
export function SharePlan({ quoteId, lang }: { quoteId: string; lang: string }) {
  const hi = lang === "hi" || lang === "mr";
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try { setUrl((await api<{ url: string }>("POST", `/api/quote/${quoteId}/share`)).url); }
    catch { toast.error(hi ? "लिंक नहीं बन पाया, फिर कोशिश करें।" : "Couldn't create the link. Please try again."); }
    setBusy(false);
  }
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast.success(hi ? "लिंक कॉपी हो गया" : "Link copied"); } catch { toast.info(url); }
  }
  const msg = url ? (hi ? `हमारे बिज़नेस के लिए यह प्लान देखें: ${url}` : `Have a look at this plan for our business: ${url}`) : "";
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="text-sm font-semibold">{hi ? "पार्टनर या CA से राय लें" : "Ask your partner or CA"}</div>
      <p className="text-xs text-muted-foreground">{hi ? "एक लिंक भेजें — वे बिना लॉगिन के यही प्लान और कीमत देखेंगे। कोई निजी जानकारी नहीं दिखती।" : "Send a link — they see this exact plan and price without logging in. No personal details are shown."}</p>
      {!url ? (
        <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={create}><Share2 className="size-3.5" />{hi ? "शेयर लिंक बनाएँ" : "Create share link"}</Button>
      ) : (
        <div className="space-y-2">
          <input readOnly value={url} aria-label="Share link" className="w-full rounded-md border bg-muted px-2 py-1.5 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-8 items-center rounded-md bg-[#008069] px-3 text-xs font-medium text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(msg)}`}>WhatsApp</a>
            <Button size="sm" variant="outline" onClick={copy}>{hi ? "कॉपी करें" : "Copy link"}</Button>
            <a className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium" target="_blank" rel="noreferrer" href={`${url.replace("/p/", "/api/share/")}/pdf`}>PDF</a>
          </div>
        </div>
      )}
    </div>
  );
}
