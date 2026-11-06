import { CATALOGUE, CONNECTIVITY, FIBRE, getProduct, isDependent, type ProductId, type Segment } from "@/lib/catalogue";
import { HARD_ESCALATE_SITES } from "@/lib/config";
import { eligibility, gstCheck } from "./eligibility";
import { cityTier, deriveSegment } from "./normalise";
import { priceLines } from "./pricing";
import { carrierStatus } from "./quote";
import type {
  Alternative, BudgetResult, BundleId, BusinessProfile, Counterfactual, Escalation, EscalationCode, Exclusion,
  Line, Need, Recommendation, Ref, TraceEntry,
} from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const has = (p: BusinessProfile, n: Need) => p.needs.includes(n);
/** What saying "I don't want X" removes. Connectivity and mobile lines are the core of every plan and cannot be declined. */
export const DECLINABLE: Partial<Record<Need, ProductId[]>> = {
  cctv: ["P23"], payments: ["P19"], wifi: ["P22"], uptime: ["P09"], backup: ["P17"], email: ["P16"], security: ["P20", "P21"], static_ip: ["P11"],
  phone_system: ["P12"], tollfree: ["P13"], sms: ["P14"], website: ["P18"], fleet: ["P25"], machines: ["P24"], whatsapp: ["P15"], multisite_mgmt: ["P10"],
};

export const bundleForSegment = (s: Segment): BundleId =>
  ({ micro: "dukaan", prof: "office", multi: "allshops", mfg: "factory" } as const)[s];

type Mode = "normal" | "lean" | "full";
interface Built {
  lines: Line[]; exclusions: Exclusion[]; trace: TraceEntry[]; why: Ref[]; addons: ProductId[];
  notices: Ref[]; siteConn: Record<number, ProductId>;
}

/** Assemble the bundle for a segment. Pure and deterministic; every decision appends to the trace. */
function build(profile: BusinessProfile, segment: Segment, mode: Mode): Built {
  const lines: Line[] = [];
  const exclusions: Exclusion[] = [];
  const trace: TraceEntry[] = [];
  const notices: Ref[] = [];
  const siteConn: Record<number, ProductId> = {};
  const sites = Math.max(1, profile.sites);

  const addExcl = (productId: ProductId, code: Exclusion["code"], params?: Exclusion["params"]) => {
    if (!exclusions.some((e) => e.productId === productId && e.code === code)) exclusions.push({ productId, code, params });
  };
  const wants = (n: Need) =>
    has(profile, n) || (mode === "full" && ["uptime", "security", "backup", "cctv", "wifi"].includes(n));
  const full = mode !== "lean";
  const declinedProducts = new Set((profile.declined ?? []).flatMap((n) => DECLINABLE[n] ?? []));

  function add(id: ProductId, qty: number, siteIndex: number | null, requested: boolean): boolean {
    if (qty < 1) return false;
    if (declinedProducts.has(id)) {
      if (!trace.some((t) => t.code === "DECLINED_BY_OWNER" && t.productId === id)) trace.push({ step: "owner", code: "DECLINED_BY_OWNER", status: "info", productId: id });
      return false;
    }
    const r = eligibility(id, profile);
    if (!r.ok) {
      if (requested) addExcl(id, r.code, r.params);
      trace.push({ step: "eligibility", code: r.code, status: "fail", productId: id, params: r.params });
      return false;
    }
    const ex = lines.find((l) => l.productId === id && l.siteIndex === siteIndex);
    if (ex) { ex.qty = Math.max(ex.qty, qty); return true; }
    lines.push({ productId: id, qty, siteIndex });
    trace.push({ step: "eligibility", code: r.pending ? "ELIGIBLE_PENDING_GST" : "ELIGIBLE", status: "pass", productId: id });
    return true;
  }

  /** Per-site dependent product: needs compatible connectivity at that site (AirFiber can't carry failover/static IP/etc.). */
  function addDependent(id: ProductId, qty: number, siteIndex: number, requested: boolean): boolean {
    const p = getProduct(id);
    const conn = siteConn[siteIndex];
    if (p.requiresOneOf.length && !p.requiresOneOf.includes(conn)) {
      if (requested) addExcl(id, "EXCL_AIRFIBER_INCOMPATIBLE", { site: siteIndex + 1 });
      trace.push({ step: "dependency", code: "EXCL_AIRFIBER_INCOMPATIBLE", status: "fail", productId: id, params: { site: siteIndex + 1 } });
      return false;
    }
    return add(id, qty, siteIndex, requested);
  }
  /** Account-level dependent (e.g. the multi-site control panel): needs a compatible link at ANY site. */
  function addAccountDependent(id: ProductId, qty: number, requested: boolean): boolean {
    const allowed = getProduct(id).requiresOneOf;
    if (!Object.values(siteConn).some((c) => allowed.includes(c))) {
      if (requested) addExcl(id, "EXCL_AIRFIBER_INCOMPATIBLE", { site: 1 });
      trace.push({ step: "dependency", code: "EXCL_AIRFIBER_INCOMPATIBLE", status: "fail", productId: id, params: { site: 1 } });
      return false;
    }
    return add(id, qty, null, requested);
  }
  const eachSite = (fn: (s: number) => void) => { for (let s = 0; s < sites; s++) fn(s); };

  const gst = gstCheck(profile.gstin);
  const emp = Math.max(1, profile.employees);
  const phoneLines = profile.lines ?? (segment === "micro" ? 1 : clamp(Math.ceil(emp / 3), 1, 10));

  // 1) connectivity per site -------------------------------------------------------------------
  function preferredConnectivity(): ProductId {
    switch (segment) {
      case "micro": return "P01";
      case "prof": return emp <= 3 ? "P01" : "P02";
      case "multi": return "P02";
      case "mfg": return emp >= 10 && gst === "ok" ? "P05" : "P02";
    }
  }
  let pref = preferredConnectivity();
  if (segment === "mfg" && emp >= 10 && gst !== "ok") {
    addExcl("P05", gst === "none" ? "EXCL_NEEDS_GSTIN" : "EXCL_GSTIN_INACTIVE", gst === "inactive" ? { status: profile.gstin.status ?? "" } : undefined);
    trace.push({ step: "template", code: "DEDICATED_LINE_NEEDS_GST", status: "warn", productId: "P05" });
  }
  if (wants("fast_internet") && segment === "prof") {
    const r = eligibility("P03", profile);
    if (r.ok) pref = "P03"; else addExcl("P03", r.code, r.params);
  }

  eachSite((s) => {
    let id = pref;
    if (FIBRE.includes(id) && profile.fibreFeasible?.[s] === false) {
      trace.push({ step: "feasibility", code: "AIRFIBER_SWAP", status: "info", productId: "P04", params: { site: s + 1, from: id } });
      notices.push({ code: "AIRFIBER_SWAP", params: { site: s + 1 } });
      id = "P04";
    }
    if (!eligibility(id, profile).ok && id !== "P02") id = "P02";
    if (add(id, 1, s, true)) siteConn[s] = id;
  });
  if (!Object.keys(siteConn).length) return { lines, exclusions, trace, why: [], addons: [], notices, siteConn };

  // 2) segment defaults ------------------------------------------------------------------------
  const why: Ref[] = [];
  switch (segment) {
    case "micro":
      add("P07", phoneLines, null, true);
      if (full) eachSite((s) => add("P19", 1, s, false));
      break;
    case "prof":
      add("P07", phoneLines, null, true);
      if (full) { add("P16", clamp(emp, 1, 50), null, false); add("P17", 1, null, false); add("P20", clamp(emp, 1, 50), null, false); }
      break;
    case "multi":
      eachSite((s) => add("P07", 2, s, true));
      if (full) eachSite((s) => {
        addDependent("P09", 1, s, false);
        addDependent("P23", clamp(profile.cameras ?? 2, 1, 20), s, false);
        add("P19", 1, s, false);
      });
      if (sites >= 3 && full) {
        if (addAccountDependent("P10", sites, true)) trace.push({ step: "template", code: "NETWORK_CONTROL_ADDED", status: "add", productId: "P10" });
      }
      break;
    case "mfg":
      add("P08", clamp(Math.ceil(emp / 20), 1, 10), null, true);
      if (full) {
        const fw = eligibility("P21", profile);
        if (fw.ok) eachSite((s) => addDependent("P21", 1, s, true)); else if (emp >= 10 || has(profile, "security")) addExcl("P21", fw.code, fw.params);
        const m = clamp(profile.machines ?? (has(profile, "machines") ? 3 : 1), 1, 200);
        const s = eligibility("P24", profile);
        if (s.ok) add("P24", m, null, true); else if (emp >= 10 || has(profile, "machines")) addExcl("P24", s.code, s.params);
      }
      break;
  }

  // 3) needs-driven additions ------------------------------------------------------------------
  if (mode !== "lean") {
    if (wants("payments")) eachSite((s) => add("P19", 1, s, true));
    if (wants("cctv")) eachSite((s) => addDependent("P23", clamp(profile.cameras ?? 2, 1, 20), s, true));
    if (wants("wifi")) eachSite((s) => addDependent("P22", 1, s, true));
    if (wants("uptime")) eachSite((s) => addDependent("P09", 1, s, true));
    if (wants("backup")) add("P17", 1, null, true);
    if (wants("email")) add("P16", clamp(emp, 1, 50), null, true);
    if (wants("security")) {
      add("P20", clamp(emp, 1, 50), null, true);
      if (segment !== "micro" && emp >= 10) {
        const r = eligibility("P21", profile);
        if (r.ok) eachSite((s) => addDependent("P21", 1, s, true)); else addExcl("P21", r.code, r.params);
      }
    }
    if (wants("static_ip")) addDependent("P11", 1, 0, true);
    if (wants("phone_system")) add("P12", clamp(Math.ceil(emp / 5), 2, 10), null, true);
    if (wants("tollfree")) add("P13", 1, null, true);
    if (wants("sms")) add("P14", 1, null, true);
    if (wants("website")) add("P18", 1, null, true);
    if (wants("fleet")) add("P25", clamp(profile.vehicles ?? 3, 1, 200), null, true);
    if (wants("machines") && segment !== "mfg") add("P24", clamp(profile.machines ?? 3, 1, 200), null, true);
    if (wants("multisite_mgmt")) addAccountDependent("P10", sites, true);
    if (wants("whatsapp")) {
      if (!add("P15", 1, null, true)) {
        // Honest fallback: say no, offer what works today (website with catalogue link) as an add-on.
        notices.push({ code: "WHATSAPP_ALTERNATIVE_WEBSITE" });
      }
    }
  }

  // 4) reasons ---------------------------------------------------------------------------------
  const hasP = (id: ProductId) => lines.some((l) => l.productId === id);
  if (profile.currentInternet === "hotspot") why.push({ code: "BECAUSE_HOTSPOT_UNRELIABLE" });
  if (segment === "multi") why.push({ code: "BECAUSE_ONE_BILL_ALL_SITES", params: { sites } });
  if (segment === "prof") why.push({ code: "BECAUSE_OFFICE_SECURE_PRODUCTIVE" });
  if (segment === "mfg") why.push({ code: "BECAUSE_MFG_DEDICATED" });
  if (hasP("P19")) why.push({ code: "BECAUSE_BILLING_UPI" });
  if (hasP("P23")) why.push({ code: "BECAUSE_CCTV" });
  if (hasP("P09")) why.push({ code: "BECAUSE_BACKUP" });
  if (hasP("P04")) why.push({ code: "BECAUSE_AIRFIBER_FAST" });
  if (segment === "micro" && !why.length) why.push({ code: "BECAUSE_SMALL_SHOP_SIMPLE" });

  // 5) optional add-ons (eligible, relevant to the segment, compatible with each site's link) -----
  const addons: ProductId[] = [];
  for (const p of CATALOGUE) {
    if (lines.some((l) => l.productId === p.id)) continue;
    if (CONNECTIVITY.includes(p.id) || p.id === "P07" || p.id === "P08") continue;
    if (!p.segments.includes(segment)) continue;
    if (!eligibility(p, profile).ok) continue;
    if (p.requiresOneOf.length && !Object.values(siteConn).some((c) => p.requiresOneOf.includes(c))) continue;
    addons.push(p.id);
  }
  return { lines, exclusions, trace, why: why.slice(0, 4), addons, notices, siteConn };
}

// ---- budget mode ---------------------------------------------------------------------------------
const REMOVAL_ORDER: ProductId[] = ["P18", "P22", "P23", "P17", "P20", "P16", "P12", "P13", "P14", "P15", "P11", "P09", "P19", "P25", "P24", "P21", "P10"];
const DOWNGRADE: Record<string, ProductId> = { P03: "P02", P02: "P01", P01: "P04" };

function applyBudget(lines: Line[], target: number): { lines: Line[]; result: BudgetResult } {
  let cur = lines.map((l) => ({ ...l }));
  const removed: ProductId[] = [];
  const downgraded: ProductId[] = [];
  const monthly = () => priceLines(cur).monthly;
  for (const id of REMOVAL_ORDER) {
    if (monthly() <= target) break;
    if (cur.some((l) => l.productId === id)) { cur = cur.filter((l) => l.productId !== id); removed.push(id); }
  }
  if (monthly() > target) {
    cur = cur.map((l) => {
      const to = DOWNGRADE[l.productId];
      if (to && getProduct(to).priceMin < getProduct(l.productId).priceMin && monthly() > target) {
        downgraded.push(l.productId);
        return { ...l, productId: to };
      }
      return l;
    });
    // dependents that no longer fit a downgraded link (AirFiber) are dropped
    const snapshot = cur;
    cur = cur.filter((l) => !isDependent(l.productId) || carrierStatus(snapshot, l) === "ok");
  }
  const minPossible = monthly();
  return { lines: cur, result: { target, met: minPossible <= target, removed, downgraded, minPossible } };
}

// ---- counterfactuals -----------------------------------------------------------------------------
function counterfactuals(profile: BusinessProfile, exclusions: Exclusion[]): Counterfactual[] {
  const out: Counterfactual[] = [];
  const gstIds = exclusions.filter((e) => e.code === "EXCL_NEEDS_GSTIN").map((e) => e.productId);
  const verified: BusinessProfile = { ...profile, gstin: { has: true, verified: true, status: "Active" } };
  const gstUnlock = gstIds.filter((id) => eligibility(id, verified).ok);
  if (gstUnlock.length) out.push({ condition: "GST_VERIFIED", unlocks: gstUnlock });

  const staff = new Map<number, ProductId[]>();
  for (const e of exclusions.filter((x) => x.code === "EXCL_TOO_SMALL")) {
    const need = getProduct(e.productId).minEmployees;
    if (eligibility(e.productId, { ...profile, employees: need }).ok) staff.set(need, [...(staff.get(need) ?? []), e.productId]);
  }
  for (const [threshold, unlocks] of staff) out.push({ condition: "MORE_STAFF", threshold, unlocks });

  const sitesMap = new Map<number, ProductId[]>();
  for (const e of exclusions.filter((x) => x.code === "EXCL_FEW_SITES")) {
    const need = getProduct(e.productId).minSites;
    if (eligibility(e.productId, { ...profile, sites: need }).ok) sitesMap.set(need, [...(sitesMap.get(need) ?? []), e.productId]);
  }
  for (const [threshold, unlocks] of sitesMap) out.push({ condition: "MORE_SITES", threshold, unlocks });
  return out;
}

// ---- escalation ----------------------------------------------------------------------------------
function escalate(profile: BusinessProfile, segment: Segment, lines: Line[], tier: number | null): Escalation {
  const reasons: EscalationCode[] = [];
  let hard = false;
  if (!tier) { reasons.push("OUT_OF_AREA"); hard = true; }
  if (profile.sites >= HARD_ESCALATE_SITES) { reasons.push("MANY_SITES"); hard = true; }
  if (profile.explicitHuman) { reasons.push("REQUESTED_HUMAN"); hard = true; }
  if (!lines.length && tier && profile.sites < HARD_ESCALATE_SITES) { reasons.push("NO_VALID_BUNDLE"); hard = true; }
  if (profile.otherNeeds?.length) reasons.push("OUT_OF_CATALOGUE");
  if (segment === "multi" && profile.sites >= 3) reasons.push("MULTI_SITE_HIGH_VALUE");
  if (segment === "mfg") reasons.push("MFG_FIELD_LED");
  if (lines.some((l) => l.productId === "P05" || l.productId === "P06")) reasons.push("DEDICATED_LINE");
  const uniq = [...new Set(reasons)];
  return { flag: uniq.length > 0, level: hard ? "hard" : uniq.length ? "assist" : "none", reasons: uniq };
}

// ---- main entry ----------------------------------------------------------------------------------
export function recommend(profile: BusinessProfile): Recommendation {
  const tier = cityTier(profile.city);
  const segment = deriveSegment(profile);
  const trace: TraceEntry[] = [
    { step: "normalise", code: "SEGMENT", status: "info", params: { segment, businessType: profile.businessType ?? "—" } },
    tier
      ? { step: "normalise", code: "CITY_TIER", status: "info", params: { city: profile.city, tier } }
      : { step: "normalise", code: "CITY_UNKNOWN", status: "fail", params: { city: profile.city } },
    { step: "normalise", code: "GST_STATE", status: "info", params: { state: gstCheck(profile.gstin) } },
  ];

  const empty = (bundleId: BundleId): Recommendation => ({
    bundleId, segment, cityTier: tier, lines: [], addons: [], exclusions: [], alternatives: [], counterfactuals: [], why: [], notices: [],
    escalation: escalate(profile, segment, [], tier), trace,
  });

  if (!tier || profile.sites >= HARD_ESCALATE_SITES) return empty(bundleForSegment(segment));

  // SIM-only route: valid, 1-month, with an upgrade nudge at activation.
  const simOnly = profile.needs.length > 0 && profile.needs.every((n) => n === "sim_only");
  if (simOnly) {
    const qty = clamp(profile.lines ?? profile.employees ?? 1, 1, 10);
    const lines: Line[] = [{ productId: "P07", qty, siteIndex: null }];
    const r = eligibility("P07", profile);
    trace.push({ step: "template", code: "SIM_ONLY_ROUTE", status: "info" });
    return {
      ...empty("justphones"), lines: r.ok ? lines : [], why: [{ code: "BECAUSE_SIM_ONLY" }],
      notices: [{ code: "SIM_UPGRADE_LATER" }], escalation: escalate(profile, segment, lines, tier), trace,
    };
  }

  const main = build(profile, segment, "normal");
  trace.push(...main.trace);
  let lines = main.lines;
  let budget: BudgetResult | undefined;
  if (profile.budget && profile.budget > 0 && lines.length) {
    const b = applyBudget(lines, profile.budget);
    lines = b.lines;
    budget = b.result;
    trace.push({ step: "budget", code: budget.met ? "BUDGET_MET" : "BUDGET_NOT_MET", status: budget.met ? "pass" : "warn", params: { target: budget.target, min: budget.minPossible } });
  }

  const price = priceLines(lines);
  trace.push({ step: "pricing", code: "PRICE_MATH", status: "info", params: { monthly: price.monthly, setup: price.setup, gst: price.gstMonthly } });

  const alternatives: Alternative[] = [];
  for (const [id, mode] of [["lighter", "lean"], ["fuller", "full"]] as const) {
    const alt = build(profile, segment, mode);
    const p = priceLines(alt.lines);
    if (alt.lines.length && p.monthly !== price.monthly) alternatives.push({ id, lines: alt.lines, monthly: p.monthly, setup: p.setup });
  }

  return {
    bundleId: bundleForSegment(segment), segment, cityTier: tier, lines,
    addons: main.addons.filter((id) => !lines.some((l) => l.productId === id)),
    exclusions: main.exclusions, alternatives, counterfactuals: counterfactuals(profile, main.exclusions),
    escalation: escalate(profile, segment, lines, tier), why: main.why, notices: main.notices, budget, trace,
  };
}
