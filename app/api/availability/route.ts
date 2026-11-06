import { z } from "zod";
import { ok, route } from "@/lib/api";
import { checkSite } from "@/lib/feasibility";
import { getProduct } from "@/lib/catalogue";
import { plainName } from "@/lib/catalogue/plain";

const Query = z.object({ pincode: z.string().regex(/^\d{6}$/, "6-digit pincode") });

/**
 * Pre-quote availability for a pincode: the same feasibility layers the order flow uses (ops coverage → India Post directory →
 * documented policy), with the basis reported so the screen never overstates certainty. If fibre isn't expected, the catalogue's own
 * wireless option is named; whether it can be sold still depends on the owner's city, which the advisor checks.
 */
export const GET = route(async (req: Request) => {
  const { pincode } = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const f = await checkSite(pincode);
  const air = getProduct("P04");
  return ok({
    pincode, fibre: f.fibre, basis: f.basis, confirmed: f.confirmed, area: f.area ?? null,
    fallback: f.fibre ? null : { productId: "P04", name: plainName("P04", "en"), priceFrom: air.priceMin },
  });
});
