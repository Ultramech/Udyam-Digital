import { HttpError, ok, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { createShare } from "@/lib/share";
import { publicBaseUrl } from "@/lib/channels/twilio";
import { priceLines } from "@/lib/rules/pricing";
import { bundleName } from "@/lib/i18n/bundles";

/** Creates a read-only share link for this quote (no login needed to view it; nothing personal is shown). */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const q = await ownedQuote((await params).id);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const token = await createShare(q.id);
  const base = publicBaseUrl() ?? new URL(req.url).origin;
  const p = priceLines(q.lines);
  return ok({ token, url: `${base}/p/${token}`, summary: { plan: bundleName(q.bundleId, "en"), monthly: p.monthly, gstMonthly: p.gstMonthly, setup: p.setup, gstSetup: p.gstSetup, firstPayment: p.firstPayment, currency: "INR" } });
});
