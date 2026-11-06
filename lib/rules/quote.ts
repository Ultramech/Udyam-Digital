import { CATALOGUE, CONNECTIVITY, FIBRE, getProduct, isDependent, isPerSite, type ProductId } from "@/lib/catalogue";
import { eligibility } from "./eligibility";
import type { BusinessProfile, Line, Params, Ref } from "./types";

export type Edit =
  | { type: "add"; productId: ProductId; qty?: number; siteIndex?: number }
  | { type: "remove"; productId: ProductId; siteIndex?: number }
  | { type: "setQty"; productId: ProductId; qty: number; siteIndex?: number }
  | { type: "addSite" }
  | { type: "removeSite"; siteIndex: number };

export interface EditResult {
  lines: Line[];
  profile: BusinessProfile;
  notices: Ref[];
  blocked?: Ref & { productId?: ProductId };
}

export interface Issue extends Ref { productId: ProductId; siteIndex: number | null }

const MAX_QTY = 100;
const siteOf = (l: { siteIndex: number | null }) => l.siteIndex ?? 0;
const connAt = (lines: Line[], site: number) => lines.find((l) => CONNECTIVITY.includes(l.productId) && siteOf(l) === site);

/**
 * Is a dependent product carried by a compatible link?
 *  - attached to a site (siteIndex ≠ null): needs a compatible link AT THAT SITE (failover on an AirFiber site makes no sense)
 *  - account-level (siteIndex = null, e.g. the multi-site control panel): needs a compatible link ANYWHERE in the bundle.
 */
export function carrierStatus(lines: Line[], l: Line): "ok" | "none" | "incompatible" {
  const p = getProduct(l.productId);
  if (!p.requiresOneOf.length) return "ok";
  if (l.siteIndex === null) {
    if (lines.some((x) => p.requiresOneOf.includes(x.productId))) return "ok";
    return lines.some((x) => CONNECTIVITY.includes(x.productId)) ? "incompatible" : "none";
  }
  const c = connAt(lines, l.siteIndex);
  if (!c) return "none";
  return p.requiresOneOf.includes(c.productId) ? "ok" : "incompatible";
}

/** Final guard: every line must be eligible, sensibly quantified and carried by compatible connectivity. */
export function validateLines(lines: Line[], profile: BusinessProfile): Issue[] {
  const issues: Issue[] = [];
  const dup = new Set<string>();
  for (const l of lines) {
    const key = `${l.productId}@${l.siteIndex}`;
    if (dup.has(key)) issues.push({ code: "DUPLICATE_LINE", productId: l.productId, siteIndex: l.siteIndex });
    dup.add(key);
    if (l.productId === "P10" && l.siteIndex !== null) issues.push({ code: "MISPLACED_LINE", productId: l.productId, siteIndex: l.siteIndex });
  }
  if (lines.filter((l) => l.productId === "P10").length > 1) issues.push({ code: "DUPLICATE_LINE", productId: "P10", siteIndex: null });
  const seen = new Set<number>();
  for (const l of lines) {
    if (!CONNECTIVITY.includes(l.productId)) continue;
    const site = siteOf(l);
    if (seen.has(site)) issues.push({ code: "DUPLICATE_CONNECTIVITY", params: { site: site + 1 }, productId: l.productId, siteIndex: l.siteIndex });
    seen.add(site);
  }
  for (const l of lines) {
    getProduct(l.productId); // guard: throws on an unknown product id
    const push = (code: string, params?: Params) => issues.push({ code, params, productId: l.productId, siteIndex: l.siteIndex });
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY) push("QTY_INVALID", { qty: l.qty });
    if (isPerSite(l.productId) && l.productId !== "P10" && l.qty !== 1) push("QTY_INVALID", { qty: l.qty });
    if (l.siteIndex !== null && l.siteIndex >= profile.sites) push("SITE_INVALID", { site: l.siteIndex + 1 });
    const r = eligibility(l.productId, profile);
    if (!r.ok) push(r.code, r.params);
    if (isDependent(l.productId)) {
      const st = carrierStatus(lines, l);
      if (st === "none") push("EXCL_DEPENDENCY", { site: siteOf(l) + 1 });
      else if (st === "incompatible") push("EXCL_AIRFIBER_INCOMPATIBLE", { site: siteOf(l) + 1 });
    }
  }
  return issues;
}

/**
 * Re-quote after a status change (e.g. GSTIN found Cancelled): remove every line that is no longer eligible, then anything
 * that lost its carrier. Returns what was removed so the owner sees exactly what changed and why.
 */
export function dropIneligible(linesIn: Line[], profile: BusinessProfile): { lines: Line[]; removed: { productId: ProductId; code: string; params?: Params }[] } {
  let lines = linesIn.map((l) => ({ ...l }));
  const removed: { productId: ProductId; code: string; params?: Params }[] = [];
  for (let pass = 0; pass < 4; pass++) {
    const bad = validateLines(lines, profile).filter((i) => i.code.startsWith("EXCL_"));
    if (!bad.length) break;
    for (const b of bad) if (!removed.some((r) => r.productId === b.productId && r.code === b.code)) removed.push({ productId: b.productId, code: b.code, params: b.params });
    const key = (l: { productId: string; siteIndex: number | null }) => `${l.productId}@${l.siteIndex}`;
    const gone = new Set(bad.map((b) => key(b)));
    lines = lines.filter((l) => !gone.has(key(l)));
  }
  return { lines, removed };
}

export type CatalogueState = { productId: ProductId; state: "included" | "available" | "unavailable"; reason?: Ref };
/** For the quote builder: every relevant product is included, can be added, or is unavailable — with the plain reason. */
export function catalogueStatus(lines: Line[], profile: BusinessProfile, segment: string): CatalogueState[] {
  const out: CatalogueState[] = [];
  for (const p of CATALOGUE) {
    if (lines.some((l) => l.productId === p.id)) { out.push({ productId: p.id, state: "included" }); continue; }
    if (CONNECTIVITY.includes(p.id) || p.id === "P08") continue; // connectivity is swapped by feasibility/upgrade, not added ad hoc
    if (!p.segments.includes(segment) && !["P09", "P11", "P13", "P14", "P15", "P18"].includes(p.id)) continue;
    const r = eligibility(p, profile);
    if (!r.ok) { out.push({ productId: p.id, state: "unavailable", reason: { code: r.code, params: r.params } }); continue; }
    const conns = lines.filter((l) => CONNECTIVITY.includes(l.productId));
    if (p.requiresOneOf.length && conns.length && !conns.some((c) => p.requiresOneOf.includes(c.productId)))
      out.push({ productId: p.id, state: "unavailable", reason: { code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: 1 } } });
    else out.push({ productId: p.id, state: "available" });
  }
  return out;
}
/** Cheapest eligible connectivity that satisfies a dependent product at a given site. */
function cheapestConnectivityFor(productId: ProductId, site: number, profile: BusinessProfile): ProductId | null {
  const allowed = getProduct(productId).requiresOneOf;
  const feasible = profile.fibreFeasible?.[site] !== false;
  const options = allowed
    .filter((id) => eligibility(id, profile).ok)
    .filter((id) => feasible || !FIBRE.includes(id))
    // dedicated lines are never an "auto-add": they need a survey and a human
    .filter((id) => id !== "P05" && id !== "P06")
    .sort((a, b) => getProduct(a).priceMin - getProduct(b).priceMin);
  return options[0] ?? null;
}

/**
 * Applies per-site fibre feasibility to an already-customised quote: an infeasible site on fibre switches to 5G AirFiber
 * (only if the catalogue allows it), and anything that cannot ride on AirFiber (failover, fixed IP, firewall…) is dropped
 * with an explanation. Sites that become feasible again are NOT switched back automatically.
 */
export function applyFeasibility(linesIn: Line[], profileIn: BusinessProfile, feasible: Record<number, boolean>): EditResult {
  let lines = linesIn.map((l) => ({ ...l }));
  const profile: BusinessProfile = { ...profileIn, fibreFeasible: { ...profileIn.fibreFeasible, ...feasible } };
  const notices: Ref[] = [];
  for (const [k, ok] of Object.entries(feasible)) {
    const s = Number(k);
    if (ok) continue;
    const conn = lines.find((l) => FIBRE.includes(l.productId) && siteOf(l) === s);
    if (!conn) continue;
    if (!eligibility("P04", profile).ok) {
      notices.push({ code: "NO_AIRFIBER_FALLBACK", params: { site: s + 1 } });
      continue;
    }
    conn.productId = "P04";
    notices.push({ code: "AIRFIBER_SWAP", params: { site: s + 1 } });
    const dropped = lines.filter((l) => l.siteIndex === s && isDependent(l.productId) && !getProduct(l.productId).requiresOneOf.includes("P04"));
    lines = lines.filter((l) => !dropped.includes(l));
    for (const d of dropped) notices.push({ code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: s + 1, productId: d.productId } });
  }
  // account-level products (control panel…) survive as long as ANY site still has a compatible link
  const stranded = lines.filter((l) => l.siteIndex === null && isDependent(l.productId) && carrierStatus(lines, l) !== "ok");
  lines = lines.filter((l) => !stranded.includes(l));
  for (const d of stranded) notices.push({ code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: 1, productId: d.productId } });
  return { lines, profile, notices };
}

export function applyEdit(linesIn: Line[], edit: Edit, profileIn: BusinessProfile): EditResult {
  let lines = linesIn.map((l) => ({ ...l }));
  let profile = { ...profileIn };
  const notices: Ref[] = [];
  const blocked = (b: Ref, productId?: ProductId): EditResult => ({ lines: linesIn, profile: profileIn, notices, blocked: { ...b, productId } });

  switch (edit.type) {
    case "add": {
      const p = getProduct(edit.productId);
      const r = eligibility(p, profile);
      if (!r.ok) return blocked({ code: r.code, params: r.params }, p.id);
      if (CONNECTIVITY.includes(p.id)) {
        // one link per site: adding connectivity REPLACES that site's link, then anything that can't ride on the new one is dropped
        const s = edit.siteIndex ?? 0;
        if (s < 0 || s >= profile.sites) return blocked({ code: "SITE_INVALID", params: { site: s + 1 } }, p.id);
        const cur = connAt(lines, s);
        if (cur?.productId === p.id) return { lines, profile, notices };
        if (cur) cur.productId = p.id; else lines.push({ productId: p.id, qty: 1, siteIndex: s });
        const dropped = lines.filter((l) => l.siteIndex === s && isDependent(l.productId) && carrierStatus(lines, l) !== "ok");
        lines = lines.filter((l) => !dropped.includes(l));
        for (const d of dropped) notices.push({ code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: s + 1, productId: d.productId } });
        const stranded = lines.filter((l) => l.siteIndex === null && isDependent(l.productId) && carrierStatus(lines, l) !== "ok");
        lines = lines.filter((l) => !stranded.includes(l));
        for (const d of stranded) notices.push({ code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: 1, productId: d.productId } });
        return { lines, profile, notices };
      }
      const perSiteLine = isPerSite(p.id) && p.id !== "P10";
      const targets: (number | null)[] = perSiteLine
        ? edit.siteIndex !== undefined ? [edit.siteIndex] : Array.from({ length: profile.sites }, (_, i) => i)
        : [p.id === "P10" ? null : edit.siteIndex ?? (isDependent(p.id) ? 0 : null)];
      for (const s of targets) {
        const depSite = s ?? 0;
        if (p.requiresOneOf.length) {
          const st = carrierStatus(lines, { productId: p.id, qty: 1, siteIndex: s });
          if (st === "incompatible") return blocked({ code: "EXCL_AIRFIBER_INCOMPATIBLE", params: { site: depSite + 1 } }, p.id);
          if (st === "none") {
            const carrier = cheapestConnectivityFor(p.id, depSite, profile);
            if (!carrier) return blocked({ code: "EXCL_DEPENDENCY", params: { site: depSite + 1 } }, p.id);
            lines.push({ productId: carrier, qty: 1, siteIndex: depSite });
            notices.push({ code: "DEP_ADDED", params: { productId: carrier, for: p.id, site: depSite + 1 } });
          }
        }
        const qty = perSiteLine ? 1 : p.id === "P10" ? profile.sites : Math.min(MAX_QTY, Math.max(1, edit.qty ?? 1));
        const ex = lines.find((l) => l.productId === p.id && l.siteIndex === s);
        if (ex) { if (!perSiteLine && p.id !== "P10") ex.qty = Math.min(MAX_QTY, ex.qty + qty); }
        else lines.push({ productId: p.id, qty, siteIndex: s });
      }
      return { lines, profile, notices };
    }
    case "remove": {
      const removing = lines.filter((l) => l.productId === edit.productId && (edit.siteIndex === undefined || siteOf(l) === edit.siteIndex));
      lines = lines.filter((l) => !removing.includes(l));
      if (CONNECTIVITY.includes(edit.productId)) {
        // cascade: dependents lose their carrier
        for (const r of removing) {
          if (connAt(lines, siteOf(r))) continue;
          const orphans = lines.filter((l) => l.siteIndex !== null && isDependent(l.productId) && siteOf(l) === siteOf(r));
          if (orphans.length) {
            lines = lines.filter((l) => !orphans.includes(l));
            notices.push({ code: "DEP_REMOVED", params: { site: siteOf(r) + 1, count: orphans.length } });
          }
        }
        const stranded = lines.filter((l) => l.siteIndex === null && isDependent(l.productId) && carrierStatus(lines, l) !== "ok");
        if (stranded.length) { lines = lines.filter((l) => !stranded.includes(l)); notices.push({ code: "DEP_REMOVED", params: { site: 1, count: stranded.length } }); }
      }
      return { lines, profile, notices };
    }
    case "setQty": {
      if (edit.qty < 1) return applyEdit(lines, { type: "remove", productId: edit.productId, siteIndex: edit.siteIndex }, profile);
      if (!Number.isInteger(edit.qty) || edit.qty > MAX_QTY) return blocked({ code: "QTY_INVALID", params: { qty: edit.qty } }, edit.productId);
      if (isPerSite(edit.productId) && edit.productId !== "P10" && edit.qty !== 1) return blocked({ code: "QTY_INVALID", params: { qty: edit.qty } }, edit.productId);
      for (const l of lines) if (l.productId === edit.productId && (edit.siteIndex === undefined || siteOf(l) === edit.siteIndex)) l.qty = edit.qty;
      return { lines, profile, notices };
    }
    case "addSite": {
      const newIdx = profile.sites;
      const src = newIdx - 1;
      for (const l of linesIn) if (l.siteIndex === src) lines.push({ ...l, siteIndex: newIdx });
      profile = { ...profile, sites: newIdx + 1 };
      // per-account network control follows the site count
      for (const nc of lines.filter((l) => l.productId === "P10")) nc.qty = profile.sites;
      const unlocked = eligibility("P10", profile);
      const had = eligibility("P10", profileIn).ok;
      if (unlocked.ok && !had) notices.push({ code: "NETWORK_CONTROL_NOW_AVAILABLE" });
      return { lines, profile, notices };
    }
    case "removeSite": {
      if (profile.sites <= 1) return blocked({ code: "MIN_ONE_SITE" });
      lines = lines
        .filter((l) => l.siteIndex !== edit.siteIndex)
        .map((l) => (l.siteIndex !== null && l.siteIndex > edit.siteIndex ? { ...l, siteIndex: l.siteIndex - 1 } : l));
      profile = { ...profile, sites: profile.sites - 1 };
      if (lines.some((l) => l.productId === "P10")) {
        if (eligibility("P10", profile).ok) for (const nc of lines.filter((l) => l.productId === "P10")) nc.qty = profile.sites;
        else { lines = lines.filter((l) => l.productId !== "P10"); notices.push({ code: "NETWORK_CONTROL_REMOVED" }); }
      }
      return { lines, profile, notices };
    }
  }
}
