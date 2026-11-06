import type { Lang } from "@/lib/catalogue/plain";
import type { Line } from "@/lib/rules/types";

export const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");
export const fmtDate = (iso: string, lang: Lang = "en") =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "hi" || lang === "mr" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const fmtTime = (ms: number, lang: Lang = "en") => new Date(ms).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Collapses per-site lines of the same product into one display row ("× 3 locations"). */
export function groupLines(lines: (Line & { unitPrice?: number; monthly?: number; setup?: number })[]) {
  const map = new Map<string, { productId: string; qty: number; sites: number; monthly: number; setup: number; siteIndexes: (number | null)[] }>();
  for (const l of lines) {
    const g = map.get(l.productId) ?? { productId: l.productId, qty: 0, sites: 0, monthly: 0, setup: 0, siteIndexes: [] };
    g.qty += l.qty; g.sites += l.siteIndex !== null ? 1 : 0; g.monthly += l.monthly ?? 0; g.setup += l.setup ?? 0; g.siteIndexes.push(l.siteIndex);
    map.set(l.productId, g);
  }
  return [...map.values()];
}
