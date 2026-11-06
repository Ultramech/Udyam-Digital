import { ADDRESS_PROOF_MAX_DAYS } from "@/lib/config";
import { GST_STATE_CODES, UDYAM_STATE_LETTERS, editDistance, norm, repairGstin, validateGstin, validateUdyam } from "./identifiers";
import { addressesMatch, daysBetween, namesMatch, nameSimilarity, splitProprietor, NAME_MATCH_THRESHOLD } from "./match";
import type { Check, ExtractedDoc, GstRecord, KycInput, KycResult, KycStatus, Severity, Slot, UdyamRecord } from "./types";

/** Measured with sharp (Laplacian variance, 800px wide). Clear specimens ≥ 559; the blurred K04 certificate = 4. */
export const SHARPNESS_MIN = 150;
const CONFIDENCE_MIN = 0.6;

const KEY_FIELDS: Record<Slot, string[]> = {
  gst_certificate: ["gstin", "legal_name"],
  udyam_certificate: ["udyam_number", "enterprise_name"],
  address_proof: ["billed_to", "address", "bill_date"],
  signatory_id: ["name", "for_business", "valid_till"],
};

export function runKyc(input: KycInput): KycResult {
  const { docs, entered, lookups, today } = input;
  const checks: Check[] = [];
  const push = (code: string, severity: Severity, slot?: Slot, params?: Check["params"]) =>
    checks.push({ code, severity, slot, params, needsReview: severity === "review" });

  // ---- 1. per-document quality: legibility, type, key fields -------------------------------------
  const usable: Partial<Record<Slot, ExtractedDoc>> = {};
  for (const slot of Object.keys(docs) as Slot[]) {
    const d = docs[slot]!;
    if (d.legibility === "unreadable") { push("DOC_UNREADABLE", "reupload", slot); continue; }
    if (d.legibility === "blurry" || d.confidence < CONFIDENCE_MIN || (d.sharpness !== undefined && d.sharpness < SHARPNESS_MIN)) {
      push("DOC_BLURRY", "reupload", slot, d.sharpness !== undefined ? { sharpness: d.sharpness } : undefined);
      continue;
    }
    if (d.docType !== slot) { push("DOC_WRONG_TYPE", "reupload", slot, { got: d.docType }); continue; }
    if (d.legibility === "skewed") push("DOC_SKEWED", "info", slot);
    let ok = true;
    for (const f of KEY_FIELDS[slot]) if (!d.fields[f]) { push("FIELD_MISSING", "reupload", slot, { field: f }); ok = false; }
    if (ok) usable[slot] = d;
  }
  // a document with a blank key field is not usable for cross-checks, but a present Udyam number elsewhere may still be
  const gstDoc = usable.gst_certificate;
  const udyamDoc = usable.udyam_certificate ?? (docs.udyam_certificate && docs.udyam_certificate.fields.udyam_number ? docs.udyam_certificate : undefined);
  const billDoc = usable.address_proof;
  const idDoc = usable.signatory_id;

  // ---- 2. GSTIN: format → checksum (with OCR repair) → registry → status ------------------------------
  let gstin = gstDoc?.fields.gstin ? norm(gstDoc.fields.gstin) : entered.gstin ? norm(entered.gstin) : undefined;
  let rec: GstRecord | undefined;
  let gstValid = false;
  if (gstDoc && entered.gstin && norm(entered.gstin) !== gstin) push("GSTIN_DOC_ENTERED_MISMATCH", "review", "gst_certificate");
  if (gstin) {
    const f = validateGstin(gstin);
    if (!f.ok) {
      const fixed = repairGstin(gstin, (g) => !!lookups.gst(g));
      if (fixed) {
        push("GSTIN_OCR_REPAIRED", "info", "gst_certificate", { from: gstin, to: fixed });
        gstin = fixed;
        gstValid = true;
      } else {
        const near = lookups.nearGst?.(gstin);
        push(f.formatOk ? "GSTIN_CHECKSUM" : "GSTIN_FORMAT", "reupload", "gst_certificate", near ? { suggestion: near.gstin, suggestionName: near.trade_name } : undefined);
      }
    } else gstValid = true;

    if (gstValid) {
      rec = lookups.gst(gstin);
      if (!rec) push("GSTIN_NOT_FOUND", "block", "gst_certificate");
      else {
        if (rec.status === "Cancelled") push("GSTIN_CANCELLED", "block", "gst_certificate");
        if (rec.status === "Suspended") push("GSTIN_SUSPENDED", "block", "gst_certificate");
        const sc = GST_STATE_CODES[gstin.slice(0, 2)];
        if (sc && sc !== rec.state) push("GSTIN_STATE_MISMATCH", "review", "gst_certificate", { code: gstin.slice(0, 2), state: rec.state });
        if (gstDoc) {
          const d = splitProprietor(gstDoc.fields.legal_name ?? "");
          const r = splitProprietor(rec.legal_name);
          const ownerOk = nameSimilarity(d.owner, r.owner) >= NAME_MATCH_THRESHOLD;
          const bizOk = d.business === null && r.business === null ? true : nameSimilarity(d.business ?? "", r.business ?? "") >= NAME_MATCH_THRESHOLD;
          if (!ownerOk || !bizOk) push("GST_DOC_REGISTRY_MISMATCH", "review", "gst_certificate", { field: "legal_name", doc: gstDoc.fields.legal_name ?? "", registry: rec.legal_name });
          else if (gstDoc.fields.address && !addressesMatch(gstDoc.fields.address, rec.principal_place_of_business)) push("GST_DOC_REGISTRY_MISMATCH", "review", "gst_certificate", { field: "address" });
          // the certificate must agree with itself: trade name vs the business named inside "(Prop. …)"
          if (d.business && gstDoc.fields.trade_name && !namesMatch(d.business, gstDoc.fields.trade_name))
            push("NAME_MISMATCH", "review", "gst_certificate", { a: d.business, b: gstDoc.fields.trade_name });
        }
      }
    }
  }
  const gstActive = !!rec && rec.status === "Active";

  // ---- 3. Udyam: lookup by number beats uploading a certificate ------------------------------------
  let urec: UdyamRecord | undefined;
  const udyamNumber = udyamDoc?.fields.udyam_number ? udyamDoc.fields.udyam_number.toUpperCase() : entered.udyam ?? undefined;
  if (udyamNumber) {
    const f = validateUdyam(udyamNumber);
    if (!f.ok) push("UDYAM_FORMAT", "reupload", "udyam_certificate");
    else {
      urec = lookups.udyam(udyamNumber.toUpperCase());
      if (!urec) push("UDYAM_NOT_FOUND", "review", "udyam_certificate");
      else {
        if (udyamDoc?.fields.enterprise_name && !namesMatch(udyamDoc.fields.enterprise_name, urec.enterprise_name))
          push("UDYAM_NAME_MISMATCH", "review", "udyam_certificate", { doc: udyamDoc.fields.enterprise_name, registry: urec.enterprise_name });
        const letters = UDYAM_STATE_LETTERS[urec.state];
        if (letters && letters !== f.stateLetters) push("UDYAM_STATE_MISMATCH", "review", "udyam_certificate");
      }
    }
  }
  if (input.claimsUdyam && !udyamNumber && !docs.udyam_certificate) push("DOC_MISSING", "reupload", "udyam_certificate");

  // ---- 4. address proof ----------------------------------------------------------------------------
  const refAddress = rec?.principal_place_of_business ?? gstDoc?.fields.address ?? entered.siteAddress ?? undefined;
  const addressSkippable = gstActive && !!entered.siteAddress && !!rec && addressesMatch(entered.siteAddress, rec.principal_place_of_business);
  if (billDoc) {
    const days = daysBetween(billDoc.fields.bill_date!, today);
    if (days > ADDRESS_PROOF_MAX_DAYS) push("ADDRESS_PROOF_STALE", "reupload", "address_proof", { days, max: ADDRESS_PROOF_MAX_DAYS, billDate: billDoc.fields.bill_date! });
    else if (days < 0) push("ADDRESS_PROOF_FUTURE", "review", "address_proof", { billDate: billDoc.fields.bill_date! });
    if (refAddress && !addressesMatch(billDoc.fields.address!, refAddress)) push("ADDRESS_MISMATCH", "review", "address_proof");
  } else if (!addressSkippable && !docs.address_proof) push("DOC_MISSING", "reupload", "address_proof");

  // ---- 5. authorised signatory ---------------------------------------------------------------------
  const bizName = rec?.trade_name ?? gstDoc?.fields.trade_name ?? undefined;
  if (idDoc) {
    if (idDoc.fields.valid_till! < today) push("SIGNATORY_ID_EXPIRED", "reupload", "signatory_id", { validTill: idDoc.fields.valid_till! });
    let linked = !bizName || namesMatch(idDoc.fields.for_business!, bizName);
    if (linked && rec?.constitution === "Proprietorship") linked = nameSimilarity(idDoc.fields.name!, splitProprietor(rec.legal_name).owner) >= NAME_MATCH_THRESHOLD;
    if (!linked) push("SIGNATORY_NOT_LINKED", "review", "signatory_id");
  } else if (!docs.signatory_id) push("DOC_MISSING", "reupload", "signatory_id");

  // ---- 6. cross-document business-name consistency ------------------------------------------------
  if (bizName) {
    if (udyamDoc?.fields.enterprise_name && !namesMatch(udyamDoc.fields.enterprise_name, bizName) && !checks.some((c) => c.code === "UDYAM_NAME_MISMATCH"))
      push("NAME_MISMATCH", "review", "udyam_certificate", { a: udyamDoc.fields.enterprise_name, b: bizName });
    if (billDoc?.fields.billed_to && !namesMatch(billDoc.fields.billed_to, bizName)) push("NAME_MISMATCH", "review", "address_proof", { a: billDoc.fields.billed_to, b: bizName });
  }

  // ---- verdict ---------------------------------------------------------------------------------------
  const sev = (s: Severity) => checks.some((c) => c.severity === s);
  const status: KycStatus = sev("block") ? "blocked" : sev("reupload") ? "reupload" : sev("review") ? "review" : "verified";
  const neededSlots = [...new Set(checks.filter((c) => c.slot && (c.severity === "reupload")).map((c) => c.slot!))];
  return { status, checks, gstEligible: gstValid && gstActive, gst: rec, udyam: urec, neededSlots, gstinUsed: gstin };
}

/** Closest registry GSTIN within 2 characters (used to suggest a fix when the entered number fails its checksum). */
export function makeNearGst(all: GstRecord[]) {
  return (g: string): GstRecord | undefined => {
    const n = norm(g);
    let best: GstRecord | undefined;
    let bd = 3;
    for (const r of all) {
      const d = editDistance(n, r.gstin);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };
}
