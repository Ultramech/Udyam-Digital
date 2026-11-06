import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { changeOwnPassword, requireRole } from "@/lib/auth";
import { audit } from "@/lib/privacy/audit";

export const POST = route(async (req: Request) => {
  const me = await requireRole();
  if (me.isDemo) throw new HttpError(400, "DEMO_ACCOUNT");
  const b = await parseBody(req, z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) }));
  await changeOwnPassword(me.id, b.current, b.next);
  await audit(me, "staff.password_change", "staff", me.id);
  return ok({ ok: true });
});
