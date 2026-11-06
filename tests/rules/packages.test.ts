import { describe, expect, it } from "vitest";
import { packages } from "@/lib/rules/packages";
import { recommend } from "@/lib/rules/recommend";
import { validateLines } from "@/lib/rules/quote";
import type { BusinessProfile } from "@/lib/rules/types";

const pharmacy: BusinessProfile = { businessType: "pharmacy", employees: 4, sites: 1, city: "Indore", gstin: { has: true }, needs: ["payments", "whatsapp", "cctv"] };
const clinic: BusinessProfile = { businessType: "clinic", employees: 8, sites: 1, city: "Pune", gstin: { has: false }, needs: ["email", "backup", "whatsapp"] };

describe("Basic / Recommended / Premium comparison", () => {
  it("returns three engine-valid options ordered by price", () => {
    for (const p of [pharmacy, clinic]) {
      const rec = recommend(p);
      const opts = packages(p, rec.lines, rec);
      expect(opts.map((o) => o.id)).toEqual(["basic", "recommended", "premium"]);
      for (const o of opts) expect(validateLines(o.lines, p)).toEqual([]);
      expect(opts[0].monthly).toBeLessThanOrEqual(opts[1].monthly);
      expect(opts[1].monthly).toBeLessThanOrEqual(opts[2].monthly);
      expect(opts[1].delta).toBe(0);
      expect(opts.find((o) => o.current)?.id).toBe("recommended");
    }
  });
  it("reports coverage only for needs the owner stated", () => {
    const opts = packages(pharmacy, recommend(pharmacy).lines);
    for (const o of opts) expect([...o.covered, ...o.missed].sort()).toEqual(["cctv", "payments", "whatsapp"]);
    // basic (lean build) leaves out the needs-driven add-ons
    expect(opts[0].missed).toContain("cctv");
    expect(opts[1].covered).toContain("cctv");
  });
  it("a GSTIN-less clinic never sees WhatsApp as covered in any package", () => {
    for (const o of packages(clinic, recommend(clinic).lines)) expect(o.missed).toContain("whatsapp");
  });
  it("adds / drops are relative to Recommended", () => {
    const [basic, , premium] = packages(pharmacy, recommend(pharmacy).lines);
    expect(basic.adds).toEqual([]);
    expect(basic.drops.length).toBeGreaterThan(0);
    expect(premium.drops).toEqual([]);
  });
  it("no packages when there is no valid bundle (out of area)", () => {
    expect(packages({ ...pharmacy, city: "Nowhereabad" }, [])).toEqual([]);
  });
});
