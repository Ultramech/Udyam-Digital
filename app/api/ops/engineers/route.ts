import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { addEngineer, listEngineers, setEngineerActive } from "@/lib/scheduling";
import { maskPhone } from "@/lib/kyc/identifiers";

/** Ops owns the engineer roster. `cities: ["*"]` means the engineer covers every city. */
export const GET = route(async () => {
  await requireRole("ops", "admin");
  return ok({ engineers: (await listEngineers()).map((e) => ({ ...e, phone: maskPhone(e.phone) || e.phone })) });
});
export const POST = route(async (req: Request) => {
  await requireRole("ops", "admin");
  const b = await parseBody(req, z.object({ name: z.string().min(2).max(60), phone: z.string().regex(/^[6-9]\d{9}$/), cities: z.array(z.string().min(1).max(40)).min(1).max(30) }));
  const e = await addEngineer(b.name, b.phone, b.cities);
  return ok({ engineer: { ...e, phone: maskPhone(e.phone) || e.phone } });
});
export const PATCH = route(async (req: Request) => {
  await requireRole("ops", "admin");
  const b = await parseBody(req, z.object({ id: z.string().max(40), active: z.boolean() }));
  return ok({ engineer: await setEngineerActive(b.id, b.active) });
});
