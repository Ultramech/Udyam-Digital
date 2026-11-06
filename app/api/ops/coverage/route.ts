import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { setCoverage } from "@/lib/feasibility";

/** Ops marks a pincode as fibre-passing or not. Takes precedence over every estimate (authoritative operator data). */
export const PUT = route(async (req: Request) => {
  const s = await requireRole("ops", "admin");
  const b = await parseBody(req, z.object({ pincode: z.string().regex(/^\d{6}$/), fibre: z.boolean() }));
  await setCoverage(b.pincode, b.fibre, s.id);
  return ok({ pincode: b.pincode, fibre: b.fibre });
});
