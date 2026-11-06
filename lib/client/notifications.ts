import { api, readJourney, writeJourney } from "./api";
import type { OrderEvent } from "@/lib/store/types";
import type { PublicTicket } from "@/lib/support/tickets";

export interface Note { id: string; at: number; date: string; kind: OrderEvent["type"] | "reply"; text: string; href: string; orderName?: string }

/**
 * In-app notifications: every update on the owner's orders (from the order timeline the server keeps) plus support replies.
 * Read state is per device (localStorage), because the owner reaches orders through private links held on this device.
 */
export async function loadNotes(): Promise<Note[]> {
  const j = readJourney();
  const notes: Note[] = [];
  await Promise.all(j.orders.map(async (o) => {
    try {
      const r = await api<{ events: OrderEvent[] }>("GET", `/api/orders/${o.id}?t=${o.token}`);
      r.events.forEach((e, i) => notes.push({ id: e.id, at: i, date: e.at, kind: e.type, text: e.text, href: `/track/${o.id}?t=${o.token}`, orderName: o.name }));
    } catch { /* order erased or link invalid */ }
  }));
  const ids = (j.tickets ?? []).map((t) => `${t.id}:${t.token}`).join(",");
  if (ids) {
    try {
      const r = await api<{ tickets: PublicTicket[] }>("GET", `/api/support/tickets?ids=${encodeURIComponent(ids)}`);
      for (const t of r.tickets) t.messages.forEach((m, i) => { if (m.by === "staff") notes.push({ id: `${t.id}-${i}`, at: m.at, date: new Date(m.at).toISOString().slice(0, 10), kind: "reply", text: `${m.name ?? "Team"}: ${m.text}`, href: "/support" }); });
    } catch { /* ignore */ }
  }
  // newest first: by date, then by position within the same day
  return notes.sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);
}
export const seenSet = () => new Set(readJourney().seenEvents ?? []);
export function markSeen(ids: string[]) { writeJourney({ seenEvents: [...new Set([...(readJourney().seenEvents ?? []), ...ids])].slice(-500) }); }
