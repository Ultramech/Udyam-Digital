"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Minus, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { useVerify } from "@/components/customer/verify";
import { CONNECTIVITY, getProduct } from "@/lib/catalogue";
import { plainBenefit, plainName, plainUnit } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { api, ApiError, writeJourney } from "@/lib/client/api";
import { fmtDate, groupLines, inr } from "@/lib/client/format";
import type { QuoteView } from "@/lib/client/types";
import type { Edit } from "@/lib/rules/quote";
import { SharePlan } from "@/components/customer/share-plan";
import { BillCompare } from "@/components/customer/bill-compare";
import { GstinHelp } from "@/components/customer/gst-help";
import { CallbackRequest } from "@/components/customer/callback-request";
import { PackageCompare } from "@/components/customer/package-compare";
import { MaturityCard } from "@/components/customer/maturity-card";

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const router = useRouter();
  const { ensureVerified } = useVerify();
  const [v, setV] = useState<QuoteView | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => { api<QuoteView>("GET", `/api/quote/${id}`).then((r) => { setV(r); writeJourney({ quoteId: id }); }).catch(() => setErr(true)); }, [id]);

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await api<QuoteView>("PATCH", `/api/quote/${id}`, body);
      if (r.blocked) toast.warning(ruleReason({ code: r.blocked.code, params: r.blocked.params, productId: r.blocked.productId }, lang));
      else { setV(r); for (const n of r.notices ?? []) toast.info(ruleReason(n, lang)); }
    } catch (e) { toast.error(e instanceof ApiError && e.code === "QUOTE_INVALID" ? "That combination isn't allowed." : t("error_generic")); }
    setBusy(false);
  }, [id, lang, t]);
  const edit = (e: Edit) => patch({ op: "edit", edit: e });

  async function next() {
    if (!(await ensureVerified())) return; // saving a quote / proceeding to buy needs a verified phone
    router.push(`/order/${id}/sites`);
  }

  if (err) return <CustomerShell step={2}><Card className="p-4 text-sm">{t("error_generic")}</Card></CustomerShell>;
  if (!v) return <CustomerShell step={2}><div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-64" /></div></CustomerShell>;

  const { quote, pricing, schedule } = v;
  const groups = groupLines(pricing.lines);
  const sites = quote.profile.sites;
  const unavailable = v.catalogue.filter((c) => c.state === "unavailable");
  const addons = v.catalogue.filter((c) => c.state === "available");
  const hard = v.escalation.level === "hard";

  return (
    <CustomerShell step={2}>
      <div className="space-y-4 pb-32">
        <div className="flex items-start justify-between gap-3">
          <div><h1 className="text-xl font-bold">{t("quote_title")}</h1><p className="text-sm text-muted-foreground">{bundleName(quote.bundleId, lang)}</p></div>
          <Badge variant="secondary" className="shrink-0 gap-1"><CalendarClock className="size-3" />{fmtDate(schedule.date, lang)}</Badge>
        </div>

        {v.issues.length > 0 && <Card className="flex gap-2 border-destructive/40 bg-destructive/5 p-3 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /><div>{v.issues.slice(0, 3).map((i, k) => <div key={k}>{ruleReason({ code: i.code, params: i.params, productId: i.productId }, lang)}</div>)}</div></Card>}

        {/* locations */}
        {(sites > 1 || quote.bundleId === "allshops") && (
          <Card className="flex items-center justify-between p-3">
            <div className="text-sm font-medium">{t("f_sites")}</div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" aria-label="Remove a location" disabled={busy || sites <= 1} onClick={() => edit({ type: "removeSite", siteIndex: sites - 1 })}><Minus className="size-3.5" /></Button>
              <span className="w-6 text-center font-semibold" aria-live="polite">{sites}</span>
              <Button size="icon" variant="outline" aria-label={t("add_site")} disabled={busy || sites >= 20} onClick={() => edit({ type: "addSite" })}><Plus className="size-3.5" /></Button>
            </div>
          </Card>
        )}

        {/* included */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("included")}</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {groups.map((g) => {
              const p = getProduct(g.productId);
              const perSiteUnit = p.unit === "per site";
              const connectivity = CONNECTIVITY.includes(g.productId);
              const first = pricing.lines.find((l) => l.productId === g.productId)!;
              const each = g.sites > 1 ? first.qty : g.qty;
              return (
                <li key={g.productId} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><ProductIcon id={g.productId} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-snug">{plainName(g.productId, lang)}</div>
                    <div className="text-xs text-muted-foreground">{inr(first.unitPrice)} {plainUnit(p.unit, lang)}{g.sites > 1 ? ` · ${g.sites} ${t("sites_n")}` : ""}{p.setup ? ` · ${inr(p.setup)} ${t("setup_once")}` : ""}</div>
                    {!perSiteUnit && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Button size="icon-sm" variant="outline" aria-label="Fewer" disabled={busy || each <= 1} onClick={() => edit({ type: "setQty", productId: g.productId, qty: each - 1 })}><Minus className="size-3" /></Button>
                        <span className="w-6 text-center text-sm font-medium" aria-live="polite">{each}</span>
                        <Button size="icon-sm" variant="outline" aria-label="More" disabled={busy || each >= 100} onClick={() => edit({ type: "setQty", productId: g.productId, qty: each + 1 })}><Plus className="size-3" /></Button>
                        {g.sites > 1 && <span className="text-[11px] text-muted-foreground">{(lang === "hi" || lang === "mr") ? "प्रति लोकेशन" : "per location"}</span>}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right"><div className="text-sm font-semibold">{inr(g.monthly)}</div><div className="text-[10px] text-muted-foreground">{(lang === "hi" || lang === "mr") ? "/ माह" : "/ mo"}</div>
                    {!connectivity && g.productId !== "P07" && <Button size="icon-sm" variant="ghost" aria-label={t("remove")} disabled={busy} onClick={() => edit({ type: "remove", productId: g.productId })}><Trash2 className="size-3.5 text-muted-foreground" /></Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* add-ons */}
        {addons.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{t("add_ons")}</h2><Link href={`/catalogue?quote=${id}`} className="text-xs text-primary underline-offset-4 hover:underline">{(lang === "hi" || lang === "mr") ? "सभी सेवाएँ देखें" : "Browse all services"}</Link></div>
            <ul className="space-y-1.5">
              {addons.map((c) => {
                const p = getProduct(c.productId);
                return (
                  <li key={c.productId} className="flex items-center gap-3 rounded-lg border bg-card p-2.5">
                    <ProductIcon id={c.productId} className="size-4 text-primary" />
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium leading-snug">{plainName(c.productId, lang)}</div><div className="text-[11px] text-muted-foreground">{plainBenefit(c.productId, lang)} · {inr(p.priceMin)} {plainUnit(p.unit, lang)}</div></div>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => edit({ type: "add", productId: c.productId })}><Plus className="mr-1 size-3" />{t("add")}</Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* unavailable, with reasons */}
        {unavailable.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">{t("unavailable")}</h2>
            <ul className="space-y-1.5">
              {unavailable.map((c) => (
                <li key={c.productId} className="rounded-lg border border-dashed bg-muted/40 p-2.5 opacity-90">
                  <div className="text-sm font-medium text-muted-foreground">{plainName(c.productId, lang)}</div>
                  <div className="text-[11px] text-muted-foreground">{c.reason && ruleReason({ code: c.reason.code, params: c.reason.params, productId: c.productId }, lang)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GstinHelp counterfactuals={v.counterfactuals} lang={lang} />

        <PackageCompare options={v.packages ?? []} lang={lang} busy={busy}
          onChoose={(pid) => patch({ op: "alternative", id: pid === "basic" ? "lighter" : pid === "premium" ? "fuller" : "recommended" })} />

        {/* budget mode */}
        <Card className="space-y-3 p-3">
          <div className="text-sm font-semibold">{t("budget_mode")}</div>
          <div className="flex gap-2">
            <Input inputMode="numeric" placeholder="1500" aria-label={t("budget_label")} value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
            <Button disabled={busy || !budget} onClick={() => patch({ op: "budget", amount: Number(budget) })}>{t("budget_apply")}</Button>
            {quote.profile.budget && <Button variant="ghost" disabled={busy} onClick={() => { setBudget(""); patch({ op: "budget", amount: null }); }}>{t("budget_clear")}</Button>}
          </div>
          {v.budget && <p className={`text-xs ${v.budget.met ? "text-success" : "text-warning"}`}>{ruleReason({ code: v.budget.met ? "BUDGET_MET" : "BUDGET_NOT_MET", params: { target: v.budget.target, min: v.budget.minPossible } }, lang)}{v.budget.removed.length > 0 && ` (${(lang === "hi" || lang === "mr") ? "हटाया" : "removed"}: ${v.budget.removed.map((r) => plainName(r, lang).split(" (")[0]).join(", ")})`}</p>}
        </Card>
        <p className="text-xs text-muted-foreground">{t("indicative")}</p>
        {v.maturity && pricing.lines.length > 0 && <MaturityCard m={v.maturity} quoteId={id} lang={lang} />}
        <BillCompare quoteId={id} lang={lang} />
        <SharePlan quoteId={id} lang={lang} />
        <CallbackRequest conversationId={quote.conversationId} lang={lang} />
      </div>


      {/* sticky price bar: one transparent number */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left" aria-label={t("breakdown")}>
            <div className="text-2xl font-extrabold leading-none">{inr(pricing.monthly)}<span className="ml-1 text-xs font-medium text-muted-foreground">{t("per_month")}</span></div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{t("gst_extra")} · {pricing.setup ? `${inr(pricing.setup)} ${t("setup_once")}` : t("free")} · <span className="underline">{t("breakdown")}</span></div>
          </button>
          <Button size="lg" onClick={next} disabled={busy || v.issues.length > 0 || hard || !pricing.lines.length}>{t("btn_continue_sites")}</Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>{t("breakdown")}</SheetTitle><SheetDescription>{t("indicative")}</SheetDescription></SheetHeader>
          <div className="mx-auto w-full max-w-xl space-y-1.5 px-4 pb-6 text-sm">
            {groups.map((g) => <div key={g.productId} className="flex justify-between gap-3"><span className="text-muted-foreground">{plainName(g.productId, lang)}{g.qty > 1 ? ` × ${g.qty}` : ""}</span><span>{inr(g.monthly)}</span></div>)}
            <hr className="my-2" />
            <Row l={t("monthly_charge")} r={inr(pricing.monthly)} /><Row l={`${t("gst_18")} · ${t("monthly_charge")}`} r={inr(pricing.gstMonthly)} /><Row l={`${t("monthly_charge")} ${t("incl_gst")}`} r={inr(pricing.monthlyInclGst)} bold />
            <hr className="my-2" />
            <Row l={t("setup_charges")} r={inr(pricing.setup)} /><Row l={`${t("gst_18")} · ${t("setup_charges")}`} r={inr(pricing.gstSetup)} />
            <hr className="my-2" />
            <Row l={t("first_payment")} r={inr(pricing.firstPayment)} bold />
            <Row l={t("contract")} r={`${pricing.contractMonths} ${t("months")}`} /><Row l={t("go_live")} r={fmtDate(schedule.date, lang)} />
            <hr className="my-2" />
            <div className="rounded-lg bg-muted p-2.5 text-xs">
              <div className="mb-1 font-semibold">{(lang === "hi" || lang === "mr") ? "आपके बिल, एक नज़र में" : "Your bills at a glance"}</div>
              <Row l={(lang === "hi" || lang === "mr") ? "पहला बिल (सेटअप + पहला महीना, GST सहित)" : "First bill (setup + first month, incl. GST)"} r={inr(pricing.firstPayment)} />
              <Row l={(lang === "hi" || lang === "mr") ? "दूसरे महीने से हर महीने (GST सहित)" : "Every month after that (incl. GST)"} r={inr(pricing.monthlyInclGst)} />
              {pricing.contractMonths > 1 && <Row l={(lang === "hi" || lang === "mr") ? `${pricing.contractMonths} महीने के कॉन्ट्रैक्ट में कुल` : `Total over the ${pricing.contractMonths}-month contract`} r={inr(pricing.firstPayment + pricing.monthlyInclGst * (pricing.contractMonths - 1))} bold />}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </CustomerShell>
  );
}
const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => <div className={`flex justify-between gap-3 ${bold ? "font-semibold" : ""}`}><span>{l}</span><span>{r}</span></div>;
