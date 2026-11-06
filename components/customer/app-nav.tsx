"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, FlaskConical, Gift, Globe, House, LayoutGrid, Package, UserRound, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { LANGS } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./notification-bell";
import { MenuButton } from "./side-drawer";
import { SearchLauncher } from "./search-sheet";
import { useVerify } from "./verify";
import { TalkToPerson } from "./talk-person";

interface Tab { href: string; key: string; icon: LucideIcon; active: (p: string) => boolean }
export const TABS: Tab[] = [
  { href: "/", key: "tab_home", icon: House, active: (p) => p === "/" },
  { href: "/catalogue", key: "tab_plans", icon: LayoutGrid, active: (p) => p.startsWith("/catalogue") },
  { href: "/orders", key: "tab_orders", icon: Package, active: (p) => /^\/(orders|track|quote|order)(\/|$)/.test(p) },
  { href: "/rewards", key: "tab_rewards", icon: Gift, active: (p) => p.startsWith("/rewards") },
  { href: "/account", key: "tab_account", icon: UserRound, active: (p) => p.startsWith("/account") },
];

/** One compact native picker on every screen size: it never overflows a 360px phone and is the same control everywhere. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">Language</span>
      <Globe className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground sm:left-3" aria-hidden />
      <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}
        className="h-10 appearance-none rounded-full border border-input bg-card pl-8 pr-3 text-sm font-medium text-foreground sm:pl-9 sm:pr-4">
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
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", on ? "bg-accent text-primary" : "text-muted-foreground")}>
                  <tab.icon className="size-5" aria-hidden />
                </span>
                <span className={cn("leading-none", on ? "font-bold text-primary" : "font-medium text-muted-foreground")}>{t(tab.key)}</span>
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
      <SearchLauncher className="mt-6" />
      <nav aria-label="Main" className="mt-6 flex-1">
        <ul className="space-y-1">
          {TABS.map((tab) => {
            const on = tab.active(path);
            return (
              <li key={tab.href}>
                <Link href={tab.href} aria-current={on ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-xl px-3 py-3 text-[0.9375rem] transition-colors", on ? "bg-accent font-bold text-primary" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground")}>
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

/** Phone top bar on browsing screens: menu, brand, search, notifications and profile. */
export function BrowseBar() {
  const { account } = useVerify();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur md:hidden">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-3">
        <MenuButton />
        <Link href="/" aria-label="Home" className="mr-auto"><Logo /></Link>
        <SearchLauncher variant="icon" />
        <NotificationBell />
        <Link href="/account" aria-label="Account" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground ring-1 ring-primary/25">{(account?.name?.[0] ?? "").toUpperCase() || <UserRound className="size-4" />}</Link>
      </div>
    </header>
  );
}

/** Signed-out chrome: brand, the page's own sections on a laptop, language, and a way in. */
export function PublicBar() {
  const { t } = useI18n();
  const path = usePathname();
  const home = path === "/";
  const links: [string, string][] = [["/#solutions", "ld_nav_solutions"], ["/#bundles", "ld_nav_bundles"], ["/#how", "ld_nav_how"], ["/login?next=%2Fsupport", "ld_nav_help"]];
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
        <Link href="/" aria-label="Home"><Logo /></Link>
        {home && (
          <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
            {links.map(([href, key]) => <Link key={key} href={href} className="rounded-full px-4 py-2 text-[0.9375rem] font-semibold text-foreground/80 hover:bg-accent hover:text-primary">{t(key)}</Link>)}
          </nav>
        )}
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          {path !== "/login" && path !== "/account/setup" && (
            <>
              <Link href="/login" className="hidden h-10 items-center rounded-xl border border-primary px-4 text-sm font-semibold text-primary hover:bg-accent sm:inline-flex">{t("sign_in")}</Link>
              <Link href="/login?next=%2Fadvisor" className="inline-flex h-10 items-center whitespace-nowrap rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 sm:px-4">{t("welcome_cta")}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Footer for signed-out pages. Only links that go somewhere, and nothing invented. */
export function PublicFooter() {
  const { t } = useI18n();
  const col = (title: string, links: [string, string][]) => (
    <div>
      <h2 className="text-sm font-extrabold">{title}</h2>
      <ul className="mt-3 space-y-1">{links.map(([href, label]) => <li key={label}><Link href={href} className="inline-flex min-h-9 items-center text-sm text-muted-foreground hover:text-primary">{label}</Link></li>)}</ul>
    </div>
  );
  return (
    <footer className="mt-10 border-t bg-card">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))] md:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{t("ld_f_blurb")}</p>
        </div>
        {col(t("ld_nav_solutions"), [["/#solutions", t("ld_cat_internet")], ["/#solutions", t("ld_cat_mobile")], ["/#solutions", t("ld_cat_digital")], ["/#solutions", t("ld_cat_security")]])}
        {col(t("ld_f_support"), [["/login?next=%2Fsupport", t("ld_nav_help")], ["/login?next=%2Forders", t("ld_f_track")], ["/connect", t("ld_f_chat")]])}
        {col(t("ld_f_legal"), [["/privacy", t("ld_f_policy")], ["/privacy#delete", "Delete my data"]])}
      </div>
      <div className="border-t"><p className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-muted-foreground md:px-8">{t("ld_f_proto")}</p></div>
    </footer>
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
