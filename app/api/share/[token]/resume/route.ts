import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { get } from "@/lib/db/store";
import { ownedQuote } from "@/lib/accounts/guard";

export const GET = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const share = await get<{ quoteId: string; createdAt: number }>("share", token);
  if (!share || Date.now() - share.createdAt > 14 * 86_400_000) throw new HttpError(404, "SHARE_NOT_FOUND");
  const q = await ownedQuote(share.quoteId); // only the quote owner can resume a private checkout
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  return NextResponse.redirect(new URL(`/quote/${q.id}`, req.url));
});
