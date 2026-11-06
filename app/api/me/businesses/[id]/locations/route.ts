import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { addLocation, removeLocation, requireUser } from "@/lib/accounts/users";

const Body = z.object({ label: z.string().trim().max(40).nullable().optional(), address: z.string().trim().min(5).max(200), pincode: z.string().regex(/^\d{6}$/).nullable().optional() });

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const b = await parseBody(req, Body);
  return ok({ id: await addLocation(u.id, (await params).id, b) });
});

export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const { locationId } = await parseBody(req, z.object({ locationId: z.string().max(20) }));
  await removeLocation(u.id, (await params).id, locationId);
  return ok({ ok: true });
});
