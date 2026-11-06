import "server-only";
import { del, get, newId, put } from "@/lib/db/store";
import { HttpError } from "@/lib/api";
import { checkOtp, sendOtp, twoFactorConfigured } from "./twofactor";

/**
 * One OTP engine for both uses (logging in, signing an order). Fails closed without a provider key. The provider's session id never
 * leaves the server; callers get our opaque `otpId`, bound to a purpose so a login code can never sign an order.
 */
const TTL_MS = 5 * 60_000, MAX_ATTEMPTS = 5, COOLDOWN_MS = 30_000, MAX_SENDS_PER_HOUR = 4;
export type OtpPurpose = "login" | "esign";
interface Pending { phone: string; sessionId: string; purpose: OtpPurpose; bind?: string; createdAt: number; attempts: number }
interface Limiter { times: number[] }

export async function requestOtp(phone: string, purpose: OtpPurpose, bind?: string): Promise<string> {
  if (!twoFactorConfigured()) throw new HttpError(503, "OTP_UNAVAILABLE");
  const now = Date.now();
  const lim = (await get<Limiter>("otp", `rl-${phone}`)) ?? { times: [] };
  const recent = lim.times.filter((t) => now - t < 3600_000);
  if (recent.length && now - recent[recent.length - 1] < COOLDOWN_MS) throw new HttpError(429, "OTP_TOO_SOON");
  if (recent.length >= MAX_SENDS_PER_HOUR) throw new HttpError(429, "OTP_LIMIT");
  const sent = await sendOtp(phone);
  if ("error" in sent) throw new HttpError(502, "OTP_SEND_FAILED");
  await put("otp", `rl-${phone}`, { times: [...recent, now] } satisfies Limiter);
  const otpId = newId("OTP");
  await put("otp", otpId, { phone, sessionId: sent.sessionId, purpose, bind, createdAt: now, attempts: 0 } satisfies Pending);
  return otpId;
}

/** Returns the verified phone (and what the code was bound to). The code is single-use. */
export async function confirmOtp(otpId: string, code: string, purpose: OtpPurpose, bind?: string): Promise<{ phone: string }> {
  if (!twoFactorConfigured()) throw new HttpError(503, "OTP_UNAVAILABLE");
  const p = await get<Pending>("otp", otpId);
  if (!p || p.purpose !== purpose || (bind !== undefined && p.bind !== bind) || Date.now() - p.createdAt > TTL_MS) {
    if (p) await del("otp", otpId);
    throw new HttpError(401, "OTP_EXPIRED");
  }
  if (p.attempts >= MAX_ATTEMPTS) { await del("otp", otpId); throw new HttpError(429, "OTP_ATTEMPTS"); }
  await put("otp", otpId, { ...p, attempts: p.attempts + 1 });
  const r = await checkOtp(p.sessionId, code);
  if (r === "unreachable") throw new HttpError(502, "OTP_VERIFY_FAILED");
  if (r !== "match") throw new HttpError(401, "WRONG_OTP");
  await del("otp", otpId);
  return { phone: p.phone };
}
