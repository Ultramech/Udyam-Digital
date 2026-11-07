import { HttpError, ok, route } from "@/lib/api";
import { headers } from "next/headers";
import { limit } from "@/lib/accounts/rateLimit";
import { resolveDelegate } from "@/lib/delegate";
import { kycFor } from "@/lib/store/kyc";
import { getQuote } from "@/lib/store/quotes";

/**
 * What a delegate link is asking for. Public (the link IS the credential), so it reveals as little as possible: the kind of business,
 * the city, the owner's first name and which documents are wanted. No phone, GSTIN, address, name on any document or anything read.
 */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  await limit(`dlg-view:${ip}`, 120, 60 * 60 * 1000);
  const d = await resolveDelegate((await params).token);
  if (!d) throw new HttpError(404, "LINK_NOT_FOUND");
  const q = await getQuote(d.quoteId);
  if (!q) throw new HttpError(404, "LINK_NOT_FOUND");
  const k = await kycFor(q);
  return ok({
    business: q.profile.businessType ?? "", city: q.profile.city ?? "", ownerFirstName: d.ownerFirstName, label: d.label, expiresAt: d.expiresAt,
    slots: d.slots.map((slot) => ({ slot, done: !!k.docs[slot] && d.uploaded.some((u) => u.slot === slot) })),
  });
});
