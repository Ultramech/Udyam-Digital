/**
 * Staff authentication + role-based access, and the customer visitor-session cookie.
 *
 * Staff sign in with email + password (scrypt hashes, DB-backed rate limit). The cookie holds a random token; only its SHA-256 is
 * stored in `staff_sessions` (8-hour sessions, revocable). For the hackathon demo, one-click demo accounts exist ONLY while
 * DEMO_MODE is on (default); set DEMO_MODE=false in a real deployment and they are refused.
 */
import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { HttpError } from "./api";
import { newId, newSecret, orm } from "./db/store";
import { staffSessions, staffUsers } from "./db/schema";
import { hashPassword, hashToken, passwordProblem, verifyPassword } from "./accounts/crypto";
import { limit, resetLimit } from "./accounts/rateLimit";

export type Role = "rep" | "partner" | "ops" | "admin";
export interface Staff { id: string; name: string; role: Role; email?: string; isDemo?: boolean; mustChangePassword?: boolean }

export const demoMode = () => process.env.DEMO_MODE !== "false";
const secure = () => process.env.NODE_ENV === "production";
const COOKIE = "ud_staff";
const TTL_MS = 8 * 3600_000;

/** Demo directory: ids match lead-routing territories in lib/leads/leads.ts (OWNERS). Usable only in DEMO_MODE. */
export const DEMO_STAFF: (Staff & { email: string; cities: string[] })[] = [
  { id: "R01", name: "Anita Rao", role: "rep", email: "anita.rao@demo.accel.example", cities: ["Mumbai", "Pune", "Indore"] },
  { id: "R02", name: "Vikram Nair", role: "rep", email: "vikram.nair@demo.accel.example", cities: ["Bengaluru", "Chennai", "Hyderabad"] },
  { id: "R03", name: "Meera Kapoor", role: "rep", email: "meera.kapoor@demo.accel.example", cities: ["Delhi", "Jaipur", "Lucknow"] },
  { id: "P01", name: "Shree Connect", role: "partner", email: "shree.connect@demo.accel.example", cities: [] },
  { id: "OPS1", name: "Kavita Menon", role: "ops", email: "kavita.menon@demo.accel.example", cities: [] },
  { id: "ADM1", name: "Demo Admin", role: "admin", email: "admin@demo.accel.example", cities: [] },
];

/** Idempotently creates the demo accounts (no password: they can't be used outside DEMO_MODE). */
export async function ensureDemoStaff() {
  const d = await orm();
  for (const s of DEMO_STAFF) await d.insert(staffUsers).values({ id: s.id, email: s.email, name: s.name, role: s.role, isDemo: true, cities: JSON.stringify(s.cities) }).onConflictDoNothing();
}

async function startStaffSession(staffId: string) {
  const token = newSecret();
  const ua = ((await headers()).get("user-agent") ?? "").slice(0, 200) || null;
  const d = await orm();
  await d.insert(staffSessions).values({ id: newId("SS"), staffId, tokenHash: hashToken(token), userAgent: ua, expiresAt: Date.now() + TTL_MS });
  await d.update(staffUsers).set({ lastLoginAt: Date.now() }).where(eq(staffUsers.id, staffId));
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: TTL_MS / 1000 });
}

const toStaff = (s: typeof staffUsers.$inferSelect): Staff => ({ id: s.id, name: s.name, role: s.role, email: s.email, isDemo: s.isDemo, mustChangePassword: s.mustChangePassword });

export async function currentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const d = await orm();
  const ses = await d.query.staffSessions.findFirst({ where: and(eq(staffSessions.tokenHash, hashToken(token)), isNull(staffSessions.revokedAt), gt(staffSessions.expiresAt, Date.now())) });
  if (!ses) return null;
  const s = await d.query.staffUsers.findFirst({ where: eq(staffUsers.id, ses.staffId) });
  if (!s || !s.active || (s.isDemo && !demoMode())) return null;
  return toStaff(s);
}

export async function requireRole(...roles: Role[]): Promise<Staff> {
  const s = await currentStaff();
  if (!s) throw new HttpError(401, "NOT_SIGNED_IN");
  if (roles.length && !roles.includes(s.role)) throw new HttpError(403, "FORBIDDEN", { role: s.role });
  return s;
}

/** Email + password. Same error for unknown email and wrong password; 5 attempts per 15 minutes per email and per IP. */
export async function staffLogin(email: string, password: string): Promise<Staff> {
  const e = email.trim().toLowerCase();
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  await limit(`staff-login:email:${e}`, 5, 15 * 60_000);
  await limit(`staff-login:ip:${ip}`, 20, 15 * 60_000);
  const d = await orm();
  const s = await d.query.staffUsers.findFirst({ where: eq(staffUsers.email, e) });
  const ok = await verifyPassword(password, s?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA"); // constant-ish time for unknown emails
  if (!s || !ok || !s.active) throw new HttpError(401, "INVALID_CREDENTIALS");
  await resetLimit(`staff-login:email:${e}`);
  await startStaffSession(s.id);
  return toStaff(s);
}

/** One-click demo login (hackathon judging). Refused when DEMO_MODE=false. */
export async function demoSignIn(id: string): Promise<Staff> {
  if (!demoMode()) throw new HttpError(403, "DEMO_LOGIN_DISABLED");
  await ensureDemoStaff();
  const s = await (await orm()).query.staffUsers.findFirst({ where: eq(staffUsers.id, id) });
  if (!s || !s.isDemo || !s.active) throw new HttpError(400, "UNKNOWN_STAFF");
  await startStaffSession(s.id);
  return toStaff(s);
}

export async function signOut() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await (await orm()).update(staffSessions).set({ revokedAt: Date.now() }).where(eq(staffSessions.tokenHash, hashToken(token)));
  c.delete(COOKIE);
}

// ---- staff administration (admin only; callers enforce the role) --------------------------------------------------
export async function listStaff() {
  const rows = await (await orm()).select().from(staffUsers);
  return rows.filter((s) => demoMode() || !s.isDemo).map((s) => ({ ...toStaff(s), active: s.active, lastLoginAt: s.lastLoginAt, createdAt: s.createdAt, hasPassword: !!s.passwordHash }));
}
export const staffName = async (id: string) => (await (await orm()).query.staffUsers.findFirst({ where: eq(staffUsers.id, id) }))?.name ?? id;

export async function createStaff(v: { email: string; name: string; role: Role; password: string }) {
  const p = passwordProblem(v.password);
  if (p) throw new HttpError(422, p);
  const d = await orm();
  const email = v.email.trim().toLowerCase();
  if (await d.query.staffUsers.findFirst({ where: eq(staffUsers.email, email) })) throw new HttpError(409, "EMAIL_TAKEN");
  const id = newId("ST");
  await d.insert(staffUsers).values({ id, email, name: v.name.trim(), role: v.role, passwordHash: await hashPassword(v.password), mustChangePassword: true });
  return id;
}

export async function updateStaff(id: string, v: Partial<{ role: Role; active: boolean; password: string; name: string }>) {
  const d = await orm();
  const s = await d.query.staffUsers.findFirst({ where: eq(staffUsers.id, id) });
  if (!s) throw new HttpError(404, "STAFF_NOT_FOUND");
  const patch: Partial<typeof staffUsers.$inferInsert> = { updatedAt: Date.now() };
  if (v.role) patch.role = v.role;
  if (v.name) patch.name = v.name.trim();
  if (v.active !== undefined) patch.active = v.active;
  if (v.password) { const p = passwordProblem(v.password); if (p) throw new HttpError(422, p); patch.passwordHash = await hashPassword(v.password); patch.mustChangePassword = true; }
  await d.update(staffUsers).set(patch).where(eq(staffUsers.id, id));
  // deactivation or a reset ends existing sessions
  if (v.active === false || v.password) await d.update(staffSessions).set({ revokedAt: Date.now() }).where(and(eq(staffSessions.staffId, id), isNull(staffSessions.revokedAt)));
}

export async function changeOwnPassword(id: string, current: string, next: string) {
  const d = await orm();
  const s = await d.query.staffUsers.findFirst({ where: eq(staffUsers.id, id) });
  if (!s || !(await verifyPassword(current, s.passwordHash))) throw new HttpError(401, "INVALID_CREDENTIALS");
  const p = passwordProblem(next);
  if (p) throw new HttpError(422, p);
  await d.update(staffUsers).set({ passwordHash: await hashPassword(next), mustChangePassword: false, updatedAt: Date.now() }).where(eq(staffUsers.id, id));
}

// ---- customer visitor session (anonymous journey; linked to an account at sign-in) --------------------------------
const SID = "ud_sid";
export async function sessionId(): Promise<string | undefined> { return (await cookies()).get(SID)?.value; }
export async function setSessionId(id: string) { (await cookies()).set(SID, id, { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: 60 * 60 * 24 * 7 }); }
/** Visitor session ids are bearer secrets too (they carry the "verified" flag), so they're long and random. */
export const newVisitorId = () => `S-${newSecret()}`;
