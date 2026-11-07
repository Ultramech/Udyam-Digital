"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { api, ApiError } from "@/lib/client/api";
import { DOC_INFO } from "@/components/customer/kyc-parts";
import type { Slot } from "@/lib/kyc/types";
import { cn } from "@/lib/utils";

interface Link { ref: string; label: string; slots: Slot[]; uploaded: { slot: Slot }[]; expiresAt: number; state: "waiting" | "partly" | "done" | "expired" | "cancelled" }

/**
 * "Don't have the documents with you?" A shop is run by several people: the CA holds the GST papers, a partner may be the signatory.
 * The owner sends one of them a link; they upload from their own phone, no account, only the documents named here, for 48 hours.
 */
export function DelegateCard({ quoteId, missing, onChanged }: { quoteId: string; missing: Slot[]; onChanged: () => void }) {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<Link[]>([]);
  const [who, setWho] = useState<string>("");
  const [pickedRaw, setPicked] = useState<Slot[] | null>(null); // null = "all that are still missing"
  const picked = (pickedRaw ?? missing).filter((s) => missing.includes(s));
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ url: string; label: string; slots: Slot[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const lastCount = useRef(0);

  const WHO = hi ? ["मेरा CA / अकाउंटेंट", "पार्टनर या डायरेक्टर", "दुकान पर कोई", "कोई और"] : ["My CA or accountant", "Partner or director", "Someone at the shop", "Someone else"];

  const refresh = useCallback(() => api<{ delegates: Link[] }>("GET", `/api/delegate?quoteId=${quoteId}`).then((r) => {
    setLinks(r.delegates);
    const n = r.delegates.reduce((a, d) => a + d.uploaded.length, 0);
    if (n !== lastCount.current) { lastCount.current = n; onChanged(); } // something came back: refresh the documents on screen
  }).catch(() => {}), [quoteId, onChanged]);
  useEffect(() => { refresh(); }, [refresh]);
  const waiting = links.some((l) => l.state === "waiting" || l.state === "partly");
  useEffect(() => { if (!waiting) return; const h = setInterval(refresh, 6000); return () => clearInterval(h); }, [waiting, refresh]);

  async function create() {
    if (!who || !picked.length) return;
    setBusy(true);
    try {
      const r = await api<{ path: string; ref: string }>("POST", "/api/delegate", { quoteId, label: who, slots: picked });
      setFresh({ url: `${window.location.origin}${r.path}`, label: who, slots: picked });
      setOpen(false); setWho(""); setPicked(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "TOO_MANY_LINKS" ? (hi ? "पहले से कई लिंक चालू हैं। एक रद्द करें।" : "You already have several links open. Cancel one first.") : (hi ? "लिंक नहीं बन पाया। दोबारा कोशिश करें।" : "Couldn't make the link. Please try again."));
    } finally { setBusy(false); }
  }

  const message = (url: string, slots: Slot[]) => hi
    ? `नमस्ते, मैं अपनी दुकान के लिए Airtel Business की सेवाएँ ले रहा/रही हूँ। कृपया यहाँ ये दस्तावेज़ भेज दें: ${slots.map((s) => DOC_INFO[s].title[1]).join(", ")}। लॉगिन नहीं चाहिए, एक मिनट लगेगा (48 घंटे तक चलेगा): ${url}`
    : `Hi, I'm getting internet and business services for my shop from Airtel Business. Could you please upload these here: ${slots.map((s) => DOC_INFO[s].title[0]).join(", ")}? No login needed, it takes a minute (works for 48 hours): ${url}`;

  async function cancel(ref: string) {
    try { await api("DELETE", `/api/delegate/${ref}?quoteId=${quoteId}`); toast.success(hi ? "लिंक रद्द हो गया।" : "Link cancelled."); refresh(); } catch { toast.error(hi ? "रद्द नहीं हो पाया।" : "Couldn't cancel it."); }
  }

  const chip = (l: Link) => l.state === "done" ? [hi ? "सब मिल गया" : "All received", "bg-success/10 text-success"]
    : l.state === "partly" ? [hi ? `${l.uploaded.length}/${l.slots.length} मिले` : `${l.uploaded.length} of ${l.slots.length} received`, "bg-info/10 text-info"]
      : l.state === "waiting" ? [hi ? "इंतज़ार में" : "Waiting", "bg-muted text-muted-foreground"]
        : l.state === "expired" ? [hi ? "समय खत्म" : "Expired", "bg-muted text-muted-foreground"] : [hi ? "रद्द" : "Cancelled", "bg-muted text-muted-foreground"];

  if (!missing.length && !links.length) return null;
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Users className="size-5" aria-hidden /></span>
        <div className="min-w-0">
          <div className="font-bold">{hi ? "दस्तावेज़ आपके पास नहीं हैं?" : "Don't have the documents with you?"}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{hi ? "अपने CA, पार्टनर या दुकान पर किसी को लिंक भेजें। वे अपने फ़ोन से भेज देंगे। अकाउंट नहीं चाहिए।" : "Send a link to your CA, partner or someone at the shop. They add the documents from their own phone. No account needed."}</p>
        </div>
      </div>

      {fresh && (
        <div className="space-y-2.5 rounded-xl border border-success/40 bg-success/5 p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-success"><Check className="size-4" aria-hidden />{hi ? "लिंक तैयार है" : "Link ready"}</div>
          <p className="break-all rounded-lg bg-card p-2 font-mono text-xs">{fresh.url}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(message(fresh.url, fresh.slots))}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"><Send className="size-4" aria-hidden />{hi ? "WhatsApp पर भेजें" : "Send on WhatsApp"}</a>
            <Button variant="outline" className="h-11 gap-2" onClick={async () => { try { await navigator.clipboard.writeText(fresh.url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.info(fresh.url); } }}>
              <Copy className="size-4" aria-hidden />{copied ? (hi ? "कॉपी हुआ" : "Copied") : (hi ? "लिंक कॉपी करें" : "Copy link")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{hi ? "48 घंटे चलेगा। सिर्फ़ चुने हुए दस्तावेज़ों के लिए। आप कभी भी रद्द कर सकते हैं।" : "Works for 48 hours, only for the documents you chose. You can cancel it any time."}</p>
        </div>
      )}

      {open ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 text-sm font-semibold">{hi ? "कौन मदद करेगा?" : "Who will help?"}</div>
            <div className="flex flex-wrap gap-2">
              {WHO.map((w) => <button key={w} type="button" aria-pressed={who === w} onClick={() => setWho(w)} className={cn("min-h-11 rounded-full border px-4 text-sm font-medium", who === w ? "border-primary bg-accent text-primary" : "bg-card")}>{w}</button>)}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold">{hi ? "कौन से दस्तावेज़?" : "Which documents?"}</div>
            <div className="space-y-1.5">
              {missing.map((s) => (
                <label key={s} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={picked.includes(s)} onChange={(e) => setPicked(e.target.checked ? [...picked, s] : picked.filter((x) => x !== s))} />
                  <span className="font-medium">{DOC_INFO[s].title[hi ? 1 : 0]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy || !who || !picked.length} onClick={create}>{hi ? "लिंक बनाएँ" : "Create link"}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{hi ? "रद्द करें" : "Cancel"}</Button>
          </div>
        </div>
      ) : missing.length > 0 && (
        <Button variant="outline" className="gap-2" onClick={() => { setOpen(true); setFresh(null); }}><Send className="size-4" aria-hidden />{hi ? "लिंक भेजें" : "Send a link"}</Button>
      )}

      {links.length > 0 && (
        <ul className="space-y-1.5 border-t pt-3">
          {links.map((l) => {
            const [text, cls] = chip(l);
            return (
              <li key={l.ref} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate"><b>{l.label}</b> <span className="text-muted-foreground">· {l.slots.map((s) => DOC_INFO[s].title[hi ? 1 : 0]).join(", ")}</span></span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{text}</span>
                  {(l.state === "waiting" || l.state === "partly") && <button type="button" className="min-h-11 px-1 text-xs font-medium text-primary underline-offset-2 hover:underline" onClick={() => cancel(l.ref)}>{hi ? "रद्द" : "Cancel"}</button>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
