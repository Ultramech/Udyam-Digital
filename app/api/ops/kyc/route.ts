import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { get, list } from "@/lib/db/store";
import { kycView } from "@/lib/store/kycView";
import type { KycCase, Order, Quote } from "@/lib/store/types";

/** The review queue shows the exact case a customer just hit — same record, not a copy. */
export const GET = route(async (req: Request) => {
  await requireRole("ops", "admin");
  const all = new URL(req.url).searchParams.get("all") === "1";
  const cases = await list<KycCase>("kyc");
  const rows = await Promise.all(cases.filter((k) => all || (k.status === "review" && !k.review) || (k.status === "reupload" && !k.review)).map(async (k) => {
    const q = await get<Quote>("quote", k.quoteId);
    const o = q?.orderId ? await get<Order>("order", q.orderId) : null;
    return { ...kycView(k), business: o?.businessName ?? q?.profile.businessType ?? "Applicant", orderId: o?.id ?? null, createdAt: k.createdAt, needsReview: k.status === "review" && !k.review };
  }));
  return ok({ rows });
});
