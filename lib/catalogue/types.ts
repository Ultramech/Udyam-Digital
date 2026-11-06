export type ProductId = string; // "P01".."P25"
export type Segment = "micro" | "prof" | "multi" | "mfg";

export interface Product {
  id: ProductId;
  category: string;
  csvName: string;
  description: string;
  unit: string; // "per site" | "per line" | ...
  priceMin: number;
  priceMax: number;
  setup: number;
  minContract: number;
  tiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  requiresOneOf: ProductId[];
  installDays: number;
  segments: string[];
  /** Set by catalogue admin (ops): sales of this product are paused. Never set by the CSV. */
  paused?: boolean;
}
