import { ok, parseBody, route } from "@/lib/api";
import { createBusiness, listBusinesses, requireUser } from "@/lib/accounts/users";
import { maskGstin } from "@/lib/kyc/identifiers";
import { BusinessFields } from "@/lib/accounts/validation";


export const GET = route(async () => {
  const u = await requireUser();
  return ok({ businesses: (await listBusinesses(u.id)).map((b) => ({ ...b, gstin: b.gstin ? maskGstin(b.gstin) : null })) });
});

/** Add a business by hand (orders also create/update them automatically, with registry-verified identifiers). */
export const POST = route(async (req: Request) => {
  const u = await requireUser();
  const b = await parseBody(req, BusinessFields);
  return ok({ id: await createBusiness(u.id, b) });
});
