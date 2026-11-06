"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Gift, House, LayoutGrid, LifeBuoy, Package, Search, UserRound } from "lucide-react";
import { ProductIcon } from "@/components/brand";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CATALOGUE } from "@/lib/catalogue";
import { plainBenefit, plainName } from "@/lib/catalogue/plain";
import { inr } from "@/lib/client/format";
import { cn } from "@/lib/utils";

const PAGES = [
  { href: "/", key: "tab_home", icon: House }, { href: "/catalogue", key: "tab_plans", icon: LayoutGrid }, { href: "/orders", key: "tab_orders", icon: Package },
  { href: "/rewards", key: "tab_rewards", icon: Gift }, { href: "/support", key: "dr_help", icon: LifeBuoy }, { href: "/account", key: "tab_account", icon: UserRound },
];

/** Search across the 25 services and the app's pages. A bar on Home, or an icon in the top bar. Everything it finds exists. */
export function SearchLauncher({ variant = "bar", className }: { variant?: "bar" | "icon"; className?: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const services = useMemo(() => {
    if (!needle) return CATALOGUE.slice(0, 5);
    return CATALOGUE.filter((p) => `${plainName(p.id, lang)} ${plainBenefit(p.id, lang)} ${p.csvName} ${p.category} ${plainName(p.id, "en")}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [needle, lang]);
  const pages = useMemo(() => (needle ? PAGES.filter((p) => t(p.key).toLowerCase().includes(needle)) : []), [needle, t]);
  const go = (href: string) => { setOpen(false); setQ(""); router.push(href); };

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={t("search_title")} className={cn("flex size-10 items-center justify-center rounded-full border border-input bg-card", className)}><Search className="size-[1.125rem]" /></button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={cn("flex h-12 w-full items-center gap-3 rounded-2xl border bg-card px-4 text-left text-[0.9375rem] text-muted-foreground shadow-card", className)}>
          <Search className="size-5 shrink-0" aria-hidden />{t("search_ph")}
        </button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[92dvh] rounded-t-3xl p-0">
          <SheetHeader className="px-4 pt-4"><SheetTitle>{t("search_title")}</SheetTitle><SheetDescription className="sr-only">{t("search_hint")}</SheetDescription></SheetHeader>
          <div className="px-4"><div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 size-5 text-muted-foreground" aria-hidden /><Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_hint")} aria-label={t("search_title")} className="pl-11" /></div></div>
          <div className="mt-3 flex-1 overflow-y-auto px-4 pb-8">
            {needle && services.length === 0 && pages.length === 0 && <p className="py-8 text-center text-muted-foreground">{t("search_none")}</p>}
            {services.length > 0 && <h3 className="mb-2 mt-2 text-sm font-bold text-muted-foreground">{t("search_services")}</h3>}
            <ul className="space-y-2">
              {services.map((p) => (
                <li key={p.id}><button type="button" onClick={() => go(`/catalogue?s=${encodeURIComponent(plainName(p.id, lang).split(" (")[0])}`)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-card px-3.5 py-2.5 text-left hover:border-primary">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><ProductIcon id={p.id} className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{plainName(p.id, lang)}</span><span className="block truncate text-sm text-muted-foreground">{t("exp_from")} {inr(p.priceMin)}{t("per_month")}</span></span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button></li>
              ))}
            </ul>
            {pages.length > 0 && <h3 className="mb-2 mt-5 text-sm font-bold text-muted-foreground">{t("search_pages")}</h3>}
            <ul className="space-y-2">
              {pages.map((p) => (
                <li key={p.href}><button type="button" onClick={() => go(p.href)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-card px-3.5 text-left hover:border-primary"><p.icon className="size-5 text-primary" aria-hidden /><span className="flex-1 font-semibold">{t(p.key)}</span><ChevronRight className="size-5 text-muted-foreground" aria-hidden /></button></li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
