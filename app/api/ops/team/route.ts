import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { createStaff, listStaff, requireRole } from "@/lib/auth";
import { audit } from "@/lib/privacy/audit";

export const GET = route(async () => {
  await requireRole("admin");
  return ok({ staff: await listStaff() });
});

/** Admin creates a staff account with a temporary password (they must change it at first sign-in). */
export const POST = route(async (req: Request) => {
  const admin = await requireRole("admin");
  const b = await parseBody(req, z.object({ email: z.string().email().max(120), name: z.string().trim().min(2).max(80), role: z.enum(["rep", "partner", "ops", "admin"]), password: z.string().min(1).max(200) }));
  const id = await createStaff(b);
  await audit(admin, "staff.create", "staff", id);
  return ok({ id });
});
