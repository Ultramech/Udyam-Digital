import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { recommend } from "@/lib/rules/recommend";
import { priceLines, contractMonths, estimateSchedule, addBusinessDays } from "@/lib/rules/pricing";
import { applyEdit, applyFeasibility, validateLines } from "@/lib/rules/quote";
import { eligibility } from "@/lib/rules/eligibility";
import { deriveSegment, cityTier, findBusinessType } from "@/lib/rules/normalise";
import { CATALOGUE } from "@/lib/catalogue";
import type { BusinessProfile, Line, Need } from "@/lib/rules/types";

const base = (o: Partial<BusinessProfile> = {}): BusinessProfile => ({
  businessType: "Pharmacy", employees: 3, sites: 1, city: "Indore", gstin: { has: false }, needs: [], ...o,
});
const GST_OK = { has: true, verified: true, status: "Active" as const };
const ids = (lines: Line[]) => lines.map((l) => l.productId);
const qty = (lines: Line[], id: string, site?: number) => lines.filter((l) => l.productId === id && (site === undefined || l.siteIndex === site)).reduce((s, l) => s + l.qty, 0);
const excl = (r: ReturnType<typeof recommend>, id: string) => r.exclusions.find((e) => e.productId === id);

describe("normalisation", () => {
  it("maps the dataset's business types to segments and cities to tiers", () => {
    expect(findBusinessType("Pharmacy")?.segment).toBe("micro");
    expect(findBusinessType("I run a chemist shop")?.name).toBe("Pharmacy");
    expect(findBusinessType("pharmacy chain")?.segment).toBe("multi");
    expect(findBusinessType("मेरी दवा की दुकान")?.name).toBe("Pharmacy");
    expect(cityTier("Indore")).toBe(2);
    expect(cityTier("Pune")).toBe(1);
    expect(cityTier("Bangalore")).toBe(1);
    expect(cityTier("Dehradun")).toBeNull();
  });
  it("3+ sites makes a business multi-site; manufacturers stay mfg", () => {
    expect(deriveSegment({ businessType: "Restaurant", employees: 12, sites: 3 })).toBe("multi");
    expect(deriveSegment({ businessType: "Textile unit", employees: 40, sites: 3 })).toBe("mfg");
  });
});

describe("S1 · Sharma-ji (micro, no GST)", () => {
  const profile = base({ needs: ["payments"], currentInternet: "hotspot" });
  const r = recommend(profile);
  it("recommends Dukaan Digital: fibre + 1 line + billing machine at the catalogue floor", () => {
    expect(r.bundleId).toBe("dukaan");
    expect(ids(r.lines).sort()).toEqual(["P01", "P07", "P19"]);
    const p = priceLines(r.lines);
    expect(p.monthly).toBe(1897);
    expect(p.setup).toBe(2500);
    expect(r.escalation.level).toBe("none");
  });
  it("never offers GST-only products", () => {
    for (const id of ["P12", "P13", "P14", "P15", "P10", "P21", "P24"]) expect(ids(r.lines)).not.toContain(id);
  });
  it("refuses WhatsApp Business with a reason, a fallback and an unlock path", () => {
    const w = recommend(base({ needs: ["payments", "whatsapp"] }));
    expect(excl(w, "P15")?.code).toBe("EXCL_NEEDS_GSTIN");
    expect(w.notices.map((n) => n.code)).toContain("WHATSAPP_ALTERNATIVE_WEBSITE");
    expect(w.addons).toContain("P18");
    expect(w.counterfactuals).toContainEqual(expect.objectContaining({ condition: "GST_VERIFIED", unlocks: expect.arrayContaining(["P15"]) }));
  });
  it("swaps to 5G AirFiber when fibre is not feasible and drops failover with a reason", () => {
    const f = recommend(base({ needs: ["payments", "uptime"], fibreFeasible: { 0: false } }));
    expect(ids(f.lines)).toContain("P04");
    expect(ids(f.lines)).not.toContain("P01");
    expect(ids(f.lines)).not.toContain("P09");
    expect(excl(f, "P09")?.code).toBe("EXCL_AIRFIBER_INCOMPATIBLE");
    expect(f.notices.map((n) => n.code)).toContain("AIRFIBER_SWAP");
    expect(estimateSchedule(f.lines).days).toBeLessThan(estimateSchedule(r.lines).days);
    expect(contractMonths(f.lines)).toBe(12); // AirFiber's 6-month minimum is lifted to 12 for bundles
  });
});

describe("S2 · Dr. Menon (professional office, GST active)", () => {
  const r = recommend(base({ businessType: "Clinic", employees: 5, city: "Kochi", gstin: GST_OK, needs: ["email", "security"] }));
  it("recommends Office Ready at ₹3,716/month with no setup fee", () => {
    expect(r.bundleId).toBe("office");
    expect(qty(r.lines, "P02")).toBe(1);
    expect(qty(r.lines, "P07")).toBe(2);
    expect(qty(r.lines, "P16")).toBe(5);
    expect(qty(r.lines, "P20")).toBe(5);
    const p = priceLines(r.lines);
    expect(p.monthly).toBe(3716);
    expect(p.setup).toBe(0);
  });
  it("offers backup internet, fixed IP and cloud phone as eligible add-ons", () => {
    expect(r.addons).toEqual(expect.arrayContaining(["P09", "P11", "P12"]));
  });
  it("includes cloud phone only with GST and ≥3 staff", () => {
    const withPhone = recommend(base({ businessType: "Clinic", employees: 5, city: "Kochi", gstin: GST_OK, needs: ["phone_system"] }));
    expect(qty(withPhone.lines, "P12")).toBe(2);
    expect(excl(recommend(base({ businessType: "Clinic", employees: 2, gstin: GST_OK, needs: ["phone_system"] })), "P12")?.code).toBe("EXCL_TOO_SMALL");
  });
  it("Tier-2 clinic wanting 1 Gbps is told no (tier), and gets 300 Mbps", () => {
    const t = recommend(base({ businessType: "Clinic", employees: 8, city: "Kochi", gstin: GST_OK, needs: ["fast_internet"] }));
    expect(excl(t, "P03")?.code).toBe("EXCL_CITY_TIER");
    expect(ids(t.lines)).toContain("P02");
    const t1 = recommend(base({ businessType: "Clinic", employees: 8, city: "Pune", gstin: GST_OK, needs: ["fast_internet"] }));
    expect(ids(t1.lines)).toContain("P03");
  });
});

describe("S3 · Spice Route (3-site restaurant chain, GST)", () => {
  const p = base({ businessType: "Restaurant chain", employees: 12, sites: 3, city: "Pune", gstin: GST_OK, needs: ["payments", "cctv"] });
  const r = recommend(p);
  it("prices every site independently at ₹3,593/site", () => {
    expect(r.bundleId).toBe("allshops");
    for (const s of [0, 1, 2]) expect(priceLines(r.lines.filter((l) => l.siteIndex === s && l.productId !== "P10")).monthly).toBe(3593);
    expect(priceLines(r.lines.filter((l) => l.siteIndex === 0 && l.productId !== "P10")).setup).toBe(7600);
  });
  it("adds central network control (3+ sites, 10+ staff, GST) and offers firewall", () => {
    expect(qty(r.lines, "P10")).toBe(3);
    expect(r.addons).toContain("P21");
  });
  it("flags a high-value assisted opportunity (assist, not a hard stop)", () => {
    expect(r.escalation).toMatchObject({ flag: true, level: "assist" });
    expect(r.escalation.reasons).toContain("MULTI_SITE_HIGH_VALUE");
  });
  it("without GST: no network control / firewall / WhatsApp, each explained", () => {
    const n = recommend({ ...p, gstin: { has: false }, needs: ["whatsapp", "security"] });
    expect(ids(n.lines)).not.toContain("P10");
    expect(excl(n, "P10")?.code).toBe("EXCL_NEEDS_GSTIN");
    expect(excl(n, "P15")?.code).toBe("EXCL_NEEDS_GSTIN");
    expect(excl(n, "P21")?.code).toBe("EXCL_NEEDS_GSTIN");
  });
  it("per-site feasibility: only the infeasible site falls back to AirFiber and loses failover", () => {
    const f = recommend({ ...p, fibreFeasible: { 2: false } });
    expect(qty(f.lines, "P02")).toBe(2);
    expect(qty(f.lines, "P04", 2)).toBe(1);
    expect(qty(f.lines, "P09", 0)).toBe(1);
    expect(qty(f.lines, "P09", 2)).toBe(0);
  });
  it("4-site pharmacy chain with GST gets WhatsApp, billing and CCTV at every site", () => {
    const c = recommend(base({ businessType: "Pharmacy chain", employees: 20, sites: 4, city: "Mumbai", gstin: GST_OK, needs: ["whatsapp", "payments", "cctv"] }));
    expect(qty(c.lines, "P15")).toBe(1);
    expect(qty(c.lines, "P19")).toBe(4);
    expect(qty(c.lines, "P23")).toBe(8);
  });
});

describe("manufacturers (field-led)", () => {
  it("40-staff textile unit with GST: dedicated line + firewall + sensors, escalated to field", () => {
    const r = recommend(base({ businessType: "Textile unit", employees: 40, city: "Surat", gstin: GST_OK, needs: ["machines"], machines: 5 }));
    expect(r.bundleId).toBe("factory");
    expect(ids(r.lines)).toEqual(expect.arrayContaining(["P05", "P21", "P24", "P08"]));
    expect(qty(r.lines, "P24")).toBe(5);
    expect(qty(r.lines, "P21")).toBe(1);
    expect(r.escalation.reasons).toEqual(expect.arrayContaining(["MFG_FIELD_LED", "DEDICATED_LINE"]));
  });
  it("Factory Line floor price is ₹10,747 for the illustrated quantities", () => {
    const r = recommend(base({ businessType: "Auto-parts unit", employees: 12, city: "Pune", gstin: GST_OK }));
    expect(priceLines(r.lines).monthly).toBe(10747);
    expect(priceLines(r.lines).setup).toBe(17000);
    expect(contractMonths(r.lines)).toBe(24);
  });
  it("8-person unit asking for sensors is refused on size, with an unlock threshold", () => {
    const r = recommend(base({ businessType: "Textile unit", employees: 8, city: "Surat", gstin: GST_OK, needs: ["machines"] }));
    expect(excl(r, "P24")?.code).toBe("EXCL_TOO_SMALL");
    expect(r.counterfactuals).toContainEqual(expect.objectContaining({ condition: "MORE_STAFF", threshold: 10 }));
  });
});

describe("GSTIN status", () => {
  it("Cancelled GSTIN removes GST-required products but keeps the rest", () => {
    const r = recommend(base({ businessType: "Travel agency", employees: 6, city: "Visakhapatnam", gstin: { has: true, verified: true, status: "Cancelled" }, needs: ["whatsapp", "email"] }));
    expect(excl(r, "P15")?.code).toBe("EXCL_GSTIN_INACTIVE");
    expect(ids(r.lines)).toContain("P16");
    expect(ids(r.lines)).toContain("P02");
  });
  it("Suspended GSTIN is reported with its status", () => {
    const r = recommend(base({ gstin: { has: true, verified: true, status: "Suspended" }, needs: ["sms"] }));
    expect(excl(r, "P14")).toMatchObject({ code: "EXCL_GSTIN_INACTIVE", params: { status: "Suspended" } });
  });
  it("GST declared but not yet verified is tentatively eligible", () => {
    expect(eligibility("P15", base({ gstin: { has: true } }))).toMatchObject({ ok: true, pending: true });
  });
});

describe("other routes", () => {
  it("SIM-only route: just phones on a 1-month contract", () => {
    const r = recommend(base({ employees: 2, needs: ["sim_only"] }));
    expect(r.bundleId).toBe("justphones");
    expect(r.lines).toEqual([{ productId: "P07", qty: 2, siteIndex: null }]);
    expect(contractMonths(r.lines)).toBe(1);
  });
  it("toll-free without GST is excluded", () => {
    expect(excl(recommend(base({ needs: ["tollfree"] })), "P13")?.code).toBe("EXCL_NEEDS_GSTIN");
  });
  it("fleet business gets one tracker per vehicle", () => {
    expect(qty(recommend(base({ businessType: "Travel agency", employees: 6, needs: ["fleet"], vehicles: 5 })).lines, "P25")).toBe(5);
  });
  it("budget mode trims by priority and reports what was removed", () => {
    const r = recommend(base({ needs: ["payments", "cctv", "wifi"], budget: 1500 }));
    expect(r.budget?.met).toBe(true);
    expect(priceLines(r.lines).monthly).toBeLessThanOrEqual(1500);
    expect(r.budget?.removed.length).toBeGreaterThan(0);
    expect(ids(r.lines)).toContain("P01"); // connectivity is protected
  });
  it("impossible budget is reported honestly rather than faked", () => {
    const r = recommend(base({ needs: [], budget: 300 }));
    expect(r.budget?.met).toBe(false);
    expect(r.budget?.minPossible).toBeGreaterThan(300);
  });
  it("provides lighter and fuller alternatives", () => {
    const r = recommend(base({ businessType: "Clinic", employees: 5, city: "Kochi", gstin: GST_OK }));
    expect(r.alternatives.map((a) => a.id)).toContain("lighter");
  });
});

describe("escalation", () => {
  it("unknown / outside Tier 1-2 city → hard escalate, no lines", () => {
    const r = recommend(base({ city: "Dehradun" }));
    expect(r.lines).toEqual([]);
    expect(r.escalation).toMatchObject({ level: "hard" });
    expect(r.escalation.reasons).toContain("OUT_OF_AREA");
  });
  it("50+ sites → hard escalate", () => {
    const r = recommend(base({ businessType: "Restaurant chain", sites: 60, employees: 200, gstin: GST_OK }));
    expect(r.escalation.reasons).toContain("MANY_SITES");
    expect(r.escalation.level).toBe("hard");
  });
  it("explicit request for a person still produces a recommendation but flags hard escalation", () => {
    const r = recommend(base({ explicitHuman: true }));
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.escalation.reasons).toContain("REQUESTED_HUMAN");
  });
  it("out-of-catalogue requirements are flagged for a person", () => {
    expect(recommend(base({ otherNeeds: ["drone fleet"] })).escalation.reasons).toContain("OUT_OF_CATALOGUE");
  });
});

describe("quote editing", () => {
  const profile = base({ city: "Kochi" });
  it("adding a dependent product without connectivity auto-adds the cheapest eligible carrier", () => {
    const r = applyEdit([], { type: "add", productId: "P11" }, profile);
    expect(ids(r.lines).sort()).toEqual(["P01", "P11"]);
    expect(r.notices[0]).toMatchObject({ code: "DEP_ADDED", params: { productId: "P01" } });
  });
  it("failover on an AirFiber-only site is blocked with a reason", () => {
    const r = applyEdit([{ productId: "P04", qty: 1, siteIndex: 0 }], { type: "add", productId: "P09" }, profile);
    expect(r.blocked?.code).toBe("EXCL_AIRFIBER_INCOMPATIBLE");
  });
  it("ineligible products cannot be added", () => {
    expect(applyEdit([], { type: "add", productId: "P15" }, profile).blocked?.code).toBe("EXCL_NEEDS_GSTIN");
    expect(applyEdit([], { type: "add", productId: "P10" }, base({ employees: 12, city: "Kochi", gstin: GST_OK })).blocked?.code).toBe("EXCL_FEW_SITES");
  });
  it("removing connectivity cascades to products that rode on it", () => {
    const start: Line[] = [{ productId: "P01", qty: 1, siteIndex: 0 }, { productId: "P23", qty: 2, siteIndex: 0 }, { productId: "P07", qty: 1, siteIndex: null }];
    const r = applyEdit(start, { type: "remove", productId: "P01" }, profile);
    expect(ids(r.lines)).toEqual(["P07"]);
    expect(r.notices[0].code).toBe("DEP_REMOVED");
  });
  it("quantities: invalid values are blocked, extra lines/cameras reprice immediately", () => {
    const rec = recommend(base({ needs: ["cctv"] }));
    const more = applyEdit(rec.lines, { type: "setQty", productId: "P23", qty: 4 }, base({ needs: ["cctv"] }));
    expect(priceLines(more.lines).monthly - priceLines(rec.lines).monthly).toBe(2 * 199);
    expect(priceLines(more.lines).setup - priceLines(rec.lines).setup).toBe(2 * 1800);
    expect(applyEdit(rec.lines, { type: "setQty", productId: "P01", qty: 3 }, profile).blocked?.code).toBe("QTY_INVALID");
    expect(applyEdit(rec.lines, { type: "setQty", productId: "P07", qty: 1.5 }, profile).blocked?.code).toBe("QTY_INVALID");
  });
  it("adding a site duplicates that site's lines and unlocks network control at 3 sites", () => {
    const p2 = base({ businessType: "Restaurant chain", employees: 12, sites: 2, city: "Pune", gstin: GST_OK });
    const rec = recommend(p2);
    const r = applyEdit(rec.lines, { type: "addSite" }, p2);
    expect(r.profile.sites).toBe(3);
    expect(qty(r.lines, "P02")).toBe(3);
    expect(r.notices.map((n) => n.code)).toContain("NETWORK_CONTROL_NOW_AVAILABLE");
    expect(validateLines(r.lines, r.profile)).toEqual([]);
  });
  it("feasibility on a customised quote: infeasible site → AirFiber, failover dropped with a reason, others untouched", () => {
    const p = base({ businessType: "Restaurant chain", employees: 12, sites: 3, city: "Pune", gstin: GST_OK, needs: ["payments", "cctv"] });
    const rec = recommend(p);
    const r = applyFeasibility(rec.lines, p, { 1: false });
    expect(qty(r.lines, "P04", 1)).toBe(1);
    expect(qty(r.lines, "P02", 1)).toBe(0);
    expect(qty(r.lines, "P09", 1)).toBe(0);
    expect(qty(r.lines, "P09", 0)).toBe(1);
    expect(qty(r.lines, "P23", 1)).toBe(2); // CCTV works on AirFiber
    expect(r.notices.map((n) => n.code)).toEqual(expect.arrayContaining(["AIRFIBER_SWAP", "EXCL_AIRFIBER_INCOMPATIBLE"]));
    expect(validateLines(r.lines, r.profile)).toEqual([]);
  });
  it("the last site cannot be removed", () => {
    expect(applyEdit([], { type: "removeSite", siteIndex: 0 }, base()).blocked?.code).toBe("MIN_ONE_SITE");
  });
});

describe("pricing, GST and schedule", () => {
  it("GST is 18% of monthly and of setup, shown separately and rounded to the rupee", () => {
    const p = priceLines(recommend(base({ needs: ["payments"] })).lines);
    expect(p.gstMonthly).toBe(341); // 1897 × 0.18 = 341.46
    expect(p.gstSetup).toBe(450);
    expect(p.monthlyInclGst).toBe(1897 + 341);
    expect(p.firstPayment).toBe(1897 + 341 + 2500 + 450);
  });
  it("indicative price always lies inside the catalogue's [min, max]", () => {
    for (const pr of CATALOGUE) {
      const lo = priceLines([{ productId: pr.id, qty: 1, siteIndex: null }], "min").monthly;
      const hi = priceLines([{ productId: pr.id, qty: 1, siteIndex: null }], "max").monthly;
      expect(lo).toBe(pr.priceMin);
      expect(hi).toBe(pr.priceMax);
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });
  it("dependent items are scheduled after connectivity; Sundays are skipped", () => {
    const s = estimateSchedule([{ productId: "P01", qty: 1, siteIndex: 0 }, { productId: "P23", qty: 2, siteIndex: 0 }], "2026-07-15");
    expect(s.items.find((i) => i.productId === "P23")?.days).toBe(5 + 4);
    expect(addBusinessDays("2026-07-18", 1)).toBe("2026-07-20"); // Sat → Mon
  });
});

describe("determinism and the decision trace", () => {
  it("the same profile always yields the same recommendation", () => {
    const p = base({ businessType: "Clinic", employees: 5, city: "Kochi", gstin: GST_OK, needs: ["email", "uptime"] });
    expect(JSON.stringify(recommend(p))).toBe(JSON.stringify(recommend(p)));
  });
  it("the trace records segment, per-product checks and the price math", () => {
    const t = recommend(base({ needs: ["whatsapp"] })).trace;
    expect(t.some((e) => e.code === "SEGMENT")).toBe(true);
    expect(t.some((e) => e.code === "EXCL_NEEDS_GSTIN" && e.productId === "P15" && e.status === "fail")).toBe(true);
    expect(t.some((e) => e.code === "PRICE_MATH")).toBe(true);
  });
});

// ---- Backtest over the supplied 5,000 leads ---------------------------------------------------
const NEED_FOR: Record<string, Need> = {
  P19: "payments", P23: "cctv", P15: "whatsapp", P14: "sms", P16: "email", P17: "backup", P09: "uptime", P11: "static_ip",
  P12: "phone_system", P13: "tollfree", P22: "wifi", P18: "website", P25: "fleet", P24: "machines", P10: "multisite_mgmt", P21: "security", P20: "security",
};
describe("backtest on the supplied leads", () => {
  const leads = parse(readFileSync("data/smb_leads.csv"), { columns: true }) as Record<string, string>[];
  const gst = new Map((parse(readFileSync("data/mock_gstin_registry.csv"), { columns: true }) as Record<string, string>[]).map((r) => [r.gstin, r.status]));

  const profileOf = (r: Record<string, string>): BusinessProfile => ({
    businessType: r.business_type,
    employees: Number(r.employee_count),
    sites: Number(r.num_sites),
    city: r.city,
    gstin: r.has_gstin === "Y" ? { has: true, verified: true, status: gst.get(r.gstin) as "Active" } : { has: false },
    needs: [...new Set(r.products_of_interest.split(";").map((p) => NEED_FOR[p]).filter(Boolean))],
  });

  it("our segment derivation agrees with the dataset on ≥ 98% of leads", () => {
    const segMap: Record<string, string> = { "Micro retail & services": "micro", "Professional offices": "prof", "Small multi-site businesses": "multi", "Small manufacturers": "mfg" };
    const agree = leads.filter((r) => deriveSegment(profileOf(r)) === segMap[r.segment]).length;
    expect(agree / leads.length).toBeGreaterThanOrEqual(0.98);
  });

  it("the engine never produces a rule-violating bundle for any of the 5,000 lead profiles", () => {
    let withLines = 0;
    for (const r of leads) {
      const p = profileOf(r);
      const rec = recommend(p);
      if (rec.lines.length) withLines++;
      const issues = validateLines(rec.lines, p);
      expect(issues, `${r.lead_id} ${JSON.stringify(issues)}`).toEqual([]);
    }
    expect(withLines).toBe(leads.length);
  });

  it("finds the historical sales that broke the catalogue's own rules (mis-selling / compliance finding)", () => {
    const activated = leads.filter((r) => r.outcome === "Activated");
    let violating = 0;
    let inactiveGst = 0;
    for (const r of activated) {
      const p = profileOf(r);
      const lines: Line[] = r.bundle_products.split(";").map((b) => { const [id, q] = b.split("x"); return { productId: id, qty: Number(q), siteIndex: null }; });
      // account-level check only (site placement is not in the data): eligibility + dependencies
      const bad = lines.some((l) => !eligibility(l.productId, p).ok || (CATALOGUE.find((c) => c.id === l.productId)!.requiresOneOf.length > 0 && !lines.some((x) => CATALOGUE.find((c) => c.id === l.productId)!.requiresOneOf.includes(x.productId))));
      if (bad) violating++;
      if (p.gstin.has && p.gstin.status !== "Active") inactiveGst++;
    }
    expect(violating).toBeGreaterThanOrEqual(50);
    expect(violating).toBeLessThanOrEqual(70);
    expect(inactiveGst).toBe(22);
  });
});
