import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { limit } from "@/lib/accounts/rateLimit";
import { getUser } from "@/lib/accounts/users";
import { requireKycConsent } from "@/lib/store/kyc";
import { createDelegate, DELEGATE_TTL, listDelegates } from "@/lib/delegate";
import { SLOTS } from "@/lib/kyc/types";

const Body = z.object({ quoteId: z.string().max(40), label: z.string().max(60), slots: z.array(z.enum(SLOTS as [string, ...string[]])).min(1).max(4) });

/** The signed-in owner lets one person (CA, partner, staff) upload specific documents from their own phone. */
export const POST = route(async (req: Request) => {
  const b = await parseBody(req, Body);
  const q = await ownedQuote(b.quoteId);
  await requireKycConsent(q);
  await limit(`delegate-create:${q.id}`, 10, 60 * 60 * 1000);
  const owner = q.userId ? await getUser(q.userId) : null;
  try {
    const d = await createDelegate(q.id, b.label, b.slots as never, owner?.name?.split(/\s+/)[0] ?? null);
    return ok({ path: `/d/${d.token}`, ref: d.ref, expiresAt: Date.now() + DELEGATE_TTL });
  } catch (e) {
    if (e instanceof Error && e.message === "TOO_MANY_LINKS") throw new HttpError(409, "TOO_MANY_LINKS");
    throw e;
  }
});

/** The owner's own list of links and what came back through each. Nothing here lets anyone act as a delegate. */
export const GET = route(async (req: Request) => {
  const q = await ownedQuote(new URL(req.url).searchParams.get("quoteId") ?? "");
  return ok({ delegates: await listDelegates(q.id) });
});
