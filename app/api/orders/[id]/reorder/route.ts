import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { newId } from "@/lib/db/store";
import { recommend } from "@/lib/rules/recommend";
import { loadOrder } from "@/lib/store/orderAccess";
import { saveQuote } from "@/lib/store/quotes";
import type { Quote } from "@/lib/store/types";

const Body = z.object({ t: z.string().max(40).optional(), mode: z.enum(["upgrade", "new_site"]) });

/**
 * Starts a fresh quote from an existing order: "upgrade" keeps the same business and services so the owner can add more
 * (the quote page then offers Premium and add-ons); "new_site" copies the plan for one new branch. Everything is re-checked
 * by the rules engine and goes through KYC/consent again — nothing is carried over unverified.
 */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, Body);
  const o = await loadOrder(id, b.t ?? null);
  const profile = b.mode === "new_site" ? { ...o.profile, sites: 1, fibreFeasible: undefined } : { ...o.profile, fibreFeasible: undefined };
  const rec = recommend(profile);
  const lines = b.mode === "upgrade" ? o.lines : rec.lines;
  const q: Quote = {
    id: newId("QT"), sessionId: await sessionId(), profile, lines, bundleId: rec.bundleId, notices: rec.notices, version: 1,
    attribution: { ...o.attribution, source: `reorder:${b.mode}` },
    sites: Array.from({ length: profile.sites }, (_, i) => ({ index: i, address: "", pincode: "", checked: false })), createdAt: Date.now(),
  };
  await saveQuote(q);
  return ok({ quoteId: q.id });
});
