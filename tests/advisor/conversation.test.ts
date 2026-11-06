import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { advisorTurn } from "@/lib/advisor/orchestrator";
import { recommend } from "@/lib/rules/recommend";
import { priceLines } from "@/lib/rules/pricing";
import { sanitiseMeta } from "@/lib/advisor/llm";
import type { Facts } from "@/lib/advisor/extract";

const chain: Facts = { businessType: "Restaurant chain", employees: 12, sites: 3, city: "Pune", gst: "yes", needs: ["payments", "cctv", "uptime"] };
const ids = (t: ReturnType<typeof advisorTurn>) => new Set(t.recommendation!.lines.map((l) => l.productId));

describe("conversational plan changes go through the rules engine", () => {
  it("'remove CCTV' declines it; the engine leaves cameras out and says why in the trace", () => {
    const t = advisorTurn({ facts: chain, lang: "en", llmFacts: { needs: [] }, llmMeta: { changedFields: [], removeNeeds: ["cctv"] } });
    expect(ids(t).has("P23")).toBe(false);
    expect(t.facts.declined).toContain("cctv");
    expect(t.recommendation!.trace.some((x) => x.code === "DECLINED_BY_OWNER" && x.productId === "P23")).toBe(true);
  });

  it("asking for a declined feature again brings it back", () => {
    const t = advisorTurn({ facts: { ...chain, declined: ["cctv"], needs: ["payments", "uptime"] }, lang: "en", llmFacts: { needs: ["cctv"] } });
    expect(ids(t).has("P23")).toBe(true);
    expect(t.facts.declined).not.toContain("cctv");
  });

  it("'make it 4 cameras' resizes per location and re-prices", () => {
    const before = priceLines(advisorTurn({ facts: chain, lang: "en" }).recommendation!.lines).monthly;
    const t = advisorTurn({ facts: chain, lang: "en", llmFacts: { needs: [], cameras: 4 } });
    expect(t.recommendation!.lines.filter((l) => l.productId === "P23").every((l) => l.qty === 4)).toBe(true);
    expect(priceLines(t.recommendation!.lines).monthly).toBeGreaterThan(before);
  });

  it("a correction ('actually 2 shops') overrides the earlier fact; without it the LLM can only fill gaps", () => {
    const fill = advisorTurn({ facts: chain, lang: "en", llmFacts: { needs: [], sites: 2 } });
    expect(fill.facts.sites).toBe(3);
    const fix = advisorTurn({ facts: chain, lang: "en", llmFacts: { needs: [], sites: 2 }, llmMeta: { changedFields: ["sites"], removeNeeds: [] } });
    expect(fix.facts.sites).toBe(2);
  });

  it("connectivity and mobile lines can never be declined", () => {
    const r = recommend({ businessType: "pharmacy", employees: 3, sites: 1, city: "Indore", gstin: { has: false }, needs: ["payments"], declined: ["payments", "cctv", "uptime"] });
    expect(r.lines.some((l) => ["P01", "P02", "P03", "P04"].includes(l.productId))).toBe(true);
    expect(r.lines.some((l) => l.productId === "P07")).toBe(true);
    expect(r.lines.some((l) => l.productId === "P19")).toBe(false);
  });

  it("model meta is sanitised: unknown intents/needs/fields are dropped", () => {
    const m = sanitiseMeta({ intent: "hack", removeNeeds: ["cctv", "rm -rf"], changedFields: ["sites", "price"], languageRequest: "fr" });
    expect(m).toEqual({ intent: "describe", question: undefined, languageRequest: undefined, removeNeeds: ["cctv"], changedFields: ["sites"] });
  });
});
