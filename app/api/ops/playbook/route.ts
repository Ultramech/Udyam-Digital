import { ok, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { playbook } from "@/lib/leads/playbook";
import { leadSignals } from "@/lib/leads/signals";

/** Segment and channel playbook plus the decision-changing signals, computed from the supplied quarter of leads. Staff only. */
export const GET = route(async () => {
  await requireRole("ops", "admin", "rep");
  return ok({ ...playbook(), signals: leadSignals() });
});
