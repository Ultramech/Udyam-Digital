import { z } from "zod";
import { ownedQuote } from "@/lib/accounts/guard";
import { get } from "@/lib/db/store";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { saveQuote } from "@/lib/store/quotes";
import { getKyc } from "@/lib/store/kyc";
import { createOrder, recordLeadConversion } from "@/lib/store/orders";
import { effectiveKycStatus } from "@/lib/kyc/effective";
import { validateLines } from "@/lib/rules/quote";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import { getLead } from "@/lib/leads/leads";
import { put } from "@/lib/db/store";
import { attachOrderToBusiness } from "@/lib/accounts/users";
import type { ConsentRecord, Conversation, Session } from "@/lib/store/types";

const Body = z.object({ quoteId: z.string().max(40), businessName: z.string().min(2).max(80), lang: z.enum(["en", "hi", "mr", "ta"]).default("en"),
  /** what the owner saw; if the catalogue changed since, the order is refused so nobody pays a price they did not see */
  expectedMonthly: z.number().int().nonnegative().optional(), expectedSetup: z.number().int().nonnegative().optional() });

/** Creates the order record (payment still pending). Every guard here is enforced server-side, not just in the UI. */
export const POST = route(async (req: Request) => {
  const b = await parseBody(req, Body);
  const q = await ownedQuote(b.quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  if (q.orderId) { const ex = await get<{ id: string; token: string }>("order", q.orderId); if (ex) return ok({ orderId: ex.id, token: ex.token, existing: true }); }

  const sid = await sessionId();
  const s = sid ? await get<Session>("session", sid) : null;
  if (!s?.verified || !s.phone) throw new HttpError(401, "OTP_REQUIRED");
  const consent = q.consentId ? await get<ConsentRecord>("consent", q.consentId) : null;
  if (!consent?.purposes.kyc || !consent.purposes.service) throw new HttpError(403, "CONSENT_REQUIRED");
  if (!q.lines.length) throw new HttpError(409, "EMPTY_QUOTE");
  const issues = validateLines(q.lines, q.profile);
  if (issues.length) throw new HttpError(409, "QUOTE_INVALID", { issues: issues.map((i) => `${i.productId}:${i.code}`) });
  if (recommend(q.profile).escalation.level === "hard") throw new HttpError(409, "NEEDS_SPECIALIST");
  if (q.sites.some((x) => !x.checked)) throw new HttpError(409, "SITES_NOT_CHECKED");
  const now = priceLines(q.lines);
  if ((b.expectedMonthly !== undefined && b.expectedMonthly !== now.monthly) || (b.expectedSetup !== undefined && b.expectedSetup !== now.setup))
    throw new HttpError(409, "PRICE_CHANGED", { monthly: now.monthly, setup: now.setup });

  const kyc = q.kycId ? await getKyc(q.kycId) : null;
  if (!kyc) throw new HttpError(409, "KYC_NOT_STARTED");
  const eff = effectiveKycStatus(kyc.checks, { requeued: kyc.requeued, decision: kyc.review?.decision });
  // verified / approved proceed; 'review' may be paid but activation waits; anything else must be fixed first
  if (!["verified", "approved", "review"].includes(eff)) throw new HttpError(409, "KYC_INCOMPLETE", { status: eff });

  const conv = q.conversationId ? await get<Conversation>("conversation", q.conversationId) : null;
  const lead = conv?.leadId ? await getLead(conv.leadId) : null;
  const order = await createOrder(q, kyc, { businessName: b.businessName, phone: s.phone, lang: b.lang, leadId: lead?.id });
  // the account that proved this phone owns the order; it's filed under the matching business (created if new)
  if (s.userId) { order.userId = s.userId; order.businessId = await attachOrderToBusiness(s.userId, order, kyc); }
  order.kycStatus = eff === "review" ? "review" : "verified";
  if (eff === "approved") order.kycStatus = "approved";
  await put("order", order.id, order);
  q.orderId = order.id;
  if (s.userId) { q.userId = s.userId; q.businessId = order.businessId; }
  await saveQuote(q);
  await recordLeadConversion(lead, order.id);
  return ok({ orderId: order.id, token: order.token });
});
