import type { ProductId, Segment } from "@/lib/catalogue";
import type { Lang } from "@/lib/catalogue/plain";

export type Need =
  | "payments" | "cctv" | "whatsapp" | "sms" | "email" | "backup" | "uptime" | "static_ip"
  | "phone_system" | "tollfree" | "wifi" | "website" | "fleet" | "machines" | "security"
  | "multisite_mgmt" | "sim_only" | "fast_internet";

export type CurrentInternet = "hotspot" | "home_bb" | "biz_bb" | "leased" | "mixed" | "none";
export type GstStatus = "Active" | "Cancelled" | "Suspended";

export interface BusinessProfile {
  businessType?: string;
  employees: number;
  sites: number;
  city: string;
  /** has = owner says they have a GSTIN; verified/status come from the registry lookup at KYC. */
  gstin: { has: boolean; verified?: boolean; status?: GstStatus };
  udyam?: { has: boolean; verified?: boolean };
  currentInternet?: CurrentInternet;
  currentSpend?: number;
  needs: Need[];
  /** Monthly budget (pre-GST) — enables budget mode. */
  budget?: number;
  /** Fibre feasibility per site index (undefined = feasible). */
  fibreFeasible?: Record<number, boolean>;
  lines?: number;
  machines?: number;
  vehicles?: number;
  cameras?: number;
  otherNeeds?: string[];
  explicitHuman?: boolean;
  /** Features the owner explicitly said they do NOT want ("remove CCTV"). Never removes connectivity or mobile lines. */
  declined?: Need[];
  lang?: Lang;
}

export interface Line { productId: ProductId; qty: number; siteIndex: number | null }

export type Params = Record<string, string | number>;
export interface Ref { code: string; params?: Params }

export type TraceStatus = "pass" | "fail" | "info" | "add" | "warn";
export interface TraceEntry extends Ref { step: string; status: TraceStatus; productId?: ProductId }

export type ExclusionCode =
  | "EXCL_CITY_TIER" | "EXCL_TOO_SMALL" | "EXCL_FEW_SITES" | "EXCL_NEEDS_GSTIN"
  | "EXCL_GSTIN_INACTIVE" | "EXCL_AIRFIBER_INCOMPATIBLE" | "EXCL_DEPENDENCY" | "EXCL_PAUSED";
export interface Exclusion { productId: ProductId; code: ExclusionCode; params?: Params }

export type BundleId = "dukaan" | "office" | "allshops" | "factory" | "justphones";

export type EscalationLevel = "none" | "assist" | "hard";
export type EscalationCode =
  | "OUT_OF_AREA" | "MANY_SITES" | "REQUESTED_HUMAN" | "NO_VALID_BUNDLE" | "OUT_OF_CATALOGUE"
  | "MULTI_SITE_HIGH_VALUE" | "MFG_FIELD_LED" | "DEDICATED_LINE";
export interface Escalation { flag: boolean; level: EscalationLevel; reasons: EscalationCode[] }

export interface Counterfactual { condition: "GST_VERIFIED" | "MORE_STAFF" | "MORE_SITES"; threshold?: number; unlocks: ProductId[] }

export interface Totals { monthly: number; setup: number; gstMonthly: number; gstSetup: number; monthlyInclGst: number; setupInclGst: number; firstPayment: number }

export interface Alternative { id: "lighter" | "fuller"; lines: Line[]; monthly: number; setup: number }

export interface BudgetResult { target: number; met: boolean; removed: ProductId[]; downgraded: ProductId[]; minPossible: number }

export interface Recommendation {
  bundleId: BundleId;
  segment: Segment;
  cityTier: 1 | 2 | null;
  lines: Line[];
  addons: ProductId[];
  exclusions: Exclusion[];
  alternatives: Alternative[];
  counterfactuals: Counterfactual[];
  escalation: Escalation;
  why: Ref[];
  notices: Ref[];
  budget?: BudgetResult;
  trace: TraceEntry[];
}
