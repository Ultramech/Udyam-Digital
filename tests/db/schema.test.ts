import { describe, expect, it, vi } from "vitest";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { readFileSync, readdirSync } from "node:fs";
import * as schema from "@/lib/db/schema";

vi.mock("server-only", () => ({}));

const tables = (Object.values(schema) as unknown[]).filter((t): t is SQLiteTable => !!t && typeof t === "object" && Symbol.for("drizzle:IsDrizzleTable") in (t as object));
const byName = new Map(tables.map((t) => [getTableConfig(t).name, getTableConfig(t)]));

describe("schema ↔ store registry ↔ migrations stay in sync", () => {
  it("every record kind maps to a real table whose indexed columns exist", async () => {
    const { TABLES } = await import("@/lib/db/store");
    for (const [kind, { table, cols }] of Object.entries(TABLES)) {
      const cfg = byName.get(table);
      expect(cfg, `${kind} → ${table}`).toBeDefined();
      const names = new Set(cfg!.columns.map((c) => c.name));
      for (const c of ["id", "data", "created_at", "updated_at", ...Object.keys(cols)]) expect(names.has(c), `${table}.${c}`).toBe(true);
    }
  });
  it("the committed migrations create every table in the schema (run `npm run db:generate` after editing schema.ts)", () => {
    const sql = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`drizzle/${f}`, "utf8")).join("\n");
    for (const name of byName.keys()) expect(sql, name).toContain(`CREATE TABLE \`${name}\``);
  });
});
