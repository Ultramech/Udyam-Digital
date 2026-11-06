import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { DEMO_STAFF, currentStaff, demoMode, demoSignIn, signOut, staffLogin } from "@/lib/auth";

/** GET: who is signed in (+ the one-click demo directory while DEMO_MODE is on). */
export const GET = route(async () => ok({
  staff: await currentStaff(), demoMode: demoMode(),
  directory: demoMode() ? DEMO_STAFF.map(({ id, name, role }) => ({ id, name, role })) : [],
}));

/** POST { email, password } — real login. POST { id } — demo login, refused unless DEMO_MODE. */
const Body = z.union([z.object({ email: z.string().email().max(120), password: z.string().min(1).max(200) }), z.object({ id: z.string().max(10) })]);
export const POST = route(async (req: Request) => {
  const b = await parseBody(req, Body);
  return ok({ staff: "email" in b ? await staffLogin(b.email, b.password) : await demoSignIn(b.id) });
});
export const DELETE = route(async () => { await signOut(); return ok({ ok: true }); });
