import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import type { ExtractedDoc, Slot } from "./types";

/**
 * Aadhaar Paperless Offline e-KYC, verified locally. The owner downloads a ZIP from myaadhaar.uidai.gov.in, protected by a share phrase
 * of their choice, and uploads it here with that phrase. We (1) open the ZIP with the phrase, (2) check UIDAI's XML-DSig signature
 * against UIDAI's published public key, so an edited or forged file fails, and (3) keep only what KYC needs.
 *
 * Privacy by construction: the file carries no Aadhaar number (only a reference ID whose first four characters are its last four digits),
 * and we throw away the photo and the hashed mobile/email. The ZIP, the XML and the phrase are held in memory for this one request and
 * never stored or logged. Only name, address, state/pincode and the last four digits leave this module.
 *
 * Spec: https://uidai.gov.in/en/aadhaar-paperless-offline-e-kyc  ·  Certificate: lib/kyc/uidai/okyc-publickey.cer (published by UIDAI).
 */

export type AadhaarFailure =
  | "NOT_A_ZIP" | "WRONG_PHRASE" | "NO_XML" | "NOT_UIDAI_XML" | "SIGNATURE_INVALID" | "MALFORMED";

export class AadhaarError extends Error {
  constructor(public code: AadhaarFailure) { super(`Aadhaar offline e-KYC: ${code}`); }
}

export interface AadhaarKyc {
  name: string;
  /** Four-digit year only (data minimisation); the full date of birth is not kept. */
  birthYear: string | null;
  address: string;
  pincode: string | null;
  state: string | null;
  last4: string;
  /** When UIDAI generated the file (from the reference ID), ISO date. */
  generatedOn: string | null;
}

const MAX_ZIP = 2 * 1024 * 1024;
const MAX_XML = 1024 * 1024;

let cachedCert: string | undefined;
/** UIDAI's published certificate (PEM). Tests inject their own key instead. */
export function uidaiCertificate(): string {
  if (!cachedCert) cachedCert = readFileSync(join(process.cwd(), "lib", "kyc", "uidai", "okyc-publickey.cer"), "utf8");
  return cachedCert;
}

/** Opens the share-phrase-protected ZIP and returns the XML text. The phrase is only ever passed to the unzipper. */
async function unzip(zip: Buffer, phrase: string): Promise<string> {
  if (zip.length > MAX_ZIP) throw new AadhaarError("NOT_A_ZIP");
  let reader: ZipReader<Uint8Array>;
  let entries;
  try {
    reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(zip)));
    entries = await reader.getEntries();
  } catch { throw new AadhaarError("NOT_A_ZIP"); }
  const entry = entries.find((e) => !e.directory && /\.xml$/i.test(e.filename));
  if (!entry || !("getData" in entry)) { await reader.close().catch(() => undefined); throw new AadhaarError("NO_XML"); }
  try {
    const text = await entry.getData!(new TextWriter(), { password: phrase });
    if (text.length > MAX_XML) throw new AadhaarError("MALFORMED");
    return text;
  } catch (e) {
    if (e instanceof AadhaarError) throw e;
    throw new AadhaarError("WRONG_PHRASE");
  } finally { await reader.close().catch(() => undefined); }
}

/** Plain XML (already unzipped by the owner) is accepted too; the signature is what matters. */
function looksLikeXml(b: Buffer) { return b.subarray(0, 64).toString("utf8").trimStart().startsWith("<"); }

/** Checks the enveloped signature and returns the signed document text. Anything else in the file is ignored. */
function verifyAndGetSigned(xml: string, certOrKeyPem: string): string {
  const doc = new DOMParser({ onError: () => { throw new AadhaarError("MALFORMED"); } }).parseFromString(xml, "text/xml");
  const root = doc.documentElement;
  if (!root || root.nodeName !== "OfflinePaperlessKyc") throw new AadhaarError("NOT_UIDAI_XML");
  const sigs = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature");
  if (sigs.length !== 1) throw new AadhaarError("SIGNATURE_INVALID");
  const sig = new SignedXml({ publicCert: certOrKeyPem, getCertFromKeyInfo: () => null });
  try {
    sig.loadSignature(sigs[0] as unknown as Node);
    if (!sig.checkSignature(xml)) throw new AadhaarError("SIGNATURE_INVALID");
  } catch (e) {
    if (e instanceof AadhaarError) throw e;
    throw new AadhaarError("SIGNATURE_INVALID");
  }
  // Read data only from what the signature actually covers (defends against a signed copy plus an unsigned extra element).
  const covered = sig.getSignedReferences();
  if (covered.length !== 1 || !covered[0].includes("<UidData")) throw new AadhaarError("SIGNATURE_INVALID");
  return covered[0];
}

const attr = (el: { getAttribute(k: string): string | null } | null, k: string) => (el?.getAttribute(k) ?? "").trim();

function extract(signedXml: string): AadhaarKyc {
  const doc = new DOMParser().parseFromString(signedXml, "text/xml");
  const refId = attr(doc.documentElement, "referenceId");
  const poi = doc.getElementsByTagName("Poi")[0] ?? null;
  const poa = doc.getElementsByTagName("Poa")[0] ?? null;
  const name = attr(poi, "name");
  if (!/^\d{4}/.test(refId) || !name || !poa) throw new AadhaarError("MALFORMED");
  const part = (k: string) => attr(poa, k);
  const address = [part("careof"), part("house"), part("street"), part("loc"), part("vtc"), part("po"), part("subdist"), part("dist"), part("state"), part("pc")]
    .filter(Boolean).join(", ");
  const dob = attr(poi, "dob"); // dd-mm-yyyy, or just a year
  const ts = refId.slice(4);
  return {
    name,
    birthYear: (dob.match(/(\d{4})$/) ?? dob.match(/^(\d{4})/))?.[1] ?? null,
    address,
    pincode: part("pc") || null,
    state: part("state") || null,
    last4: refId.slice(0, 4),
    generatedOn: /^\d{8}/.test(ts) ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : null,
  };
}

/** The whole pipeline. `cert` defaults to UIDAI's published certificate. */
export async function readAadhaarOffline(file: Buffer, phrase: string, cert: string = uidaiCertificate()): Promise<AadhaarKyc> {
  const xml = looksLikeXml(file) ? file.toString("utf8") : await unzip(file, phrase);
  return extract(verifyAndGetSigned(xml, cert));
}

/** Shapes the verified data like any other document so the same rules (name match, address match) apply. Fields are minimal and masked-ready. */
export function aadhaarAsDocument(slot: Extract<Slot, "signatory_id" | "address_proof">, a: AadhaarKyc): ExtractedDoc {
  const masked = `XXXXXXXX${a.last4}`;
  return {
    slot,
    docType: slot,
    legibility: "clear",
    confidence: 1, // a verified digital signature, not a model's guess
    source: "aadhaar_offline",
    fields: slot === "signatory_id"
      ? { name: a.name, designation: "Aadhaar holder (offline e-KYC)", for_business: null, id_no: masked, valid_till: null }
      : { document: "Aadhaar offline e-KYC", consumer_no: masked, billed_to: a.name, address: a.address, bill_date: a.generatedOn },
  };
}

export const AADHAAR_MAX_BYTES = MAX_ZIP;
