import { maskGstin, maskUdyam } from "@/lib/kyc/identifiers";
import type { KycCase } from "./types";
import { kycScore } from "@/lib/kyc/confidence";

/** What the browser may see: identifiers are masked, raw document images are never returned. */
export function kycView(k: KycCase) {
  const mask = (f: string, v: string | null) => (v && f === "gstin" ? maskGstin(v) : v && f === "udyam_number" ? maskUdyam(v) : v && (f === "consumer_no" || f === "id_no") ? v.slice(0, 2) + "••••" + v.slice(-2) : v);
  return {
    id: k.id, quoteId: k.quoteId, status: k.status, gstEligible: k.gstEligible, neededSlots: k.neededSlots, requeued: !!k.requeued,
    gstinMasked: maskGstin(k.gstinUsed ?? k.entered.gstin), gstName: k.gstName, gstStatus: k.gstStatus, udyamName: k.udyamName, claimsUdyam: k.claimsUdyam,
    checks: k.checks, review: k.review ?? null,
    score: kycScore({ checks: k.checks, docs: k.docs, neededSlots: k.neededSlots, gstStatus: k.gstStatus, udyamFound: !!k.udyamName, claimsGst: !!(k.entered.gstin || k.docs.gst_certificate) }),
    docs: Object.fromEntries(Object.entries(k.docs).map(([slot, d]) => [slot, {
      slot, source: d!.source, legibility: d!.legibility, confidence: d!.confidence, sharpness: d!.sharpness, file: d!.file, seenInOtherApplications: d!.seenInOtherApplications ?? 0,
      fields: Object.fromEntries(Object.entries(d!.fields).map(([f, v]) => [f, mask(f, v)])),
    }])),
  };
}
export type KycView = ReturnType<typeof kycView>;
