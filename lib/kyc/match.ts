const STOP = new Set(["llp", "pvt", "ltd", "private", "limited", "prop", "the", "and", "co", "company"]);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(prop\.?/g, " ")
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

/** Token-set similarity in [0,1]: shared tokens ÷ the larger token set. Order, punctuation and company suffixes don't matter. */
export function nameSimilarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(A.size, B.size);
}

export const NAME_MATCH_THRESHOLD = 0.85;
export const namesMatch = (a: string, b: string) => nameSimilarity(a, b) >= NAME_MATCH_THRESHOLD;

/** Proprietorship legal names look like "Neha Kaur (Prop. Vindhya Tours & Travels)". */
export function splitProprietor(legal: string): { owner: string; business: string | null } {
  const m = legal.match(/^(.*?)\s*\(Prop\.?\s*(.+?)\)\s*$/i);
  return m ? { owner: m[1].trim(), business: m[2].trim() } : { owner: legal.trim(), business: null };
}

export const pincodeOf = (addr: string) => addr.match(/\b(\d{6})\b/)?.[1] ?? null;
const normAddr = (a: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Tolerant of extra words (a bill may add the state) but strict on what matters: pincode and every house/unit number
 * must agree, and the remaining words must overlap by ≥ 80% of the shorter address.
 */
export function addressesMatch(a: string, b: string): boolean {
  const pa = pincodeOf(a), pb = pincodeOf(b);
  if (pa && pb && pa !== pb) return false;
  // a word broken across a line end ("A ndhra") must not count as a different address: identical once spacing is ignored = same
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (squash(a) === squash(b)) return true;
  const A = new Set(normAddr(a).split(" ").filter(Boolean));
  const B = new Set(normAddr(b).split(" ").filter(Boolean));
  const nums = (s: Set<string>) => [...s].filter((t) => /^\d+$/.test(t) && t !== pa && t !== pb);
  const na = nums(A), nb = nums(B);
  if (na.length && nb.length) {
    // every house/unit number in the shorter list must appear in the other address
    const [short, longSet] = na.length <= nb.length ? [na, B] : [nb, A];
    if (!short.every((n) => longSet.has(n))) return false;
  }
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const small = Math.min(A.size, B.size);
  return inter / (small >= 4 ? small : Math.max(A.size, B.size)) >= 0.8;
}

export const daysBetween = (fromISO: string, toISO: string) =>
  Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000);
