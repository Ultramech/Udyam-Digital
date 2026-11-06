import { describe, expect, it } from "vitest";
import { chipsToText, matchChip, splitMessage, toWhatsAppText } from "@/lib/channels/format";
import type { QuickReply } from "@/lib/advisor/orchestrator";

const q = (...labels: string[]): QuickReply[] => labels.map((label) => ({ label, value: label }));
const staff = q("1", "2–3", "4–9", "10–24", "25+");
const kinds = q("Shop", "Clinic", "Office", "Restaurant");

describe("matchChip", () => {
  it("numbered option for word chips", () => {
    expect(matchChip("2", kinds)?.label).toBe("Clinic");
    expect(matchChip("9", kinds)).toBeNull();
    expect(matchChip(" clinic ", kinds)?.label).toBe("Clinic");
  });
  it("a typed number is a VALUE for range chips, not an option index", () => {
    expect(matchChip("5", staff)?.label).toBe("4–9");
    expect(matchChip("1", staff)?.label).toBe("1");
    expect(matchChip("12", staff)?.label).toBe("10–24");
    expect(matchChip("40", staff)?.label).toBe("25+");
    expect(matchChip("0", staff)).toBeNull();
  });
  it("free text is never captured", () => {
    expect(matchChip("I run a clinic in Kochi", kinds)).toBeNull();
    expect(matchChip("I run a clinic", staff)).toBeNull();
  });
});

describe("chipsToText", () => {
  it("numbers word chips and bullets range chips", () => {
    expect(chipsToText(kinds, "en")).toContain("2. Clinic");
    const r = chipsToText(staff, "en");
    expect(r).toContain("• 2–3");
    expect(r).not.toContain("1. 1");
  });
  it("is empty without chips", () => expect(chipsToText([], "en")).toBe(""));
});

describe("text helpers", () => {
  it("converts markdown bold to WhatsApp bold", () => expect(toWhatsAppText("the **Dukaan** plan")).toBe("the *Dukaan* plan"));
  it("splits long text under the limit without losing content", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(40)).join("\n\n");
    const parts = splitMessage(text, 1400);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 1400)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toContain("Paragraph 59");
  });
  it("keeps short text as one message", () => expect(splitMessage("hello")).toEqual(["hello"]));
});
