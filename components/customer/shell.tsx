"use client";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { LANGS } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import { DemoDrawer } from "@/components/demo-drawer";
import { TalkToPerson } from "./talk-person";
import { VerifyProvider } from "./verify";
import { NotificationBell } from "./notification-bell";
import { AccountButton } from "./account-button";
import { AuthGate } from "./auth-gate";

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <>
      {/* phones: one compact native picker, so the header never overflows a 360–390px screen */}
      <label className="sm:hidden">
        <span className="sr-only">Language</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="h-8 rounded-full border bg-card px-2.5 text-xs">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </label>
      <div role="group" aria-label="Language" className="hidden rounded-full border bg-card p-0.5 text-xs sm:inline-flex">
        {LANGS.map((l) => (
          <button key={l.code} type="button" onClick={() => setLang(l.code)} aria-pressed={lang === l.code}
            className={cn("rounded-full px-2.5 py-1 transition-colors", lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {l.label}
          </button>
        ))}
      </div>
    </>
  );
}

/** Mobile-first frame shared by every customer screen: one clear header, progress, and a person always one tap away. */
export function CustomerShell({ children, step, total = 6, wide }: { children: React.ReactNode; step?: number; total?: number; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <VerifyProvider>
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className={cn("mx-auto flex items-center justify-between gap-2 px-4 py-2.5", wide ? "max-w-5xl" : "max-w-xl")}>
          <Link href="/" aria-label="Home"><Logo /></Link>
          <div className="flex items-center gap-1.5"><LanguageSwitch /><NotificationBell /><AccountButton /><TalkToPerson /></div>
        </div>
        {step ? (
          <div className={cn("mx-auto px-4 pb-2", wide ? "max-w-5xl" : "max-w-xl")} aria-label={`${t("step_of")} ${step} ${t("of")} ${total}`}>
            <div className="flex gap-1">{Array.from({ length: total }, (_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")} />)}</div>
          </div>
        ) : null}
      </header>
      <main className={cn("mx-auto w-full flex-1 px-4 py-5", wide ? "max-w-5xl" : "max-w-xl")}><AuthGate>{children}</AuthGate></main>
      <footer className="mx-auto w-full max-w-xl px-4 pb-24 pt-2 text-center text-[11px] text-muted-foreground">{t("prototype")}</footer>
      <DemoDrawer />
    </VerifyProvider>
  );
}
