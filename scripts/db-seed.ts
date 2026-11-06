/**
 * Seeds a fresh database (local or Turso). Idempotent — safe to run on every deploy.
 *   npm run db:seed
 *
 *  - First admin from ADMIN_EMAIL + ADMIN_PASSWORD (created once; never overwritten — change it in the app afterwards).
 *  - Demo staff accounts (no passwords) when DEMO_MODE is not "false".
 *  - Installation roster: the placeholder engineers below, only if the roster is empty. Replace them with the real field team.
 */
import { eq } from "drizzle-orm";
import { db, orm } from "../lib/db/store";
import { staffUsers } from "../lib/db/schema";
import { demoMode, ensureDemoStaff } from "../lib/auth";
import { hashPassword, passwordProblem } from "../lib/accounts/crypto";
import { addEngineer, listEngineers } from "../lib/scheduling";

const ROSTER: [string, string][] = [["Ravi Deshmukh", "9876543221"], ["Sunita Nair", "9765432154"], ["Imran Qureshi", "9987654308"]];

(async () => {
  await db(); // migrates in development; in production run `npm run db:migrate` first
  const d = await orm();

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const problem = passwordProblem(password);
    if (problem) throw new Error(`ADMIN_PASSWORD: ${problem}`);
    const exists = await d.query.staffUsers.findFirst({ where: eq(staffUsers.email, email) });
    if (exists) console.log(`admin: ${email} already exists (left unchanged)`);
    else {
      await d.insert(staffUsers).values({ id: "ADMIN", email, name: process.env.ADMIN_NAME || "Administrator", role: "admin", passwordHash: await hashPassword(password) });
      console.log(`admin: created ${email}`);
    }
  } else console.log("admin: ADMIN_EMAIL / ADMIN_PASSWORD not set — skipped" + (demoMode() ? " (demo accounts still available)" : " — set them, or nobody can sign in to /ops"));

  if (demoMode()) { await ensureDemoStaff(); console.log("demo staff: ready (DEMO_MODE on)"); }
  else console.log("demo staff: skipped (DEMO_MODE=false — demo logins are refused)");

  const roster = await listEngineers();
  if (roster.length) console.log(`roster: ${roster.length} engineer(s) already present`);
  else { for (const [n, p] of ROSTER) await addEngineer(n, p, ["*"]); console.log(`roster: added ${ROSTER.length} placeholder engineers`); }
  process.exit(0);
})().catch((e) => { console.error("seed failed:", e instanceof Error ? e.message : e); process.exit(1); });
