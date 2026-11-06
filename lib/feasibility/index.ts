import "server-only";
import { get, put } from "@/lib/db/store";

/**
 * Fibre feasibility, in honest layers. No public API exposes an operator's fibre footprint, so:
 *  1. ops_coverage — pincodes the operator's own ops team has marked passing / not passing (editable via /api/ops/coverage). Authoritative.
 *  2. post_office  — the real India Post directory: does the pincode exist, which district/state, and is it served by an urban sub/head
 *                    office or only by village branch offices (rural → fibre unlikely). A real signal, but only an estimate.
 *  3. policy       — only when the pincode is not in the postal directory (the case's synthetic addresses use invented pincodes):
 *                    the documented deterministic rule. Labelled "unverified" everywhere.
 * Every answer except (1) is provisional: the tracker's "Technical feasibility" stage is where a person confirms it.
 */
export type FeasibilityBasis = "ops_coverage" | "post_office" | "policy";
export interface SiteFeasibility { fibre: boolean; basis: FeasibilityBasis; confirmed: boolean; area?: { district: string; state: string }; cityMismatch?: boolean }

interface PostOffice { District: string; State: string; BranchType: string; Name: string }
interface PinDoc { found: boolean; district?: string; state?: string; offices?: { name: string; type: string }[]; at: number; unreachable?: boolean }

async function lookupPincode(pin: string): Promise<PinDoc> {
  const cached = await get<PinDoc>("pincode", pin);
  if (cached && !cached.unreachable && Date.now() - cached.at < 30 * 86_400_000) return cached;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    const j = (await res.json()) as { Status: string; PostOffice: PostOffice[] | null }[];
    const po = j?.[0]?.PostOffice;
    const doc: PinDoc = po?.length
      ? { found: true, district: po[0].District, state: po[0].State, offices: po.map((p) => ({ name: p.Name, type: p.BranchType })), at: Date.now() }
      : { found: false, at: Date.now() };
    await put("pincode", pin, doc);
    return doc;
  } catch {
    return { found: false, at: Date.now(), unreachable: true };
  }
}

/** Is this a real Indian pincode? "unknown" when India Post can't be reached (callers decide; we never guess "valid"). */
export async function verifyPincode(pin: string): Promise<{ status: "found"; district: string; state: string } | { status: "not_found" } | { status: "unknown" }> {
  if (!/^[1-9]\d{5}$/.test(pin)) return { status: "not_found" };
  const d = await lookupPincode(pin);
  if (d.found) return { status: "found", district: d.district!, state: d.state! };
  return d.unreachable ? { status: "unknown" } : { status: "not_found" };
}

/** The documented fallback for pincodes outside the postal directory: those ending 7, 8 or 9 have no fibre (≈30% of sites). */
const policy = (pin: string) => { const d = Number(pin.slice(-1)); return !(d >= 7 && d <= 9); };

export async function checkSite(pincode: string, city?: string): Promise<SiteFeasibility> {
  const ops = await get<{ fibre: boolean }>("coverage", pincode);
  const pin = await lookupPincode(pincode);
  const area = pin.found ? { district: pin.district!, state: pin.state! } : undefined;
  const mismatch = pin.found && !!city && !`${pin.district} ${pin.state}`.toLowerCase().includes(city.trim().toLowerCase().slice(0, 5)) && !pin.offices!.some((o) => o.name.toLowerCase().includes(city.trim().toLowerCase().slice(0, 5)));
  if (ops) return { fibre: ops.fibre, basis: "ops_coverage", confirmed: true, area, cityMismatch: mismatch };
  if (pin.found) {
    const urban = pin.offices!.some((o) => /sub|head/i.test(o.type));
    return { fibre: urban, basis: "post_office", confirmed: false, area, cityMismatch: mismatch };
  }
  return { fibre: policy(pincode), basis: "policy", confirmed: false };
}

export async function setCoverage(pincode: string, fibre: boolean, by: string) { await put("coverage", pincode, { fibre, by, at: Date.now() }); }
