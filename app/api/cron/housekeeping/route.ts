import { timingSafeEqual } from "node:crypto";
import { HttpError, ok, route } from "@/lib/api";
import { runResumeNudges } from "@/lib/nudges/resume";
import { sweepStuckOrders } from "@/lib/orders/sla";

export const maxDuration = 60;

/**
 * Scheduled housekeeping: resume reminders + the stuck-order sweep. Called by Vercel Cron (it sends `Authorization: Bearer $CRON_SECRET`)
 * or any external scheduler with the same header. With no CRON_SECRET configured the endpoint refuses everything — it is never open.
 */
export const GET = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new HttpError(503, "CRON_NOT_CONFIGURED");
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new HttpError(401, "UNAUTHORIZED");
  const sweep = await sweepStuckOrders();
  return ok({ nudges: await runResumeNudges(), sla: { checked: sweep.checked, delayed: sweep.delayed.length } });
});
