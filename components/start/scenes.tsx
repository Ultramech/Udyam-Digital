"use client";
import { Check, Cloud, Phone, ShieldCheck, Sparkles, Truck, Wifi } from "lucide-react";
import { Mark } from "@/components/brand";
import { cn } from "@/lib/utils";

/** The three welcome scenes. Pure CSS/SVG compositions (no photos), each with its own colour world and its own layout. */
const frame = "relative isolate h-[17.5rem] w-full overflow-hidden rounded-[2rem]";
const delay = (s: number) => ({ animationDelay: `${s}s` });

/** 1 · Connectivity: the Airtel mark at the centre of expanding signal rings, with the four things a business needs orbiting it. */
export function ConnectScene({ label }: { label: string }) {
  const orbit = [
    { Icon: Wifi, pos: "left-7 top-7", d: 0 }, { Icon: ShieldCheck, pos: "right-7 top-10", d: 0.9 },
    { Icon: Cloud, pos: "left-10 bottom-12", d: 1.7 }, { Icon: Phone, pos: "right-9 bottom-9", d: 0.4 },
  ];
  return (
    <div className={cn(frame, "bg-[radial-gradient(90%_95%_at_50%_30%,oklch(0.66_0.24_27),oklch(0.46_0.21_27))]")} role="img" aria-label={label}>
      <div className="absolute -right-10 -top-10 size-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
      {[0, 1.2, 2.4].map((d) => <div key={d} className="absolute inset-0 grid place-items-center" aria-hidden><span className="ud-ping size-64 rounded-full border border-white/45" style={delay(d)} /></div>)}
      <div className="absolute inset-0 grid place-items-center" aria-hidden>
        <span className="grid size-24 place-items-center rounded-full bg-white shadow-lift ring-8 ring-white/20"><Mark className="size-14" /></span>
      </div>
      {orbit.map(({ Icon, pos, d }) => (
        <span key={pos} aria-hidden className={cn("ud-float absolute grid size-12 place-items-center rounded-2xl bg-white/90 text-primary shadow-card backdrop-blur", pos)} style={delay(d)}><Icon className="size-6" /></span>
      ))}
      <span aria-hidden className="absolute bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 backdrop-blur">Fibre · 5G · Calling · Cloud</span>
    </div>
  );
}

/** 2 · Your language, one price: a chat where the owner writes in Hindi and the advisor answers with a plan. */
export function ChatScene({ label, user, plan, price }: { label: string; user: string; plan: string; price: string }) {
  return (
    <div className={cn(frame, "bg-[linear-gradient(160deg,var(--accent),oklch(0.975_0.02_310))] px-4 pt-5")} role="img" aria-label={label}>
      <div className="absolute -left-12 bottom-0 size-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="relative space-y-3" aria-hidden>
        <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[0.9375rem] font-medium shadow-card">{user}</p>
        <div className="ud-float max-w-[88%] rounded-2xl rounded-bl-md bg-[linear-gradient(135deg,oklch(0.62_0.24_27),oklch(0.48_0.22_27))] p-3.5 text-white shadow-lift">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80"><Sparkles className="size-3.5" />AI advisor</p>
          <p className="mt-1 text-lg font-extrabold leading-tight">{plan}</p>
          <p className="mt-0.5 text-sm text-white/90">{price}</p>
        </div>
      </div>
      <div className="absolute inset-x-4 bottom-4 flex gap-2" aria-hidden>
        {["EN", "हिं", "मरा", "தமி"].map((l, i) => <span key={l} className={cn("flex-1 rounded-full py-1.5 text-center text-xs font-bold", i === 1 ? "bg-primary text-primary-foreground shadow-card" : "bg-white/80 text-foreground/70")}>{l}</span>)}
      </div>
    </div>
  );
}

/** 3 · Buy, sign, track: the order tracker on a dark stage, two steps done and the installation in progress. */
export function TrackScene({ label, rows, eta }: { label: string; rows: [string, string, string]; eta: string }) {
  return (
    <div className={cn(frame, "flex items-center bg-[linear-gradient(165deg,oklch(0.3_0.02_20),oklch(0.17_0.014_20))] px-5 pt-5")} role="img" aria-label={label}>
      <div className="absolute -right-8 -top-8 size-44 rounded-full bg-primary/40 blur-3xl" aria-hidden />
      <span aria-hidden className="ud-float absolute right-4 top-3.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-foreground shadow-lift"><Truck className="size-3.5 text-primary" />{eta}</span>
      <div className="relative w-full rounded-2xl bg-white p-4 shadow-lift" aria-hidden>
        <ul className="space-y-3.5">
          {rows.slice(0, 2).map((r) => (
            <li key={r} className="flex items-center gap-3 text-[0.9375rem] font-semibold"><span className="grid size-7 place-items-center rounded-full bg-success text-white"><Check className="size-4" /></span>{r}<span className="ml-auto text-xs font-medium text-success">✓</span></li>
          ))}
          <li>
            <div className="flex items-center gap-3 text-[0.9375rem] font-semibold"><span className="ud-pulse grid size-7 place-items-center rounded-full bg-primary"><span className="size-2 rounded-full bg-white" /></span>{rows[2]}</div>
            <div className="ml-10 mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10"><span className="block h-full w-3/5 rounded-full bg-primary" /></div>
          </li>
        </ul>
      </div>
    </div>
  );
}
