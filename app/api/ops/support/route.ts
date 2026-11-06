import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { list } from "@/lib/db/store";
import type { Ticket } from "@/lib/store/types";
import { publicTicket } from "@/lib/support/tickets";

/** Support queue: open first, high priority first, oldest first. */
export const GET = route(async () => {
  await requireRole("rep", "ops", "admin");
  const rank = (t: Ticket) => (t.status === "resolved" ? 2 : 0) + (t.priority === "high" ? 0 : 1);
  const tickets = (await list<Ticket>("ticket", { limit: 500 })).sort((a, b) => rank(a) - rank(b) || a.createdAt - b.createdAt).map(publicTicket);
  return ok({ tickets });
});
