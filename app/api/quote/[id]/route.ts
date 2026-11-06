import { z } from "zod";
import { ownedQuote } from "@/lib/accounts/guard";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { applyEdit, validateLines } from "@/lib/rules/quote";
import { recommend } from "@/lib/rules/recommend";
import { getQuote, quoteView, saveQuote } from "@/lib/store/quotes";
import type { Need } from "@/lib/rules/types";

const Edit = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add"), productId: z.string().regex(/^P\d{2}$/), qty: z.number().int().min(1).max(100).optional(), siteIndex: z.number().int().min(0).max(499).optional() }),
  z.object({ type: z.literal("remove"), productId: z.string().regex(/^P\d{2}$/), siteIndex: z.number().int().min(0).max(499).optional() }),
  z.object({ type: z.literal("setQty"), productId: z.string().regex(/^P\d{2}$/), qty: z.number().int().min(0).max(100), siteIndex: z.number().int().min(0).max(499).optional() }),
  z.object({ type: z.literal("addSite") }),
  z.object({ type: z.literal("removeSite"), siteIndex: z.number().int().min(0).max(499) }),
]);
const Body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("edit"), edit: Edit }),
  z.object({ op: z.literal("alternative"), id: z.enum(["lighter", "fuller", "recommended"]) }),
  z.object({ op: z.literal("budget"), amount: z.number().int().min(100).max(10_000_000).nullable() }),
  z.object({ op: z.literal("needs"), needs: z.array(z.string()).max(20) }),
]);

export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const q = await ownedQuote((await params).id);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  return ok(quoteView(q));
});

/** Every change is applied by the rules engine and returned fully re-priced. The client never computes eligibility or price. */
export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const q = await getQuote((await params).id);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const b = await parseBody(req, Body);
  let notices: { code: string; params?: Record<string, string | number> }[] = [];
  let blocked: unknown;

  if (b.op === "edit") {
    const r = applyEdit(q.lines, b.edit, q.profile);
    if (r.blocked) blocked = r.blocked;
    else {
      q.lines = r.lines; q.profile = r.profile; notices = r.notices;
      if (b.edit.type === "addSite") q.sites = [...q.sites, { index: q.sites.length, address: "", pincode: "", checked: false }];
      if (b.edit.type === "removeSite") q.sites = q.sites.filter((s) => s.index !== (b.edit as { siteIndex: number }).siteIndex).map((s, i) => ({ ...s, index: i }));
    }
  } else if (b.op === "alternative") {
    const rec = recommend(q.profile);
    const alt = b.id === "recommended" ? { lines: rec.lines } : rec.alternatives.find((a) => a.id === b.id);
    if (!alt?.lines.length) throw new HttpError(409, "NO_SUCH_ALTERNATIVE");
    q.lines = alt.lines;
  } else if (b.op === "budget") {
    q.profile = { ...q.profile, budget: b.amount ?? undefined };
    const rec = recommend(q.profile);
    q.lines = rec.lines; notices = rec.notices;
  } else {
    q.profile = { ...q.profile, needs: b.needs as Need[] };
    const rec = recommend(q.profile);
    q.lines = rec.lines; notices = rec.notices;
  }
  if (!blocked) {
    q.version++;
    // belt and braces: a quote that violates a rule is never saved
    const issues = validateLines(q.lines, q.profile);
    if (issues.length) throw new HttpError(409, "QUOTE_INVALID", { issues: issues.map((i) => `${i.productId}:${i.code}`) });
    await saveQuote(q);
  }
  return ok({ ...quoteView(q), notices, blocked: blocked ?? null });
});
