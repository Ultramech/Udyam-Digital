"use client";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

const STAGES = ["RECEIVED", "KYC_VERIFICATION", "FEASIBILITY", "INSTALL_SCHEDULED", "INSTALL_IN_PROGRESS", "ACTIVATED"] as const;

/** Page heading: one h1 per screen, one quiet line under it. */
export function PageTitle({ title, sub, action, className }: { title: string; sub?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        {sub ? <p className="mt-1 text-[0.9375rem] text-muted-foreground">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Heading for a group of things on a screen. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-base font-bold">{children}</h2>
      {action}
    </div>
  );
}

/** What an order is doing right now, in the owner's language. Colour carries meaning: green live, amber waiting, red stopped. */
export function OrderStatus({ stage, payment, cancelled }: { stage: string | null; payment?: string; cancelled?: boolean }) {
  const { t } = useI18n();
  if (cancelled || stage === "CANCELLED") return <Badge variant="destructive">{t("order_cancelled")}</Badge>;
  if (stage === "ACTIVATED") return <Badge variant="success">{t("stage_ACTIVATED")}</Badge>;
  if (!stage) return <Badge variant="warning">{payment === "success" ? t("order_paid") : t("order_unpaid")}</Badge>;
  return <Badge variant="info">{t(`stage_${stage}`)}</Badge>;
}

/** Six steps from "received" to "live". The current one is named; the rest are just marks. */
export function StageTrack({ stage, className }: { stage: string | null; className?: string }) {
  const idx = stage ? Math.max(0, STAGES.indexOf(stage as (typeof STAGES)[number])) : -1;
  return (
    <div className={cn("flex gap-1", className)} role="img" aria-label={stage ?? "Not placed yet"}>
      {STAGES.map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= idx ? "bg-current" : "bg-current opacity-20")} />)}
    </div>
  );
}

/** A tappable row: icon, two lines, chevron. The standard list item across the app. */
export function Row({ href, icon, title, sub, right, className }: { href: string; icon?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-muted/60", className)}>
      {icon ? <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{title}</span>
        {sub ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{sub}</span> : null}
      </span>
      {right}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** Honest empty state: what is missing, why, and the one thing to do. */
export function Empty({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/60 px-5 py-9 text-center">
      <div className="text-base font-bold">{title}</div>
      {sub ? <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{sub}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A section that stays closed until you want it, so secondary tools never crowd the main decision. Cards inside are flattened (no card in a card). */
export function Collapse({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.9375rem] font-bold [&::-webkit-details-marker]:hidden">
        {title}<ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t px-4 py-4 [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:rounded-none [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:p-0">{children}</div>
    </details>
  );
}
