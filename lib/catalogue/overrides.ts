/**
 * Catalogue administration, kept deliberately narrow.
 *
 * Ops can pause a product, move its indicative price INSIDE the band the catalogue publishes, change the setup fee and the
 * typical install time. Eligibility rules and dependencies stay locked to product_catalogue.csv: they are the contract the
 * rules engine is tested against (5,000-lead backtest, scenario tests), so changing them is a code + test change, not a toggle.
 *
 * Overrides are applied in place to the shared catalogue objects (the engine reads them through getProduct), on the server
 * before every API request (lib/api.ts) and in the browser by <CatalogueSync/>, so the price an owner sees is the price charged.
 */
import { CATALOGUE } from "./index";
import type { Product } from "./types";

export interface Override { productId: string; paused?: boolean; priceMin?: number; setup?: number; installDays?: number }
export interface CatalogueChange { id: string; at: number; by: string; productId: string; field: keyof Omit<Override, "productId">; from: number | boolean; to: number | boolean; note: string }

type Base = Pick<Product, "priceMin" | "setup" | "installDays" | "paused">;
const ORIGINAL = new Map<string, Base>(CATALOGUE.map((p) => [p.id, { priceMin: p.priceMin, setup: p.setup, installDays: p.installDays, paused: false }]));
export const original = (id: string) => ORIGINAL.get(id);

/** Validate a proposed override against the published catalogue. Returns an error code or null. */
export function checkOverride(o: Override): string | null {
  const base = ORIGINAL.get(o.productId);
  const p = CATALOGUE.find((x) => x.id === o.productId);
  if (!base || !p) return "UNKNOWN_PRODUCT";
  if (o.priceMin !== undefined && (!Number.isInteger(o.priceMin) || o.priceMin < base.priceMin || o.priceMin > p.priceMax)) return "PRICE_OUTSIDE_PUBLISHED_BAND";
  if (o.setup !== undefined && (!Number.isInteger(o.setup) || o.setup < 0 || o.setup > 1_000_000)) return "INVALID_SETUP_FEE";
  if (o.installDays !== undefined && (!Number.isInteger(o.installDays) || o.installDays < 1 || o.installDays > 90)) return "INVALID_INSTALL_DAYS";
  return null;
}

/** Make the in-memory catalogue equal to CSV + overrides (idempotent; products without an override revert to the CSV). */
export function applyOverrides(list: Override[]) {
  const by = new Map(list.map((o) => [o.productId, o]));
  for (const p of CATALOGUE) {
    const base = ORIGINAL.get(p.id)!;
    const o = by.get(p.id);
    p.priceMin = o?.priceMin ?? base.priceMin;
    p.setup = o?.setup ?? base.setup;
    p.installDays = o?.installDays ?? base.installDays;
    p.paused = o?.paused ?? false;
  }
}
