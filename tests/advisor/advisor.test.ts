import { describe, expect, it } from "vitest";
import { advisorTurn } from "@/lib/advisor/orchestrator";
import { extractFacts, emptyFacts } from "@/lib/advisor/extract";
import { priceLines } from "@/lib/rules/pricing";

const ids = (t: ReturnType<typeof advisorTurn>) => t.recommendation!.lines.map((l) => l.productId);
const SHARMA_EN = "I run a pharmacy in Indore. I have three employees, one shop and need reliable internet, billing and CCTV.";
const SHARMA_HI = "मेरी इंदौर में दवा की दुकान है। 3 कर्मचारी हैं, एक दुकान। बिलिंग और CCTV चाहिए। जीएसटी नहीं है।";

describe("extraction in one pass", () => {
  it("Sharma-ji (English): pulls every fact from one message and asks only about GST", () => {
    const t = advisorTurn({ text: SHARMA_EN, lang: "en", facts: emptyFacts() });
    expect(t.facts).toMatchObject({ businessType: "Pharmacy", city: "Indore", employees: 3, sites: 1 });
    expect(t.facts.needs.sort()).toEqual(["cctv", "payments"]);
    expect(t.missing).toEqual(["gst"]);
    expect(t.reply).toMatch(/GST number/);
    expect(t.stage).toBe("collecting");
  });
  it("Sharma-ji (Hindi): same facts, same bundle, answered in Hindi", () => {
    const en = advisorTurn({ text: SHARMA_EN + " I don't have GST.", lang: "en", facts: emptyFacts() });
    const hi = advisorTurn({ text: SHARMA_HI, lang: "hi", facts: emptyFacts() });
    expect(hi.facts).toMatchObject({ businessType: "Pharmacy", city: "Indore", employees: 3, sites: 1, gst: "no" });
    expect(hi.stage).toBe("recommended");
    expect(ids(hi).sort()).toEqual(ids(en).sort());
    expect(hi.reply).toMatch(/[ऀ-ॿ]/);
    expect(hi.reply).not.toMatch(/\bP\d{2}\b/);
  });
  it("Dr. Menon: a dental clinic with 5 staff and GST goes straight to Office Ready", () => {
    const t = advisorTurn({ text: "I run a dental clinic in Kochi with 5 staff. We have GST. Need email, security and backup internet.", lang: "en", facts: emptyFacts() });
    expect(t.stage).toBe("recommended");
    expect(t.recommendation!.bundleId).toBe("office");
    expect(ids(t)).toEqual(expect.arrayContaining(["P02", "P16", "P20", "P09"]));
  });
  it("Spice Route: a 3-branch restaurant chain is recognised as multi-site and flagged for sales assist", () => {
    const t = advisorTurn({ text: "We run a restaurant chain in Pune with 3 branches and 12 employees. We have GST, need billing and CCTV in every branch.", lang: "en", facts: emptyFacts() });
    expect(t.recommendation!.bundleId).toBe("allshops");
    expect(t.recommendation!.escalation.level).toBe("assist");
    expect(ids(t)).toContain("P10");
  });
});

describe("conversation behaviour", () => {
  it("opens with a greeting and a first question when nothing is known", () => {
    const t = advisorTurn({ lang: "en" });
    expect(t.stage).toBe("collecting");
    expect(t.quickReplies.length).toBeGreaterThan(0);
  });
  it("asks one question at a time, in a fixed order, and uses chips", () => {
    let t = advisorTurn({ text: "I have a kirana store", lang: "en", facts: emptyFacts() });
    expect(t.missing[0]).toBe("employees");
    t = advisorTurn({ facts: t.facts, chip: { slot: "employees", value: "3" }, lang: "en" });
    expect(t.missing[0]).toBe("city");
    t = advisorTurn({ facts: t.facts, chip: { slot: "city", value: "Jaipur" }, lang: "en" });
    expect(t.missing[0]).toBe("gst");
    t = advisorTurn({ facts: t.facts, chip: { slot: "gst", value: "no" }, lang: "en" });
    expect(t.missing[0]).toBe("needs");
    t = advisorTurn({ facts: t.facts, chip: { slot: "needs", value: "payments" }, lang: "en" });
    expect(t.stage).toBe("recommended");
    expect(t.recommendation!.bundleId).toBe("dukaan");
  });
  it("'not sure' still produces the segment's default plan", () => {
    const t = advisorTurn({ text: "I have a salon in Surat, 2 staff, no GST. Not sure what I need, suggest for me.", lang: "en", facts: emptyFacts() });
    expect(t.stage).toBe("recommended");
    expect(priceLines(t.recommendation!.lines).monthly).toBe(1897);
  });
  it("says no to WhatsApp Business without GST — clearly, with an alternative", () => {
    const t = advisorTurn({ text: "I run a boutique in Pune, 2 staff, 1 shop, no GST. I want WhatsApp for my customers.", lang: "en", facts: emptyFacts() });
    expect(ids(t)).not.toContain("P15");
    expect(t.reply).toMatch(/WhatsApp Business needs a GST number/);
    expect(t.reply).toMatch(/website/i);
  });
  it("a request for a person escalates immediately and keeps the facts", () => {
    const t = advisorTurn({ text: "I want to talk to a person please", lang: "en", facts: { ...emptyFacts(), businessType: "Pharmacy" } });
    expect(t.stage).toBe("escalated");
    expect(t.facts.explicitHuman).toBe(true);
    expect(t.facts.businessType).toBe("Pharmacy");
  });
  it("a city we don't serve online is a hard escalation, not a wrong quote", () => {
    const t = advisorTurn({ text: "I run a pharmacy in Dehradun, 3 staff, 1 shop, no GST, need billing", lang: "en", facts: emptyFacts() });
    expect(t.stage).toBe("escalated");
    expect(t.recommendation!.escalation.reasons).toContain("OUT_OF_AREA");
    expect(t.recommendation!.lines).toEqual([]);
  });
  it("a budget in the message switches on budget mode", () => {
    const f = extractFacts("I have a kirana store in Indore, 2 staff, no GST, want billing and CCTV, budget under ₹1,500", emptyFacts());
    expect(f.budget).toBe(1500);
    const t = advisorTurn({ text: "I have a kirana store in Indore, 2 staff, no GST, want billing and CCTV, budget under ₹1,500", lang: "en", facts: emptyFacts() });
    expect(priceLines(t.recommendation!.lines).monthly).toBeLessThanOrEqual(1500);
  });
  it("current spend is captured but never presented as a saving", () => {
    const f = extractFacts("we spend ₹2,400 a month on internet and phones", emptyFacts());
    expect(f.currentSpend).toBe(2400);
  });
  it("model output only fills gaps and is sanity-checked (no override of what the owner said)", () => {
    const base = extractFacts("pharmacy in Indore, 3 staff", emptyFacts());
    const t = advisorTurn({ facts: base, llmFacts: { employees: 999999, sites: 1, city: "Pune", gst: "no" }, lang: "en" });
    expect(t.facts.employees).toBe(3); // owner's number wins
    expect(t.facts.city).toBe("Indore");
    expect(t.facts.sites).toBe(1); // gap filled
  });
});
