import { HttpError, ok, route } from "@/lib/api";
import { udyamLookup } from "@/lib/kyc/registry";
import { maskUdyam, validateUdyam } from "@/lib/kyc/identifiers";

/** Mock Udyam lookup API (backed by mock_udyam_registry.csv). District code 00 is valid for this synthetic dataset. */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ u: string }> }) => {
  const u = (await params).u.toUpperCase();
  if (!validateUdyam(u).ok) throw new HttpError(422, "UDYAM_FORMAT");
  const r = udyamLookup(u);
  if (!r) throw new HttpError(404, "UDYAM_NOT_FOUND");
  return ok({ udyam: maskUdyam(r.udyam_number), enterpriseName: r.enterprise_name, type: r.enterprise_type, activity: r.major_activity, city: r.city, state: r.state });
});
