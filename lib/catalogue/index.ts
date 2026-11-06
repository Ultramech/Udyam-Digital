import raw from "./catalogue.generated.json";
import type { Product, ProductId } from "./types";
export type { Product, ProductId, Segment } from "./types";

export const CATALOGUE: Product[] = raw as Product[];
const BY_ID = new Map(CATALOGUE.map((p) => [p.id, p]));

export function getProduct(id: ProductId): Product {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown product ${id}`);
  return p;
}

/** Connectivity products that satisfy a product's `requiresOneOf` are all in this set. */
export const CONNECTIVITY: ProductId[] = ["P01", "P02", "P03", "P04", "P05", "P06"];
export const FIBRE: ProductId[] = ["P01", "P02", "P03"];
/** Products that are installed after the site's connectivity is live. */
export const isDependent = (id: ProductId) => getProduct(id).requiresOneOf.length > 0;
/** Products priced per site (one line per site in a multi-site bundle). */
export const isPerSite = (id: ProductId) => getProduct(id).unit === "per site";
