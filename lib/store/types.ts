import type { Facts } from "@/lib/advisor/extract";
import type { Check, ExtractedDoc, KycStatus, Slot } from "@/lib/kyc/types";
import type { BusinessProfile, BundleId, EscalationCode, EscalationLevel, Line, Ref } from "@/lib/rules/types";

export interface Attribution { source?: string; partnerCode?: string; repId?: string; /** referral code of an existing (activated) customer */ referrer?: string }

export interface Session { id: string; phone?: string; verified: boolean; /** set once the visitor signs in */ userId?: string; lang: string; attribution: Attribution; createdAt: number }

export interface ChatMsg { role: "user" | "assistant"; text: string; at: number }
export interface Conversation { id: string; sessionId?: string; userId?: string; lang: string; facts: Facts; messages: ChatMsg[]; stage: string; leadId?: string; quoteId?: string; attribution: Attribution; createdAt: number }

export interface Quote {
  id: string; conversationId?: string; sessionId?: string; userId?: string; businessId?: string; profile: BusinessProfile; lines: Line[]; bundleId: BundleId;
  notices: Ref[]; version: number; attribution: Attribution; sites: SiteInfo[]; consentId?: string; kycId?: string; orderId?: string;
  createdAt: number;
}
export interface SiteInfo { index: number; address: string; pincode: string; fibreFeasible?: boolean; fibreBasis?: "ops_coverage" | "post_office" | "policy"; checked: boolean }

export type LeadStatus = "new" | "assigned" | "callback" | "quoted" | "converted" | "closed";
export interface Lead {
  id: string; origin: "live"; createdAt: number; conversationId?: string; quoteId?: string; orderId?: string;
  businessName?: string; phone?: string; profile: BusinessProfile; facts: Facts; bundleId?: BundleId; monthly: number;
  level: EscalationLevel; reasons: EscalationCode[]; status: LeadStatus; ownerId?: string; attribution: Attribution;
  notes: { at: number; by: string; text: string }[]; callbacks: { at: string; note: string; done: boolean }[];
  assistCredit?: { to: string; kind: "rep" | "partner" };
}

export interface ConsentRecord {
  id: string; quoteId: string; sessionId?: string; noticeVersion: string; at: number; lang: string;
  purposes: { kyc: boolean; service: boolean; digilocker: boolean; marketing: boolean }; phoneHash?: string;
}

export interface KycCase {
  id: string; quoteId: string; entered: { gstin?: string; udyam?: string; siteAddress?: string }; claimsUdyam: boolean;
  docs: Partial<Record<Slot, ExtractedDoc>>; status: KycStatus; checks: Check[]; gstEligible: boolean; neededSlots: Slot[];
  gstinUsed?: string; gstName?: string; gstStatus?: string; udyamName?: string;
  review?: { decision: "approved" | "rejected" | "correction"; by: string; note: string; at: number };
  requeued?: boolean; createdAt: number; updatedAt: number;
}

export const STAGES = ["RECEIVED", "KYC_VERIFICATION", "FEASIBILITY", "INSTALL_SCHEDULED", "INSTALL_IN_PROGRESS", "ACTIVATED"] as const;
export type Stage = (typeof STAGES)[number];
export type ItemStatus = "waiting" | "scheduled" | "in_progress" | "live";

export interface OrderItem { productId: string; siteIndex: number | null; qty: number; status: ItemStatus; etaDate: string }
export interface Order {
  id: string; quoteId: string; token: string; createdAt: number; userId?: string; businessId?: string; businessName: string; phone?: string; lang: string;
  profile: BusinessProfile; bundleId: BundleId; lines: Line[]; sites: SiteInfo[];
  totals: { monthly: number; setup: number; gstMonthly: number; gstSetup: number; firstPayment: number; contractMonths: number };
  payment: { status: "awaiting" | "processing" | "success" | "failed"; attempts: number; method: "upi" | "card" | "netbanking" | "wallet" | "other"; razorpayOrderId?: string; razorpayPaymentId?: string;
    /** "deposit": the order was placed with a reservation payment; `balance` is what remains and must be paid before activation */
    plan?: "full" | "deposit"; paid?: number; balance?: { amount: number; status: "due" | "paid"; razorpayOrderId?: string; razorpayPaymentId?: string; paidAt?: number } };
  esign?: { signedAt: number; method: "sms-otp"; docHash: string; signedHash: string; signerPhoneMasked: string; ip: string };
  esignDraft?: { docHash: string; preparedAt: number };
  kycId?: string; kycStatus: "pending" | KycStatus | "approved";
  stage?: Stage; stageHistory: { stage: Stage; at: string; note?: string }[]; stageDates: Record<Stage, string>;
  items: OrderItem[]; goLive: string;
  actionNeeded?: Ref; delayed?: { reason: string; newEta: string };
  engineer?: { id?: string; name: string; phoneMasked: string; slot: string; date?: string; window?: string; /** set by ops when the engineer leaves for the visit */ enRoute?: { at: number } };
  /** real clock time (ms) the order entered its current stage — used by the stuck-order sweep, never for customer-facing dates */
  stageChangedAt?: number;
  chases: number; attribution: Attribution; leadId?: string; consentId?: string; referralCode?: string;
  /** Cancelled before installation started. Refunds go back through Razorpay; `failed` means ops must refund by hand. */
  cancelled?: { at: number; by: "customer" | string; reason: string; refund: { status: "not_needed" | "initiated" | "failed"; amount: number; razorpayRefundIds: string[] } };
}

export interface OrderEvent { id: string; orderId: string; at: string; type: "stage" | "delay" | "action" | "chase" | "message" | "payment" | "kyc" | "visit"; text: string; delivery?: { channel: "whatsapp" | "telegram"; status: "sent" | "failed" | "skipped"; reason?: string; at?: number }[] }
export type TicketCategory = "order" | "kyc" | "billing" | "installation" | "cancel" | "other";
export interface Ticket {
  id: string; token: string; createdAt: number; updatedAt: number; sessionId?: string; userId?: string; orderId?: string; lang: string;
  category: TicketCategory; status: "open" | "in_progress" | "resolved"; priority: "normal" | "high"; assignedTo?: string;
  messages: { by: "customer" | "assistant" | "staff"; name?: string; text: string; at: number }[];
  /** Handoff for the human: everything the owner already told us, so they never repeat themselves. No raw identifiers. */
  context: { businessName?: string; bundle?: string; stage?: string; kycStatus?: string; payment?: string; monthly?: number; goLive?: string; delayed?: string; summary: string[] };
}

export interface AuditEntry { id: string; at: number; actor: string; role: string; action: string; entity: string; entityId: string }
