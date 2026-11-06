import { HttpError, ok, parseBody, route } from "@/lib/api";
import { ownedConversation, requireCustomer } from "@/lib/accounts/guard";
import { get, put } from "@/lib/db/store";
import { currentStaff, sessionId } from "@/lib/auth";
import { AdvisorBody, runAdvisor } from "@/lib/advisor/turn";
import type { Conversation } from "@/lib/store/types";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  const b = await parseBody(req, AdvisorBody);
  // Rep/partner credit is only ever taken from a signed-in staff session — never from a URL parameter someone could type.
  const { repId: _ignored, ...claimed } = b.attribution; void _ignored;
  b.attribution = claimed;
  const staff = await currentStaff();
  const coPilot = !!b.copilot && !!staff && (staff.role === "rep" || staff.role === "partner" || staff.role === "admin");
  if (coPilot) b.attribution = { ...b.attribution, source: b.attribution.source ?? "copilot", repId: staff!.id, ...(staff!.role === "partner" ? { partnerCode: staff!.id } : {}) };
  // customers must have verified their phone and set up their profile; a rep in co-pilot mode works on the owner's behalf
  const user = coPilot ? null : await requireCustomer();
  if (b.conversationId && !coPilot) await ownedConversation(b.conversationId);
  const r = await runAdvisor(b, await sessionId());
  if (user && r.conversationId) {
    const c = await get<Conversation>("conversation", r.conversationId);
    if (c && !c.userId) await put("conversation", c.id, { ...c, userId: user.id });
  }
  return ok(r);
});

export const GET = route(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return ok({ conversation: null });
  try { return ok({ conversation: await ownedConversation(id) }); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return ok({ conversation: null }); throw e; }
});
