import { beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => { /* not used */ } }));

let runAdvisor: typeof import("@/lib/advisor/turn").runAdvisor;

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(mkdtempSync(join(tmpdir(), "ns-")), "t.db")}`;
  delete process.env.GEMINI_API_KEY;
  runAdvisor = (await import("@/lib/advisor/turn")).runAdvisor;
});

const base = { lang: "en" as const, attribution: {} };

describe("the advisor has no scripted fallback", () => {
  it("without a model it says so, and does not guess facts from keywords", async () => {
    const r = await runAdvisor({ ...base, text: "I run a pharmacy in Pune with 6 staff and 2 shops, we have GST" });
    expect(r.ai).toEqual({ used: false, reason: "NOT_CONFIGURED" });
    expect(r.turn.reply).toMatch(/not configured/i);
    expect(r.turn.facts.employees).toBeUndefined();
    expect(r.turn.facts.city).toBeUndefined();
    expect(r.turn.stage).toBe("collecting");
  });

  it("the opening greeting is not a canned script either", async () => {
    const r = await runAdvisor({ ...base });
    expect(r.ai.used).toBe(false);
    expect(r.turn.reply).not.toMatch(/Namaste/);
  });
});
