/**
 * End-to-end KYC check against the judges' planted problems, with NO cached reads: every specimen image is read by the live
 * document reader (Gemini vision), then validated by the same runKyc the app uses, and each applicant's verdict is compared
 * with kyc_expected.json. Usage: NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local scripts/check-kyc-live.ts
 */
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { extractDocument, specimenFile } from "../lib/kyc/ocr";
import { runKyc, makeNearGst } from "../lib/kyc/validate";
import type { ExtractedDoc, GstRecord, KycInput, Slot, UdyamRecord } from "../lib/kyc/types";

const read = <T,>(f: string) => parse(readFileSync(`data/${f}`), { columns: true }) as T[];
const GST = read<GstRecord>("mock_gstin_registry.csv"), UD = read<UdyamRecord>("mock_udyam_registry.csv");
const G = new Map(GST.map((r) => [r.gstin, r])), U = new Map(UD.map((r) => [r.udyam_number, r]));
const lookups: KycInput["lookups"] = { gst: (g) => G.get(g), udyam: (u) => U.get(u), nearGst: makeNearGst(GST) };
const KEY = JSON.parse(readFileSync("kyc_expected.json", "utf8")) as Record<string, { status: string; codes: string[] }>;
const SLOTS: Slot[] = ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let ok = 0, bad = 0;
  for (const [id, exp] of Object.entries(KEY)) {
    const docs: Partial<Record<Slot, ExtractedDoc>> = {};
    for (const slot of SLOTS) {
      const buf = specimenFile(id, slot);
      if (!buf) continue;
      for (let attempt = 0; ; attempt++) {
        try { docs[slot] = await extractDocument(slot, buf, "image/png"); break; }
        catch (e) { if (attempt >= 3) throw e; await sleep(8000); }
      }
      await sleep(3000);
    }
    const r = runKyc({ today: "2026-07-15", entered: {}, claimsUdyam: true, docs, lookups });
    const codes = [...new Set(r.checks.filter((c) => c.severity !== "info").map((c) => c.code))].sort();
    const pass = r.status === exp.status && JSON.stringify(codes) === JSON.stringify([...exp.codes].sort());
    pass ? ok++ : bad++;
    console.log(`${pass ? "✓" : "✗"} ${id} live → ${r.status} [${codes.join(", ")}]  expected ${exp.status} [${exp.codes.join(", ")}]`);
  }
  console.log(`\n${ok}/${ok + bad} applicants match the answer key using live document reading`);
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
