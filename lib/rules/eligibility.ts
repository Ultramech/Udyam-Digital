import { getProduct, type Product } from "@/lib/catalogue";
import type { BusinessProfile, ExclusionCode, Params } from "./types";
import { cityTier } from "./normalise";

export type GstCheck = "ok" | "none" | "inactive";

/** Advisor stage: owner says they have a GSTIN (tentatively OK). KYC stage: registry status decides. */
export function gstCheck(g: BusinessProfile["gstin"]): GstCheck {
  if (!g.has) return "none";
  if (g.status && g.status !== "Active") return "inactive";
  return "ok";
}

export type Eligibility = { ok: true; pending?: boolean } | { ok: false; code: ExclusionCode; params?: Params };

export function eligibility(product: Product | string, profile: BusinessProfile): Eligibility {
  const p = typeof product === "string" ? getProduct(product) : product;
  if (p.paused) return { ok: false, code: "EXCL_PAUSED" };
  const tier = cityTier(profile.city);
  if (!tier || !p.tiers.includes(tier)) return { ok: false, code: "EXCL_CITY_TIER", params: { tier: tier ?? 0 } };
  if (profile.employees < p.minEmployees) return { ok: false, code: "EXCL_TOO_SMALL", params: { need: p.minEmployees, have: profile.employees } };
  if (profile.sites < p.minSites) return { ok: false, code: "EXCL_FEW_SITES", params: { need: p.minSites, have: profile.sites } };
  if (p.requiresGstin) {
    const g = gstCheck(profile.gstin);
    if (g === "none") return { ok: false, code: "EXCL_NEEDS_GSTIN" };
    if (g === "inactive") return { ok: false, code: "EXCL_GSTIN_INACTIVE", params: { status: profile.gstin.status ?? "" } };
    return { ok: true, pending: !profile.gstin.verified };
  }
  return { ok: true };
}
