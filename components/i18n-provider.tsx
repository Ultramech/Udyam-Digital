"use client";
import { captureAttribution } from "@/lib/client/api";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/lib/catalogue/plain";
import { translate } from "@/lib/i18n/messages";

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string; /** true once the stored/URL language has been applied */ ready: boolean }
const I18n = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k, ready: false });

const KEY = "ud_lang";
/** Language persists across every screen (and reloads). The first paint is English; the stored choice applies right after mount. */
const isLang = (v: unknown): v is Lang => v === "en" || v === "hi" || v === "mr" || v === "ta";
/** The language chosen earlier (?lang= wins, then storage). "" when none; null during server render/hydration. */
const savedLang = (): string => {
  try { const v = new URL(window.location.href).searchParams.get("lang") ?? localStorage.getItem(KEY); return isLang(v) ? v : ""; } catch { return ""; } // storage may be blocked (private mode)
};
const noSubscribe = () => () => {};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const saved = useSyncExternalStore(noSubscribe, savedLang, () => null);
  const [picked, setPicked] = useState<Lang | null>(null);
  const lang: Lang = picked ?? (isLang(saved) ? saved : "en");
  const ready = saved !== null;
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { captureAttribution(window.location.search); }, []); // campaign/partner links (?src=, ?partner=)
  const setLang = useCallback((l: Lang) => {
    setPicked(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: l }) }).catch(() => {});
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (k: string) => translate(lang, k), ready }), [lang, setLang, ready]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}
export const useI18n = () => useContext(I18n);
export const useT = () => useContext(I18n).t;
