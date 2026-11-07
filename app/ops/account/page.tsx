"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OpsShell, useStaff } from "@/components/ops/shell";
import { api, ApiError } from "@/lib/client/api";

export default function StaffAccount() {
  const me = useStaff();
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  async function save() {
    if (f.next !== f.again) { toast.error("The new passwords don't match."); return; }
    setBusy(true);
    try { await api("POST", "/api/ops/password", { current: f.current, next: f.next }); toast.success("Password changed."); setF({ current: "", next: "", again: "" }); window.location.reload(); }
    catch (e) { const c = e instanceof ApiError ? e.code : ""; toast.error(c === "INVALID_CREDENTIALS" ? "Current password is wrong." : c === "PASSWORD_TOO_SHORT" ? "Use at least 10 characters." : "Couldn't change the password."); }
    setBusy(false);
  }
  return (
    <OpsShell>
      <div className="max-w-md space-y-4">
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">My account</h1>
        {me && <Card className="p-4 text-sm"><div className="font-semibold">{me.name}</div><div className="text-muted-foreground">{me.email} · <span className="capitalize">{me.role}</span></div></Card>}
        {me?.isDemo ? <Card className="p-4 text-sm text-muted-foreground">Demo accounts have no password; they work only while DEMO_MODE is on.</Card> : (
          <Card className="space-y-3 p-4">
            <div className="text-sm font-semibold">Change password</div>
            <div className="space-y-1.5"><Label htmlFor="cur">Current password</Label><Input id="cur" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="new">New password (10+ characters)</Label><Input id="new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="again">New password again</Label><Input id="again" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></div>
            <Button disabled={busy || !f.current || f.next.length < 10} onClick={save}>Change password</Button>
          </Card>
        )}
      </div>
    </OpsShell>
  );
}
