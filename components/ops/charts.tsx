"use client";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Small SVG/HTML charts for the operations console (no chart library). Everything is drawn from the numbers passed in:
 * nothing here invents or smooths data beyond the line's curve.
 */
const RED = "oklch(0.56 0.235 27)";

/** Tiny trend line for a KPI card. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const id = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 28 - ((v - min) / span) * 22] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={RED} stopOpacity="0.28" /><stop offset="1" stopColor={RED} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L100 32 L0 32Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke={RED} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const niceStep = (range: number, ticks: number) => { const raw = range / ticks, mag = 10 ** Math.floor(Math.log10(raw || 1)), n = raw / mag; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag; };

/** Smooth area/line chart with gridlines, a hover read-out and the latest value called out. */
export function AreaChart({ data, format = (n) => String(n), height = 215, unit = "" }: { data: { label: string; value: number }[]; format?: (n: number) => string; height?: number; unit?: string }) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div className="grid h-40 place-items-center text-sm text-muted-foreground">Not enough data</div>;
  const W = 420, H = height, L = 40, R = 14, T = 18, B = 28;
  const vals = data.map((d) => d.value);
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const step = niceStep(Math.max(hi0 - lo0, hi0 * 0.2, 1), 4);
  const lo = Math.max(0, Math.floor((lo0 - step * 0.5) / step) * step), hi = Math.ceil((hi0 + step * 0.5) / step) * step;
  const ticks: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6));
  const x = (i: number) => L + (i / (data.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const curve = pts.map(([px, py], i) => {
    if (!i) return `M${px} ${py}`;
    const [x0, y0] = pts[i - 1], dx = (px - x0) / 2.2;
    return `C${x0 + dx} ${y0} ${px - dx} ${py} ${px} ${py}`;
  }).join(" ");
  const active = hover ?? data.length - 1;
  const [ax, ay] = pts[active];
  const tip = `${format(data[active].value)}${unit}${hover !== null ? ` · ${data[active].label}` : ""}`;
  const tw = tip.length * 7.6 + 20, tx = Math.min(Math.max(ax - tw / 2, L), W - R - tw);
  const every = Math.ceil(data.length / 5);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img" aria-label={`Line chart, latest ${tip} (${data[data.length - 1].label})`}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHover(Math.min(data.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (data.length - 1))))); }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={RED} stopOpacity="0.22" /><stop offset="1" stopColor={RED} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-border" strokeDasharray="3 5" /><text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground">{format(t)}{unit}</text></g>))}
      {data.map((d, i) => (i % every === 0 || i === data.length - 1) && <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" className="fill-muted-foreground">{d.label}</text>)}
      <path d={`${curve} L${x(data.length - 1)} ${H - B} L${x(0)} ${H - B}Z`} fill={`url(#${id})`} />
      <path d={curve} fill="none" stroke={RED} strokeWidth="2.6" strokeLinecap="round" />
      {hover !== null && <line x1={ax} x2={ax} y1={T} y2={H - B} stroke={RED} strokeOpacity="0.25" />}
      <circle cx={ax} cy={ay} r="6" fill="#fff" stroke={RED} strokeWidth="3" />
      <g transform={`translate(${tx} ${Math.max(2, ay - 40)})`}><rect width={tw} height="27" rx="13.5" fill={RED} /><text x={tw / 2} y="18" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{tip}</text></g>
    </svg>
  );
}

/** Horizontal bars, strongest first in solid red and fading down the list. */
export function HBars({ rows, fmt = (n) => n.toLocaleString("en-IN"), empty = "No data" }: { rows: { label: string; value: number; note?: string }[]; fmt?: (n: number) => string; empty?: string }) {
  if (!rows.length) return <div className="py-6 text-center text-sm text-muted-foreground">{empty}</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${fmt(r.value)}${r.note ? ` · ${r.note}` : ""}`} className="grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
          <span className="line-clamp-2 font-medium leading-tight text-foreground/80">{r.label}</span>
          <span className="h-3.5 overflow-hidden rounded-full bg-primary/[0.07]"><span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: RED, opacity: 0.35 + 0.65 * (r.value / max) }} /></span>
          <span className="min-w-[3.5rem] text-right font-semibold tabular-nums">{fmt(r.value)}{r.note ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{r.note}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Conversion funnel drawn as stacked trapezoids, widest first; counts and step conversion sit to the right. */
export function Funnel({ stages }: { stages: { stage: string; value: number; step?: number | null }[] }) {
  const max = Math.max(1, stages[0]?.value ?? 1);
  const w = (v: number) => 50 + (v / max) * 50; // never narrower than 50% so the label sits inside the shape
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-x-4">
      <ul className="space-y-1">
        {stages.map((s, i) => {
          const a = w(s.value), b = i < stages.length - 1 ? w(stages[i + 1].value) : a * 0.86;
          const lA = (100 - a) / 2, rA = 100 - lA, lB = (100 - b) / 2, rB = 100 - lB;
          const shade = 1 - (i / Math.max(1, stages.length - 1)) * 0.72;
          return (
            <li key={s.stage} className="relative grid h-11 place-items-center">
              <span aria-hidden className="absolute inset-0" style={{ clipPath: `polygon(${lA}% 0,${rA}% 0,${rB}% 100%,${lB}% 100%)`, background: `color-mix(in oklch, ${RED} ${Math.round(shade * 100)}%, white)` }} />
              <span className="relative whitespace-nowrap px-2 text-[0.8125rem] font-semibold" style={{ color: shade > 0.55 ? "#fff" : "oklch(0.3 0.08 27)" }}>{s.stage}</span>
            </li>
          );
        })}
      </ul>
      <ul className="space-y-1">
        {stages.map((s) => (
          <li key={s.stage} className="flex h-11 items-center justify-end gap-2 text-right"><b className="text-[0.9375rem] tabular-nums">{s.value.toLocaleString("en-IN")}</b><span className="w-11 text-xs tabular-nums text-muted-foreground">{s.step != null ? `${s.step}%` : ""}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Donut with a centre read-out. */
export function Donut({ parts, centre, sub, size = 150 }: { parts: { label: string; value: number; color: string }[]; centre: string; sub?: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const arcs = parts.map((p, i) => ({ ...p, len: (p.value / total) * 87.96, from: parts.slice(0, i).reduce((s, q) => s + (q.value / total) * 87.96, 0) }));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" className="text-primary/[0.08]" strokeWidth="5" />
        {arcs.map((a) => <circle key={a.label} cx="18" cy="18" r="14" fill="none" stroke={a.color} strokeWidth="5" strokeDasharray={`${Math.max(0, a.len - 0.6)} ${87.96 - Math.max(0, a.len - 0.6)}`} strokeDashoffset={-a.from} />)}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-extrabold leading-none">{centre}</div>{sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}</div></div>
    </div>
  );
}

/** A thin progress bar for "baseline vs target" style rows. */
export function Meter({ value, max = 100, tone = "red" }: { value: number; max?: number; tone?: "red" | "green" | "amber" }) {
  const c = tone === "green" ? "var(--success)" : tone === "amber" ? "var(--warning)" : RED;
  return <span className="block h-2 overflow-hidden rounded-full bg-foreground/[0.07]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, (value / max) * 100))}%`, background: c }} /></span>;
}

/** Brand-led palette for categories: red first, then warm and cool accents that stay distinguishable. */
export const PALETTE = ["oklch(0.56 0.235 27)", "oklch(0.74 0.16 60)", "oklch(0.5 0.12 160)", "oklch(0.5 0.12 245)", "oklch(0.35 0.012 60)", "oklch(0.8 0.09 25)", "oklch(0.62 0.14 305)"] as const;
export const colorAt = (i: number) => PALETTE[i % PALETTE.length];

export function Legend({ items }: { items: { label: string; value?: string | number; color: string }[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2.5"><span className="size-3 shrink-0 rounded-full" style={{ background: i.color }} /><span className="min-w-0 truncate text-muted-foreground">{i.label}</span>{i.value !== undefined && <b className="ml-auto pl-2 tabular-nums">{i.value}</b>}</li>
      ))}
    </ul>
  );
}

/** Donut with its legend beside it; parts are coloured from the palette unless a colour is given. */
export function DonutLegend({ parts, centre, sub, size = 132 }: { parts: { label: string; value: number; color?: string }[]; centre: string; sub?: string; size?: number }) {
  const coloured = parts.map((p, i) => ({ ...p, color: p.color ?? colorAt(i) }));
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Donut size={size} centre={centre} sub={sub} parts={coloured} />
      <div className="min-w-[8rem] flex-1"><Legend items={coloured.map((p) => ({ label: p.label, value: p.value.toLocaleString("en-IN"), color: p.color }))} /></div>
    </div>
  );
}

/** One horizontal bar split into proportional parts (a 100% stack), with a legend underneath. */
export function StackBar({ parts, height = 14 }: { parts: { label: string; value: number; color?: string }[]; height?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const coloured = parts.map((p, i) => ({ ...p, color: p.color ?? colorAt(i) }));
  if (!total) return <div className="py-4 text-center text-sm text-muted-foreground">No data</div>;
  return (
    <div>
      <div className="flex overflow-hidden rounded-full bg-primary/[0.07]" style={{ height }} role="img" aria-label={coloured.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {coloured.filter((p) => p.value > 0).map((p) => <span key={p.label} title={`${p.label}: ${p.value}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} className="first:rounded-l-full last:rounded-r-full" />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {coloured.map((p) => <li key={p.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: p.color }} /><span className="text-muted-foreground">{p.label}</span><b className="tabular-nums">{p.value.toLocaleString("en-IN")}</b></li>)}
      </ul>
    </div>
  );
}

/** Vertical columns for a short ordered series (days, weeks, stages, age buckets). */
export function ColumnChart({ data, format = (n) => n.toLocaleString("en-IN"), height = 190, highlight }: { data: { label: string; value: number }[]; format?: (n: number) => string; height?: number; highlight?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="grid h-32 place-items-center text-sm text-muted-foreground">No data</div>;
  const W = 420, H = height, L = 8, R = 8, T = 22, B = 34;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (W - L - R) / data.length, bw = Math.min(40, slot * 0.62);
  const every = Math.ceil(data.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full select-none" role="img" aria-label={`Column chart: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`} onMouseLeave={() => setHover(null)}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="currentColor" className="text-border" />
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * (H - T - B)), x = L + i * slot + (slot - bw) / 2, y = H - B - h;
        const on = hover === i || highlight === i;
        return (
          <g key={d.label + i} onMouseEnter={() => setHover(i)}>
            <rect x={L + i * slot} y={T - 6} width={slot} height={H - T - B + 6} fill="transparent" />
            <rect x={x} y={y} width={bw} height={h} rx={Math.min(8, bw / 2)} fill={RED} opacity={on || hover === null ? 1 : 0.45} />
            {(on || data.length <= 8) && d.value > 0 && <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-foreground">{format(d.value)}</text>}
            {(i % every === 0) && <text x={x + bw / 2} y={H - 12} textAnchor="middle" fontSize="11.5" className="fill-muted-foreground">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** Half-circle gauge for a score out of `max`. */
export function Gauge({ value, max = 100, label, tone = "red" }: { value: number; max?: number; label?: string; tone?: "red" | "green" | "amber" }) {
  const f = Math.min(1, Math.max(0, value / max)), r = 42, len = Math.PI * r;
  const c = tone === "green" ? "var(--success)" : tone === "amber" ? "var(--warning)" : RED;
  return (
    <div className="relative mx-auto w-40">
      <svg viewBox="0 0 100 58" className="w-full" role="img" aria-label={`${label ?? "Score"} ${value} of ${max}`}>
        <path d="M8 50A42 42 0 0 1 92 50" fill="none" stroke="currentColor" className="text-primary/[0.1]" strokeWidth="9" strokeLinecap="round" />
        <path d="M8 50A42 42 0 0 1 92 50" fill="none" stroke={c} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${len * f} ${len}`} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center"><div className="text-3xl font-extrabold leading-none tabular-nums">{value}</div>{label && <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>}</div>
    </div>
  );
}

/** A value on a published band: the track is the allowed range, the marker is where the current value sits, the tick is the original. */
export function BandRange({ min, max, value, original, format = (n) => `₹${n.toLocaleString("en-IN")}` }: { min: number; max: number; value: number; original?: number; format?: (n: number) => string }) {
  const span = Math.max(1, max - min), pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / span) * 100))}%`;
  return (
    <div title={`${format(value)} within ${format(min)}–${format(max)}`}>
      <div className="relative h-2.5 rounded-full bg-primary/[0.1]">
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: pos(value) }} />
        {original !== undefined && <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-foreground/50" style={{ left: pos(original) }} />}
        <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow" style={{ left: pos(value) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{format(min)}</span><span>{format(max)}</span></div>
    </div>
  );
}
