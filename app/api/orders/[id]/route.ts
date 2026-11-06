import { ok, route } from "@/lib/api";
import { loadOrder, orderView } from "@/lib/store/orderAccess";

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const token = new URL(req.url).searchParams.get("t");
  const o = await loadOrder((await params).id, token);
  return ok(await orderView(o));
});
