"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Award, Bell, FlaskConical, Gift, House, LayoutGrid, LifeBuoy, LogOut, Menu, MessageCircle, Package, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useVerify } from "@/components/customer/verify";
import { tgLink, waLink } from "@/components/customer/channel-links";
import { LanguageSwitch, openDemoTools } from "@/components/customer/app-nav";
import { useRewards } from "@/lib/client/use-rewards";
import { cn } from "@/lib/utils";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/** The hamburger and the side panel it opens: who you are, every place in the app, the chat bots, language, sign out. */
export function MenuButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const path = usePathname();
  const { account, signOut } = useVerify();
  const rewards = useRewards(!!account);
  const [open, setOpen] = useState(false);
  const items = [
    { href: "/", key: "tab_home", icon: House, on: path === "/" }, { href: "/catalogue", key: "tab_plans", icon: LayoutGrid, on: path.startsWith("/catalogue") },
    { href: "/orders", key: "tab_orders", icon: Package, on: path.startsWith("/orders") || path.startsWith("/track") }, { href: "/rewards", key: "tab_rewards", icon: Gift, on: path.startsWith("/rewards") },
    { href: "/notifications", key: "dr_notif", icon: Bell, on: path.startsWith("/notifications") }, { href: "/support", key: "dr_help", icon: LifeBuoy, on: path.startsWith("/support") },
    { href: "/account", key: "tab_account", icon: UserRound, on: path.startsWith("/account") },
  ];
  const wa = waLink(), tg = tgLink();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("menu_open")} className={cn("flex size-10 items-center justify-center rounded-full border border-input bg-card", className)}><Menu className="size-5" /></button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-sm gap-0 overflow-y-auto p-0">
          <SheetHeader className="sr-only"><SheetTitle>{t("menu_open")}</SheetTitle><SheetDescription>{t("dr_chat")}</SheetDescription></SheetHeader>
          <div className="hero-red px-5 pb-5 pt-10">
            <div className="flex items-center gap-3">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-xl font-extrabold text-primary">{(account?.name?.[0] ?? "").toUpperCase() || <UserRound className="size-6" />}</span>
              <div className="min-w-0"><div className="truncate text-lg font-extrabold leading-tight">{account?.name ?? t("tab_account")}</div><div className="text-sm opacity-85">{account?.phoneMasked}</div></div>
            </div>
            {rewards && <Link href="/rewards" onClick={() => setOpen(false)} className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2.5 text-sm font-semibold"><Award className="size-5" aria-hidden />{t(`tier_${rewards.tier}`)}<span className="ml-auto num">{rewards.balance} {t("coins")}</span></Link>}
          </div>
          <nav aria-label="Menu" className="p-3">
            <ul className="space-y-1">
              {items.map((i) => (
                <li key={i.href}><Link href={i.href} onClick={() => setOpen(false)} aria-current={i.on ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.9375rem]", i.on ? "bg-accent font-bold text-primary" : "font-medium hover:bg-muted")}><i.icon className="size-5" aria-hidden />{t(i.key)}</Link></li>
              ))}
            </ul>
          </nav>
          {(wa || tg) && (
            <div className="border-t p-4">
              <div className="mb-2 text-sm font-bold">{t("dr_chat")}</div>
              <div className="flex flex-wrap gap-2">
                {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#008069] px-3.5 text-sm font-semibold text-[#008069]"><MessageCircle className="size-4" aria-hidden />WhatsApp</a>}
                {tg && <a href={tg} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#229ED9] px-3.5 text-sm font-semibold text-[#229ED9]"><Send className="size-4" aria-hidden />Telegram</a>}
              </div>
            </div>
          )}
          <div className="space-y-2 border-t p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{t("dr_lang")}</span><LanguageSwitch /></div>
            {DEMO && <button type="button" onClick={() => { setOpen(false); openDemoTools(); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-muted"><FlaskConical className="size-4" aria-hidden />{t("demo_tools")}</button>}
            <button type="button" onClick={async () => { await signOut(); setOpen(false); toast.success("OK"); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-destructive hover:bg-muted"><LogOut className="size-4" aria-hidden />Sign out</button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
