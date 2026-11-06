import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { get } from "@/lib/db/store";
import { audit } from "@/lib/privacy/audit";
import { getKyc, recompute } from "@/lib/store/kyc";
import { kycView } from "@/lib/store/kycView";
import { addEvent, getOrder, setKycStatus } from "@/lib/store/orders";
import type { Quote } from "@/lib/store/types";

const Body = z.object({ decision: z.enum(["approved", "rejected", "correction"]), note: z.string().max(300).default("") });

/** A reviewer's decision is recorded, audit-logged, and flows straight to the customer's KYC screen and order tracker. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireRole("ops", "admin");
  const k = await getKyc((await params).id);
  if (!k) throw new HttpError(404, "KYC_NOT_FOUND");
  const b = await parseBody(req, Body);
  k.review = { decision: b.decision, by: staff.name, note: b.note, at: Date.now() };
  await recompute(k);
  await audit(staff, `kyc.${b.decision}`, "kyc", k.id);
  const q = await get<Quote>("quote", k.quoteId);
  const o = q?.orderId ? await getOrder(q.orderId) : null;
  if (o) {
    const hi = o.lang === "hi";
    if (b.decision === "approved") await setKycStatus(o.id, "approved", hi ? "आपके दस्तावेज़ मंज़ूर हो गए हैं।" : "Your documents have been approved.");
    else if (b.decision === "correction") { await setKycStatus(o.id, "reupload", hi ? `एक दस्तावेज़ दोबारा चाहिए: ${b.note || "कृपया ट्रैकर देखें"}` : `One document needs correcting: ${b.note || "please see your tracker"}`); await addEvent(o.id, "action", b.note || "Correction requested"); }
    else await setKycStatus(o.id, "rejected" as never, hi ? "हम आपके दस्तावेज़ वेरिफाई नहीं कर सके। हमारी टीम आपसे संपर्क करेगी।" : "We couldn't verify your documents. Our team will contact you.");
  }
  return ok({ kyc: kycView(k) });
});
