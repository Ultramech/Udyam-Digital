/**
 * Google Gemini (free tier) over plain REST — no SDK. Used for (1) understanding the owner's words, (2) writing the plain-language
 * explanation, (3) reading uploaded documents (vision). Always asks for JSON that matches a schema, at temperature 0.
 * Server-side only: the key never reaches the browser.
 */
import "server-only";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class GeminiError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "RATE_LIMITED" | "UNAVAILABLE" | "BAD_RESPONSE" | "REJECTED", message: string) { super(message); }
}

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
/** Gemini's schema dialect: upper-case type names. */
export type Schema = { type: "OBJECT" | "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN" | "ARRAY"; properties?: Record<string, Schema>; items?: Schema; enum?: string[]; nullable?: boolean; description?: string; required?: string[] };

/**
 * Free-tier quotas are PER MODEL (e.g. 20 requests/day on gemini-2.5-flash), so a live demo can exhaust one model. Calls therefore walk a
 * chain of models, each with its own quota. Vision (document reading) tries every full-size model first and the lite models last (measured on the
 * specimens before being allowed in). A retired model (404) is skipped for a day rather than failing the call. A model that reports quota exhaustion is skipped for a while instead of being hammered.
 */
const csv = (v: string | undefined, d: string) => (v ?? d).split(",").map((m) => m.trim()).filter(Boolean);
const FULL = "gemini-3-flash-preview,gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-flash-latest,gemini-2.5-flash";
const LITE = "gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-2.5-flash-lite";
const FALLBACK_TEXT = csv(process.env.GEMINI_FALLBACK_MODELS, `${FULL},${LITE}`);
// lite models close the vision chain: measured 97.3% field accuracy on all 47 specimens with every planted trap caught (check:ai --ocr)
const FALLBACK_VISION = csv(process.env.GEMINI_FALLBACK_VISION_MODELS, `${FULL},${LITE}`);
const coolUntil = new Map<string, number>();

/**
 * Total time one call may spend across all models and retries. Vercel ends a function at its maxDuration (60 s on these routes);
 * stopping at 40 s leaves time to answer honestly (deterministic advisor / "reader unavailable") instead of a bare 504.
 */
const budgetMs = () => { const n = Number(process.env.GEMINI_BUDGET_MS); return Number.isFinite(n) && n > 0 ? n : 40_000; };

export async function geminiJson<T>(opts: { system: string; parts: Part[]; schema: Schema; timeoutMs?: number; model?: string }): Promise<T> {
  const deadline = Date.now() + budgetMs();
  const primary = opts.model ?? geminiModel();
  const textOnly = opts.parts.every((p) => "text" in p);
  const all = opts.model ? [primary] : [primary, ...(textOnly ? FALLBACK_TEXT : FALLBACK_VISION)];
  const chain = [...new Set(all)];
  const live = chain.filter((m) => (coolUntil.get(m) ?? 0) < Date.now());
  let last: unknown = new GeminiError("RATE_LIMITED", "Every configured Gemini model is rate-limited right now");
  for (const model of live.length ? live : chain.slice(0, 1)) {
    const left = deadline - Date.now();
    if (left < 3_000) { last = new GeminiError("UNAVAILABLE", "Gemini time budget used up"); break; }
    try { return await geminiJsonOnce<T>({ ...opts, model, timeoutMs: Math.min(opts.timeoutMs ?? 25_000, left), deadline }); }
    catch (e) {
      last = e;
      if (e instanceof GeminiError && e.code === "RATE_LIMITED") coolUntil.set(model, Date.now() + (/per day|daily/i.test(e.message) ? 30 * 60_000 : 60_000));
      else if (e instanceof GeminiError && e.code === "UNAVAILABLE") coolUntil.set(model, Date.now() + 30_000);
      else if (e instanceof GeminiError && e.code === "REJECTED" && /\(404\)/.test(e.message)) { coolUntil.set(model, Date.now() + 24 * 3_600_000); continue; } // model retired or not offered to this key: skip it
      if (!(e instanceof GeminiError) || (e.code !== "RATE_LIMITED" && e.code !== "UNAVAILABLE")) throw e;
    }
  }
  throw last;
}

async function geminiJsonOnce<T>(opts: { system: string; parts: Part[]; schema: Schema; timeoutMs?: number; model?: string; deadline?: number }): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("NOT_CONFIGURED", "GEMINI_API_KEY is not set");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseMimeType: "application/json", responseSchema: opts.schema, temperature: 0 },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const remaining = opts.deadline ? opts.deadline - Date.now() : Infinity;
    if (remaining < 2_000) throw new GeminiError("UNAVAILABLE", "Gemini time budget used up");
    const timer = setTimeout(() => ctl.abort(), Math.min(opts.timeoutMs ?? 25_000, remaining));
    try {
      const res = await fetch(`${BASE}/models/${opts.model ?? geminiModel()}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body, signal: ctl.signal,
      });
      if (res.status === 429 || res.status === 503) {
        const body = res.status === 429 ? await res.text().catch(() => "") : "";
        const daily = /PerDay|per day/i.test(body) || /exceeded your current quota/i.test(body);
        // a per-minute limit or an overload may clear in a moment: back off once. A daily quota won't: move to the next model at once.
        if (attempt < 1 && !daily) { await new Promise((r) => setTimeout(r, 1500)); continue; }
        throw new GeminiError(res.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE", `Gemini returned ${res.status}${daily ? " (daily quota)" : ""}`);
      }
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new GeminiError("REJECTED", `Gemini rejected the request (${res.status}): ${j.error?.message?.slice(0, 160) ?? "no detail"}`);
      }
      if (!res.ok) throw new GeminiError("UNAVAILABLE", `Gemini returned ${res.status}`);
      const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new GeminiError("BAD_RESPONSE", `Empty response (finishReason=${j.candidates?.[0]?.finishReason ?? "?"})`);
      try { return JSON.parse(text) as T; } catch { throw new GeminiError("BAD_RESPONSE", "Response was not valid JSON"); }
    } catch (e) {
      if (e instanceof GeminiError) throw e;
      if (e instanceof Error && e.name === "AbortError") throw new GeminiError("UNAVAILABLE", "Gemini timed out"); // never wait twice on a slow call: the next model gets a turn
      if (attempt === 1) throw new GeminiError("UNAVAILABLE", "Could not reach Gemini");
    } finally { clearTimeout(timer); }
  }
  throw new GeminiError("UNAVAILABLE", "Gemini unavailable");
}

/** Lists models this key can use (used by the diagnostics script to confirm the key works and the model exists). */
export async function geminiListModels(): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("NOT_CONFIGURED", "GEMINI_API_KEY is not set");
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  if (!res.ok) throw new GeminiError("REJECTED", `models.list returned ${res.status}`);
  const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (j.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace("models/", ""));
}
