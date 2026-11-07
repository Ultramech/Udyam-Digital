"use client";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { Mark } from "@/components/brand";
import { cn } from "@/lib/utils";

/** Full-screen frame for the start screens: soft pink wash, a centred phone-width column and a pink wave at the foot. */
export function AuthScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[linear-gradient(180deg,var(--card)_0%,var(--card)_55%,var(--accent)_100%)]">
      <Wave />
      <div className={cn("relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-5", className)}>{children}</div>
    </div>
  );
}

function Wave() {
  return (
    <svg aria-hidden viewBox="0 0 400 140" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full text-primary/10">
      <path d="M0 70C70 20 130 20 200 62s140 50 200 0v78H0z" fill="currentColor" />
      <path d="M0 100c80-40 150-20 220 10s120 20 180-14v44H0z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="-ml-2 inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-black/5">
      <ArrowLeft className="size-6" aria-hidden />
    </button>
  );
}

/** airtel | SYNC wordmark, as on the reference screens. */
export function Wordmark({ tone = "red", size = "md" }: { tone?: "red" | "white"; size?: "md" | "lg" }) {
  const white = tone === "white";
  return (
    <span className="inline-flex items-center gap-2.5 leading-none">
      <Mark tone={tone} className={size === "lg" ? "size-14" : "size-9"} />
      <span className={cn("font-extrabold lowercase tracking-tight", size === "lg" ? "text-[2.25rem]" : "text-[1.625rem]", white ? "text-white" : "text-primary")}>airtel</span>
      <span aria-hidden className={cn("w-px", size === "lg" ? "h-9" : "h-7", white ? "bg-white/60" : "bg-foreground/30")} />
      <span className={cn("font-extrabold tracking-tight", size === "lg" ? "text-[2.25rem]" : "text-[1.5rem]", white ? "text-white" : "text-foreground")}>SYNC</span>
    </span>
  );
}

/** Three-step progress, red up to the current step. */
export function Segments({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-foreground/10")} />)}
    </div>
  );
}

/**
 * A rounded field with a leading icon and a small label above the value, as on the reference. The control inside is a plain
 * input or select (pass `control`), so ids, labels and validation attributes stay with the caller.
 */
export function IconField({ id, label, icon: Icon, error, select, children }: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; error?: string; select?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn("flex items-center gap-3 rounded-2xl border bg-card px-4 py-2.5 shadow-card transition focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/25", error && "border-destructive")}>
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-xs text-muted-foreground">{label}</label>
          <div className="[&_input]:w-full [&_input]:bg-transparent [&_input]:text-base [&_input]:font-semibold [&_input]:outline-none [&_select]:w-full [&_select]:appearance-none [&_select]:bg-transparent [&_select]:text-base [&_select]:font-semibold [&_select]:outline-none">{children}</div>
        </div>
        {select && <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
      </div>
      {error && <p id={`${id}-err`} role="alert" className="mt-1.5 px-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

/** India flag, drawn inline (no image asset): saffron, white with a navy wheel, green. */
export function Flag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={cn("h-5 w-7 shrink-0 rounded-[3px] shadow-sm", className)} aria-hidden>
      <rect width="30" height="7" fill="#FF9933" /><rect y="7" width="30" height="6" fill="#fff" /><rect y="13" width="30" height="7" fill="#138808" />
      <circle cx="15" cy="10" r="2.4" fill="none" stroke="#000080" strokeWidth="0.7" />
    </svg>
  );
}
