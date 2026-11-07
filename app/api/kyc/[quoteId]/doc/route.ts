import { HttpError, ok, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { getQuote } from "@/lib/store/quotes";
import { kycFor } from "@/lib/store/kyc";
import { kycView } from "@/lib/store/kycView";
import { ingestDocument } from "@/lib/kyc/ingest";
import type { Slot } from "@/lib/kyc/types";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

/** Multipart upload: slot + file, for the signed-in owner. The checks themselves live in lib/kyc/ingest.ts (shared with delegated uploads). */
export const POST = route(async (req: Request, { params }: { params: Promise<{ quoteId: string }> }) => {
  const q = await ownedQuote((await params).quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "FILE_REQUIRED");
  await ingestDocument(q, String(form.get("slot") ?? "") as Slot, file);
  return ok({ kyc: kycView(await kycFor((await getQuote(q.id))!)) });
});
