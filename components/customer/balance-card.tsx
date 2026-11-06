"use client";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/client/api";
import { inr } from "@/lib/client/format";

interface Rz { keyId?: string; razorpayOrderId?: string; amount?: number; currency?: string; test?: boolean }
type RzCtor = new (o: Record<string, unknown>) => { open(): void; on(ev: string, cb: () => void): void };
const loadRazorpay = () => new Promise<void>((res, rej) => {
  if ((window as unknown as { Razorpay?: unknown }).Razorpay) return res();
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = () => res(); s.onerror = () => rej(new Error("razorpay_script")); document.body.appendChild(s);
});

/** Balance of a reserve-now order. The amount is whatever the server stored — the browser only opens Checkout and returns the signed result. */
export function BalanceCard({ orderId, token, amount, lang, onPaid }: { orderId: string; token: string; amount: number; lang: string; onPaid: () => void }) {
  const hi = lang === "hi" || lang === "mr";
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    try {
      const rz = await api<Rz>("POST", `/api/orders/${orderId}/balance`, { t: token });
      await loadRazorpay();
      await new Promise<void>((resolve) => {
        const R = (window as unknown as { Razorpay: RzCtor }).Razorpay;
        const inst = new R({
          key: rz.keyId, amount: rz.amount, currency: rz.currency, order_id: rz.razorpayOrderId, name: "Accel Business", description: hi ? "बाकी राशि" : "Balance payment", theme: { color: "#e40000" },
          handler: async (resp: Record<string, string>) => {
            try { await api("PUT", `/api/orders/${orderId}/balance`, { t: token, ...resp }); toast.success(hi ? "बाकी राशि मिल गई — धन्यवाद।" : "Balance received — thank you."); onPaid(); }
            catch { toast.error(hi ? "भुगतान की पुष्टि नहीं हो पाई।" : "We couldn't confirm that payment."); }
            resolve();
          },
          modal: { ondismiss: () => resolve() },
        });
        inst.on("payment.failed", () => toast.error(hi ? "भुगतान नहीं हो पाया।" : "Payment didn't go through."));
        inst.open();
      });
    } catch (e) { toast.error(e instanceof ApiError && e.code === "PAYMENTS_UNAVAILABLE" ? (hi ? "ऑनलाइन भुगतान अभी उपलब्ध नहीं है।" : "Online payment isn't available right now.") : (hi ? "कुछ गड़बड़ हुई — दोबारा कोशिश करें।" : "Something went wrong — please try again.")); }
    setBusy(false);
  }
  return (
    <Card className="space-y-2 border-primary/30 bg-accent p-3.5 text-sm" aria-labelledby="bal-h">
      <div id="bal-h" className="flex items-center gap-2 font-semibold"><Wallet className="size-4 text-primary" />{hi ? "बाकी राशि चुकाएँ" : "Pay the remaining balance"}</div>
      <p className="text-muted-foreground">{hi ? `आपने शुरू में आरक्षण राशि दी थी। सेवाएँ चालू करने के लिए बाकी ${inr(amount)} चुकाएँ — इसके बाद कोई और शुल्क नहीं।` : `You reserved with a deposit. Pay the remaining ${inr(amount)} so we can switch your services on — nothing else is added.`}</p>
      <Button disabled={busy} onClick={pay}>{hi ? `${inr(amount)} चुकाएँ` : `Pay ${inr(amount)}`}</Button>
    </Card>
  );
}
