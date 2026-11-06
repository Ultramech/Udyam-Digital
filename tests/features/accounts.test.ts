/**
 * Accounts: customer sign-in (phone proved → account + hashed session, visitor records claimed), profile, businesses, devices,
 * export, deletion; staff password login, rate limit, demo-mode gate, forged cookies, deactivation. Real routes + real DB file.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useTempDb } from "./helpers";

vi.mock("server-only", () => ({}));
let jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0 (iPhone)", "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k: string, v: string) => { jar.set(k, v); }, delete: (k: string) => { jar.delete(k); } }),
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

let S: typeof import("@/lib/db/store");
const req = (method: string, body?: unknown) => new Request("http://t/x", { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const json = async (r: Response) => ({ status: r.status, body: await r.json() });
const P = <T,>(v: T) => ({ params: Promise.resolve(v) });

beforeAll(async () => {
  useTempDb();
  process.env.ALLOW_TEST_VERIFY = "1";
  S = await import("@/lib/db/store");
});
beforeEach(() => { jar = new Map(); delete process.env.DEMO_MODE; });

async function signIn(phone: string) {
  const { POST } = await import("@/app/api/demo/verify/route");
  return json(await POST(req("POST", { phone })));
}

describe("customer accounts", () => {
  it("proving a phone creates the account, a hashed session, and claims what the visitor did before", async () => {
    jar.set("ud_sid", "S-visitor1");
    await S.put("session", "S-visitor1", { id: "S-visitor1", verified: false, lang: "hi", attribution: {}, createdAt: Date.now() });
    await S.put("quote", "QT-CLAIM1", { id: "QT-CLAIM1", sessionId: "S-visitor1", profile: {}, lines: [], bundleId: "dukaan", createdAt: Date.now() });
    const r = await signIn("9876500011");
    expect(r.status).toBe(200);
    expect(r.body.user.isNew).toBe(true);
    expect(r.body.claimed).toBe(1);
    const token = jar.get("ud_auth")!;
    expect(token.length).toBeGreaterThanOrEqual(32);
    const db = await S.db();
    const row = (await db.execute("SELECT token_hash FROM user_sessions")).rows[0];
    expect(String(row.token_hash)).not.toContain(token); // only the hash is stored
    expect((await S.get<{ userId?: string }>("quote", "QT-CLAIM1"))!.userId).toBe(r.body.user.id);
    const v = await S.get<{ verified: boolean; userId: string }>("session", "S-visitor1");
    expect(v).toMatchObject({ verified: true, userId: r.body.user.id });
    const u = (await db.execute("SELECT lang FROM users WHERE phone = '9876500011'")).rows[0];
    expect(u.lang).toBe("hi"); // the visitor's language carries over
  });

  const validSetup = (o: Record<string, unknown> = {}, b: Record<string, unknown> = {}) => ({
    name: "Priya Iyer", profileType: "director", email: "", ...o,
    business: { name: "Iyer Dental Care", type: "Dental clinic", typeOther: "", city: "Chennai", cityOther: "", employees: "6", sites: "1", address: "12, 2nd Main Road, Adyar", pincode: "600020", gstin: "", udyam: "", ...b },
  });
  const indiaPost = (found: boolean, district = "Chennai", state = "Tamil Nadu") => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ Status: found ? "Success" : "Error", PostOffice: found ? [{ Name: "Adyar", District: district, State: state, BranchType: "Sub Post Office" }] : null }]))));

  it("sign-up: first sign-in is not set up; setup validates every field, checks the pincode with India Post, then unlocks the app", async () => {
    const r = await signIn("9876500019");
    expect(r.body.user).toMatchObject({ isNew: true, onboarded: false });
    const setup = await import("@/app/api/me/setup/route");
    expect((await setup.POST(req("POST", { skip: true }))).status).toBe(400); // no skipping any more
    indiaPost(true);
    const bad = await json(await setup.POST(req("POST", validSetup({ name: "R2D2", email: "priya@", profileType: "captain" }, { name: "!!", type: "", city: "", employees: "0", sites: "9999", address: "short", pincode: "012345", gstin: "27ABCDE1234F1Z9", udyam: "UDYAM-12" }))));
    expect(bad.status).toBe(422);
    expect(bad.body.errors).toMatchObject({
      name: "NAME_INVALID", email: "EMAIL_INVALID", profileType: "PROFILE_TYPE_REQUIRED", "business.name": "BUSINESS_NAME_INVALID", "business.type": "TYPE_REQUIRED",
      "business.city": "CITY_REQUIRED", "business.employees": "STAFF_INVALID", "business.sites": "SITES_INVALID", "business.address": "ADDRESS_INVALID",
      "business.pincode": "PINCODE_INVALID", "business.gstin": "GSTIN_CHECKSUM", "business.udyam": "UDYAM_FORMAT",
    });
    // advisor is still locked until setup succeeds
    const adv = await import("@/app/api/advisor/route");
    expect((await adv.POST(req("POST", { text: "pharmacy in Indore", lang: "en" }))).status).toBe(403);
    indiaPost(false); // (lookups are cached per pincode, so this case uses its own)
    expect((await json(await setup.POST(req("POST", validSetup({}, { pincode: "600099" }))))).body.errors).toEqual({ "business.pincode": "PINCODE_NOT_FOUND" });
    indiaPost(true);
    const ok = await json(await setup.POST(req("POST", validSetup())));
    expect(ok.status).toBe(200); expect(ok.body.businessId).toMatch(/^B-/); expect(ok.body.warnings).toEqual({});
    const me = await json(await (await import("@/app/api/me/route")).GET());
    expect(me.body.user).toMatchObject({ name: "Priya Iyer", profileType: "director", onboarded: true });
    expect(me.body.businesses[0]).toMatchObject({ name: "Iyer Dental Care", businessType: "Dental clinic", city: "Chennai", employees: 6, segment: "prof" });
    expect(me.body.businesses[0].locations[0]).toMatchObject({ address: "12, 2nd Main Road, Adyar", pincode: "600020" });
    jar.delete("ud_auth");
    expect((await signIn("9876500019")).body.user).toMatchObject({ isNew: false, onboarded: true }); // returning user skips setup
  });

  it("setup: valid GSTIN accepted unverified; state/city mismatches are warnings, not blocks; names in Indian scripts are valid", async () => {
    await signIn("9876500020");
    indiaPost(true, "Pune", "Maharashtra");
    const setup = await import("@/app/api/me/setup/route");
    const r = await json(await setup.POST(req("POST", validSetup({ name: "प्रिया अय्यर" }, { gstin: "37IHKXV5167L1ZS", city: "Chennai", pincode: "411001" }))));
    expect(r.status).toBe(200);
    expect(r.body.warnings).toEqual({ "business.pincode": "PINCODE_CITY_MISMATCH", "business.gstin": "GSTIN_STATE_MISMATCH" });
    const me = await json(await (await import("@/app/api/me/route")).GET());
    expect(me.body.businesses[0].verifiedAt).toBeNull(); // entered ≠ verified: KYC verifies against the registry
    expect(me.body.businesses[0].gstin).not.toBe("37IHKXV5167L1ZS"); // masked
  });

  it("gate: signed-out → 401 everywhere; someone else's quote → 404; someone else's order link → 403", async () => {
    const adv = await import("@/app/api/advisor/route");
    expect((await adv.POST(req("POST", { text: "pharmacy in Indore", lang: "en" }))).status).toBe(401);
    const tix = await import("@/app/api/support/tickets/route");
    expect((await tix.POST(req("POST", { text: "help me please now" }))).status).toBe(401);
    // owner A
    const a = await signIn("9876500031");
    await (await import("@/lib/accounts/users")).updateProfile(a.body.user.id, { onboardedAt: Date.now() });
    await S.put("quote", "QT-OWNA01", { id: "QT-OWNA01", userId: a.body.user.id, profile: { businessType: "Pharmacy", employees: 3, sites: 1, city: "Indore", gstin: { has: false }, needs: [] }, lines: [], bundleId: "dukaan", notices: [], version: 1, attribution: {}, sites: [], createdAt: Date.now() });
    await S.put("order", "UD-OWNA01", { id: "UD-OWNA01", token: "tok-a", userId: a.body.user.id, quoteId: "QT-OWNA01", payment: { status: "awaiting" }, lines: [], items: [], stageHistory: [], totals: {}, createdAt: Date.now() });
    const quote = await import("@/app/api/quote/[id]/route");
    expect((await quote.GET(req("GET"), P({ id: "QT-OWNA01" }))).status).toBe(200);
    // owner B, same ids and even the order's link token
    jar = new Map();
    const b = await signIn("9876500032");
    await (await import("@/lib/accounts/users")).updateProfile(b.body.user.id, { onboardedAt: Date.now() });
    expect((await quote.GET(req("GET"), P({ id: "QT-OWNA01" }))).status).toBe(404);
    const order = await import("@/app/api/orders/[id]/route");
    const o = await order.GET(new Request("http://t/api/orders/UD-OWNA01?t=tok-a"), P({ id: "UD-OWNA01" }));
    expect(o.status).toBe(403);
  });

  it("profile, businesses and locations are owner-only; GSTIN is masked", async () => {
    await signIn("9876500012");
    const me = await import("@/app/api/me/route");
    expect((await me.PATCH(req("PATCH", { name: "Rakesh Sharma", email: "rakesh@example.in", notifyEmail: true }))).status).toBe(200);
    expect((await me.PATCH(req("PATCH", { email: "not-an-email" }))).status).toBe(400);
    const biz = await import("@/app/api/me/businesses/route");
    const b = await json(await biz.POST(req("POST", { name: "Sharma Medical", businessType: "pharmacy", city: "Indore", employees: 3 })));
    const locs = await import("@/app/api/me/businesses/[id]/locations/route");
    expect((await locs.POST(req("POST", { address: "Shop 4, MG Road, Indore", pincode: "452001" }), P({ id: b.body.id }))).status).toBe(200);
    await (await S.orm()).run(`UPDATE businesses SET gstin = '23ABCXK1234L1Z5', gst_status = 'Active' WHERE id = '${b.body.id}'` as never);
    const view = await json(await me.GET());
    expect(view.body.user).toMatchObject({ name: "Rakesh Sharma", email: "rakesh@example.in", notifyEmail: true, phoneMasked: "98••••••12" });
    expect(view.body.businesses[0]).toMatchObject({ name: "Sharma Medical", segment: "micro" });
    expect(view.body.businesses[0].locations).toHaveLength(1);
    expect(view.body.businesses[0].gstin).not.toBe("23ABCXK1234L1Z5");
    // someone else can't touch it
    jar = new Map(); await signIn("9876500013");
    const edit = await import("@/app/api/me/businesses/[id]/route");
    expect((await edit.PATCH(req("PATCH", { name: "Hijacked" }), P({ id: b.body.id }))).status).toBe(404);
  });

  it("devices: list, sign out others, sign out this device (visitor loses verified)", async () => {
    await signIn("9876500014");
    const first = jar.get("ud_auth")!;
    jar.delete("ud_auth"); await signIn("9876500014"); // second device
    const sessions = await import("@/app/api/me/sessions/route");
    expect((await json(await sessions.GET())).body.sessions).toHaveLength(2);
    await sessions.DELETE(req("DELETE", { others: true }));
    expect((await json(await sessions.GET())).body.sessions).toHaveLength(1);
    const me = await import("@/app/api/me/route");
    jar.set("ud_auth", first); // the revoked device
    expect((await me.GET()).status).toBe(401);
    jar.delete("ud_auth"); await signIn("9876500014");
    const sid = jar.get("ud_sid")!;
    const { POST } = await import("@/app/api/auth/logout/route");
    await POST();
    expect((await me.GET()).status).toBe(401);
    expect((await S.get<{ verified: boolean }>("session", sid))!.verified).toBe(false);
  });

  it("export holds my data; deleting the account erases it and anonymises orders", async () => {
    const r = await signIn("9876500015");
    await S.put("order", "UD-ERASE1", { id: "UD-ERASE1", userId: r.body.user.id, phone: "9876500015", businessName: "Erase Me Store", sites: [{ index: 0, address: "Shop 1" }], payment: { status: "success" }, totals: { monthly: 1 }, createdAt: Date.now() });
    const exp = await import("@/app/api/me/export/route");
    const res = await exp.GET();
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const data = JSON.parse(await res.text());
    expect(data.profile.phone).toBe("9876500015");
    expect(data.orders[0].id).toBe("UD-ERASE1");
    // give the account a business + location, then delete with foreign keys OFF (as a Turso HTTP connection may be):
    // erasure must not depend on ON DELETE CASCADE
    const biz = await import("@/app/api/me/businesses/route");
    const nb = await json(await biz.POST(req("POST", { name: "Erase Me Store", city: "Indore", employees: 2 })));
    const locs = await import("@/app/api/me/businesses/[id]/locations/route");
    await locs.POST(req("POST", { address: "Shop 9, MG Road, Indore", pincode: "452001" }), P({ id: nb.body.id }));
    await (await S.db()).execute("PRAGMA foreign_keys = OFF");
    const me = await import("@/app/api/me/route");
    expect((await me.DELETE()).status).toBe(200);
    await (await S.db()).execute("PRAGMA foreign_keys = ON");
    for (const t of ["businesses WHERE owner_user_id", "user_sessions WHERE user_id"]) expect((await (await S.db()).execute(`SELECT count(*) AS n FROM ${t} = '${r.body.user.id}'`)).rows[0].n).toBe(0);
    expect((await (await S.db()).execute(`SELECT count(*) AS n FROM business_locations WHERE business_id = '${nb.body.id}'`)).rows[0].n).toBe(0);
    const o = await S.get<{ phone?: string; businessName: string; userId?: string }>("order", "UD-ERASE1");
    expect(o).toMatchObject({ businessName: "[erased]" });
    expect(o!.phone).toBeUndefined(); expect(o!.userId).toBeUndefined();
    expect((await (await S.db()).execute("SELECT count(*) AS n FROM users WHERE phone = '9876500015'")).rows[0].n).toBe(0);
    expect((await (await S.db()).execute(`SELECT count(*) AS n FROM user_sessions WHERE user_id = '${r.body.user.id}'`)).rows[0].n).toBe(0); // cascaded
  });
});

describe("staff accounts", () => {
  it("a forged cookie (staff id instead of a token) is not a session", async () => {
    jar.set("ud_staff", "ADM1");
    const { GET } = await import("@/app/api/ops/team/route");
    expect((await GET()).status).toBe(401);
  });

  it("email + password: wrong → 401, locked after 5 tries, right → signed in; admin creates staff who must change password", async () => {
    const { createStaff } = await import("@/lib/auth");
    await createStaff({ email: "Boss@Accel.example", name: "Boss", role: "admin", password: "correct horse battery" });
    const session = await import("@/app/api/ops/session/route");
    expect((await session.POST(req("POST", { email: "boss@accel.example", password: "nope" }))).status).toBe(401);
    const ok = await json(await session.POST(req("POST", { email: "BOSS@accel.example", password: "correct horse battery" })));
    expect(ok.body.staff).toMatchObject({ role: "admin", mustChangePassword: true });
    const team = await import("@/app/api/ops/team/route");
    expect((await team.POST(req("POST", { email: "rep1@accel.example", name: "Rep One", role: "rep", password: "short" }))).status).toBe(422);
    const created = await json(await team.POST(req("POST", { email: "rep1@accel.example", name: "Rep One", role: "rep", password: "temporary-pass-1" })));
    expect(created.status).toBe(200);
    // lockout
    for (let i = 0; i < 5; i++) await session.POST(req("POST", { email: "rep1@accel.example", password: "wrong" }));
    const locked = await json(await session.POST(req("POST", { email: "rep1@accel.example", password: "temporary-pass-1" })));
    expect(locked.status).toBe(429); expect(locked.body.error).toBe("TOO_MANY_ATTEMPTS");
  });

  it("deactivating someone ends their session at once; admins can't demote themselves", async () => {
    const { createStaff } = await import("@/lib/auth");
    const id = await createStaff({ email: "ops9@accel.example", name: "Ops Nine", role: "ops", password: "ops-nine-password" });
    const session = await import("@/app/api/ops/session/route");
    await session.POST(req("POST", { email: "ops9@accel.example", password: "ops-nine-password" }));
    const opsJar = jar; jar = new Map();
    await session.POST(req("POST", { id: "ADM1" })); // demo admin (DEMO_MODE default on)
    const member = await import("@/app/api/ops/team/[id]/route");
    expect((await member.PATCH(req("PATCH", { active: false }), P({ id }))).status).toBe(200);
    expect((await member.PATCH(req("PATCH", { role: "rep" }), P({ id: "ADM1" }))).status).toBe(400);
    jar = opsJar;
    const kyc = await import("@/app/api/ops/kyc/route");
    expect((await kyc.GET(new Request("http://t/api/ops/kyc"))).status).toBe(401);
  });

  it("demo logins are refused when DEMO_MODE=false, and existing demo sessions stop working", async () => {
    const session = await import("@/app/api/ops/session/route");
    await session.POST(req("POST", { id: "OPS1" }));
    process.env.DEMO_MODE = "false";
    const kyc = await import("@/app/api/ops/kyc/route");
    expect((await kyc.GET(new Request("http://t/api/ops/kyc"))).status).toBe(401);
    expect((await session.POST(req("POST", { id: "OPS1" }))).status).toBe(403);
    expect((await json(await session.GET())).body.directory).toEqual([]);
  });
});

describe("environment check", () => {
  it("production refuses a local database and missing admin when demo is off", async () => {
    const { checkEnv } = await import("@/lib/env");
    const keep = { ...process.env };
    Object.assign(process.env, { DATABASE_URL: "file:.data/x.db", DEMO_MODE: "false" }); delete process.env.ADMIN_EMAIL;
    delete process.env.VERCEL;
    expect(checkEnv("production").errors.join(" ")).not.toMatch(/DATABASE_URL/); // a laptop / own server: file DB is fine
    process.env.VERCEL = "1";
    const r = checkEnv("production");
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/DATABASE_URL/);
    expect(r.errors.join(" ")).toMatch(/ADMIN_EMAIL/);
    Object.assign(process.env, { DATABASE_URL: "libsql://x.turso.io", DATABASE_AUTH_TOKEN: "t", ADMIN_EMAIL: "a@b.c" });
    expect(checkEnv("production").ok).toBe(true);
    delete process.env.VERCEL;
    process.env = keep;
  });
});
