/**
 * Persistence: libSQL (a local SQLite file in development, Turso when DATABASE_URL points at it — same code, same SQL).
 *
 * Schema = lib/db/schema.ts, applied by versioned migrations in ./drizzle (`npm run db:migrate`).
 * Workflow records keep a simple typed API (put/get/list/update by kind + id) but each kind lives in its OWN table, with the
 * columns we filter or join on extracted on every write (see TABLES) and the full aggregate in `data` (JSON).
 * Identity/profile tables are accessed relationally through `orm()` (lib/accounts/*).
 */
import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { customAlphabet } from "nanoid";
import * as schema from "./schema";

export type Kind = "session" | "conversation" | "lead" | "quote" | "consent" | "kyc" | "order" | "event" | "audit" | "analytics" | "otp" | "document" | "pincode" | "coverage" | "engineer" | "booking" | "oauth" | "tglink" | "optout" | "share" | "referral" | "catalogue_override" | "catalogue_change" | "ticket" | "kyc_file";

type Doc = Record<string, unknown> & { [k: string]: unknown };
type Extract = (d: Doc) => string | number | null | undefined;
const s = (v: unknown) => (typeof v === "string" && v ? v : null);
const at = (d: Doc, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Doc)[k] : undefined), d);

/** Kind → table + indexed columns. Must match lib/db/schema.ts (asserted by tests/db/schema.test.ts). */
export const TABLES: Record<Kind, { table: string; cols: Record<string, Extract> }> = {
  session: { table: "visitor_sessions", cols: { user_id: (d) => s(d.userId), verified: (d) => (d.verified ? 1 : 0) } },
  conversation: { table: "conversations", cols: { session_id: (d) => s(d.sessionId), user_id: (d) => s(d.userId), lead_id: (d) => s(d.leadId) } },
  lead: { table: "leads", cols: { status: (d) => s(d.status), owner_id: (d) => s(d.ownerId), level: (d) => s(d.level), order_id: (d) => s(d.orderId) } },
  quote: { table: "quotes", cols: { session_id: (d) => s(d.sessionId), user_id: (d) => s(d.userId), business_id: (d) => s(d.businessId), order_id: (d) => s(d.orderId) } },
  consent: { table: "consents", cols: { quote_id: (d) => s(d.quoteId), session_id: (d) => s(d.sessionId) } },
  kyc: { table: "kyc_cases", cols: { quote_id: (d) => s(d.quoteId), status: (d) => s(d.status) } },
  order: { table: "orders", cols: {
    user_id: (d) => s(d.userId), business_id: (d) => s(d.businessId), quote_id: (d) => s(d.quoteId), stage: (d) => s(d.stage),
    payment_status: (d) => s(at(d, "payment.status")), kyc_status: (d) => s(d.kycStatus), cancelled: (d) => (d.cancelled ? 1 : 0),
  } },
  event: { table: "order_events", cols: { order_id: (d) => s(d.orderId) } },
  audit: { table: "audit_logs", cols: { actor: (d) => s(d.actor), entity: (d) => s(d.entity), entity_id: (d) => s(d.entityId) } },
  ticket: { table: "support_tickets", cols: { user_id: (d) => s(d.userId), session_id: (d) => s(d.sessionId), order_id: (d) => s(d.orderId), status: (d) => s(d.status) } },
  booking: { table: "bookings", cols: { order_id: (d) => s(d.orderId) } },
  share: { table: "shares", cols: { quote_id: (d) => s(d.quoteId) } },
  catalogue_change: { table: "catalogue_changes", cols: { product_id: (d) => s(d.productId) } },
  analytics: { table: "kv_analytics", cols: {} },
  otp: { table: "otp_challenges", cols: {} },
  document: { table: "documents", cols: {} },
  pincode: { table: "pincode_cache", cols: {} },
  coverage: { table: "coverage_overrides", cols: {} },
  engineer: { table: "engineers", cols: {} },
  oauth: { table: "oauth_states", cols: {} },
  tglink: { table: "telegram_links", cols: {} },
  optout: { table: "channel_optouts", cols: {} },
  referral: { table: "referrals", cols: {} },
  catalogue_override: { table: "catalogue_overrides", cols: {} },
  kyc_file: { table: "kyc_file_fingerprints", cols: {} },
};

// ---- connection + migrations ---------------------------------------------------------------------------------------
type G = typeof globalThis & { __udyamDb?: Promise<Client> };
export const databaseUrl = () => process.env.DATABASE_URL || "file:.data/udyam.db"; // `||`: an empty DATABASE_URL= line falls back
export const migrationsFolder = () => join(process.cwd(), "drizzle");

/** Migrates on first use (see autoMigrate); where it doesn't (Vercel), verifies the schema exists and fails with a clear message. */
async function init(): Promise<Client> {
  const url = databaseUrl();
  if (url.startsWith("file:")) mkdirSync(".data", { recursive: true });
  const c = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  if (url.startsWith("file:")) await c.execute("PRAGMA foreign_keys = ON");
  if (autoMigrate()) await migrate(drizzle(c), { migrationsFolder: migrationsFolder() });
  else {
    const r = await c.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'");
    if (!r.rows.length) throw new Error("Database schema missing — run `npm run db:migrate` against DATABASE_URL before starting.");
  }
  return c;
}
/** A failed connection is not cached — the next request retries instead of every request failing until a restart. */
export const db = () => {
  const g = globalThis as G;
  const p = (g.__udyamDb ??= init().catch((e) => { g.__udyamDb = undefined; throw e; }));
  return autoMigrate() ? p.then(catchUpMigrations) : p;
};

/**
 * Migrate automatically everywhere EXCEPT Vercel (concurrent cold starts would race; there the build runs `npm run db:migrate`).
 * So `npm run dev`, `npm start` on a laptop and tests all just work on a fresh clone. DB_AUTO_MIGRATE=true|false overrides.
 */
const autoMigrate = () => (process.env.DB_AUTO_MIGRATE ? process.env.DB_AUTO_MIGRATE === "true" : !process.env.VERCEL);
type M = typeof globalThis & { __udyamMig?: { checkedAt: number; count: number; running?: Promise<void> } };
/** Dev only: a migration pulled in while the server is running is applied on the next request (checked at most every 2 s). */
async function catchUpMigrations(c: Client): Promise<Client> {
  const g = globalThis as M;
  const st = (g.__udyamMig ??= { checkedAt: 0, count: -1 });
  if (Date.now() - st.checkedAt < 2000) { await st.running; return c; }
  st.checkedAt = Date.now();
  let count = st.count;
  try { count = (JSON.parse(readFileSync(join(migrationsFolder(), "meta", "_journal.json"), "utf8")) as { entries: unknown[] }).entries.length; } catch { return c; }
  if (count !== st.count) {
    st.running = st.count === -1 ? Promise.resolve() : migrate(drizzle(c), { migrationsFolder: migrationsFolder() });
    await st.running;
    st.count = count;
  }
  return c;
}
/** Typed query builder over the same connection, for the relational identity tables. */
export async function orm(): Promise<LibSQLDatabase<typeof schema>> { return drizzle(await db(), { schema }); }

// ---- record API ----------------------------------------------------------------------------------------------------
function row(kind: Kind, id: string, data: unknown) {
  const t = TABLES[kind];
  const cols = Object.keys(t.cols);
  const vals = cols.map((c) => t.cols[c](data as Doc) ?? null);
  return { t, cols, vals, json: JSON.stringify(data) };
}

export async function put<T>(kind: Kind, id: string, data: T): Promise<T> {
  const { t, cols, vals, json } = row(kind, id, data);
  const now = Date.now();
  const names = ["id", "data", "created_at", "updated_at", ...cols];
  await (await db()).execute({
    sql: `INSERT INTO ${t.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at${cols.map((c) => `, ${c} = excluded.${c}`).join("")}`,
    args: [id, json, now, now, ...vals],
  });
  return data;
}

/** Insert only if the id is free; returns false when it is already taken (used as a uniqueness lock, e.g. slot bookings). */
export async function putIfAbsent<T>(kind: Kind, id: string, data: T): Promise<boolean> {
  const { t, cols, vals, json } = row(kind, id, data);
  const now = Date.now();
  const names = ["id", "data", "created_at", "updated_at", ...cols];
  const r = await (await db()).execute({
    sql: `INSERT INTO ${t.table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")}) ON CONFLICT(id) DO NOTHING`,
    args: [id, json, now, now, ...vals],
  });
  return r.rowsAffected === 1;
}

export async function get<T>(kind: Kind, id: string): Promise<T | null> {
  const r = await (await db()).execute({ sql: `SELECT data FROM ${TABLES[kind].table} WHERE id = ?`, args: [id] });
  return r.rows[0] ? (JSON.parse(String(r.rows[0].data)) as T) : null;
}

export async function list<T>(kind: Kind, opts: { limit?: number; newestFirst?: boolean } = {}): Promise<T[]> {
  const r = await (await db()).execute({
    sql: `SELECT data FROM ${TABLES[kind].table} ORDER BY created_at ${opts.newestFirst === false ? "ASC" : "DESC"}, rowid ${opts.newestFirst === false ? "ASC" : "DESC"} LIMIT ?`,
    args: [opts.limit ?? 500],
  });
  return r.rows.map((x) => JSON.parse(String(x.data)) as T);
}

/** Indexed lookup on one of the kind's extracted columns (e.g. all events of an order, all orders of a user). */
export async function listBy<T>(kind: Kind, column: string, value: string | number, opts: { limit?: number; newestFirst?: boolean } = {}): Promise<T[]> {
  const t = TABLES[kind];
  if (!(column in t.cols)) throw new Error(`${kind} has no indexed column ${column}`);
  const dir = opts.newestFirst === false ? "ASC" : "DESC";
  const r = await (await db()).execute({ sql: `SELECT data FROM ${t.table} WHERE ${column} = ? ORDER BY created_at ${dir}, rowid ${dir} LIMIT ?`, args: [value, opts.limit ?? 500] });
  return r.rows.map((x) => JSON.parse(String(x.data)) as T);
}

/** Read-modify-write. Last writer wins — fine for this workload; uniqueness-critical paths use putIfAbsent. */
export async function update<T>(kind: Kind, id: string, fn: (cur: T) => T): Promise<T | null> {
  const cur = await get<T>(kind, id);
  if (!cur) return null;
  return put(kind, id, fn(cur));
}

export async function del(kind: Kind, id: string): Promise<void> {
  await (await db()).execute({ sql: `DELETE FROM ${TABLES[kind].table} WHERE id = ?`, args: [id] });
}

export async function clear(kinds?: Kind[]): Promise<void> {
  const c = await db();
  for (const k of kinds ?? (Object.keys(TABLES) as Kind[])) await c.execute(`DELETE FROM ${TABLES[k].table}`);
}

const upper = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);
const lower = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 12);
const secret = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", 32);
export const newId = (prefix: string) => `${prefix}-${upper()}`;
export const newToken = () => lower();
/** ~187 bits: for bearer secrets (session cookies). Never stored as-is — only its hash. */
export const newSecret = () => secret();
