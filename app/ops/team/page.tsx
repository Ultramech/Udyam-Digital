"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsShell, useStaff } from "@/components/ops/shell";
import { api, ApiError } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";

type Role = "rep" | "partner" | "ops" | "admin";
interface Member { id: string; name: string; email?: string; role: Role; active: boolean; isDemo?: boolean; hasPassword: boolean; lastLoginAt: number | null; createdAt: number }
const ROLES: Role[] = ["rep", "partner", "ops", "admin"];
const ERR: Record<string, string> = { EMAIL_TAKEN: "That email already has an account.", PASSWORD_TOO_SHORT: "Use at least 10 characters.", CANNOT_DEMOTE_SELF: "You can't remove your own admin access.", FORBIDDEN: "Only admins manage the team." };

export default function Team() {
  const me = useStaff();
  const [rows, setRows] = useState<Member[] | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "rep" as Role, password: "" });
  const load = useCallback(() => api<{ staff: Member[] }>("GET", "/api/ops/team").then((r) => setRows(r.staff)).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); load(); } catch (e) { toast.error(ERR[e instanceof ApiError ? e.code : ""] ?? "Couldn't save."); }
  };
  const tempPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

  return (
    <OpsShell>
      <div className="max-w-4xl space-y-4">
        <div><h1 className="text-xl font-bold">Team</h1><p className="text-sm text-muted-foreground">Staff and partner accounts. New accounts get a temporary password and must set their own at first sign-in. Deactivating or resetting a password ends that person&apos;s sessions immediately.</p></div>
        <Card className="space-y-3 p-4">
          <div className="text-sm font-semibold">Add a person</div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Full name" />
            <Input placeholder="Work email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Work email" />
            <select className="h-9 rounded-md border bg-card px-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} aria-label="Role">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
            <div className="flex gap-1"><Input placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label="Temporary password" /><Button variant="outline" size="sm" className="h-9" onClick={() => setForm({ ...form, password: tempPassword() })}>Generate</Button></div>
          </div>
          <Button disabled={form.name.trim().length < 2 || !form.email.includes("@") || form.password.length < 10} onClick={() => act(async () => { await api("POST", "/api/ops/team", form); setForm({ name: "", email: "", role: "rep", password: "" }); }, `Account created — share the temporary password with ${form.name} securely.`)}>Create account</Button>
        </Card>
        {!rows ? <Skeleton className="h-48" /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-[11px] text-muted-foreground">{["Person", "Role", "Status", "Last sign-in", ""].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{rows.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2"><div className="font-medium">{m.name}{m.isDemo && <Badge variant="outline" className="ml-1.5">demo</Badge>}</div><div className="text-xs text-muted-foreground">{m.email}</div></td>
                  <td className="px-3"><select className="h-8 rounded-md border bg-card px-1.5 text-sm" value={m.role} disabled={m.isDemo || m.id === me?.id} onChange={(e) => act(() => api("PATCH", `/api/ops/team/${m.id}`, { role: e.target.value }), "Role updated")} aria-label={`${m.name} role`}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></td>
                  <td className="px-3"><Badge variant={m.active ? "default" : "secondary"}>{m.active ? "active" : "deactivated"}</Badge></td>
                  <td className="px-3 text-xs">{m.lastLoginAt ? fmtTime(m.lastLoginAt) : "never"}</td>
                  <td className="space-x-1 whitespace-nowrap px-3">
                    {!m.isDemo && m.id !== me?.id && <Button size="sm" variant="ghost" onClick={() => act(() => api("PATCH", `/api/ops/team/${m.id}`, { active: !m.active }), m.active ? "Deactivated — sessions ended" : "Reactivated")}>{m.active ? "Deactivate" : "Reactivate"}</Button>}
                    {!m.isDemo && <Button size="sm" variant="ghost" onClick={() => { const pw = tempPassword(); act(() => api("PATCH", `/api/ops/team/${m.id}`, { password: pw }), `Temporary password for ${m.name}: ${pw}`); }}>Reset password</Button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        )}
      </div>
    </OpsShell>
  );
}
