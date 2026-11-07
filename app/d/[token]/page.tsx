"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileImage, Lock, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { DOC_INFO } from "@/components/customer/kyc-parts";
import { fmtDate } from "@/lib/client/format";
import type { Slot } from "@/lib/kyc/types";

interface Info { business: string; city: string; ownerFirstName: string | null; label: string; expiresAt: number; slots: { slot: Slot; done: boolean }[] }
type Result = { state: "received" | "review" | "retake"; fix?: string };

/**
 * Opened by a CA, partner or shop staff from a link the owner sent. No account, no password: the link is the key, and it only
 * covers the documents listed here. It shows nothing that was read from any document, only whether each one was received.
 */
export default function DelegatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const [info, setInfo] = useState<Info | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState<Slot | null>(null);
  const [results, setResults] = useState<Partial<Record<Slot, Result>>>({});
  const [err, setErr] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<Slot, HTMLInputElement | null>>>({});

  const load = useCallback(() => fetch(`/api/d/${token}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setInfo).catch(() => setGone(true)), [token]);
  useEffect(() => { load(); }, [load]);

  async function send(slot: Slot, f: File) {
    setBusy(slot); setErr(null);
    try {
      const fd = new FormData(); fd.set("slot", slot); fd.set("file", f);
      const res = await fetch(`/api/d/${token}/doc?lang=${hi ? "hi" : "en"}`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        const c = data.error as string;
        setErr(c === "UNSUPPORTED_TYPE" || c === "FILE_CONTENT_MISMATCH" ? (hi ? "सिर्फ़ PNG/JPG फ़ोटो या PDF भेजें।" : "Please send a PNG or JPG photo, or a PDF.")
          : c === "FILE_TOO_LARGE" ? (hi ? "फ़ाइल 5 MB से छोटी होनी चाहिए।" : "The file must be under 5 MB.")
          : c === "SAME_FILE_AGAIN" ? (hi ? "यह वही फ़ाइल है जिसमें पहले समस्या थी। नई फ़ोटो लें।" : "That is the same file that had a problem. Please take a new photo.")
          : c === "DOCUMENT_READER_UNAVAILABLE" ? (hi ? "अभी दस्तावेज़ जाँचने की सेवा उपलब्ध नहीं है। थोड़ी देर बाद फिर कोशिश करें।" : "We can't check documents right now. Please try again in a little while.")
          : c === "LINK_NOT_FOUND" ? (hi ? "यह लिंक बंद हो चुका है।" : "This link is no longer active.")
          : (hi ? "कुछ गड़बड़ हुई। दोबारा कोशिश करें।" : "Something went wrong. Please try again."));
        if (c === "LINK_NOT_FOUND") setGone(true);
        return;
      }
      setResults((r) => ({ ...r, [slot]: { state: data.state, fix: data.fix } }));
      load();
    } catch { setErr(hi ? "नेटवर्क की समस्या। दोबारा कोशिश करें।" : "Network problem. Please try again."); }
    finally { setBusy(null); }
  }

  if (gone) return (
    <CustomerShell><Card className="space-y-1 p-5"><div className="text-lg font-bold">{hi ? "यह लिंक अब काम नहीं करता" : "This link no longer works"}</div>
      <p className="text-sm text-muted-foreground">{hi ? "यह पुराना हो गया है या रद्द कर दिया गया है। जिसने भेजा है उनसे नया लिंक माँगें।" : "It has expired or was cancelled. Ask the person who sent it for a new one."}</p></Card></CustomerShell>
  );
  if (!info) return <CustomerShell><div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-48" /></div></CustomerShell>;

  const left = info.slots.filter((s) => !s.done).length;
  const who = info.ownerFirstName ?? (hi ? "मालिक" : "The owner");
  return (
    <CustomerShell>
      <div className="space-y-4 pb-10">
        <div>
          <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{hi ? `${who} को आपकी मदद चाहिए` : `${who} needs your help`}</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">
            {left === 0 ? (hi ? "सब मिल गया। धन्यवाद! आप यह पेज बंद कर सकते हैं।" : "Everything is in. Thank you! You can close this page.")
              : hi ? `${info.business}${info.city ? `, ${info.city}` : ""} के लिए ${left} दस्तावेज़ चाहिए। लगभग एक मिनट लगेगा। अकाउंट की ज़रूरत नहीं।`
                : `${who} is getting internet and business services for their ${info.business || "business"}${info.city ? ` in ${info.city}` : ""}. Please add ${left} ${left === 1 ? "document" : "documents"}. It takes about a minute, and you don't need an account.`}
          </p>
        </div>

        {info.slots.map(({ slot, done }) => {
          const r = results[slot];
          const t = DOC_INFO[slot];
          const ok = done && r?.state !== "retake";
          return (
            <Card key={slot} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[0.9375rem] font-bold"><FileImage className="size-4 shrink-0" aria-hidden />{t.title[hi ? 1 : 0]}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t.why[hi ? 1 : 0]}</p>
                </div>
                {ok
                  ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"><CheckCircle2 className="size-3" aria-hidden />{hi ? "मिल गया" : "Received"}</span>
                  : <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{hi ? "ज़रूरी" : "Needed"}</span>}
              </div>
              {r?.state === "retake" && <p className="rounded-xl bg-warning/10 p-3 text-sm"><b>{hi ? "इसे दोबारा भेजें।" : "Please send this one again."}</b> {r.fix}</p>}
              {r?.state === "review" && <p className="rounded-xl bg-info/10 p-3 text-sm">{hi ? "मिल गया। एक समीक्षक इसे देखेगा।" : "Received. A reviewer will take a look."}</p>}
              <input ref={(el) => { inputs.current[slot] = el; }} type="file" accept="image/png,image/jpeg,application/pdf" className="sr-only" aria-label={t.title[0]}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) send(slot, f); e.target.value = ""; }} />
              <Button size={ok ? "sm" : "lg"} variant={ok ? "outline" : "default"} className="w-full gap-2 sm:w-auto" disabled={busy !== null} onClick={() => inputs.current[slot]?.click()}>
                <Upload className="size-4" aria-hidden />{busy === slot ? (hi ? "जाँच हो रही है…" : "Checking…") : ok ? (hi ? "दूसरी फ़ाइल भेजें" : "Send a different file") : (hi ? "फ़ोटो या PDF भेजें" : "Send a photo or PDF")}
              </Button>
            </Card>
          );
        })}
        {err && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}

        <Card className="flex flex-row items-start gap-3 bg-secondary p-3.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>{hi ? `यह लिंक सिर्फ़ ऊपर के दस्तावेज़ों के लिए है और ${fmtDate(new Date(info.expiresAt).toISOString(), "hi")} तक चलेगा। आप यहाँ किसी का और डेटा नहीं देख सकते। हम सिर्फ़ जाँच के लिए ज़रूरी जानकारी रखते हैं।`
            : `This link only covers the documents above and works until ${fmtDate(new Date(info.expiresAt).toISOString(), "en")}. You can't see anyone's other data here. We keep only what verification needs. The owner can cancel the link at any time.`}</p>
        </Card>
      </div>
    </CustomerShell>
  );
}
