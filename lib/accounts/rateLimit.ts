import "server-only";
import { eq, sql } from "drizzle-orm";
import { orm } from "@/lib/db/store";
import { rateLimits } from "@/lib/db/schema";
import { HttpError } from "@/lib/api";

/** Fixed-window limiter stored in the database, so it holds across serverless instances. Throws 429 when exceeded. */
export async function limit(key: string, max: number, windowMs: number): Promise<void> {
  const d = await orm();
  const now = Date.now();
  const stale = now - windowMs;
  const rows = await d.insert(rateLimits).values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStart} < ${stale} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${rateLimits.windowStart} < ${stale} THEN ${now} ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
  const r = rows[0];
  if (r && r.count > max) throw new HttpError(429, "TOO_MANY_ATTEMPTS", { retryAfterSec: Math.ceil((r.windowStart + windowMs - now) / 1000) });
}

export async function resetLimit(key: string) {
  const d = await orm();
  await d.delete(rateLimits).where(eq(rateLimits.key, key));
}
