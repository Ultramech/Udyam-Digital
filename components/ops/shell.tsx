"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BookOpen, Compass, LineChart, Building2, ClipboardCheck, FlaskConical, Handshake, LifeBuoy, LogOut, UserCog, Package, ScrollText, Users } from "lucide-react";
import { Mark } from "@/components/brand";
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

/** The staff console: a left sidebar on a laptop, a scrolling pill bar on a phone. Role decides what appears; the server enforces it again on every call. */
export function OpsShell({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (staff === null) router.replace("/ops/login"); }, [staff, router]);
  if (!staff) return <div className="light grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;
  const nav = NAV.filter((n) => (n.roles as readonly string[]).includes(staff.role));
  const signOut = async () => { await api("DELETE", "/api/ops/session"); router.replace("/ops/login"); };
  return (
    <div className="light dense min-h-screen bg-[linear-gradient(180deg,oklch(0.988_0.004_20),oklch(0.968_0.016_20))] lg:pl-64">
      <aside className="border-b bg-card/90 backdrop-blur lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 lg:block lg:px-5 lg:pt-6">
          <Link href="/ops" className="block" aria-label="Operations home">
            <span className="flex items-center gap-2.5 leading-none"><Mark className="size-8" /><span className="text-[1.375rem] font-extrabold lowercase tracking-tight text-primary">airtel</span><span aria-hidden className="h-6 w-px bg-foreground/25" /><span className="text-[1.25rem] font-extrabold tracking-tight">SYNC</span></span>
            <span className="mt-2 hidden w-fit rounded-full bg-accent px-3 py-1 text-xs font-bold text-primary lg:block">Business · Operations</span>
          </Link>
          <button type="button" onClick={signOut} className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted lg:hidden" aria-label="Sign out"><LogOut className="size-5" /></button>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-3 py-3 lg:mt-5 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:px-4" aria-label="Operations">
          {nav.map((n) => {
            const active = n.href === "/ops" ? path === "/ops" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-[0.9375rem] transition-colors", active ? "bg-accent font-bold text-primary" : "font-medium text-foreground/75 hover:bg-muted")}>
                <n.icon className="size-[1.125rem]" strokeWidth={active ? 2.2 : 1.8} />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="relative hidden shrink-0 space-y-3 px-5 pb-6 pt-4 lg:block">
          <svg aria-hidden viewBox="0 0 260 90" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-24 w-full text-primary/10"><path d="M0 40C60 10 110 20 160 44s70 14 100-6v52H0z" fill="currentColor" /></svg>
          <div className="relative border-t pt-4">
            <Link href="/ops/account" className="block truncate text-[0.9375rem] font-bold hover:underline">{staff.name}</Link>
            <div className="mt-1.5 flex gap-1.5"><span className="rounded-full bg-primary px-3 py-1 text-xs font-bold capitalize text-primary-foreground">{staff.role}</span>{staff.isDemo && <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">Demo</span>}</div>
          </div>
          <button type="button" onClick={signOut} className="relative flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-input bg-card text-sm font-semibold shadow-card transition hover:bg-muted"><LogOut className="size-4" />Sign out</button>
          <Link href="/" className="relative block text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:underline">Customer app →</Link>
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-[96rem] px-4 py-6 lg:px-9 lg:py-8">
        {staff.mustChangePassword && !path.startsWith("/ops/account") && (
          <div className="mb-5 rounded-2xl border border-warning/50 bg-warning/10 p-3.5 text-sm">You&apos;re using a temporary password. <Link href="/ops/account" className="font-semibold text-primary underline">Set your own password</Link> before continuing.</div>
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
