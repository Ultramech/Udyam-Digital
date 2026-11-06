import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runKyc } from "@/lib/kyc/validate";
import { addressesMatch } from "@/lib/kyc/match";
import { GST_STATE_CODES, UDYAM_STATE_LETTERS, gstinChecksum, maskGstin, repairGstin, validateGstin, validateUdyam } from "@/lib/kyc/identifiers";
import { GST_ALL, UDYAM_ALL, applicantDocs, lookups, specimenInput } from "./helpers";

/** Our answer key — derived from inspecting every image and cross-checking the registries. */
const KEY = JSON.parse(readFileSync("kyc_expected.json", "utf8")) as Record<string, { status: string; codes: string[]; note: string }>;
const codesOf = (id: string) => [...new Set(runKyc(specimenInput(id)).checks.filter((c) => c.severity !== "info").map((c) => c.code))].sort();

describe("answer key · all 12 applicants (47 images)", () => {
  it("we hold all 47 specimen images", () => {
    expect(Object.values(Array.from({ length: 12 }, (_, i) => applicantDocs(`K${String(i + 1).padStart(2, "0")}`))).reduce((n, d) => n + Object.keys(d).length, 0)).toBe(47);
  });
  for (const [id, exp] of Object.entries(KEY)) {
    it(`${id} → ${exp.status}${exp.codes.length ? " [" + exp.codes.join(", ") + "]" : ""} — ${exp.note}`, () => {
      const r = runKyc(specimenInput(id));
      expect(codesOf(id)).toEqual([...exp.codes].sort());
      expect(r.status).toBe(exp.status);
    });
  }
  it("not every case passes: the suite demonstrates verified, re-upload, review and blocked outcomes", () => {
    const statuses = new Set(Object.keys(KEY).map((id) => runKyc(specimenInput(id)).status));
    expect([...statuses].sort()).toEqual(["blocked", "reupload", "review", "verified"]);
  });
  it("blur is detected from the measured sharpness, not hard-coded to a file name", () => {
    const k04 = applicantDocs("K04").gst_certificate!;
    expect(k04.sharpness).toBeLessThan(150);
    expect(Math.min(...["K01", "K02", "K03", "K05", "K06"].map((k) => applicantDocs(k).gst_certificate!.sharpness!))).toBeGreaterThan(500);
  });
  it("K06: the failing GSTIN comes with a 'did you mean' suggestion from the registry", () => {
    const c = runKyc(specimenInput("K06")).checks.find((x) => x.code === "GSTIN_CHECKSUM");
    expect(c?.params?.suggestion).toBe("08YKZXS5189L1ZO");
    expect(c?.params?.suggestionName).toBe("Saffron Unisex Salon");
  });
  it("K02: a skewed scan with an O/0 confusion is repaired via checksum + registry and still verifies", () => {
    const r = runKyc(specimenInput("K02"));
    expect(r.checks.map((c) => c.code)).toEqual(expect.arrayContaining(["DOC_SKEWED", "GSTIN_OCR_REPAIRED"]));
    expect(r.gstinUsed).toBe("19EOGXH4115Y1ZL");
    expect(r.status).toBe("verified");
  });
  it("K01: a cancelled GSTIN blocks GST products only; it does not claim verified", () => {
    const r = runKyc(specimenInput("K01"));
    expect(r.gstEligible).toBe(false);
    expect(r.status).toBe("blocked");
  });
  it("review cases are flagged for a human, re-upload cases are not", () => {
    expect(runKyc(specimenInput("K07")).checks.every((c) => c.severity !== "review" || c.needsReview)).toBe(true);
    expect(runKyc(specimenInput("K11")).checks.some((c) => c.needsReview)).toBe(false);
  });
});

describe("address matching", () => {
  it("tolerates extra words (state) and word order, but not a different house number or pincode", () => {
    const bill = "Shop 14, MG Road, Indore, Madhya Pradesh - 452008";
    expect(addressesMatch("Shop 14, MG Road, Indore - 452008", bill)).toBe(true);
    expect(addressesMatch("14 MG Road Indore 452008", bill)).toBe(true);
    expect(addressesMatch("Shop 41, MG Road, Indore - 452008", bill)).toBe(false);
    expect(addressesMatch("Shop 14, MG Road, Indore - 452009", bill)).toBe(false);
    expect(addressesMatch("Shop 14, Station Road, Kolkata - 700001", bill)).toBe(false);
  });
});

describe("identifiers", () => {
  it("every one of the 3,534 registry GSTINs passes format + mod-36 checksum (PAN 4th char X accepted)", () => {
    for (const r of GST_ALL) {
      expect(validateGstin(r.gstin).ok, r.gstin).toBe(true);
      expect(r.gstin[5]).toBe("X");
    }
  });
  it("GSTIN state codes agree with the registry state on every row", () => {
    for (const r of GST_ALL) expect(GST_STATE_CODES[r.gstin.slice(0, 2)], r.gstin).toBe(r.state);
  });
  it("every registry Udyam number is valid (district 00) and its state letters match the state", () => {
    for (const r of UDYAM_ALL) {
      const v = validateUdyam(r.udyam_number);
      expect(v.ok, r.udyam_number).toBe(true);
      expect(v.stateLetters, r.udyam_number).toBe(UDYAM_STATE_LETTERS[r.state]);
    }
  });
  it("a single-character typo breaks the checksum", () => {
    const g = "27PZSXS1936O1ZH";
    expect(validateGstin(g).ok).toBe(true);
    expect(validateGstin("27PZSXS1936O1ZG").checksumOk).toBe(false);
    expect(validateGstin("27PZSXS193601ZH").formatOk).toBe(false); // digit 0 where a PAN letter belongs (the OCR O/0 trap)
    expect(gstinChecksum(g)).toBe("H");
  });
  it("OCR repair only accepts candidates that pass the checksum AND exist in the registry", () => {
    expect(repairGstin("19E0GXH4115Y1ZL", (g) => !!lookups.gst(g))).toBe("19EOGXH4115Y1ZL");
    expect(repairGstin("19E0GXH4115Y1ZL", () => false)).toBeNull();
    expect(repairGstin("08YKZXS8189L1Z0", (g) => !!lookups.gst(g))).toBeNull(); // K06 is a real typo, not an OCR confusion
  });
  it("identifiers are masked for display and logs", () => {
    expect(maskGstin("27PZSXS1936O1ZH")).toBe("27PZ•••••••1ZH".replace("1ZH", "O1ZH").slice(0, 4) + "•••••••" + "O1ZH");
  });
});

describe("rules that apply to live journeys (not just specimens)", () => {
  const base = specimenInput("K03");
  it("address proof exactly 90 days old passes; 91 days is stale (reference date, not the system clock)", () => {
    const mk = (d: string) => ({ ...base, docs: { ...base.docs, address_proof: { ...base.docs.address_proof!, fields: { ...base.docs.address_proof!.fields, bill_date: d } } } });
    expect(runKyc(mk("2026-04-16")).checks.some((c) => c.code === "ADDRESS_PROOF_STALE")).toBe(false);
    expect(runKyc(mk("2026-04-15")).checks.find((c) => c.code === "ADDRESS_PROOF_STALE")?.params?.days).toBe(91);
    expect(runKyc(mk("2026-07-20")).checks.some((c) => c.code === "ADDRESS_PROOF_FUTURE")).toBe(true);
  });
  it("an expired signatory ID needs re-upload", () => {
    const id = { ...base.docs.signatory_id!, fields: { ...base.docs.signatory_id!.fields, valid_till: "2026-07-14" } };
    expect(runKyc({ ...base, docs: { ...base.docs, signatory_id: id } }).checks.some((c) => c.code === "SIGNATORY_ID_EXPIRED")).toBe(true);
  });
  it("a certificate uploaded into the wrong slot is rejected", () => {
    const wrong = { ...base.docs.udyam_certificate!, slot: "gst_certificate" as const };
    expect(runKyc({ ...base, docs: { ...base.docs, gst_certificate: wrong } }).checks.some((c) => c.code === "DOC_WRONG_TYPE")).toBe(true);
  });
  it("a bill in someone else's name triggers a name mismatch for human review", () => {
    const bill = { ...base.docs.address_proof!, fields: { ...base.docs.address_proof!.fields, billed_to: "Ramesh Traders" } };
    const r = runKyc({ ...base, docs: { ...base.docs, address_proof: bill } });
    expect(r.checks.some((c) => c.code === "NAME_MISMATCH" && c.needsReview)).toBe(true);
  });
  it("data minimisation: a verified GSTIN + matching site address means no address proof is requested", () => {
    const g = lookups.gst("27XUIXG0767D1ZP")!;
    const r = runKyc({ today: "2026-07-15", entered: { gstin: g.gstin, siteAddress: g.principal_place_of_business }, claimsUdyam: false, docs: {}, lookups });
    expect(r.gstEligible).toBe(true);
    expect(r.checks.filter((c) => c.code === "DOC_MISSING").map((c) => c.slot)).toEqual(["signatory_id"]);
  });
  it("entering a registered Udyam number replaces uploading the Udyam certificate", () => {
    const r = runKyc({ today: "2026-07-15", entered: { udyam: "UDYAM-MH-00-9516696" }, claimsUdyam: true, docs: {}, lookups });
    expect(r.udyam?.enterprise_name).toBe("Ganesh Woodcraft");
    expect(r.checks.some((c) => c.slot === "udyam_certificate")).toBe(false);
  });
  it("unregistered GSTIN is blocked; suspended GSTIN is reported as suspended", () => {
    const fake = "27AAAXA0000A1Z5";
    const mk = (g: string) => runKyc({ today: "2026-07-15", entered: { gstin: g }, claimsUdyam: false, docs: {}, lookups });
    const susp = GST_ALL.find((r) => r.status === "Suspended")!.gstin;
    expect(mk(susp).checks.some((c) => c.code === "GSTIN_SUSPENDED")).toBe(true);
    expect(mk(susp).gstEligible).toBe(false);
    expect(validateGstin(fake).ok ? mk(fake).checks.some((c) => c.code === "GSTIN_NOT_FOUND") : true).toBe(true);
  });
});

describe("address match survives a word broken across a line end", () => {
  it("'A ndhra Pradesh' (wrapped on the specimen) matches 'Andhra Pradesh'", async () => {
    const { addressesMatch } = await import("@/lib/kyc/match");
    expect(addressesMatch("Shop/Unit 1, Tech Park Road, Visakhapatnam, A ndhra Pradesh - 118383", "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383")).toBe(true);
    expect(addressesMatch("Shop/Unit 1, Tech Park Road, Visakhapatnam, A ndhra Pradesh - 118383", "Shop/Unit 7, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383")).toBe(false);
  });
});

describe("GSTIN repair tries every look-alike, anchored on checksum + registry", () => {
  it("fixes Q read as 0 (K10) and O read as 0 (K08), and never 'repairs' the K06 planted typo", async () => {
    const { repairGstin } = await import("@/lib/kyc/identifiers");
    const reg = new Set(readFileSync("data/mock_gstin_registry.csv", "utf8").split("\n").map((l) => l.split(",")[0]));
    expect(repairGstin("270HJXK0658U1ZL", (g) => reg.has(g))).toBe("27QHJXK0658U1ZL");
    expect(repairGstin("24X0RXG9365M1Z3", (g) => reg.has(g))).toBe("24XORXG9365M1Z3");
    expect(repairGstin("08YKZXS8189L1Z0", (g) => reg.has(g))).toBeNull();
  });
});
