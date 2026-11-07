import { HttpError, ok, route } from "@/lib/api";
import { limit } from "@/lib/accounts/rateLimit";
import { kycFor } from "@/lib/store/kyc";
import { getQuote } from "@/lib/store/quotes";
import { recordDelegateUpload, resolveDelegate } from "@/lib/delegate";
import { ingestDocument } from "@/lib/kyc/ingest";
import { kycReason } from "@/lib/i18n/reasons";
import type { Slot } from "@/lib/kyc/types";

export const maxDuration = 60;

/**
 * A delegate adds one of the documents the owner asked for. Same checks as the owner's upload (lib/kyc/ingest.ts); the reply says only
 * whether it was received or needs retaking, never what was read from it.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const token = (await params).token;
  const d = await resolveDelegate(token);
  if (!d) throw new HttpError(404, "LINK_NOT_FOUND");
  await limit(`dlg-up:${d.ref}`, 12, 60 * 60 * 1000);
  const form = await req.formData();
  const slot = String(form.get("slot") ?? "") as Slot;
  const file = form.get("file");
  const lang = new URL(req.url).searchParams.get("lang") === "hi" ? "hi" : "en";
  if (!d.slots.includes(slot)) throw new HttpError(403, "SLOT_NOT_REQUESTED"); // this link may only add what the owner asked for
  if (!(file instanceof File)) throw new HttpError(400, "FILE_REQUIRED");
  const q = await getQuote(d.quoteId);
  if (!q) throw new HttpError(404, "LINK_NOT_FOUND");
  await ingestDocument(q, slot, file);
  await recordDelegateUpload(token, slot);
  const k = await kycFor((await getQuote(q.id))!);
  const mine = k.checks.filter((c) => c.slot === slot && c.severity !== "info" && c.code !== "DOC_MISSING");
  const retake = mine.find((c) => c.severity === "reupload" || c.severity === "block");
  if (retake) return ok({ slot, state: "retake", fix: kycReason(retake.code, undefined, lang).fix });
  return ok({ slot, state: mine.length ? "review" : "received" });
});
