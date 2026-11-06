import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * DigiLocker (MeriPehchaan) OAuth 2.0 + PKCE client for pulling issued documents with the owner's permission.
 * Credentials come from DigiLocker partner onboarding via API Setu, which requires a registered organisation; until they are set the
 * feature reports "not configured" and the button stays hidden — nothing is faked. Endpoints are env-overridable because DigiLocker
 * versions its paths.
 */
const BASE = () => (process.env.DIGILOCKER_BASE || "https://digilocker.meripehchaan.gov.in/public/oauth2").replace(/\/+$/, "");
const cfg = () => ({ id: process.env.DIGILOCKER_CLIENT_ID, secret: process.env.DIGILOCKER_CLIENT_SECRET, redirect: process.env.DIGILOCKER_REDIRECT_URI });
export const digilockerConfigured = () => { const c = cfg(); return !!(c.id && c.secret && c.redirect); };

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function pkce() {
  const verifier = b64url(randomBytes(48));
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()), state: b64url(randomBytes(24)) };
}

export function authorizeUrl(state: string, challenge: string): string {
  const c = cfg();
  const u = new URL(`${BASE()}/1/authorize`);
  u.search = new URLSearchParams({ response_type: "code", client_id: c.id!, redirect_uri: c.redirect!, state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  return u.toString();
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const c = cfg();
  const res = await fetch(`${BASE()}/1/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15_000),
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: c.id!, client_secret: c.secret!, redirect_uri: c.redirect!, code_verifier: verifier }),
  });
  if (!res.ok) throw new Error(`digilocker_token_${res.status}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("digilocker_no_token");
  return j.access_token;
}

export interface IssuedDoc { name: string; type: string; uri: string; doctype?: string; issuer?: string; date?: string }
export async function listIssued(token: string): Promise<IssuedDoc[]> {
  const res = await fetch(`${BASE()}/2/files/issued`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`digilocker_list_${res.status}`);
  const j = (await res.json()) as { items?: IssuedDoc[] };
  return j.items ?? [];
}

export async function fetchFile(token: string, uri: string): Promise<{ buf: Buffer; mime: string }> {
  const res = await fetch(`${BASE()}/1/file/${encodeURIComponent(uri)}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`digilocker_file_${res.status}`);
  return { buf: Buffer.from(await res.arrayBuffer()), mime: (res.headers.get("content-type") ?? "application/pdf").split(";")[0] };
}

/** Which issued document can stand in for which KYC slot. Only documents DigiLocker actually issues are matched. */
export function pickFor(slot: string, docs: IssuedDoc[]): IssuedDoc | undefined {
  const by = (re: RegExp) => docs.find((d) => re.test(`${d.doctype ?? ""} ${d.name} ${d.issuer ?? ""}`));
  if (slot === "signatory_id") return by(/\bPANCR\b|PAN Verification|\bPAN\b/i) ?? by(/\bADHAR\b|Aadhaar/i);
  if (slot === "address_proof") return by(/\bADHAR\b|Aadhaar/i);
  if (slot === "udyam_certificate") return by(/udyam/i);
  if (slot === "gst_certificate") return by(/\bGST/i);
  return undefined;
}
