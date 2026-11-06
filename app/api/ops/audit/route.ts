import { ok, route } from "@/lib/api";
import { listStaff, requireRole } from "@/lib/auth";
import { list } from "@/lib/db/store";
import type { AuditEntry } from "@/lib/store/types";

/** Append-only staff action log (ids only, never raw identifiers). Admin only. */
export const GET = route(async (req: Request) => {
  await requireRole("admin");
  const u = new URL(req.url);
  const actor = u.searchParams.get("actor"), entity = u.searchParams.get("entity");
  const staff = await listStaff();
  const rows = (await list<AuditEntry>("audit", { limit: 1000 }))
    .filter((a) => (!actor || a.actor === actor) && (!entity || a.entity === entity))
    .map((a) => ({ ...a, actorName: staff.find((s) => s.id === a.actor)?.name ?? a.actor }));
  return ok({ rows, actors: staff.map((s) => ({ id: s.id, name: s.name, role: s.role })) });
});
