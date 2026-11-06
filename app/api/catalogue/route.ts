import { ok, route } from "@/lib/api";
import { CATALOGUE, CONNECTIVITY } from "@/lib/catalogue";
import { list } from "@/lib/db/store";
import { eligibility } from "@/lib/rules/eligibility";
import { ownedQuote } from "@/lib/accounts/guard";
import type { Override } from "@/lib/catalogue/overrides";
import type { Ref } from "@/lib/rules/types";

type Status = "included" | "addable" | "unavailable" | "swap";

/**
 * The full catalogue for browsing. With ?quote=<id>, every product also carries its status for THAT business, decided by
 * the same eligibility rules as the advisor (never by the browser). `overrides` lets the browser mirror ops' price/pause edits.
 */
export const GET = route(async (req: Request) => {
  const qid = new URL(req.url).searchParams.get("quote");
  // the public list needs no login; per-business status only for the quote's owner (anything else → plain list)
  const q = qid && /^QT-[A-Z0-9]{6}$/.test(qid) ? await ownedQuote(qid).catch(() => null) : null;
  const products = CATALOGUE.map((p) => {
    let status: Status | undefined, reason: Ref | undefined;
    if (q) {
      const inPlan = q.lines.some((l) => l.productId === p.id);
      const e = eligibility(p, q.profile);
      const conns = q.lines.filter((l) => CONNECTIVITY.includes(l.productId)).map((l) => l.productId);
      if (inPlan) status = "included";
      else if (!e.ok) { status = "unavailable"; reason = { code: e.code, params: e.params }; }
      else if (CONNECTIVITY.includes(p.id) || p.id === "P08") status = "swap";
      else if (p.requiresOneOf.length && conns.length && !conns.some((c) => p.requiresOneOf.includes(c))) { status = "unavailable"; reason = { code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: 1 } }; }
      else status = "addable";
    }
    return {
      id: p.id, category: p.category, unit: p.unit, priceMin: p.priceMin, priceMax: p.priceMax, setup: p.setup, minContract: p.minContract,
      tiers: p.tiers, minEmployees: p.minEmployees, minSites: p.minSites, requiresGstin: p.requiresGstin, requiresOneOf: p.requiresOneOf,
      installDays: p.installDays, segments: p.segments, paused: !!p.paused, status, reason,
    };
  });
  const overrides = await list<Override>("catalogue_override", { limit: 100 });
  return ok({ products, overrides, quoteId: q?.id ?? null });
});
