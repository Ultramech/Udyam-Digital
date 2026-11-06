"use client";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Info, ListChecks, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { plainBenefit, plainName, plainUnit } from "@/lib/catalogue/plain";
import { getProduct } from "@/lib/catalogue";
import { bundleName, bundleTagline } from "@/lib/i18n/bundles";
import { counterfactualText, ruleReason } from "@/lib/i18n/reasons";
import { traceLine } from "@/lib/i18n/trace";
import { estimateSchedule, priceLines } from "@/lib/rules/pricing";
import type { BusinessProfile, Line, Recommendation } from "@/lib/rules/types";
import { fmtDate, groupLines, inr } from "@/lib/client/format";
import { cn } from "@/lib/utils";

export function LinesList({ lines, showPrice = true }: { lines: Line[]; showPrice?: boolean }) {
  const { lang } = useI18n();
  const priced = useMemo(() => priceLines(lines), [lines]);
  const groups = groupLines(priced.lines);
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {groups.map((g) => {
        const p = getProduct(g.productId);
        return (
          <li key={g.productId} className="flex items-start gap-3 p-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"><ProductIcon id={g.productId} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-snug">{plainName(g.productId, lang)}{p.unit !== "per account" && g.qty > 1 ? <span className="ml-1 text-muted-foreground">× {g.qty}</span> : null}</div>
              <div className="text-xs text-muted-foreground">{plainBenefit(g.productId, lang)}</div>
              {g.sites > 1 && <div className="mt-0.5 text-xs text-muted-foreground">{g.sites} {(lang === "hi" || lang === "mr") ? "लोकेशन" : "locations"} · {plainUnit(p.unit, lang)}</div>}
            </div>
            {showPrice && <div className="shrink-0 text-right text-sm font-medium">{inr(g.monthly)}<div className="text-xs font-normal text-muted-foreground">{(lang === "hi" || lang === "mr") ? "/ माह" : "/ mo"}</div></div>}
          </li>
        );
      })}
    </ul>
  );
}

/** "How I decided": every rule the engine applied, in plain words. This is the proof that the recommendation is traceable. */
export function DecisionTrace({ rec }: { rec: Recommendation }) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const rows = rec.trace.map((e) => traceLine(e, lang)).filter((r) => r.text);
  const icon = { pass: "✓", fail: "✕", info: "•", add: "+", warn: "!" } as const;
  const tone = { pass: "text-success", fail: "text-destructive", info: "text-muted-foreground", add: "text-primary", warn: "text-warning" } as const;
  return (
    <div className="rounded-2xl border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium">
        <span className="flex items-center gap-2"><ListChecks className="size-4" />{(lang === "hi" || lang === "mr") ? "मैंने कैसे तय किया" : "How I decided"}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="space-y-1 border-t p-3 text-xs">
          {rows.map((r, i) => <li key={i} className="flex gap-2"><span className={cn("w-3 shrink-0 text-center font-bold", tone[r.status])}>{icon[r.status]}</span><span>{r.text}</span></li>)}
          <li className="pt-1 text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "हर कीमत और हर पात्रता नियम कोड से तय होता है — AI सिर्फ़ आपकी बात समझता और समझाता है।" : "Every price and eligibility rule is decided by code — the AI only understands you and explains."}</li>
        </ol>
      )}
    </div>
  );
}

export function BundleCard({ rec, profile, onBuy, busy }: { rec: Recommendation; profile: BusinessProfile; onBuy?: () => void; busy?: boolean }) {
  const { t, lang } = useI18n();
  const price = useMemo(() => priceLines(rec.lines), [rec.lines]);
  const sched = useMemo(() => estimateSchedule(rec.lines), [rec.lines]);
  const hard = rec.escalation.level === "hard";
  const exclusions = rec.exclusions.filter((e) => !(e.productId === "P15" && rec.notices.some((n) => n.code === "WHATSAPP_ALTERNATIVE_WEBSITE")));

  // Honest comparison only when the owner told us their spend — and never claim a saving that isn't there.
  const spend = profile.currentSpend;
  const cmp = spend && price.monthly
    ? price.monthly <= spend
      ? ((lang === "hi" || lang === "mr") ? `आपने बताया कि आप लगभग ${inr(spend)} खर्च करते हैं; यह प्लान ${inr(price.monthly)} है — लगभग ${inr(spend - price.monthly)} कम, और सब एक बिल में।` : `You told us you spend about ${inr(spend)}; this plan is ${inr(price.monthly)} — about ${inr(spend - price.monthly)} less, on one bill.`)
      : ((lang === "hi" || lang === "mr") ? `आपके मौजूदा खर्च (${inr(spend)}) से यह ${inr(price.monthly - spend)} ज़्यादा है, पर इसमें ज़्यादा सेवाएँ एक बिल में हैं।` : `This is ${inr(price.monthly - spend)} more than your current ${inr(spend)}, and it adds more services on one bill.`)
    : null;

  if (!rec.lines.length) {
    return (
      <Card className="space-y-3 border-warning/40 p-4">
        <div className="flex items-center gap-2 font-semibold"><UserRound className="size-4" />{t("human_note")}</div>
        {rec.escalation.reasons.map((r) => <p key={r} className="text-sm">{ruleReason({ code: r }, lang)}</p>)}
        <DecisionTrace rec={rec} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-primary p-4 text-primary-foreground">
        <div className="flex items-center gap-1.5 text-xs opacity-90"><Sparkles className="size-3.5" />{t("plan_for")}</div>
        <h3 className="mt-1 text-2xl font-bold leading-tight">{bundleName(rec.bundleId, lang)}</h3>
        <p className="mt-1 text-sm opacity-90">{bundleTagline(rec.bundleId, lang)}</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-4xl font-extrabold leading-none tracking-tight">{inr(price.monthly)}<span className="ml-1 text-base font-medium opacity-90">{t("per_month")}</span></div>
            <div className="mt-1 text-xs opacity-90">{t("gst_extra")} · {price.setup ? `${inr(price.setup)} ${t("setup_once")}` : ((lang === "hi" || lang === "mr") ? "कोई सेटअप फ़ीस नहीं" : "no setup fee")}</div>
          </div>
          <div className="text-right text-xs opacity-95">
            <div>{price.contractMonths} {t("months")} {t("contract")}</div>
            <div className="mt-0.5 flex items-center justify-end gap-1"><CalendarClock className="size-3.5" />{fmtDate(sched.date, lang)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <LinesList lines={rec.lines} />

        {rec.why.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-sm font-semibold">{t("why_this")}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">{rec.why.map((w, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{ruleReason(w, lang)}</li>)}</ul>
          </section>
        )}
        {rec.notices.length > 0 && (
          <section className="space-y-1.5">
            {rec.notices.map((n, i) => <div key={i} className="flex gap-2 rounded-lg bg-accent p-2.5 text-sm text-accent-foreground"><Info className="mt-0.5 size-4 shrink-0" />{ruleReason(n, lang)}</div>)}
          </section>
        )}
        {exclusions.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-sm font-semibold">{t("not_included")}</h4>
            <ul className="space-y-1.5 text-sm">
              {exclusions.map((e) => <li key={e.productId + e.code} className="rounded-2xl border bg-card p-2.5"><span className="font-medium">{plainName(e.productId, lang)}</span><div className="text-xs text-muted-foreground">{ruleReason({ code: e.code, params: e.params, productId: e.productId }, lang).replace(plainName(e.productId, lang), "").trim() || ruleReason({ code: e.code, params: e.params, productId: e.productId }, lang)}</div></li>)}
            </ul>
          </section>
        )}
        {rec.counterfactuals.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-sm font-semibold">{t("what_changes")}</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">{rec.counterfactuals.map((c, i) => <li key={i} className="flex gap-2"><span className="text-success">↗</span>{counterfactualText(c, lang)}</li>)}</ul>
          </section>
        )}
        {cmp && <p className="rounded-lg bg-secondary p-2.5 text-sm">{cmp}</p>}
        {rec.escalation.level === "assist" && (
          <div className="flex gap-2 rounded-lg border border-primary/30 bg-accent p-2.5 text-sm"><UserRound className="mt-0.5 size-4 shrink-0 text-primary" /><div><b>{t("human_note")}.</b> {rec.escalation.reasons.map((r) => ruleReason({ code: r }, lang)).join(" ")}</div></div>
        )}
        {hard && (
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-sm"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />{rec.escalation.reasons.map((r) => ruleReason({ code: r }, lang)).join(" ")}</div>
        )}

        <DecisionTrace rec={rec} />
        <p className="text-xs text-muted-foreground">{t("indicative")}</p>
        {onBuy && !hard && (
          <Button size="lg" className="w-full" onClick={onBuy} disabled={busy}>{t("customise_buy")}</Button>
        )}
        {rec.escalation.level !== "none" && <Badge variant="outline" className="text-xs">{(lang === "hi" || lang === "mr") ? "आपकी जानकारी विशेषज्ञ को भेज दी गई है" : "Your details have been shared with a specialist"}</Badge>}
      </div>
    </Card>
  );
}
