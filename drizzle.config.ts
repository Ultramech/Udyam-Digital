import { defineConfig } from "drizzle-kit";

/** `npm run db:generate` writes SQL migrations to ./drizzle from lib/db/schema.ts. Commit them; deploys apply them with `npm run db:migrate`. */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: { url: (process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL) || "file:.data/udyam.db", authToken: (process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN) || undefined },
});
