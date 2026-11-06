import { z } from "zod";
import { put } from "@/lib/db/store";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { createQuoteFromConversation, quoteView, saveQuote } from "@/lib/store/quotes";
import { ownedConversation } from "@/lib/accounts/guard";
import { currentUser } from "@/lib/accounts/users";
import { getLead, patchLead } from "@/lib/leads/leads";

/** Turn the advisor's recommendation into an editable quote. */
export const POST = route(async (req: Request) => {
  const { conversationId } = await parseBody(req, z.object({ conversationId: z.string().max(40) }));
  const conv = await ownedConversation(conversationId);
  const user = await currentUser();
  const q = await createQuoteFromConversation(conv, conv.attribution, await sessionId());
  if (user) { q.userId = user.id; await saveQuote(q); }
  if (!q.lines.length) throw new HttpError(409, "NO_PLAN_AVAILABLE");
  conv.quoteId = q.id;
  await put("conversation", conv.id, conv);
  if (conv.leadId && (await getLead(conv.leadId))) await patchLead(conv.leadId, (l) => ({ ...l, quoteId: q.id, status: l.status === "new" ? "quoted" : l.status }));
  return ok(quoteView(q));
});
