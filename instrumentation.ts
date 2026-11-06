/** Runs once per server instance at boot (Next.js instrumentation hook). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnv } = await import("./lib/env");
  const r = checkEnv();
  for (const w of r.warnings) console.warn(`[env] ${w}`);
  if (!r.ok) {
    for (const e of r.errors) console.error(`[env] ${e}`);
    // fail fast in production: a half-configured deployment should not serve customers
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") throw new Error(`Invalid environment: ${r.errors.length} required setting(s) missing (see logs above).`);
  }
}
