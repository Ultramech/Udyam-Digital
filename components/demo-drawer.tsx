"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/components/i18n-provider";
import { api, clearJourney } from "@/lib/client/api";
import { PERSONAS } from "@/lib/demo/personas";
import { LANGS } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/** Judges' controls: deterministic, repeatable, and independent of any external service. */
export function DemoDrawer() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<{ id: string; label: string; mode: string; detail: string }[]>([]);
  useEffect(() => { if (open) api<{ services: typeof services }>("GET", "/api/status").then((r) => setServices(r.services)).catch(() => {}); }, [open]);

  async function reset() {
    // Staff (admin/ops) wipe the whole demo database; anyone else only clears their own journey in this browser —
    // a shared, deployed site must not let one evaluator erase another's orders.
    try { await api("POST", "/api/demo/reset"); } catch { /* not staff: local reset only */ }
    clearJourney(); toast.success(t("demo_reset_done"));
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("demo_title")}
        className="fixed right-2 top-[calc(4.4rem+env(safe-area-inset-top,0px))] z-40 flex items-center gap-1.5 rounded-full border bg-card p-2 text-xs font-medium shadow-md hover:bg-accent sm:bottom-4 sm:left-4 sm:right-auto sm:top-auto sm:px-3 sm:py-2">
        <FlaskConical className="size-3.5 text-primary" /><span className="hidden sm:inline">Demo</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto">
          <SheetHeader><SheetTitle>{t("demo_title")}</SheetTitle><SheetDescription>Phone OTP is real (2Factor SMS). Payments run on Razorpay test mode (no real money). Signatures are not live yet.</SheetDescription></SheetHeader>
          <div className="space-y-5 px-4 pb-6 text-sm">
            <section>
              <h3 className="mb-2 font-medium">What is live right now</h3>
              <ul className="space-y-1.5">
                {services.map((s) => (
                  <li key={s.id} className="rounded-lg border bg-card p-2 text-xs">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{s.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", s.mode === "live" ? "bg-success/15 text-success" : s.mode === "simulated" ? "bg-warning/15 text-warning" : "bg-destructive/10 text-destructive")}>{s.mode === "live" ? "LIVE" : s.mode === "simulated" ? "SIMULATED" : "NOT CONFIGURED"}</span></div>
                    <div className="mt-0.5 text-muted-foreground">{s.detail}</div>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 font-medium">{t("demo_personas")}</h3>
              <div className="space-y-2">
                {PERSONAS.map((p) => (
                  <Link key={p.id} href={`/advisor?persona=${p.id}`} onClick={() => setOpen(false)} className="block rounded-lg border bg-card p-2.5 hover:border-primary">
                    <div className="font-medium">{p.title[(lang === "hi" || lang === "mr") ? "hi" : "en"]}</div>
                    <div className="text-xs text-muted-foreground">{p.blurb[(lang === "hi" || lang === "mr") ? "hi" : "en"]}</div>
                  </Link>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-medium">{t("language")}</h3>
              <div className="flex flex-wrap gap-1.5">{LANGS.map((l) => <Button key={l.code} size="sm" variant={lang === l.code ? "default" : "outline"} onClick={() => setLang(l.code)}>{l.label}</Button>)}</div>
            </section>
            <section className="space-y-2">
              <Link href="/ops" className="block" onClick={() => setOpen(false)}><Button variant="outline" className="w-full">{t("demo_open_ops")}</Button></Link>
              <Button variant="destructive" className="w-full" onClick={reset}>{t("demo_reset")}</Button>
            </section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
