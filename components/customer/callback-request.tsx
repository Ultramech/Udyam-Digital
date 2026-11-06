"use client";
import { useState } from "react";
import { CheckCircle2, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useVerify } from "@/components/customer/verify";
import { api, ApiError } from "@/lib/client/api";
import { fmtDate } from "@/lib/client/format";
import { CALLBACK_WINDOWS, callbackDays } from "@/lib/callback/windows";
import { cn } from "@/lib/utils";

/** For the owner who'd rather talk to a person: pick a day and window; it reaches the ops lead with the whole conversation attached. */
export function CallbackRequest({ conversationId, lang }: { conversationId?: string; lang: string }) {
  const hi = lang === "hi" || lang === "mr";
  const { ensureVerified } = useVerify();
  const days = callbackDays();
  const [date, setDate] = useState(days[0]);
  const [win, setWin] = useState<string>(CALLBACK_WINDOWS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ window: string; at: string; phoneMasked: string } | null>(null);
  if (!conversationId) return null;

  async function submit() {
    if (!(await ensureVerified())) return; // a rep needs a real, verified number to call
    setBusy(true);
    try { setDone(await api("POST", "/api/callback", { conversationId, date, window: win, note: note.trim() || undefined })); }
    catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast.error(c === "TOO_MANY_CALLBACKS" ? (hi ? "आपके कई कॉलबैक पहले से तय हैं।" : "You already have several callbacks booked.") : c === "NO_PLAN_YET" ? (hi ? "पहले सलाहकार को अपने बिज़नेस के बारे में बताएँ।" : "Tell the advisor about your business first.") : (hi ? "अनुरोध नहीं भेजा जा सका।" : "Couldn't send the request."));
    }
    setBusy(false);
  }
  if (done) return <Card className="flex items-start gap-2 border-success/40 bg-success/5 p-3.5 text-sm" role="status"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /><div>{hi ? `ठीक है — हम ${fmtDate(done.at.slice(0, 10), "hi")}, ${done.window} के बीच ${done.phoneMasked} पर कॉल करेंगे।` : `Done — we'll call ${done.phoneMasked} on ${fmtDate(done.at.slice(0, 10), "en")}, ${done.window}.`}</div></Card>;
  const chip = (on: boolean) => cn("min-h-11 rounded-lg border px-3 text-sm", on ? "border-primary bg-accent font-medium" : "bg-card");
  return (
    <Card className="space-y-3 p-3.5" aria-labelledby="cb-h">
      <div className="flex items-center gap-2"><Phone className="size-4 text-primary" /><h2 id="cb-h" className="text-sm font-semibold">{hi ? "किसी व्यक्ति से बात करना चाहते हैं?" : "Prefer to talk to a person?"}</h2></div>
      <div role="radiogroup" aria-label={hi ? "दिन" : "Day"} className="flex flex-wrap gap-2">{days.map((d) => <button key={d} type="button" role="radio" aria-checked={date === d} className={chip(date === d)} onClick={() => setDate(d)}>{fmtDate(d, hi ? "hi" : "en")}</button>)}</div>
      <div role="radiogroup" aria-label={hi ? "समय" : "Time window"} className="flex flex-wrap gap-2">{CALLBACK_WINDOWS.map((w) => <button key={w} type="button" role="radio" aria-checked={win === w} className={chip(win === w)} onClick={() => setWin(w)}>{w}</button>)}</div>
      <Textarea rows={2} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder={hi ? "कुछ बताना हो तो लिखें (वैकल्पिक)" : "Anything we should know? (optional)"} aria-label={hi ? "संदेश" : "Note"} />
      <Button disabled={busy} onClick={submit}>{hi ? "मुझे कॉल करें" : "Request a call"}</Button>
    </Card>
  );
}
