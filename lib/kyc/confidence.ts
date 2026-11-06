import type { Check, ExtractedDoc, Slot } from "./types";

/**
 * KYC review score (0–100): a triage signal for reviewers — it decides who looks first, never approval.
 * Five components with fixed weights; each lists the check codes that cost it points, so a low score is explainable.
 */
export interface ScoreComponent { key: "quality" | "registry" | "names" | "address" | "completeness"; score: number; max: number; causes: string[] }
export interface KycScore { score: number; band: "high" | "medium" | "low"; components: ScoreComponent[]; anomalies: string[] }

const has = (checks: Check[], ...codes: string[]) => checks.filter((c) => codes.includes(c.code)).map((c) => c.code);

export function kycScore(input: { checks: Check[]; docs: Partial<Record<Slot, ExtractedDoc>>; neededSlots: Slot[]; gstStatus?: string; udyamFound: boolean; claimsGst: boolean }): KycScore {
  const { checks, docs } = input;
  const ds = Object.values(docs) as ExtractedDoc[];
  // 1. document quality (25): legibility × reader confidence, averaged
  const q = ds.length ? ds.reduce((s, d) => s + (d.legibility === "clear" ? 1 : d.legibility === "skewed" ? 0.8 : 0) * Math.min(1, d.confidence), 0) / ds.length : 0;
  const quality: ScoreComponent = { key: "quality", max: 25, score: Math.round(25 * q), causes: has(checks, "DOC_BLURRY", "DOC_UNREADABLE", "DOC_WRONG_TYPE", "DOC_SKEWED", "FIELD_MISSING") };
  // 2. registry (25)
  const regCauses = has(checks, "GSTIN_NOT_FOUND", "GSTIN_CANCELLED", "GSTIN_SUSPENDED", "GSTIN_CHECKSUM", "GSTIN_FORMAT", "UDYAM_NOT_FOUND", "UDYAM_FORMAT");
  let reg = input.gstStatus === "Active" ? 25 : input.gstStatus ? 10 : input.udyamFound ? 18 : input.claimsGst ? 0 : 12;
  if (input.gstStatus === "Active" && input.udyamFound) reg = 25;
  const registry: ScoreComponent = { key: "registry", max: 25, score: reg, causes: regCauses };
  // 3. names (20)
  const nameCauses = has(checks, "NAME_MISMATCH", "GST_DOC_REGISTRY_MISMATCH", "UDYAM_NAME_MISMATCH", "SIGNATORY_NOT_LINKED", "GSTIN_DOC_ENTERED_MISMATCH");
  const names: ScoreComponent = { key: "names", max: 20, score: Math.max(0, 20 - 8 * nameCauses.length), causes: nameCauses };
  // 4. address (15)
  const addrCauses = has(checks, "ADDRESS_MISMATCH", "ADDRESS_PROOF_STALE", "ADDRESS_PROOF_FUTURE", "GSTIN_STATE_MISMATCH", "UDYAM_STATE_MISMATCH");
  const address: ScoreComponent = { key: "address", max: 15, score: addrCauses.length ? Math.max(0, 15 - 8 * addrCauses.length) : docs.address_proof ? 15 : 6, causes: addrCauses };
  // 5. completeness (15)
  const completeness: ScoreComponent = { key: "completeness", max: 15, score: Math.max(0, 15 - 5 * input.neededSlots.length), causes: input.neededSlots.map((s) => `MISSING:${s}`) };
  const anomalies = has(checks, "DOC_SEEN_ELSEWHERE", "DOC_DUPLICATE_SLOT", "SIGNATORY_ID_EXPIRED");
  const components = [quality, registry, names, address, completeness];
  const score = Math.max(0, components.reduce((s, c) => s + c.score, 0) - 10 * anomalies.length);
  return { score, band: score >= 75 ? "high" : score >= 50 ? "medium" : "low", components, anomalies };
}
