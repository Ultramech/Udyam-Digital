/** Server-only: registries backed by the supplied CSVs (mock GSTIN / Udyam lookup APIs read from here). */
import "server-only";
import { parse } from "csv-parse/sync";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GstRecord, UdyamRecord } from "./types";
import { makeNearGst } from "./validate";

let gst: Map<string, GstRecord> | null = null;
let udyam: Map<string, UdyamRecord> | null = null;
let all: GstRecord[] = [];

function load() {
  if (gst && udyam) return;
  const read = <T,>(f: string) => parse(readFileSync(join(process.cwd(), "data", f)), { columns: true, skip_empty_lines: true }) as T[];
  all = read<GstRecord>("mock_gstin_registry.csv");
  gst = new Map(all.map((r) => [r.gstin, r]));
  udyam = new Map(read<UdyamRecord>("mock_udyam_registry.csv").map((r) => [r.udyam_number, r]));
}

export function gstLookup(g: string): GstRecord | undefined { load(); return gst!.get(g.toUpperCase()); }
export function udyamLookup(u: string): UdyamRecord | undefined { load(); return udyam!.get(u.toUpperCase()); }
export function nearGstLookup(g: string): GstRecord | undefined { load(); return makeNearGst(all)(g); }
export const registryLookups = () => ({ gst: gstLookup, udyam: udyamLookup, nearGst: nearGstLookup });
