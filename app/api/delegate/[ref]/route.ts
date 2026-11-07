import { HttpError, ok, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { revokeDelegate } from "@/lib/delegate";

/** Cancels a link. Documents already uploaded through it stay; further uploads stop at once. */
export const DELETE = route(async (req: Request, { params }: { params: Promise<{ ref: string }> }) => {
  const q = await ownedQuote(new URL(req.url).searchParams.get("quoteId") ?? "");
  if (!(await revokeDelegate(q.id, (await params).ref))) throw new HttpError(404, "LINK_NOT_FOUND");
  return ok({ ok: true });
});
