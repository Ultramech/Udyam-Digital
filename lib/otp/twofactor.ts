import "server-only";

/**
 * 2Factor.in client (India SMS OTP over its pre-registered DLT template). The API key travels in the URL path, so this module never
 * logs URLs or raw errors — only a short reason.
 */
const BASE = "https://2factor.in/API/V1";
export const twoFactorConfigured = () => !!process.env.TWOFACTOR_API_KEY;

async function call(path: string): Promise<{ Status?: string; Details?: string } | null> {
  try {
    const res = await fetch(`${BASE}/${process.env.TWOFACTOR_API_KEY}/${path}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    return (await res.json().catch(() => null)) as { Status?: string; Details?: string } | null;
  } catch { return null; }
}

/** Sends a 6-digit code to a 10-digit Indian mobile. Returns 2Factor's session id, or null if it did not go out. */
export async function sendOtp(phone10: string): Promise<{ sessionId: string } | { error: string }> {
  const d = await call(`SMS/${phone10}/AUTOGEN`);
  if (!d) return { error: "PROVIDER_UNREACHABLE" };
  if (d.Status === "Success" && d.Details) return { sessionId: d.Details };
  return { error: "PROVIDER_REJECTED" };
}

export async function checkOtp(sessionId: string, code: string): Promise<"match" | "mismatch" | "unreachable"> {
  const d = await call(`SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(code)}`);
  if (!d) return "unreachable";
  return d.Status === "Success" && d.Details === "OTP Matched" ? "match" : "mismatch";
}
