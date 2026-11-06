/**
 * Applies pending migrations from ./drizzle to DATABASE_URL (local file or Turso). Safe to run repeatedly.
 * Used by the Vercel build (see vercel.json) so the schema is in place before any request is served.
 *   npm run db:migrate
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";

const url = (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) || "file:.data/udyam.db";
if (process.env.VERCEL && url.startsWith("file:")) {
  console.error("DATABASE_URL is not set (or points at a local file) on Vercel — serverless disks don't persist. Set it to your Turso URL.");
  process.exit(1);
}
(async () => {
  if (url.startsWith("file:")) mkdirSync(".data", { recursive: true });
  const client = createClient({ url, authToken: (process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN) || undefined });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  const r = await client.execute("SELECT count(*) AS n FROM __drizzle_migrations");
  console.log(`migrations applied to ${url.replace(/\/\/.*@/, "//***@").split("?")[0]} — ${r.rows[0].n} total`);
  process.exit(0);
})().catch((e) => { console.error("migration failed:", e instanceof Error ? e.message : e); process.exit(1); });
