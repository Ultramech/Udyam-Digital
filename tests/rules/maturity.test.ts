import { describe, expect, it } from "vitest";
import { maturity } from "@/lib/maturity/score";
import { recommend } from "@/lib/rules/recommend";
import type { BusinessProfile } from "@/lib/rules/types";

const shop: BusinessProfile = { businessType: "kirana", employees: 2, sites: 1, city: "Indore", gstin: { has: true }, currentInternet: "hotspot", needs: ["payments"] };

describe("digital maturity (advisory)", () => {
  it("is bounded 0–100 and areas 0–20", () => {
    const r = recommend(shop), m = maturity(shop, r.lines, r.counterfactuals);
    for (const s of [m.before, m.after]) {
      expect(s.total).toBeGreaterThanOrEqual(0); expect(s.total).toBeLessThanOrEqual(100);
      for (const a of s.areas) { expect(a.score).toBeGreaterThanOrEqual(0); expect(a.score).toBeLessThanOrEqual(20); }
    }
  });
  it("a plan never lowers any area (existing leased line is kept)", () => {
    const p: BusinessProfile = { ...shop, currentInternet: "leased" };
    const r = recommend(p), m = maturity(p, r.lines);
    m.after.areas.forEach((a, i) => expect(a.score).toBeGreaterThanOrEqual(m.before.areas[i].score));
  });
  it("better current internet scores higher before; more products score higher after", () => {
    const hot = maturity(shop, []).before.total, bb = maturity({ ...shop, currentInternet: "biz_bb" }, []).before.total;
    expect(bb).toBeGreaterThan(hot);
    const r = recommend(shop);
    const fuller = r.alternatives.find((a) => a.id === "fuller")?.lines ?? r.lines;
    expect(maturity(shop, fuller).after.total).toBeGreaterThanOrEqual(maturity(shop, r.lines).after.total);
  });
  it("only suggests eligible products for later (no GST-only product for a GSTIN-less owner)", () => {
    const p: BusinessProfile = { ...shop, gstin: { has: false } };
    const r = recommend(p), m = maturity(p, r.lines, r.counterfactuals);
    const later = m.roadmap.find((x) => x.horizon === "3-6m")!.items.flatMap((i) => i.products);
    for (const id of ["P14", "P15", "P05", "P06", "P21", "P24"]) expect(later).not.toContain(id);
  });
  it("is deterministic", () => {
    const r = recommend(shop);
    expect(maturity(shop, r.lines)).toEqual(maturity(shop, r.lines));
  });
});
