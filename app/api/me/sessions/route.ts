import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { listUserSessions, requireUser, revokeUserSessions } from "@/lib/accounts/users";

export const GET = route(async () => {
  const u = await requireUser();
  return ok({ sessions: (await listUserSessions(u.id)).map((s) => ({ ...s, current: s.id === u.sessionId })) });
});

/** Sign out one device ({ id }) or every other device ({ others: true }). */
export const DELETE = route(async (req: Request) => {
  const u = await requireUser();
  const b = await parseBody(req, z.union([z.object({ id: z.string().max(20) }), z.object({ others: z.literal(true) })]));
  if ("id" in b) {
    if (b.id === u.sessionId) throw new HttpError(400, "USE_SIGN_OUT"); // signing out this device goes through /api/auth/logout
    await revokeUserSessions(u.id, { id: b.id });
  } else await revokeUserSessions(u.id, { exceptId: u.sessionId });
  return ok({ sessions: await listUserSessions(u.id) });
});
