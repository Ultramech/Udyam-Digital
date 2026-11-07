"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mark } from "@/components/brand";
import { BarChart3, ClipboardCheck, Package, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/client/api";
import type { Staff } from "@/components/ops/shell";

const BLURB: Record<string, string> = {
  rep: "Sees only their own leads. Can't review KYC.", partner: "Channel partner: own leads, assisted installs.",
  ops: "KYC review and order operations (can advance orders).", admin: "Everything, including team and demo controls.",
};

export default function OpsLogin() {
  const router = useRouter();
  const [dir, setDir] = useState<Staff[]>([]);
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ directory: Staff[]; demoMode: boolean }>("GET", "/api/ops/session").then((r) => { setDir(r.directory); setDemo(r.demoMode); }).catch(() => {}); }, []);

  async function login(body: Record<string, string>) {
    setBusy(true);
    try { await api("POST", "/api/ops/session", body); router.push("/ops"); }
    catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast.error(c === "INVALID_CREDENTIALS" ? "Email or password is wrong." : c === "TOO_MANY_ATTEMPTS" ? `Too many attempts. Try again in ${Math.ceil(Number(e instanceof ApiError ? e.data.retryAfterSec : 900) / 60)} minutes.` : c === "DEMO_LOGIN_DISABLED" ? "Demo accounts are disabled on this deployment." : "Couldn't sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="light grid min-h-screen bg-[linear-gradient(180deg,oklch(0.988_0.004_20),oklch(0.968_0.016_20))] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* brand panel: laptop and wider */}
      <aside className="relative hidden overflow-hidden bg-[radial-gradient(120%_80%_at_20%_0%,oklch(0.64_0.25_27),oklch(0.46_0.21_27)_70%,oklch(0.36_0.17_27))] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-72 w-full"><path d="M0 150C80 90 150 90 220 140s130 60 180 10v150H0z" fill="#fff" opacity="0.07" /><path d="M0 200c90-60 170-30 240 20s110 30 160-10v90H0z" fill="#fff" opacity="0.08" /></svg>
        <span className="relative flex items-center gap-3 leading-none"><Mark tone="white" className="size-12" /><span className="text-[2rem] font-extrabold lowercase tracking-tight">airtel</span><span aria-hidden className="h-8 w-px bg-white/60" /><span className="text-[2rem] font-extrabold tracking-tight">SYNC</span></span>
        <div className="relative max-w-md">
          <h2 className="text-[2.5rem] font-extrabold leading-[1.1] tracking-tight">Operations console</h2>
          <p className="mt-3 text-lg text-white/85">For Accel Business staff and channel partners.</p>
          <ul className="mt-8 space-y-4 text-[1.0625rem] font-medium">
            {[[BarChart3, "Live funnel, analytics and the segment playbook"], [ClipboardCheck, "KYC review with the reasons for every flag"], [Package, "Orders, installs and delays in one board"], [ShieldCheck, "Role-based access, every action in the audit log"]].map(([I, t]) => { const Icon = I as typeof BarChart3; return <li key={String(t)} className="flex items-center gap-3.5"><span className="grid size-10 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Icon className="size-5" /></span>{String(t)}</li>; })}
          </ul>
        </div>
        <span className="relative text-sm text-white/70">Prototype · synthetic data</span>
      </aside>

      <main className="flex items-center justify-center p-6 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden"><span className="flex items-center gap-2.5 leading-none"><Mark className="size-9" /><span className="text-[1.625rem] font-extrabold lowercase tracking-tight text-primary">airtel</span><span aria-hidden className="h-7 w-px bg-foreground/25" /><span className="text-[1.5rem] font-extrabold tracking-tight">SYNC</span></span></div>
          <div><h1 className="text-[1.875rem] font-extrabold leading-tight tracking-tight">Sign in</h1><p className="mt-1 text-[0.9375rem] text-muted-foreground">Use your work email. Accounts are created by an admin under Team.</p></div>
          <form className="space-y-4 rounded-3xl bg-card p-6 shadow-card" onSubmit={(e) => { e.preventDefault(); login({ email, password }); }}>
            <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-2xl" /></div>
            <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-2xl" /></div>
            <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base shadow-lift" disabled={busy || !email || !password}>Sign in</Button>
            <p className="text-xs text-muted-foreground">Five wrong attempts lock the account for 15 minutes.</p>
          </form>
          {demo && dir.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-sm font-bold text-muted-foreground">Demo accounts <span className="font-normal">(DEMO_MODE is on)</span></div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {dir.map((s) => (
                  <button key={s.id} type="button" disabled={busy} onClick={() => login({ id: s.id })} className="rounded-2xl bg-card p-3.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60">
                    <div className="flex items-center justify-between gap-2"><span className="font-bold">{s.name}</span><span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold capitalize text-primary">{s.role}</span></div>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{BLURB[s.role]}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
