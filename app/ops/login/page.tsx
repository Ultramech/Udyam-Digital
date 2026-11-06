"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";
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
    <div className="mx-auto max-w-md space-y-5 p-6 pt-16">
      <Logo />
      <div><h1 className="text-2xl font-bold">Operations console</h1><p className="text-sm text-muted-foreground">For Accel Business staff and channel partners.</p></div>
      <Card className="space-y-3 p-4">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); login({ email, password }); }}>
          <div className="space-y-1.5"><Label htmlFor="email">Work email</Label><Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" className="w-full" disabled={busy || !email || !password}>Sign in</Button>
        </form>
        <p className="text-[11px] text-muted-foreground">Accounts are created by an admin under Team. Five wrong attempts lock the account for 15 minutes.</p>
      </Card>
      {demo && dir.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Demo accounts (DEMO_MODE is on)</div>
          {dir.map((s) => (
            <button key={s.id} type="button" disabled={busy} onClick={() => login({ id: s.id })} className="w-full text-left">
              <Card className="p-3.5 transition-colors hover:border-primary"><div className="flex items-center justify-between"><span className="font-medium">{s.name}</span><Badge variant="secondary" className="capitalize">{s.role}</Badge></div><p className="mt-0.5 text-xs text-muted-foreground">{BLURB[s.role]}</p></Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
