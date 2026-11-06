import { ok, route, HttpError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { clear } from "@/lib/db/store";

/**
 * Demo mode only: wipes every live record so any scenario can be re-run from a clean slate. The supplied datasets are untouched.
 * It erases every customer's data, so on a shared (deployed) site only an admin/ops staff session may call it; the automated
 * journey check may call it on a local test server started with ALLOW_TEST_VERIFY=1 (never in a production build).
 */
export const POST = route(async () => {
  if (process.env.DEMO_MODE === "false") throw new HttpError(403, "DEMO_ONLY");
  const testServer = process.env.ALLOW_TEST_VERIFY === "1" && process.env.NODE_ENV !== "production";
  if (!testServer) await requireRole("admin", "ops");
  await clear();
  return ok({ reset: true });
});
