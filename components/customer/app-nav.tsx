"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Globe, House, LayoutGrid, LifeBuoy, Package, UserRound, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { LANGS } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { TalkToPerson } from "./talk-person";

interface Tab { href: string; key: string; icon: LucideIcon; active: (p: string) => boolean }
export const TABS: Tab[] = [
  { href: "/", key: "tab_home", icon: House, active: (p) => p === "/" },
  { href: "/catalogue", key: "tab_plans", icon: LayoutGrid, active: (p) => p.startsWith("/catalogue") },
  { href: "/orders", key: "tab_orders", icon: Package, active: (p) => /^\/(orders|track|quote|order)(\/|$)/.test(p) },
  { href: "/support", key: "tab_help", icon: LifeBuoy, active: (p) => p.startsWith("/support") || p.startsWith("/notifications") },
  { href: "/account", key: "tab_account", icon: UserRound, active: (p) => p.startsWith("/account") },
];

/** One compact native picker on every screen size: it never overflows a 360px phone and is the same control everywhere. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">Language</span>
      <Globe className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden />
      <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}
        className="h-10 appearance-none rounded-full border border-input bg-card pl-9 pr-4 text-sm font-medium text-foreground">
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}

export const openDemoTools = () => window.dispatchEvent(new Event("ud-open-demo"));

/** Phones: five tabs, thumb height, always visible on browsing screens. */
export function TabBar() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((tab) => {
          const on = tab.active(path);
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={on ? "page" : undefined} className="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs">
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", on ? "bg-foreground text-background" : "text-muted-foreground")}>
                  <tab.icon className="size-5" aria-hidden />
                </span>
                <span className={cn("leading-none", on ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{t(tab.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tablets and laptops: the same five places as a left rail. */
export function SideRail({ demo }: { demo: boolean }) {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card p-5 md:flex">
      <Link href="/" aria-label="Home" className="px-1"><Logo /></Link>
      <nav aria-label="Main" className="mt-8 flex-1">
        <ul className="space-y-1">
          {TABS.map((tab) => {
            const on = tab.active(path);
            return (
              <li key={tab.href}>
                <Link href={tab.href} aria-current={on ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-[0.9375rem] transition-colors", on ? "bg-foreground font-bold text-background" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <tab.icon className="size-5" aria-hidden />{t(tab.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><LanguageSwitch /><NotificationBell /></div>
        {demo && (
          <button type="button" onClick={openDemoTools} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <FlaskConical className="size-4" aria-hidden />{t("demo_tools")}
          </button>
        )}
      </div>
    </aside>
  );
}

/** Phone top bar on browsing screens. */
export function BrowseBar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur md:hidden">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <div className="flex items-center gap-1.5"><LanguageSwitch /><NotificationBell /></div>
      </div>
    </header>
  );
}

/** Signed-out chrome: the brand, the language, one way in. */
export function PublicBar() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4 md:px-8">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          {path !== "/login" && path !== "/account/setup" && <Link href="/login" className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/85">{t("sign_in")}</Link>}
        </div>
      </div>
    </header>
  );
}

/** Buying flow: a way back, where you are, a person one tap away. No tabs, so nothing pulls you out of the purchase. */
export function FlowBar({ step, total }: { step: number; total: number }) {
  const router = useRouter();
  const { t } = useI18n();
  const name = t(`flow_${Math.min(step, 6)}`);
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-2 md:px-6">
        <button type="button" aria-label={t("back")} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="flex size-11 items-center justify-center rounded-full hover:bg-muted"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.9375rem] font-bold leading-tight">{name}</div>
          <div className="num text-xs text-muted-foreground">{step} {t("of_total")} {total}</div>
        </div>
        <TalkToPerson compact />
      </div>
      <div className="mx-auto flex w-full max-w-3xl gap-1 px-4 pb-2 md:px-6" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={name}>
        {Array.from({ length: total }, (_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-foreground" : "bg-border")} />)}
      </div>
    </header>
  );
}
