import { z } from "zod";
import { ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { advisorTurn } from "@/lib/advisor/orchestrator";
import { emptyFacts } from "@/lib/advisor/extract";
import { priceLines, estimateSchedule } from "@/lib/rules/pricing";
import { validateLines } from "@/lib/rules/quote";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

/** Scenario Lab: free text in → extracted facts, decision trace and priced bundle out. Stateless — nothing is saved. */
export const POST = route(async (req: Request) => {
  await requireRole("rep", "partner", "ops", "admin");
  const b = await parseBody(req, z.object({ text: z.string().min(3).max(1500), lang: z.enum(["en", "hi"]).default("en"), gst: z.enum(["auto", "yes", "no"]).default("auto") }));
  let facts = emptyFacts();
  if (b.gst !== "auto") facts = { ...facts, gst: b.gst };
  const turn = advisorTurn({ facts, text: b.text, lang: b.lang });
  const rec = turn.recommendation;
  return ok({
    turn, pricing: rec?.lines.length ? priceLines(rec.lines) : null, schedule: rec?.lines.length ? estimateSchedule(rec.lines) : null,
    violations: rec && turn.profile ? validateLines(rec.lines, turn.profile) : [],
  });
});
