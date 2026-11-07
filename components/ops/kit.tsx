"use client";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "./charts";
import { cn } from "@/lib/utils";

/** Page header: big title, one-line purpose, actions on the right. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0"><h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">{title}</h1>{sub && <p className="mt-1 max-w-3xl text-[0.9375rem] text-muted-foreground">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** One headline number: icon, label, value (label and value are consecutive siblings), optional real trend line. */
export function Kpi({ icon: Icon, label, value, sub, spark, className }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string; spark?: number[]; className?: string }) {
  return (
    <Card className={cn("relative gap-0 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.8125rem] font-medium leading-tight text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-[1.625rem] font-extrabold leading-tight tracking-tight tabular-nums">{value}</div>
        </div>
      </div>
      {sub && <div className="mt-1 pl-[3.25rem] text-xs leading-snug text-muted-foreground">{sub}</div>}
      {spark && spark.length > 1 && <div className="pointer-events-none mt-1 h-8 w-full opacity-90"><Sparkline data={spark} /></div>}
    </Card>
  );
}

/** A titled card for a chart or table. */
export function Panel({ title, sub, action, children, className, bodyClass }: { title?: React.ReactNode; sub?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string }) {
  return (
    <Card className={cn("gap-0 p-0", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
          <div className="min-w-0"><h2 className="text-[1.0625rem] font-bold leading-tight">{title}</h2>{sub && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{sub}</p>}</div>
          {action}
        </div>
      )}
      <div className={cn("px-5 pb-5 pt-3", bodyClass)}>{children}</div>
    </Card>
  );
}

const TONES = { red: "bg-[oklch(0.97_0.02_20)]", amber: "bg-[oklch(0.975_0.035_75)]", green: "bg-[oklch(0.965_0.035_160)]", blue: "bg-[oklch(0.965_0.02_245)]" } as const;
const ICON_TONES = { red: "text-primary bg-primary/10", amber: "text-[oklch(0.55_0.13_65)] bg-[oklch(0.55_0.13_65)]/12", green: "text-success bg-success/12", blue: "text-info bg-info/12" } as const;
/** A one-sentence takeaway computed from the data on the page. */
export function Insight({ icon: Icon, tone = "red", title, children }: { icon: React.ComponentType<{ className?: string }>; tone?: keyof typeof TONES; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-3.5 rounded-2xl p-4", TONES[tone])}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", ICON_TONES[tone])}><Icon className="size-5" /></span>
      <div className="min-w-0"><div className="font-bold leading-snug">{title}</div><p className="mt-0.5 text-[0.8125rem] leading-snug text-foreground/75">{children}</p></div>
    </div>
  );
}

/** Pill tabs / segmented control. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full bg-card p-1 shadow-card">
      {options.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} type="button" onClick={() => onChange(k)} className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition-colors", value === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
    </div>
  );
}

export const selectCls = "h-11 rounded-2xl border border-input bg-card px-4 pr-9 text-sm font-medium shadow-card outline-none transition focus:border-primary focus:ring-3 focus:ring-ring/25";

/** Client-side CSV download of exactly what is on screen. */
export function ExportButton({ rows, name }: { rows: () => (string | number)[][]; name: string }) {
  return (
    <button type="button" onClick={() => {
      const esc = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const blob = new Blob([rows().map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-input bg-card px-5 text-sm font-semibold shadow-card transition hover:bg-muted">
      <Download className="size-4" />Export
    </button>
  );
}

export function Pill({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "red" | "green" | "amber" | "blue"; className?: string }) {
  const t = { neutral: "bg-muted text-muted-foreground", red: "bg-primary/10 text-primary", green: "bg-success/12 text-success", amber: "bg-warning/15 text-warning", blue: "bg-info/12 text-info" }[tone];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", t, className)}>{children}</span>;
}

/** Details that stay out of the way until asked for. */
export function More({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-card shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[0.9375rem] font-bold [&::-webkit-details-marker]:hidden">{summary}<span className="text-xs font-semibold text-primary group-open:hidden">Show</span><span className="hidden text-xs font-semibold text-primary group-open:inline">Hide</span></summary>
      <div className="border-t px-5 pb-5 pt-4">{children}</div>
    </details>
  );
}
