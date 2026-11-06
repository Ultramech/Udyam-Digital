import { HttpError, ok, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { get, put } from "@/lib/db/store";
import { getQuote } from "@/lib/store/quotes";
import { kycFor, recompute, requireKycConsent } from "@/lib/store/kyc";
import { kycView } from "@/lib/store/kycView";
import { readOrFail, sha256 } from "@/lib/kyc/ocr";
import { SLOTS, type Slot } from "@/lib/kyc/types";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const MIME = new Set(["image/png", "image/jpeg", "application/pdf"]);
/** Magic bytes, so a renamed file can't pretend to be an image or a PDF. */
const sniff = (b: Buffer) =>
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
    : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "image/jpeg"
      : b.subarray(0, 5).toString("latin1") === "%PDF-" ? "application/pdf" : null;

interface FileSeen { cases: string[] }

/**
 * Multipart upload: slot + file. The file is measured and extracted in memory; it is not written to disk or logged.
 * Only its SHA-256 is kept, to catch the same file in two slots and to show reviewers when a file appears in another application.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ quoteId: string }> }) => {
  const q = await ownedQuote((await params).quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  await requireKycConsent(q);
  const form = await req.formData();
  const slot = String(form.get("slot") ?? "") as Slot;
  const file = form.get("file");
  if (!SLOTS.includes(slot)) throw new HttpError(400, "INVALID_SLOT");
  if (!(file instanceof File)) throw new HttpError(400, "FILE_REQUIRED");
  if (!MIME.has(file.type)) throw new HttpError(415, "UNSUPPORTED_TYPE", { allowed: [...MIME] });
  if (file.size > MAX_BYTES) throw new HttpError(413, "FILE_TOO_LARGE");
  const buf = Buffer.from(await file.arrayBuffer());
  const real = sniff(buf);
  if (!real || real !== file.type) throw new HttpError(415, "FILE_CONTENT_MISMATCH", { declared: file.type, detected: real });

  const hash = sha256(buf);
  const k = await kycFor(q);
  const prev = k.docs[slot];
  // re-uploading the exact file that already failed would fail the same way — say so instead of re-reading it
  if (prev?.fileHash === hash && k.checks.some((c) => c.slot === slot && c.severity === "reupload")) throw new HttpError(409, "SAME_FILE_AGAIN");

  const doc = await readOrFail(slot, buf, real, HttpError);
  const idx = (await get<FileSeen>("kyc_file", hash)) ?? { cases: [] };
  doc.fileHash = hash;
  doc.seenInOtherApplications = idx.cases.filter((c) => c !== k.id).length;
  if (!idx.cases.includes(k.id)) await put("kyc_file", hash, { cases: [...idx.cases, k.id].slice(-50) });
  k.docs[slot] = doc;
  await recompute(k);
  return ok({ kyc: kycView((await kycFor((await getQuote(q.id))!))) });
});
