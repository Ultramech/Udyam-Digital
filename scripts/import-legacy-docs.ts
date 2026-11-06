/**
 * One-off: copies records from the pre-migration `docs` table (kind, id, data) into the per-kind tables.
 * Idempotent (upserts by id, keeps the original created_at). The old table is left untouched; drop it yourself once happy.
 *   npm run db:import-legacy
 */
import { createClient } from "@libsql/client";
import { TABLES, databaseUrl, db, type Kind } from "../lib/db/store";

(async () => {
  await db(); // runs migrations first (dev)
  const c = createClient({ url: databaseUrl(), authToken: (process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN) || undefined });
  const has = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='docs'");
  if (!has.rows.length) { console.log("No legacy `docs` table — nothing to import."); return; }
  const rows = await c.execute("SELECT kind, id, data, created_at, updated_at FROM docs");
  const counts: Record<string, number> = {}; let skipped = 0;
  for (const r of rows.rows) {
    const kind = String(r.kind) as Kind;
    const t = TABLES[kind];
    if (!t) { skipped++; continue; }
    const data = JSON.parse(String(r.data));
    const cols = Object.keys(t.cols);
    const names = ["id", "data", "created_at", "updated_at", ...cols];
    await c.execute({
      sql: `INSERT INTO ${t.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at${cols.map((x) => `, ${x} = excluded.${x}`).join("")}`,
      args: [String(r.id), String(r.data), Number(r.created_at), Number(r.updated_at), ...cols.map((x) => t.cols[x](data) ?? null)],
    });
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  console.log(`Imported ${rows.rows.length - skipped} records`, counts, skipped ? `· skipped ${skipped} of unknown kinds` : "");
})().catch((e) => { console.error(e); process.exit(1); });
