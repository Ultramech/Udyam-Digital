import { z } from "zod";
import { ownedQuote } from "@/lib/accounts/guard";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { getQuote, quoteView, saveQuote } from "@/lib/store/quotes";
import { kycFor, recompute, requireKycConsent } from "@/lib/store/kyc";
import { kycView } from "@/lib/store/kycView";
import { readOrFail, sha256, specimenFile } from "@/lib/kyc/ocr";
import { dropIneligible } from "@/lib/rules/quote";
import { SLOTS, type Slot } from "@/lib/kyc/types";
import { validateGstin, validateUdyam, norm } from "@/lib/kyc/identifiers";
import { setKycStatus, getOrder } from "@/lib/store/orders";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("lookup"), gstin: z.string().max(20).optional(), udyam: z.string().max(30).optional(), siteAddress: z.string().max(200).optional() }),
  z.object({ action: z.literal("claims"), claimsUdyam: z.boolean() }),
  z.object({ action: z.literal("specimen"), applicant: z.string().regex(/^(K(0[1-9]|1[0-2])|D01)$/), slot: z.enum(SLOTS as [string, ...string[]]) }),
  z.object({ action: z.literal("remove"), slot: z.enum(SLOTS as [string, ...string[]]) }),
  z.object({ action: z.literal("requote") }),
]);

async function load(quoteId: string) {
  const q = await ownedQuote(quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  return q;
}

export const GET = route(async (_req: Request, { params }: { params: Promise<{ quoteId: string }> }) => {
  const q = await load((await params).quoteId);
  const k = await kycFor(q);
  return ok({ kyc: kycView(k), consent: !!q.consentId });
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ quoteId: string }> }) => {
  const q = await load((await params).quoteId);
  await requireKycConsent(q); // purpose limitation: nothing below runs without KYC consent
  const b = await parseBody(req, Body);
  let k = await kycFor(q);
  let removed: { productId: string; code: string }[] = [];

  if (b.action === "lookup") {
    if (b.gstin) {
      const g = norm(b.gstin);
      const f = validateGstin(g);
      k.entered.gstin = g;
      if (!f.formatOk && g.length !== 15) throw new HttpError(422, "GSTIN_FORMAT");
    }
    if (b.udyam) {
      if (!validateUdyam(b.udyam).ok) throw new HttpError(422, "UDYAM_FORMAT");
      k.entered.udyam = b.udyam.toUpperCase().replace(/\s+/g, "");
    }
    if (b.siteAddress) k.entered.siteAddress = b.siteAddress;
  } else if (b.action === "claims") k.claimsUdyam = b.claimsUdyam;
  else if (b.action === "specimen") {
    if (process.env.DEMO_MODE === "false") throw new HttpError(403, "DEMO_ONLY");
    const slot = b.slot as Slot;
    const buf = specimenFile(b.applicant, slot);
    if (!buf) throw new HttpError(404, "SPECIMEN_NOT_FOUND");
    // demo sample sets are fingerprinted for the same-file-in-two-slots check, but not cross-application (they're shared on purpose)
    k.docs[slot] = { ...(await readOrFail(slot, buf, "image/png", HttpError)), fileHash: sha256(buf) };
  } else if (b.action === "remove") delete k.docs[b.slot as Slot];
  else {
    // re-quote: the registry says GST products are not allowed → remove them and keep the rest
    k = await recompute(k);
    const q2 = (await getQuote(q.id))!;
    const r = dropIneligible(q2.lines, q2.profile);
    q2.lines = r.lines;
    q2.version++;
    await saveQuote(q2);
    removed = r.removed;
    k.requeued = true;
  }
  k = await recompute(k);
  if (q.orderId) {
    const o = await getOrder(q.orderId);
    if (o) await setKycStatus(o.id, k.status === "blocked" ? "reupload" : (k.status as never));
  }
  const q3 = (await getQuote(q.id))!;
  return ok({ kyc: kycView(k), removed, quote: quoteView(q3) });
});
