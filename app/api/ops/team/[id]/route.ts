import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { requireRole, updateStaff } from "@/lib/auth";
import { audit } from "@/lib/privacy/audit";

/** Change role, (de)activate, rename or reset a password. Deactivation and resets end that person's sessions. */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireRole("admin");
  const { id } = await params;
  const b = await parseBody(req, z.object({ role: z.enum(["rep", "partner", "ops", "admin"]).optional(), active: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional(), password: z.string().min(1).max(200).optional() }));
  if (id === admin.id && (b.active === false || (b.role && b.role !== "admin"))) throw new HttpError(400, "CANNOT_DEMOTE_SELF"); // never lock out the last admin by accident
  await updateStaff(id, b);
  await audit(admin, b.password ? "staff.password_reset" : b.active === false ? "staff.deactivate" : "staff.update", "staff", id);
  return ok({ ok: true });
});
