import "server-only";
import { del, get, list, newId, put, putIfAbsent } from "@/lib/db/store";
import { addBusinessDays } from "@/lib/rules/pricing";
import { REFERENCE_DATE } from "@/lib/config";
import { maskPhone } from "@/lib/kyc/identifiers";
import type { Order } from "@/lib/store/types";

/**
 * Installation scheduling on the operator's own data: an engineer roster maintained by ops (name, phone, cities covered) and slot
 * bookings. A booking's primary key is engineer|date|window, so two customers can never hold the same engineer slot.
 * With an empty roster there is nothing to assign — the order is held and ops see why (no invented engineers).
 */
export const WINDOWS = ["10:00–12:00", "12:00–14:00", "15:00–17:00"] as const;
export interface Engineer { id: string; name: string; phone: string; cities: string[]; active: boolean }
interface Booking { orderId: string; engineerId: string; date: string; window: string }

const covers = (e: Engineer, city: string) => e.active && (e.cities.includes("*") || e.cities.includes(city.trim().toLowerCase()));
const bookingId = (eng: string, date: string, window: string) => `${eng}|${date}|${window}`;

export const listEngineers = () => list<Engineer>("engineer", { limit: 500, newestFirst: false });
export async function addEngineer(name: string, phone: string, cities: string[]): Promise<Engineer> {
  const e: Engineer = { id: newId("ENG"), name, phone, cities: cities.map((c) => c.trim().toLowerCase()).filter(Boolean), active: true };
  return put("engineer", e.id, e);
}
export async function setEngineerActive(id: string, active: boolean) {
  const e = await get<Engineer>("engineer", id);
  if (!e) return null;
  return put("engineer", id, { ...e, active });
}

/** Free slots for an order over the next 5 working days after the schedule start (Sundays excluded). */
export async function availableSlots(o: Pick<Order, "profile" | "stageDates">): Promise<{ date: string; window: string }[]> {
  const eng = (await listEngineers()).filter((e) => covers(e, o.profile.city));
  if (!eng.length) return [];
  const bookings = new Set((await list<Booking & { id?: string }>("booking", { limit: 5000 })).map((b) => bookingId(b.engineerId, b.date, b.window)));
  const start = o.stageDates.FEASIBILITY > REFERENCE_DATE ? o.stageDates.FEASIBILITY : REFERENCE_DATE;
  const out: { date: string; window: string }[] = [];
  for (let d = 1; d <= 5; d++) {
    const date = addBusinessDays(start, d);
    for (const w of WINDOWS) if (eng.some((e) => !bookings.has(bookingId(e.id, date, w)))) out.push({ date, window: w });
  }
  return out;
}

/** Claims a specific slot (or the earliest free one) for the order and releases any earlier booking it held. */
export async function bookSlot(o: Order, pick?: { date: string; window: string }): Promise<NonNullable<Order["engineer"]> | null> {
  const eng = (await listEngineers()).filter((e) => covers(e, o.profile.city));
  const candidates = pick ? [pick] : await availableSlots(o);
  for (const s of candidates) {
    if (!(WINDOWS as readonly string[]).includes(s.window)) continue;
    for (const e of eng) {
      const ok = await putIfAbsent("booking", bookingId(e.id, s.date, s.window), { orderId: o.id, engineerId: e.id, date: s.date, window: s.window } satisfies Booking);
      if (!ok) continue;
      if (o.engineer?.id && o.engineer.date && o.engineer.window) await del("booking", bookingId(o.engineer.id, o.engineer.date, o.engineer.window));
      return { id: e.id, name: e.name, phoneMasked: maskPhone(e.phone) || e.phone, date: s.date, window: s.window, slot: `${s.date}, ${s.window}` };
    }
  }
  return null;
}

/** Frees the engineer slot an order holds (cancellation). */
export async function releaseSlot(o: Pick<Order, "engineer">) {
  if (o.engineer?.id && o.engineer.date && o.engineer.window) await del("booking", bookingId(o.engineer.id, o.engineer.date, o.engineer.window));
}
