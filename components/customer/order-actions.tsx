"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CopyPlus, LifeBuoy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { api, ApiError, writeJourney } from "@/lib/client/api";
import { inr } from "@/lib/client/format";
import type { Order } from "@/lib/store/types";

/** Help, upgrade, copy-to-new-branch and cancel — the things owners otherwise call support for. */
export function OrderActions({ o, token, lang, onChange }: { o: Order; token: string; lang: string; onChange: () => void }) {
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const canCancel = !o.cancelled && o.stage !== "INSTALL_IN_PROGRESS" && o.stage !== "ACTIVATED";

  async function reorder(mode: "upgrade" | "new_site") {
    setBusy(true);
    try {
      const r = await api<{ quoteId: string }>("POST", `/api/orders/${o.id}/reorder`, { t: token, mode });
      writeJourney({ quoteId: r.quoteId });
      router.push(`/quote/${r.quoteId}`);
    } catch { toast.error(H("Couldn't start a new plan. Please try again.", "नया प्लान शुरू नहीं हो सका। फिर कोशिश करें।")); setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try {
      await api("POST", `/api/orders/${o.id}/cancel`, { t: token, reason: reason.trim() || H("Changed my mind", "मन बदल गया") });
      toast.success(H("Order cancelled.", "ऑर्डर रद्द हुआ।")); onChange();
    } catch (e) { toast.error(e instanceof ApiError && e.code === "TOO_LATE_TO_CANCEL" ? H("Installation has started — please ask for help instead.", "इंस्टॉलेशन शुरू हो चुका है — कृपया मदद माँगें।") : H("Couldn't cancel. Please try again.", "रद्द नहीं हो सका। फिर कोशिश करें।")); }
    setBusy(false); setConfirm(false);
  }

  if (o.cancelled) {
    const r = o.cancelled.refund;
    return (
      <Card className="space-y-1 border-destructive/40 bg-destructive/5 p-3.5 text-sm">
        <div className="flex items-center gap-2 font-semibold"><Ban className="size-4 text-destructive" />{H("Order cancelled", "ऑर्डर रद्द")}</div>
        <p>{r.status === "not_needed" ? H("Nothing was charged, so there is nothing to refund.", "कोई शुल्क नहीं लगा था, इसलिए वापसी की ज़रूरत नहीं।")
          : r.status === "initiated" ? H(`Refund of ${inr(r.amount)} started — it reaches the same account in 5–7 working days.`, `${inr(r.amount)} की वापसी शुरू — 5–7 कामकाजी दिनों में उसी खाते में।`)
          : H(`Our team will refund ${inr(r.amount)} by hand and update you here.`, `हमारी टीम ${inr(r.amount)} मैन्युअली लौटाएगी और यहीं बताएगी।`)}</p>
        <div className="flex gap-2 pt-1"><Link href={`/support?order=${o.id}`}><Button size="sm" variant="outline" className="gap-1"><LifeBuoy className="size-3.5" />{H("Help", "मदद")}</Button></Link><Link href="/advisor"><Button size="sm" variant="ghost">{H("Start a new plan", "नया प्लान")}</Button></Link></div>
      </Card>
    );
  }
  return (
    <>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2 [&_button]:h-auto [&_button]:min-h-11 [&_button]:w-full [&_button]:whitespace-normal [&_button]:py-2 [&_button]:text-center">
        <Link href={`/support?order=${o.id}`}><Button variant="outline" className="w-full gap-1.5"><LifeBuoy className="size-4" />{H("Help", "मदद")}</Button></Link>
        <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => reorder("upgrade")}><Sparkles className="size-4" />{H("Add services", "सेवाएँ जोड़ें")}</Button>
        <Button variant="outline" className="gap-1.5" disabled={busy} onClick={() => reorder("new_site")}><CopyPlus className="size-4" />{H("Plan for a new branch", "नई ब्रांच के लिए")}</Button>
        {canCancel && <Button variant="ghost" className="gap-1.5 text-destructive" disabled={busy} onClick={() => setConfirm(true)}><Ban className="size-4" />{H("Cancel order", "ऑर्डर रद्द करें")}</Button>}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{H("Cancel this order?", "यह ऑर्डर रद्द करें?")}</AlertDialogTitle>
            <AlertDialogDescription>{o.payment.status === "success"
              ? H(`Anything you've paid (${inr(o.payment.paid ?? o.totals.firstPayment)}) is refunded to the same account in 5–7 working days. Your installation slot is released.`, `जो भुगतान किया (${inr(o.payment.paid ?? o.totals.firstPayment)}) वह 5–7 कामकाजी दिनों में उसी खाते में लौटेगा। इंस्टॉलेशन स्लॉट छोड़ दिया जाएगा।`)
              : H("Nothing has been charged yet.", "अभी तक कोई शुल्क नहीं लगा है।")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={H("Reason (optional) — helps us improve", "कारण (वैकल्पिक) — हमें सुधार में मदद मिलती है")} aria-label={H("Reason", "कारण")} />
          <AlertDialogFooter><AlertDialogCancel>{H("Keep my order", "ऑर्डर रखें")}</AlertDialogCancel><AlertDialogAction onClick={cancel} disabled={busy}>{H("Cancel order", "ऑर्डर रद्द करें")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
