import { HttpError, ok, route } from "@/lib/api";
import { gstLookup, nearGstLookup } from "@/lib/kyc/registry";
import { maskGstin, norm, validateGstin } from "@/lib/kyc/identifiers";

/** Mock GSTIN lookup API (backed by mock_gstin_registry.csv). Validates format + checksum before it looks anything up. */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ g: string }> }) => {
  const g = norm((await params).g);
  const f = validateGstin(g);
  if (!f.formatOk) throw new HttpError(422, "GSTIN_FORMAT");
  if (!f.checksumOk) {
    const near = nearGstLookup(g);
    throw new HttpError(422, "GSTIN_CHECKSUM", near ? { suggestion: maskGstin(near.gstin), suggestionName: near.trade_name } : undefined);
  }
  const r = gstLookup(g);
  if (!r) throw new HttpError(404, "GSTIN_NOT_FOUND");
  return ok({ gstin: maskGstin(r.gstin), legalName: r.legal_name, tradeName: r.trade_name, constitution: r.constitution, address: r.principal_place_of_business, state: r.state, status: r.status });
});
