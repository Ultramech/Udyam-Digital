/**
 * Environment check, run once when the server boots (instrumentation.ts) and by /api/health.
 * Production refuses to start with a missing REQUIRED setting (a clear list instead of a mystery 500 later);
 * optional integrations only produce warnings — each feature already reports "not configured" honestly in the app.
 */
export interface EnvReport { ok: boolean; errors: string[]; warnings: string[] }

const has = (k: string) => !!process.env[k]?.trim();

export function checkEnv(env: "production" | "development" = process.env.NODE_ENV === "production" ? "production" : "development"): EnvReport {
  const errors: string[] = [], warnings: string[] = [];
  const db = (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL)?.trim() ?? "";
  if (env === "production") {
    // On Vercel the disk is wiped between invocations, so a local file can't hold data. On your own server (or an evaluator's
    // laptop running `npm start`) the default file database is fine.
    if ((!db || db.startsWith("file:")) && process.env.VERCEL) errors.push("DATABASE_URL must point at a persistent libSQL database (e.g. libsql://<db>.turso.io) — Vercel's disk is wiped.");
    else if (!db || db.startsWith("file:")) warnings.push("Using the local file database (.data/udyam.db) — fine on a single server; use Turso for Vercel or several instances.");
    if (db.startsWith("libsql://") && !has("DATABASE_AUTH_TOKEN") && !has("TURSO_AUTH_TOKEN")) errors.push("DATABASE_AUTH_TOKEN is required for Turso.");
    if (!has("PUBLIC_BASE_URL")) warnings.push("PUBLIC_BASE_URL not set — links in SMS/WhatsApp/Telegram messages and webhooks fall back to the Vercel URL.");
    if (!has("CRON_SECRET")) warnings.push("CRON_SECRET not set — the daily housekeeping job (reminders, stuck-order sweep) will refuse to run.");
    if (process.env.DEMO_MODE !== "false" && !has("ADMIN_EMAIL")) warnings.push("DEMO_MODE is on and no ADMIN_EMAIL — only demo staff accounts can sign in. Fine for judging, not for real use.");
    if (process.env.DEMO_MODE === "false" && !has("ADMIN_EMAIL")) errors.push("DEMO_MODE=false needs ADMIN_EMAIL + ADMIN_PASSWORD (run `npm run db:seed`), or nobody can sign in to /ops.");
    if (process.env.ALLOW_TEST_VERIFY === "1") warnings.push("ALLOW_TEST_VERIFY=1 is ignored in production builds — remove it.");
  }
  const optional: [string[], string][] = [
    [["GEMINI_API_KEY"], "advisor language understanding and document reading (KYC uploads are refused without it)"],
    [["TWOFACTOR_API_KEY"], "SMS OTP — without it nobody can sign in or order"],
    [["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "NEXT_PUBLIC_RAZORPAY_KEY_ID"], "payments"],
    [["TELEGRAM_BOT_TOKEN"], "Telegram bot"],
  ];
  for (const [keys, what] of optional) if (!keys.every(has)) warnings.push(`${keys.join(" + ")} not set — ${what}.`);
  return { ok: errors.length === 0, errors, warnings };
}
