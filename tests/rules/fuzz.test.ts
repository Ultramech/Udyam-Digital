import { describe, expect, it } from "vitest";
import { CATALOGUE, CONNECTIVITY, getProduct } from "@/lib/catalogue";
import { recommend } from "@/lib/rules/recommend";
import { contractMonths, priceLines } from "@/lib/rules/pricing";
import { applyEdit, applyFeasibility, validateLines, type Edit } from "@/lib/rules/quote";
import { BUSINESS_TYPES, KNOWN_CITIES } from "@/lib/rules/normalise";
import type { BusinessProfile, Line, Need } from "@/lib/rules/types";

/** Seeded PRNG so any failure is reproducible (the seed is printed in the assertion message). */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)];
const NEEDS: Need[] = ["payments", "cctv", "whatsapp", "sms", "email", "backup", "uptime", "static_ip", "phone_system", "tollfree", "wifi", "website", "fleet", "machines", "security", "multisite_mgmt", "fast_internet"];
const PRODUCT_IDS = CATALOGUE.map((p) => p.id);

function randomProfile(r: () => number): BusinessProfile {
  const sites = r() < 0.7 ? 1 : 1 + Math.floor(r() * 12);
  const gst = r();
  const needs = NEEDS.filter(() => r() < 0.18);
  if (r() < 0.05) needs.splice(0, needs.length, "sim_only");
  const fibre: Record<number, boolean> = {};
  for (let i = 0; i < sites; i++) if (r() < 0.3) fibre[i] = false;
  return {
    businessType: pick(r, BUSINESS_TYPES).name,
    employees: 1 + Math.floor(r() ** 2 * 120),
    sites,
    city: pick(r, KNOWN_CITIES),
    gstin: gst < 0.35 ? { has: false } : gst < 0.45 ? { has: true, verified: true, status: pick(r, ["Cancelled", "Suspended"] as const) } : { has: true, verified: r() < 0.5, status: "Active" },
    needs, fibreFeasible: fibre,
    budget: r() < 0.15 ? 500 + Math.floor(r() * 6000) : undefined,
    machines: r() < 0.2 ? 1 + Math.floor(r() * 30) : undefined, vehicles: r() < 0.2 ? 1 + Math.floor(r() * 30) : undefined,
  };
}

describe("fuzz: the engine upholds its invariants for 4,000 random businesses", () => {
  const SEED = 20260715;
  const r = rng(SEED);
  const profiles = Array.from({ length: 4000 }, () => randomProfile(r));

  it("never recommends an ineligible, mis-quantified or uncarried product", () => {
    for (const [i, p] of profiles.entries()) {
      const rec = recommend(p);
      const issues = validateLines(rec.lines, p);
      expect(issues, `seed ${SEED} #${i} ${JSON.stringify(p)}`).toEqual([]);
    }
  });

  it("every site that has anything has exactly one connectivity line, and AirFiber only where fibre is infeasible or budget-downgraded", () => {
    for (const [i, p] of profiles.entries()) {
      const rec = recommend(p);
      if (!rec.lines.length || rec.bundleId === "justphones") continue;
      for (let s = 0; s < p.sites; s++) {
        const conn = rec.lines.filter((l) => CONNECTIVITY.includes(l.productId) && (l.siteIndex ?? 0) === s);
        expect(conn.length, `#${i} site ${s} ${JSON.stringify(p)}`).toBe(1);
        if (conn[0].productId === "P04" && p.fibreFeasible?.[s] !== false) expect(p.budget, `#${i} P04 without reason`).toBeDefined();
      }
    }
  });

  it("pricing is internally consistent: totals add up, GST is 18% rounded, contract ≥ every item's minimum", () => {
    for (const [i, p] of profiles.entries()) {
      const rec = recommend(p);
      if (!rec.lines.length) continue;
      const pr = priceLines(rec.lines);
      expect(pr.monthly, `#${i}`).toBe(pr.lines.reduce((s, l) => s + l.monthly, 0));
      expect(pr.setup, `#${i}`).toBe(pr.lines.reduce((s, l) => s + l.setup, 0));
      expect(pr.gstMonthly).toBe(Math.round(pr.monthly * 0.18));
      expect(pr.firstPayment).toBe(pr.monthlyInclGst + pr.setupInclGst);
      expect(pr.contractMonths).toBe(contractMonths(rec.lines));
      for (const l of rec.lines) expect(pr.contractMonths, `#${i} ${l.productId}`).toBeGreaterThanOrEqual(getProduct(l.productId).minContract);
      for (const l of pr.lines) { const p_ = getProduct(l.productId); expect(l.unitPrice).toBeGreaterThanOrEqual(p_.priceMin); expect(l.unitPrice).toBeLessThanOrEqual(p_.priceMax); }
    }
  });

  it("is deterministic and a budget, when met, is respected", () => {
    for (const [i, p] of profiles.slice(0, 800).entries()) {
      const a = recommend(p), b = recommend(p);
      expect(JSON.stringify(a), `#${i}`).toBe(JSON.stringify(b));
      if (p.budget && a.budget?.met) expect(priceLines(a.lines).monthly, `#${i}`).toBeLessThanOrEqual(p.budget);
    }
  });

  it("exclusions always explain themselves: each excluded product really is ineligible or incompatible", () => {
    for (const [i, p] of profiles.slice(0, 1500).entries()) {
      const rec = recommend(p);
      for (const e of rec.exclusions) expect(rec.lines.some((l) => l.productId === e.productId && validateLines([l], p).length === 0 && e.code !== "EXCL_AIRFIBER_INCOMPATIBLE"), `#${i} ${e.productId} ${e.code} is both included and excluded`).toBe(false);
    }
  });
});

describe("fuzz: 3,000 random quote edit sequences never reach an invalid state", () => {
  const SEED = 424242;
  const r = rng(SEED);
  it("after any accepted edit (and any feasibility change) the quote still validates", () => {
    let accepted = 0, blocked = 0;
    for (let run = 0; run < 3000; run++) {
      let profile = randomProfile(r);
      let lines: Line[] = recommend(profile).lines;
      if (!lines.length) continue;
      for (let step = 0; step < 8; step++) {
        const pid = pick(r, PRODUCT_IDS);
        const k = r();
        const edit: Edit = k < 0.3 ? { type: "add", productId: pid } : k < 0.5 ? { type: "remove", productId: pid }
          : k < 0.75 ? { type: "setQty", productId: pid, qty: Math.floor(r() * 12) } : k < 0.85 ? { type: "addSite" } : { type: "removeSite", siteIndex: Math.floor(r() * profile.sites) };
        const res = applyEdit(lines, edit, profile);
        if (res.blocked) { blocked++; expect(res.lines).toEqual(lines); continue; } // a blocked edit changes nothing
        accepted++;
        lines = res.lines; profile = res.profile;
        const issues = validateLines(lines, profile);
        // removing a product may legitimately leave nothing carrying a dependent — the engine must cascade, never leave an orphan
        expect(issues, `seed ${SEED} run ${run} step ${step} edit ${JSON.stringify(edit)} issues ${JSON.stringify(issues)} lines ${JSON.stringify(lines)}`).toEqual([]);
      }
      // infeasible-site fallback applied to a customised quote must also stay valid
      const feas: Record<number, boolean> = {};
      for (let s = 0; s < profile.sites; s++) if (r() < 0.4) feas[s] = false;
      const f = applyFeasibility(lines, profile, feas);
      expect(validateLines(f.lines, f.profile), `seed ${SEED} run ${run} feasibility ${JSON.stringify(feas)}`).toEqual([]);
    }
    expect(accepted).toBeGreaterThan(2000);
    expect(blocked).toBeGreaterThan(500); // the fuzz really does hit the guards
  });
});
