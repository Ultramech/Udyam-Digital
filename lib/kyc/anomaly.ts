import type { Check, ExtractedDoc, Slot } from "./types";

/**
 * File-fingerprint checks, run after the validators:
 *  - the same file uploaded into two different slots → the owner must upload the right document (reupload);
 *  - a file already used by another application → an INFO signal that lowers the review score. It is an indicator only:
 *    the same shop can legitimately apply twice. A reviewer decides.
 */
export function fingerprintChecks(docs: Partial<Record<Slot, ExtractedDoc>>): Check[] {
  const out: Check[] = [];
  const seen = new Map<string, Slot>();
  for (const slot of Object.keys(docs) as Slot[]) {
    const d = docs[slot]!;
    if (d.fileHash) {
      const first = seen.get(d.fileHash);
      if (first) out.push({ code: "DOC_DUPLICATE_SLOT", severity: "reupload", slot, params: { other: first }, needsReview: false });
      else seen.set(d.fileHash, slot);
    }
    if ((d.seenInOtherApplications ?? 0) > 0) out.push({ code: "DOC_SEEN_ELSEWHERE", severity: "info", slot, params: { n: d.seenInOtherApplications! }, needsReview: false });
  }
  return out;
}
