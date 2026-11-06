import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { syncCatalogue } from "@/lib/catalogue/sync";

export class HttpError extends Error {
  constructor(public status: number, public code: string, public extra?: Record<string, unknown>) { super(code); }
}
export const ok = <T,>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

/** Wraps a handler: HttpError → JSON error with status, zod validation failures → 400, anything else → 500 (message hidden). */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try { await syncCatalogue(); return await fn(...args); }
    catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.code, ...e.extra }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
      console.error("API error", e instanceof Error ? e.message : "unknown");
      return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new HttpError(400, "INVALID_JSON"); }
  return schema.parse(raw);
}
export const notFound = (what: string) => new HttpError(404, `${what.toUpperCase()}_NOT_FOUND`);
