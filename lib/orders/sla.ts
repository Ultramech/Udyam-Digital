import "server-only";
import { list } from "@/lib/db/store";
import { setDelay } from "@/lib/store/orders";
import type { Order } from "@/lib/store/types";

/**
 * Stuck-order sweep. If an order has sat in one stage longer than the SLA with nothing pending on the customer, the owner is told
 * BEFORE they have to chase: setDelay() moves the expected date and posts a proactive update (tracker + WhatsApp/Telegram), and the
 * order shows as delayed on the ops board. Measured on the real clock (`stageChangedAt`), not the dataset's reference date.
 * Orders placed before this field existed have no timestamp and are never touched.
 */
export const stageSlaHours = () => { const n = Number(process.env.STAGE_SLA_HOURS); return Number.isFinite(n) && n > 0 ? n : 48; };

export function isStuck(o: Order, now: number, slaHours = stageSlaHours()): boolean {
  if (!o.stage || o.stage === "ACTIVATED" || o.delayed || !o.stageChangedAt) return false;
  if (o.actionNeeded) return false; // waiting on the customer, not on us
  return now - o.stageChangedAt >= slaHours * 3_600_000;
}

export async function sweepStuckOrders(now = Date.now()): Promise<{ checked: number; delayed: string[] }> {
  const orders = await list<Order>("order", { limit: 5000 });
  const delayed: string[] = [];
  for (const o of orders) {
    if (!isStuck(o, now)) continue;
    const hi = o.lang === "hi" || o.lang === "mr";
    await setDelay(o.id, hi ? "यह चरण हमारी योजना से ज़्यादा समय ले रहा है" : "this step is taking longer than we planned");
    delayed.push(o.id);
  }
  return { checked: orders.length, delayed };
}
