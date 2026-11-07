import "server-only";

/**
 * DigiLocker and EntityLocker through Sandbox.co.in, a licensed KYC-API provider that holds the DigiLocker partner access itself, so no
 * registered organisation of our own is needed. The owner logs in to their own DigiLocker (or business EntityLocker) and consents on the
 * government screen; we only ever receive the documents they chose to share, as short-lived download links.
 *
 * Docs: https://developer.sandbox.co.in/api-reference/kyc/overview. Keys: SANDBOX_API_KEY / SANDBOX_API_SECRET. A `key_test…` key talks to the
 * free test host, a `key_live…` key to the billed production host (override with SANDBOX_API_BASE).
 */

export type Locker = "digilocker" | "entitylocker";
/** What each KYC slot can be filled from. DigiLocker gives identity documents; EntityLocker gives the business's own registrations. */
export const SLOT_SOURCE = {
  signatory_id: { locker: "digilocker", docType: "aadhaar" },
  address_proof: { locker: "digilocker", docType: "aadhaar" },
  gst_certificate: { locker: "entitylocker", docType: "gstn_details" },
  udyam_certificate: { locker: "entitylocker", docType: "udhyam_certificate" },
} as const;
export type SlotWithLocker = keyof typeof SLOT_SOURCE;

const key = () => process.env.SANDBOX_API_KEY;
const secret = () => process.env.SANDBOX_API_SECRET;
export const aggregatorConfigured = () => !!(key() && secret());
export const aggregatorMode = (): "test" | "live" | null => (!aggregatorConfigured() ? null : key()!.startsWith("key_test") ? "test" : "live");
const base = () => (process.env.SANDBOX_API_BASE || (aggregatorMode() === "test" ? "https://test-api.sandbox.co.in" : "https://api.sandbox.co.in")).replace(/\/+$/, "");

export class AggregatorError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "AUTH" | "REJECTED" | "UNAVAILABLE" | "BAD_RESPONSE", public status?: number) { super(`DigiLocker provider: ${code}${status ? ` (${status})` : ""}`); }
}

let token: { value: string; at: number } | null = null;
const TOKEN_TTL = 20 * 60 * 60 * 1000; // tokens last 24 h; refresh early

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, retryAuth = true): Promise<T> {
  if (!aggregatorConfigured()) throw new AggregatorError("NOT_CONFIGURED");
  const headers: Record<string, string> = { "x-api-key": key()!, "x-api-version": "1.0", "content-type": "application/json" };
  if (path === "/authenticate") headers["x-api-secret"] = secret()!;
  else {
    if (!token || Date.now() - token.at > TOKEN_TTL) await authenticate();
    headers.authorization = token!.value; // no "Bearer" prefix, per the provider's docs
  }
  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  } catch { throw new AggregatorError("UNAVAILABLE"); }
  if (res.status === 401 || res.status === 403) {
    if (path !== "/authenticate" && retryAuth) { token = null; return call<T>(method, path, body, false); }
    throw new AggregatorError("AUTH", res.status);
  }
  if (!res.ok) throw new AggregatorError(res.status >= 500 ? "UNAVAILABLE" : "REJECTED", res.status);
  try { return (await res.json()) as T; } catch { throw new AggregatorError("BAD_RESPONSE"); }
}

async function authenticate() {
  const r = await call<{ data?: { access_token?: string } }>("POST", "/authenticate");
  if (!r.data?.access_token) throw new AggregatorError("BAD_RESPONSE");
  token = { value: r.data.access_token, at: Date.now() };
}

/** Starts a consent session. The owner is sent to `url`; afterwards they land on `redirectUrl` (must be public HTTPS). */
export async function startSession(locker: Locker, redirectUrl: string): Promise<{ sessionId: string; url: string }> {
  const body = locker === "digilocker"
    ? { "@entity": "in.co.sandbox.kyc.digilocker.session.request", flow: "signin", redirect_url: redirectUrl, doc_types: ["aadhaar"], purpose: "Know Your Customer", requestor_name: "Udyam Digital" }
    : { "@entity": "in.co.sandbox.kyc.entitylocker.session.request", flow: "signin", redirect_url: redirectUrl };
  const r = await call<{ data?: { session_id?: string; authorization_url?: string } }>("POST", `/kyc/${locker}/sessions/init`, body);
  if (!r.data?.session_id || !r.data.authorization_url) throw new AggregatorError("BAD_RESPONSE");
  return { sessionId: r.data.session_id, url: r.data.authorization_url };
}

export type SessionState = "created" | "succeeded" | "failed" | "expired";
export async function sessionStatus(locker: Locker, sessionId: string): Promise<{ status: SessionState; consented: string[] }> {
  const r = await call<{ data?: { status?: SessionState; documents_consented?: string[] } }>("GET", `/kyc/${locker}/sessions/${encodeURIComponent(sessionId)}/status`);
  if (!r.data?.status) throw new AggregatorError("BAD_RESPONSE");
  return { status: r.data.status, consented: r.data.documents_consented ?? [] };
}

const MAX_FILE = 5 * 1024 * 1024;
/** The first file of that type, downloaded into memory. The link is short-lived and the bytes are never written to disk. */
export async function fetchDocument(locker: Locker, sessionId: string, docType: string): Promise<{ buf: Buffer; mime: string } | null> {
  const r = await call<{ data?: { files?: { url: string; size?: number; metadata?: { ContentType?: string } }[] } }>("GET", `/kyc/${locker}/sessions/${encodeURIComponent(sessionId)}/documents/${docType}`);
  const f = r.data?.files?.[0];
  if (!f?.url) return null;
  if ((f.size ?? 0) > MAX_FILE) throw new AggregatorError("BAD_RESPONSE");
  let res: Response;
  try { res = await fetch(f.url, { signal: AbortSignal.timeout(20_000) }); } catch { throw new AggregatorError("UNAVAILABLE"); }
  if (!res.ok) throw new AggregatorError("UNAVAILABLE", res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FILE) throw new AggregatorError("BAD_RESPONSE");
  return { buf, mime: (f.metadata?.ContentType ?? res.headers.get("content-type") ?? "application/pdf").split(";")[0] };
}

/** Test seam: forget the cached access token. */
export const _resetToken = () => { token = null; };
