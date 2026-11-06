export {};
/**
 * Adds the installation roster through the ops API (the same path ops use). Usage: BASE=http://localhost:3000 npx tsx scripts/seed-roster.ts
 * Names/numbers here are placeholders for the operator's real field team — replace them with real staff before any real use.
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
const jar: Record<string, string> = {};
async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, { method, headers: { "content-type": "application/json", cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") }, body: body ? JSON.stringify(body) : undefined });
  for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); jar[k] = v.join("="); }
  return { status: res.status, data: await res.json().catch(() => ({})) } as { status: number; data: any };
}
(async () => {
  await call("POST", "/api/ops/session", { id: "OPS1" });
  const have = (await call("GET", "/api/ops/engineers")).data.engineers ?? [];
  for (const [name, phone] of [["Ravi Deshmukh", "9876543221"], ["Sunita Nair", "9765432154"], ["Imran Qureshi", "9987654308"]]) {
    if (have.some((e: any) => e.name === name)) { console.log("exists:", name); continue; }
    const r = await call("POST", "/api/ops/engineers", { name, phone, cities: ["*"] });
    console.log(r.status === 200 ? "added:" : "FAILED:", name, r.status);
  }
})();
