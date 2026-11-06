"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Compass, LineChart, Building2, ClipboardCheck, FlaskConical, Handshake, LifeBuoy, LogOut, UserCog, Package, ScrollText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand";
import { DemoDrawer } from "@/components/demo-drawer";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export interface Staff { id: string; name: string; role: "rep" | "partner" | "ops" | "admin"; email?: string; isDemo?: boolean; mustChangePassword?: boolean }

const NAV = [
  { href: "/ops", label: "Overview", icon: BarChart3, roles: ["rep", "partner", "ops", "admin"] },
  { href: "/ops/analytics", label: "Analytics", icon: LineChart, roles: ["rep", "ops", "admin"] },
  { href: "/ops/playbook", label: "Playbook", icon: Compass, roles: ["rep", "ops", "admin"] },
  { href: "/ops/leads", label: "Leads", icon: Users, roles: ["rep", "partner", "ops", "admin"] },
  { href: "/ops/kyc", label: "KYC review", icon: ClipboardCheck, roles: ["ops", "admin"] },
  { href: "/ops/orders", label: "Orders", icon: Package, roles: ["rep", "partner", "ops", "admin"] },
  { href: "/ops/customers", label: "Customers", icon: Building2, roles: ["rep", "ops", "admin"] },
  { href: "/ops/support", label: "Support", icon: LifeBuoy, roles: ["rep", "ops", "admin"] },
  { href: "/ops/partners", label: "Partner book", icon: Handshake, roles: ["partner", "ops", "admin"] },
  { href: "/ops/catalogue", label: "Catalogue", icon: BookOpen, roles: ["ops", "admin"] },
  { href: "/ops/audit", label: "Audit log", icon: ScrollText, roles: ["admin"] },
  { href: "/ops/team", label: "Team", icon: UserCog, roles: ["admin"] },
  { href: "/ops/lab", label: "Scenario Lab", icon: FlaskConical, roles: ["rep", "partner", "ops", "admin"] },
] as const;

export function useStaff() {
  const [staff, setStaff] = useState<Staff | null | undefined>(undefined);
  useEffect(() => { api<{ staff: Staff | null }>("GET", "/api/ops/session").then((r) => setStaff(r.staff)).catch(() => setStaff(null)); }, []);
  return staff;
}

/** Desktop-first, dense and scannable. Role decides what appears; the server enforces it again on every call. */
export function OpsShell({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (staff === null) router.replace("/ops/login"); }, [staff, router]);
  if (!staff) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const nav = NAV.filter((n) => (n.roles as readonly string[]).includes(staff.role));
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b bg-card md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 p-3 md:block md:space-y-4 md:p-4">
          <Link href="/ops"><Logo /></Link>
          <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Operations">
            {nav.map((n) => {
              const active = n.href === "/ops" ? path === "/ops" : path.startsWith(n.href);
              return <Link key={n.href} href={n.href} className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm", active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted")}><n.icon className="size-4" />{n.label}</Link>;
            })}
          </nav>
          <div className="hidden space-y-2 border-t pt-3 text-xs md:block">
            <div><Link href="/ops/account" className="font-medium hover:underline">{staff.name}</Link><div className="flex gap-1"><Badge variant="secondary" className="mt-0.5 capitalize">{staff.role}</Badge>{staff.isDemo && <Badge variant="outline" className="mt-0.5">demo</Badge>}</div></div>
            <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={async () => { await api("DELETE", "/api/ops/session"); router.replace("/ops/login"); }}><LogOut className="size-3.5" />Sign out</Button>
            <Link href="/" className="block text-muted-foreground underline-offset-4 hover:underline">Customer app →</Link>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">
        {staff.mustChangePassword && !path.startsWith("/ops/account") && (
          <div className="mb-4 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">You&apos;re using a temporary password. <Link href="/ops/account" className="font-medium text-primary underline">Set your own password</Link> before continuing.</div>
        )}
        {children}
      </main>
      <DemoDrawer />
    </div>
  );
}

export const NEXT_ACTION: Record<string, string> = {
  SEND_PLAN_LINK: "Send plan link", REQUEST_KYC_DOC: "Request missing KYC document", SCHEDULE_CALLBACK: "Schedule a callback", CHECK_FEASIBILITY: "Check feasibility",
  ASSIGN_FIELD_REP: "Assign field representative", COMPLETE_INSTALL: "Complete installation", REVIEW_KYC: "Review KYC", OFFER_BUDGET_PLAN: "Offer a budget plan",
  SEND_PAYMENT_LINK: "Send payment link", COMPLETE_INSTALL_DONE: "—",
};
