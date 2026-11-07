/**
 * Route audit:  BASE=http://localhost:3000 npm run check:routes
 *  1. Every internal link / navigation / API call written in the code points at a route that exists (dynamic segments allowed).
 *  2. Every page renders (HTTP 200).
 *  3. Every API route, called signed-out with no body, answers cleanly: 2xx/3xx/4xx — never 5xx (except documented 503 "not configured").
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { needsAccount } from "../lib/accounts/routes";

const BASE = process.env.BASE ?? "http://localhost:3000";
// forward slashes everywhere, so the route table is the same on Windows as on macOS/Linux
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f).replace(/\\/g, "/"); return statSync(p).isDirectory() ? walk(p) : [p]; });

// ---- route table from the filesystem ----
const files = walk("app");
const toRoute = (f: string) => "/" + relative("app", f).replace(/\\/g, "/").replace(/\/?(page|route)\.tsx?$/, "");
const pages = files.filter((f) => /\/page\.tsx$/.test(f) || f === "app/page.tsx").map(toRoute).map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));
const apis = files.filter((f) => /\/route\.ts$/.test(f)).map(toRoute);
const all = [...pages, ...apis];
const pattern = (r: string) => new RegExp("^" + r.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+") + "/?$");
const matchers = all.map((r) => ({ r, re: pattern(r) }));
const exists = (path: string) => matchers.some((m) => m.re.test(path));

let failures = 0;
const fail = (msg: string) => { failures++; console.log("  ✗", msg); };

// ---- 1. links and calls in source ----
console.log(`1 · ${pages.length} pages, ${apis.length} API routes — checking every internal link and API call in the code`);
const src = [...walk("app"), ...walk("components"), ...walk("lib")].filter((f) => /\.(tsx?|ts)$/.test(f));
const seen = new Set<string>();
const LINK = /(?:href=\{?|router\.(?:push|replace)\(|api(?:<[^>]*>)?\(\s*"(?:GET|POST|PUT|PATCH|DELETE)",\s*|fetch\()\s*[`"']((\/(?:api\/)?)[^`"'?#\s]*)/g;
for (const f of src) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(LINK)) {
    // `${id}` → a segment; an unfinished `${a ? ...` (cut at whitespace) is a dynamic query-string suffix → dropped
    let p = m[1].replace(/\$\{[^}]*\}/g, "X").replace(/\$\{.*$/, "").replace(/\/+$/, "") || "/";
    if (p.startsWith("/_next") || /\.(svg|png|ico|webmanifest|json)$/.test(p)) continue;
    p = p.replace(/X[^/]*/g, "X");
    if (seen.has(p)) continue;
    seen.add(p);
    if (!exists(p)) fail(`${relative(".", f)} → ${m[1]} (no such route)`);
  }
}
console.log(`  ${seen.size} distinct internal targets checked`);

(async () => {
  // ---- 2. pages render ----
  console.log("2 · public pages render; customer pages send signed-out visitors to /login?next=…");
  for (const p of pages.filter((x) => !x.includes("["))) {
    const r = await fetch(BASE + p, { redirect: "manual" });
    if (needsAccount(p)) {
      const loc = r.headers.get("location") ?? "";
      if (r.status !== 307 || !loc.includes(`/login?next=${encodeURIComponent(p)}`)) fail(`GET ${p} signed-out → ${r.status} ${loc} (expected 307 to /login)`); else console.log(`  ✓ ${p} → sign-in`);
    } else if (r.status !== 200) fail(`GET ${p} → ${r.status}`); else console.log(`  ✓ ${p}`);
  }
  // ---- 3. APIs fail cleanly when signed out ----
  console.log("3 · every API answers cleanly signed-out (no 5xx)");
  const fill = (r: string) => r.replace(/\[\.\.\.[^\]]+\]/g, "x").replace(/\[([^\]]+)\]/g, (_, n: string) => (n === "token" ? "aaaaaaaaaaaa" : n === "quoteId" || n === "id" ? "QT-AAAAAA" : "x"));
  for (const r of apis) {
    const path = fill(r);
    const code = readFileSync(files.find((f) => toRoute(f) === r)!, "utf8");
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) => new RegExp(`export (const|async function) ${m}\\b`).test(code))) {
      if (r.startsWith("/api/cron") || r.startsWith("/api/demo/reset")) continue; // mutating admin endpoints, covered by their own tests
      const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json" }, body: method === "GET" || method === "DELETE" ? undefined : "{}", redirect: "manual" });
      const body = await res.text();
      const notConfigured = res.status === 503 && /not[ _]configured|unavailable/i.test(body);
      if (res.status >= 500 && !notConfigured) fail(`${method} ${path} → ${res.status} ${body.slice(0, 80)}`);
    }
  }
  console.log(failures ? `\nFAILURES: ${failures}` : "\nAll routes connected and answering cleanly.");
  process.exit(failures ? 1 : 0);
})();
