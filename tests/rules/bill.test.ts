import { describe, expect, it } from "vitest";
import { compareBill } from "@/lib/bill/compare";

const lines = [{ productId: "P02" }, { productId: "P07" }, { productId: "P19" }] as const;
describe("bill comparison is honest", () => {
  it("says 'costlier' and lists what the plan adds when it costs more", () => {
    const r = compareBill({ provider: "X", monthlyTotal: 1200, services: ["broadband"] }, 1897, 341, [...lines]);
    expect(r.verdict).toBe("costlier");
    expect(r.difference).toBe(1897 + 341 - 1200);
    expect(r.adds).toContain("Business mobile line (50 GB)");
    expect(r.adds.some((a) => /fibre/i.test(a))).toBe(false); // they already have broadband
  });
  it("says 'cheaper' only when it really is", () => {
    expect(compareBill({ provider: null, monthlyTotal: 3500, services: ["mobile postpaid", "broadband"] }, 1897, 341, [...lines]).verdict).toBe("cheaper");
  });
  it("treats a near-equal bill as the same and an unreadable one as unknown", () => {
    expect(compareBill({ provider: null, monthlyTotal: 2240, services: [] }, 1897, 341, [...lines]).verdict).toBe("same");
    expect(compareBill({ provider: null, monthlyTotal: null, services: [] }, 1897, 341, [...lines]).verdict).toBe("unknown");
  });
});
