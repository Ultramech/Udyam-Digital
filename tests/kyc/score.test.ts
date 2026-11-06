import { describe, expect, it } from "vitest";
import { fingerprintChecks } from "@/lib/kyc/anomaly";
import { kycScore } from "@/lib/kyc/confidence";
import { runKyc } from "@/lib/kyc/validate";
import { applicantDocs, specimenInput } from "./helpers";

const scoreFor = (id: string) => {
  const input = specimenInput(id);
  const r = runKyc(input);
  return kycScore({ checks: r.checks, docs: input.docs, neededSlots: r.neededSlots, gstStatus: r.gst?.status, udyamFound: !!r.udyam, claimsGst: !!input.docs.gst_certificate });
};

describe("KYC review score (triage signal)", () => {
  const clean = ["K03", "K08", "K09", "K10", "K12"];
  const planted = ["K01", "K04", "K05", "K06", "K07", "K11"];
  it("every clean control scores higher than every planted-problem applicant", () => {
    const minClean = Math.min(...clean.map((id) => scoreFor(id).score));
    const maxPlanted = Math.max(...planted.map((id) => scoreFor(id).score));
    expect(minClean).toBeGreaterThan(maxPlanted);
  });
  it("is bounded and explains itself", () => {
    for (const id of [...clean, ...planted]) {
      const s = scoreFor(id);
      expect(s.score).toBeGreaterThanOrEqual(0); expect(s.score).toBeLessThanOrEqual(100);
      for (const c of s.components) expect(c.score).toBeLessThanOrEqual(c.max);
    }
    expect(scoreFor("K01").components.find((c) => c.key === "registry")!.causes).toContain("GSTIN_CANCELLED");
    expect(scoreFor("K07").components.find((c) => c.key === "names")!.causes.length).toBeGreaterThan(0);
    expect(scoreFor("K11").components.find((c) => c.key === "address")!.causes).toContain("ADDRESS_PROOF_STALE");
  });
});

describe("file fingerprints", () => {
  it("the same file in two slots asks for the right document", () => {
    const docs = applicantDocs("K03");
    docs.gst_certificate!.fileHash = "abc"; docs.udyam_certificate!.fileHash = "abc";
    const c = fingerprintChecks(docs);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ code: "DOC_DUPLICATE_SLOT", severity: "reupload" });
  });
  it("a file seen in another application is info (an indicator), and lowers the score", () => {
    const input = specimenInput("K03");
    input.docs.address_proof!.seenInOtherApplications = 2;
    const extra = fingerprintChecks(input.docs);
    expect(extra[0]).toMatchObject({ code: "DOC_SEEN_ELSEWHERE", severity: "info" });
    const r = runKyc(input);
    const base = kycScore({ checks: r.checks, docs: input.docs, neededSlots: r.neededSlots, gstStatus: r.gst?.status, udyamFound: !!r.udyam, claimsGst: true });
    const flagged = kycScore({ checks: [...r.checks, ...extra], docs: input.docs, neededSlots: r.neededSlots, gstStatus: r.gst?.status, udyamFound: !!r.udyam, claimsGst: true });
    expect(flagged.score).toBe(Math.max(0, base.score - 10));
    expect(r.status).toBe("verified"); // info never changes the verdict
  });
});
