import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { makeNearGst } from "@/lib/kyc/validate";
import type { ExtractedDoc, GstRecord, KycInput, Slot, UdyamRecord } from "@/lib/kyc/types";

const read = <T,>(f: string) => parse(readFileSync(`data/${f}`), { columns: true }) as T[];
export const GST_ALL = read<GstRecord>("mock_gstin_registry.csv");
export const UDYAM_ALL = read<UdyamRecord>("mock_udyam_registry.csv");
const G = new Map(GST_ALL.map((r) => [r.gstin, r]));
const U = new Map(UDYAM_ALL.map((r) => [r.udyam_number, r]));

export const lookups: KycInput["lookups"] = { gst: (g) => G.get(g), udyam: (u) => U.get(u), nearGst: makeNearGst(GST_ALL) };
export const TODAY = "2026-07-15";

interface Cached { file: string; applicant: string; slot: Slot; docType: string; legibility: ExtractedDoc["legibility"]; sharpness: number; confidence: number; fields: Record<string, string | null> }
const CACHE = JSON.parse(readFileSync("fixtures/ocr_cache.json", "utf8")) as Record<string, Cached>;

export function applicantDocs(id: string): Partial<Record<Slot, ExtractedDoc>> {
  const out: Partial<Record<Slot, ExtractedDoc>> = {};
  for (const c of Object.values(CACHE)) if (c.applicant === id)
    out[c.slot] = { slot: c.slot, docType: c.docType, legibility: c.legibility, sharpness: c.sharpness, confidence: c.confidence, fields: c.fields, source: "cached", file: c.file };
  return out;
}
export const specimenInput = (id: string, over: Partial<KycInput> = {}): KycInput => ({
  today: TODAY, entered: {}, claimsUdyam: true, docs: applicantDocs(id), lookups, ...over,
});
