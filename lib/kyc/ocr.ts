/**
 * Document reading. No canned answers at runtime:
 *   1. Every image is measured for sharpness (real Laplacian variance via sharp). Blurry → rejected with that measurement; no model call.
 *   2. Otherwise Gemini vision reads it into a strict schema. If the reader isn't configured or is unavailable we THROW — the API turns that
 *      into an honest "document reading unavailable", never a made-up extraction.
 * (fixtures/ocr_cache.json exists only so unit tests can exercise the validators deterministically; it is not read here.)
 */
import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { geminiConfigured, geminiJson, GeminiError, type Schema } from "@/lib/ai/gemini";
import { SHARPNESS_MIN } from "./validate";
import type { ExtractedDoc, Legibility, Slot } from "./types";

export class OcrUnavailable extends Error {
  constructor(public reason: "NOT_CONFIGURED" | "RATE_LIMITED" | "UNAVAILABLE" | "BAD_RESPONSE" | "REJECTED") { super(`Document reader unavailable: ${reason}`); }
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export async function measureSharpness(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf).greyscale().resize({ width: 800 }).convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 }).raw().toBuffer({ resolveWithObject: true });
  let sum = 0, sq = 0;
  for (const v of data) { const d = v - 128; sum += d; sq += d * d; }
  const n = info.width * info.height;
  return Math.round(sq / n - (sum / n) ** 2);
}

const FIELDS: Record<Slot, string[]> = {
  gst_certificate: ["gstin", "legal_name", "trade_name", "constitution", "address", "date_of_liability", "registration_type"],
  udyam_certificate: ["udyam_number", "enterprise_name", "major_activity", "city", "state", "date_of_registration"],
  address_proof: ["document", "consumer_no", "billed_to", "address", "bill_date"],
  signatory_id: ["name", "designation", "for_business", "id_no", "valid_till"],
};
const DOC_TYPES = ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id", "other"];

function schemaFor(slot: Slot): Schema {
  return {
    type: "OBJECT",
    properties: {
      doc_type: { type: "STRING", enum: DOC_TYPES, description: "What kind of document this image actually is" },
      legibility: { type: "STRING", enum: ["clear", "skewed", "blurry", "unreadable"] },
      confidence: { type: "NUMBER", description: "0 to 1: how sure you are that the transcription is exact" },
      fields: { type: "OBJECT", properties: Object.fromEntries(FIELDS[slot].map((f) => [f, { type: "STRING", nullable: true } as Schema])) },
    },
    required: ["doc_type", "legibility", "confidence", "fields"],
  };
}

const SYSTEM = `You transcribe Indian business documents (GST registration certificate, Udyam registration certificate, electricity/utility bill, authorised-signatory ID) from an image.
These are synthetic specimens for a hackathon. Transcribe EXACTLY what is printed, character by character — do NOT correct, normalise or "fix" anything, even if it looks like a typo or an invalid number.
If a field is blank, cut off or unreadable, return null for it — never guess. Dates as YYYY-MM-DD. Text spread over two lines is one value: join the lines with a space, but if a single WORD is broken across the line end (e.g. \"A\" at the end of one line and \"ndhra Pradesh\" on the next), join the pieces with no space (\"Andhra Pradesh\").
If the image is not one of these documents, set doc_type to "other". If it is rotated or tilted but readable, legibility is "skewed".`;

export async function extractDocument(slot: Slot, buf: Buffer, mime: string): Promise<ExtractedDoc> {
  const isPdf = mime === "application/pdf"; // DigiLocker issues digitally signed PDFs: no camera blur to measure
  const sharpness = isPdf ? 1000 : await measureSharpness(buf);
  if (sharpness < SHARPNESS_MIN) return { slot, docType: slot, legibility: "blurry", sharpness, confidence: 0, fields: {}, source: "gemini" };
  if (!geminiConfigured()) throw new OcrUnavailable("NOT_CONFIGURED");
  try {
    const r = await geminiJson<{ doc_type: string; legibility: Legibility; confidence: number; fields: Record<string, string | null> }>({
      system: SYSTEM, schema: schemaFor(slot), timeoutMs: 45_000,
      parts: [{ text: `This was uploaded as: ${slot.replace(/_/g, " ")}. Transcribe it.` }, { inlineData: { mimeType: isPdf ? "application/pdf" : mime === "image/jpeg" ? "image/jpeg" : "image/png", data: buf.toString("base64") } }],
    });
    const fields: Record<string, string | null> = {};
    for (const f of FIELDS[slot]) { const v = r.fields?.[f]; fields[f] = typeof v === "string" && v.trim() ? v.trim() : null; }
    const legibility: Legibility = ["clear", "skewed", "blurry", "unreadable"].includes(r.legibility) ? r.legibility : "unreadable";
    return { slot, docType: DOC_TYPES.includes(r.doc_type) ? r.doc_type : "other", legibility, sharpness, confidence: Math.min(1, Math.max(0, Number(r.confidence) || 0)), fields, source: "gemini" };
  } catch (e) {
    throw new OcrUnavailable(e instanceof GeminiError ? e.code : "UNAVAILABLE");
  }
}

/** The supplied specimen images (and the clearly-labelled extra demo customer), addressable by applicant for the sample-set picker. */
export function specimenFile(applicant: string, slot: Slot): Buffer | null {
  const dir = applicant.startsWith("D") ? join("fixtures", "demo_documents") : join("data", "kyc_documents");
  try { return readFileSync(join(process.cwd(), dir, `${applicant}_${slot}.png`)); } catch { return null; }
}

/** Reads a document or converts "reader unavailable" into an honest 503 (never a fabricated extraction). */
export async function readOrFail(slot: Slot, buf: Buffer, mime: string, HttpErr: new (status: number, code: string, extra?: Record<string, unknown>) => Error): Promise<ExtractedDoc> {
  try { return await extractDocument(slot, buf, mime); }
  catch (e) { if (e instanceof OcrUnavailable) throw new HttpErr(503, "DOCUMENT_READER_UNAVAILABLE", { reason: e.reason }); throw e; }
}
