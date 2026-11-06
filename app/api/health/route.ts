import { db } from "@/lib/db/store";
import { checkEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness for uptime monitors and the post-deploy check: database reachable, migrations applied, environment sane.
 * Returns 200 when ready, 503 otherwise. Never reveals secrets — only names of missing settings.
 */
export async function GET() {
  const started = Date.now();
  const out: Record<string, unknown> = { status: "ok", time: new Date().toISOString(), version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" };
  try {
    const c = await db();
    const r = await c.execute("SELECT count(*) AS n FROM __drizzle_migrations");
    out.database = { ok: true, migrations: Number(r.rows[0].n), latencyMs: Date.now() - started };
  } catch (e) {
    out.status = "degraded";
    out.database = { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "unreachable" };
  }
  const env = checkEnv();
  out.env = { ok: env.ok, missing: env.errors.length, warnings: env.warnings.length, ...(process.env.NODE_ENV !== "production" ? { errors: env.errors, notes: env.warnings } : {}) };
  if (!env.ok) out.status = "degraded";
  return Response.json(out, { status: out.status === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
