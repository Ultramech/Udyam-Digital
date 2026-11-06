import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { playbook } from "@/lib/leads/playbook";

describe("segment & channel playbook", () => {
  const p = playbook();
  it("totals match the case funnel (5,000 leads, 368 activations)", () => {
    expect(p.total.leads).toBe(5000);
    expect(p.total.activations).toBe(368);
  });
  it("GSTIN effect matches the case appendix (9.6% vs 2.0%)", () => {
    expect(p.gstin.with.conversion).toBe(9.6);
    expect(p.gstin.without.conversion).toBe(2);
  });
  it("segments cover every lead and sum to the total", () => {
    expect(p.segments).toHaveLength(4);
    expect(p.segments.reduce((s, x) => s + x.leads, 0)).toBe(5000);
    expect(p.segments.reduce((s, x) => s + x.activations, 0)).toBe(368);
  });
  it("finds the field-sales-on-micro leak by search, not by assumption", () => {
    expect(p.waste?.segment).toBe("Micro retail & services");
    expect(p.waste?.source).toBe("Field sales");
  });
  it("never draws a conclusion from a thin cell", () => {
    for (const s of p.segments) {
      if (s.bestChannel) expect(s.bestChannel.leads).toBeGreaterThanOrEqual(p.minCell);
      for (const c of s.costlyChannels) expect(s.bySource.find((x) => x.source === c.source)!.lowSample).toBe(false);
    }
  });
  it("prices each segment's typical business with the rules engine", () => {
    for (const s of p.segments) { expect(s.advisor).not.toBeNull(); expect(s.advisor!.monthly).toBeGreaterThan(0); }
  });
});
