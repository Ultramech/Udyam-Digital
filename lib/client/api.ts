import { useMemo, useSyncExternalStore } from "react";

export class ApiError extends Error {
  constructor(public status: number, public code: string, public data: Record<string, unknown> = {}) { super(code); }
}

export async function api<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "ERROR", data);
  return data as T;
}

// ---- resume-able journey (browser only; every access is guarded because storage can be blocked) -------------------
export interface Journey { conversationId?: string; quoteId?: string; orders: { id: string; token: string; name: string }[]; tickets?: { id: string; token: string }[]; seenEvents?: string[]; payOutcome?: "success" | "fail" | "pending"; attribution?: { source?: string; partnerCode?: string; referrer?: string } }
const KEY = "ud_journey";
export function readJourney(): Journey {
  try { return { orders: [], ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Journey>) }; } catch { return { orders: [] }; }
}
export function writeJourney(patch: Partial<Journey>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readJourney(), ...patch })); window.dispatchEvent(new Event(EVT)); } catch { /* ignore */ }
}
export function clearJourney() { try { localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVT)); } catch { /* ignore */ } }

// ---- React binding: the journey as an external store (no setState-in-effect, no hydration mismatch) ----------------
const EVT = "ud-journey";
const subscribe = (cb: () => void) => { window.addEventListener("storage", cb); window.addEventListener(EVT, cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener(EVT, cb); }; };
const snapshot = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
/** null during server render / hydration; the device's journey afterwards. Re-renders when any tab writes it. */
export function useJourney(): Journey | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => { if (raw === null) return null; try { return { orders: [], ...(JSON.parse(raw || "{}") as Partial<Journey>) }; } catch { return { orders: [] }; } }, [raw]);
}

/** Campaign / partner tracking from the landing URL (?src=, ?partner=). Tracking only — sales credit never comes from a URL. */
export function captureAttribution(search: string) {
  try {
    const p = new URLSearchParams(search);
    const ref = p.get("ref"), referrer = ref && /^R-[a-z0-9]{8}$/.test(ref) ? ref : undefined;
    const source = (p.get("src") ?? (referrer ? "referral" : null))?.slice(0, 40), partnerCode = p.get("partner")?.slice(0, 20);
    if (source || partnerCode || referrer) writeJourney({ attribution: { ...(readJourney().attribution ?? {}), ...(source ? { source } : {}), ...(partnerCode ? { partnerCode } : {}), ...(referrer ? { referrer } : {}) } });
  } catch { /* ignore */ }
}
