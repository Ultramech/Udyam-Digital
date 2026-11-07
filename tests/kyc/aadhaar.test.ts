import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { generateKeyPairSync } from "node:crypto";
import { Uint8ArrayReader, Uint8ArrayWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { SignedXml } from "xml-crypto";
import { AadhaarError, aadhaarAsDocument, readAadhaarOffline } from "@/lib/kyc/aadhaar";
import { splitProprietor } from "@/lib/kyc/match";
import { runKyc } from "@/lib/kyc/validate";
import { GST_ALL, TODAY, lookups } from "./helpers";

/** A file shaped exactly like UIDAI's offline e-KYC, signed with a key we generate (UIDAI's private key is, of course, not ours). */
const keys = () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), pub: publicKey.export({ type: "spki", format: "pem" }).toString() };
};
const K = keys();
const OTHER = keys();

const body = (name = "Ramesh Kumar Sharma") =>
  `<OfflinePaperlessKyc referenceId="363220260715101010123"><UidData><Poi dob="14-03-1981" gender="M" name="${name}" e="deadbeef" m="cafebabe"/>` +
  `<Poa careof="S/O Ganesh Sharma" country="India" dist="Indore" house="Shop 4" loc="Rajwada" pc="452001" po="Rajwada" state="Madhya Pradesh" street="MG Road" subdist="Indore" vtc="Indore"/>` +
  `<Pht>ZmFrZS1waG90bw==</Pht></UidData></OfflinePaperlessKyc>`;

function sign(xml: string, priv = K.priv): string {
  const s = new SignedXml({ privateKey: priv, canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315", signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" });
  s.addReference({ xpath: "/*", uri: "", digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256", transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"] });
  s.computeSignature(xml);
  return s.getSignedXml();
}

async function zipped(xml: string, phrase: string): Promise<Buffer> {
  const w = new ZipWriter(new Uint8ArrayWriter(), { password: phrase, encryptionStrength: 3 });
  await w.add("offlineaadhaar.xml", new TextReader(xml));
  return Buffer.from(await w.close());
}

describe("Aadhaar offline e-KYC verifier", () => {
  it("opens the ZIP with the share phrase, verifies the signature and keeps only what KYC needs", async () => {
    const a = await readAadhaarOffline(await zipped(sign(body()), "Lock@487"), "Lock@487", K.pub);
    expect(a).toMatchObject({ name: "Ramesh Kumar Sharma", last4: "3632", birthYear: "1981", pincode: "452001", state: "Madhya Pradesh", generatedOn: "2026-07-15" });
    expect(a.address).toContain("Shop 4");
    // nothing else leaves the module: no photo, no hashed mobile/email, no full date of birth
    expect(JSON.stringify(a)).not.toMatch(/ZmFrZS1waG90bw|deadbeef|cafebabe|14-03-1981/);
  });

  it("refuses a wrong share phrase", async () => {
    await expect(readAadhaarOffline(await zipped(sign(body()), "Lock@487"), "wrong-phrase", K.pub)).rejects.toMatchObject({ code: "WRONG_PHRASE" });
  });

  it("refuses a file edited after UIDAI signed it (name changed)", async () => {
    const signed = sign(body());
    const forged = signed.replace("Ramesh Kumar Sharma", "Someone Else Entirely");
    await expect(readAadhaarOffline(await zipped(forged, "Lock@487"), "Lock@487", K.pub)).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });

  it("refuses a file signed by anyone other than UIDAI's key", async () => {
    await expect(readAadhaarOffline(await zipped(sign(body(), OTHER.priv), "Lock@487"), "Lock@487", K.pub)).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });

  it("refuses an unsigned file, a non-UIDAI XML and a non-ZIP", async () => {
    await expect(readAadhaarOffline(await zipped(body(), "Lock@487"), "Lock@487", K.pub)).rejects.toBeInstanceOf(AadhaarError);
    await expect(readAadhaarOffline(await zipped(sign("<Other><UidData/></Other>"), "Lock@487"), "Lock@487", K.pub)).rejects.toMatchObject({ code: "NOT_UIDAI_XML" });
    await expect(readAadhaarOffline(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), "x", K.pub)).rejects.toMatchObject({ code: "NOT_A_ZIP" });
  });

  it("does not trust an unsigned element smuggled next to the signed one", async () => {
    const signed = sign(body());
    const wrapped = signed.replace("</OfflinePaperlessKyc>", `<Poi name="Attacker" dob="01-01-1990"/></OfflinePaperlessKyc>`);
    await expect(readAadhaarOffline(await zipped(wrapped, "Lock@487"), "Lock@487", K.pub)).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });

  it("accepts the XML if the owner already unzipped it", async () => {
    const a = await readAadhaarOffline(Buffer.from(sign(body())), "", K.pub);
    expect(a.name).toBe("Ramesh Kumar Sharma");
  });

  it("plugs into the KYC rules: a proprietor's Aadhaar verifies the signatory when the name matches the registry owner", async () => {
    const prop = GST_ALL.find((r) => r.constitution === "Proprietorship" && r.status === "Active")!;
    const owner = splitProprietor(prop.legal_name).owner;
    const mk = (name: string) => aadhaarAsDocument("signatory_id", { name, birthYear: null, address: "x", pincode: null, state: null, last4: "3632", generatedOn: TODAY });
    const ok = runKyc({ today: TODAY, entered: { gstin: prop.gstin }, claimsUdyam: false, docs: { signatory_id: mk(owner) }, lookups });
    expect(ok.checks.filter((c) => c.slot === "signatory_id")).toEqual([]);
    const bad = runKyc({ today: TODAY, entered: { gstin: prop.gstin }, claimsUdyam: false, docs: { signatory_id: mk("Completely Different Person") }, lookups });
    expect(bad.checks.some((c) => c.code === "SIGNATORY_NOT_LINKED" && c.severity === "review")).toBe(true);
  });
});
