import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { put } from "@/lib/db/store";
import { loadActiveOrder, loadOrder } from "@/lib/store/orderAccess";
import { addEvent, getOrder } from "@/lib/store/orders";
import { availableSlots, bookSlot } from "@/lib/scheduling";
import { STAGES } from "@/lib/store/types";

/** Customer picks an installation slot from real engineer availability. Allowed once the order is paid, until installation starts. */
const open = (o: { stage?: string }) => !!o.stage && STAGES.indexOf(o.stage as (typeof STAGES)[number]) < STAGES.indexOf("INSTALL_IN_PROGRESS");

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const o = await loadOrder(id, new URL(req.url).searchParams.get("t"));
  if (!open(o)) return ok({ slots: [], open: false });
  return ok({ open: true, slots: await availableSlots(o), current: o.engineer ? { date: o.engineer.date, window: o.engineer.window } : null });
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), window: z.string().max(20) }));
  const o = await loadActiveOrder(id, b.t ?? null);
  if (!open(o)) throw new HttpError(409, "SLOT_NOT_OPEN");
  const offered = await availableSlots(o);
  if (!offered.some((s) => s.date === b.date && s.window === b.window)) throw new HttpError(409, "SLOT_TAKEN");
  const booked = await bookSlot(o, { date: b.date, window: b.window });
  if (!booked) throw new HttpError(409, "SLOT_TAKEN");
  const fresh = (await getOrder(o.id))!;
  fresh.engineer = { ...booked, slot: `${booked.date}, ${booked.window}` };
  await put("order", fresh.id, fresh);
  await addEvent(o.id, "action", (o.lang === "hi" || o.lang === "mr") ? `इंस्टॉलेशन स्लॉट तय: ${booked.date}, ${booked.window}।` : `Installation slot booked: ${booked.date}, ${booked.window}.`);
  return ok({ booked: { date: booked.date, window: booked.window, engineer: booked.name } });
});
