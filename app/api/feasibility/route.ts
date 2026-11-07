import { z } from "zod";
import { ownedQuote } from "@/lib/accounts/guard";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { checkSite, type SiteFeasibility } from "@/lib/feasibility";
import { applyFeasibility } from "@/lib/rules/quote";
import { priceLines } from "@/lib/rules/pricing";
import { CONNECTIVITY } from "@/lib/catalogue";
import { quoteView, saveQuote } from "@/lib/store/quotes";

const Body = z.object({
  quoteId: z.string().max(40),
  sites: z.array(z.object({ index: z.number().int().min(0).max(499), address: z.string().min(5).max(200), pincode: z.string().regex(/^\d{6}$/, "6-digit pincode"), preferredWindow: z.enum(["10:00–12:00", "12:00–14:00", "15:00–17:00"]).optional(), closedWeekdays: z.array(z.number().int().min(0).max(6)).max(6).optional() })).min(1).max(50),
});

/** Runs feasibility separately for every location, then re-prices. AirFiber is used only if the catalogue allows it. */
export const POST = route(async (req: Request) => {
  const b = await parseBody(req, Body);
  const q = await ownedQuote(b.quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const before = priceLines(q.lines);
  const feasible: Record<number, boolean> = {};
  const detail: Record<number, SiteFeasibility> = {};
  for (const s of b.sites) {
    if (s.index >= q.profile.sites) throw new HttpError(400, "SITE_OUT_OF_RANGE");
    detail[s.index] = await checkSite(s.pincode, q.profile.city);
    feasible[s.index] = detail[s.index].fibre;
  }
  const r = applyFeasibility(q.lines, q.profile, feasible);
  q.lines = r.lines;
  q.profile = r.profile;
  q.sites = q.sites.map((s) => {
    const m = b.sites.find((x) => x.index === s.index);
    return m ? { ...s, address: m.address, pincode: m.pincode, preferredWindow: m.preferredWindow, closedWeekdays: m.closedWeekdays, fibreFeasible: feasible[m.index], fibreBasis: detail[m.index].basis, checked: true } : s;
  });
  q.version++;
  await saveQuote(q);
  const after = priceLines(q.lines);
  const perSite = b.sites.map((s) => {
    const conn = q.lines.find((l) => CONNECTIVITY.includes(l.productId) && (l.siteIndex ?? 0) === s.index);
    const d = detail[s.index];
    return { index: s.index, fibre: feasible[s.index], connectivity: conn?.productId ?? null, basis: d.basis, confirmed: d.confirmed, area: d.area ?? null, cityMismatch: !!d.cityMismatch };
  });
  return ok({ ...quoteView(q), notices: r.notices, perSite, priceDelta: after.monthly - before.monthly });
});
