import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { leadSignals } from "@/lib/leads/signals";

describe("decision-changing signals in the leads file", () => {
  const s = leadSignals();
  it("partner pay is activation-only and scales with bundle value; partner customers churn more", () => {
    expect(s.partnerPay.medianCostActivated).toBeGreaterThan(20 * s.partnerPay.medianCostDropped);
    expect(s.partnerPay.monthsOfRevenuePaid).toBeGreaterThan(s.partnerPay.fieldMonthsOfRevenue * 2);
    expect(s.partnerPay.partnerChurn).toBeGreaterThan(s.partnerPay.restChurn);
  });
  it("the WhatsApp campaign loses the most leads before contact (bad numbers), not after", () => {
    expect(s.leadQuality[0].source).toBe("WhatsApp campaign");
    expect(s.leadQuality[0].lostBeforeContact).toBeGreaterThan(40);
  });
  it("finds the compliance exposure: non-active GSTINs and rule-breaking bundles", () => {
    expect(s.compliance.nonActiveGstin).toBe(22);
    expect(s.compliance.ruleBreakingBundles).toBe(56);
  });
  it("flags that 6-month churn can't be observed yet as of 'today'", () => {
    expect(s.labels.afterToday).toBe(16);
    expect(s.labels.churnNotYetObservable).toBe(s.labels.activations);
  });
  it("regional languages convert below Hindi/English", () => {
    for (const l of s.language.weakest) expect(l.conversion).toBeLessThan(s.language.hindiEnglish);
  });
});
