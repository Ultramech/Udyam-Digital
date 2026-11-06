import { ok, parseBody, route } from "@/lib/api";
import { requireUser, updateBusiness } from "@/lib/accounts/users";
import { BusinessFields } from "@/lib/accounts/validation";

/** Edit a business the signed-in owner owns. Registry-verified fields (GSTIN, status) are not editable here — KYC sets them. */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const u = await requireUser();
  const b = await parseBody(req, BusinessFields.partial());
  await updateBusiness(u.id, (await params).id, b);
  return ok({ ok: true });
});
