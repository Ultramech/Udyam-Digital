import { customAlphabet } from "nanoid";
import { HttpError, ok, route } from "@/lib/api";
import { get, put } from "@/lib/db/store";
import { loadOrder } from "@/lib/store/orderAccess";
import { getOrder } from "@/lib/store/orders";
import { publicBaseUrl } from "@/lib/channels/twilio";

/** A referral link, issued only once the service is live (you recommend what already works for you). One stable code per order. */
const code = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 8);
export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const o = await loadOrder((await params).id, new URL(req.url).searchParams.get("t"));
  if (o.stage !== "ACTIVATED") throw new HttpError(409, "NOT_ACTIVE_YET");
  let ref = o.referralCode;
  if (!ref) {
    ref = `R-${code()}`;
    await put("referral", ref, { orderId: o.id, at: Date.now() });
    const fresh = (await getOrder(o.id))!;
    await put("order", o.id, { ...fresh, referralCode: ref });
  }
  const base = publicBaseUrl() ?? new URL(req.url).origin;
  const referred = await get<{ orderId: string }>("referral", ref);
  return ok({ code: ref, url: `${base}/?ref=${ref}`, valid: !!referred });
});
