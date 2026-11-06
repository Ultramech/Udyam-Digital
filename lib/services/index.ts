/**
 * Service interfaces (MASTER_PLAN G3). Every external dependency is behind one of these with a deterministic mock,
 * so the whole demo runs with no API keys and no network. Swap an implementation here without touching callers.
 *
 *   AdvisorService   → lib/advisor/{orchestrator (rules), claude (optional extraction)}
 *   OCRService       → lib/kyc/ocr.ts            (cached specimens → Claude vision → offline)
 *   GSTINService     → lib/kyc/registry.ts       (mock registry backed by mock_gstin_registry.csv)
 *   UdyamService     → lib/kyc/registry.ts       (mock registry backed by mock_udyam_registry.csv)
 *   FeasibilityService, OTPService, PaymentService, ESignService, NotificationService → below / lib/store/orders.ts
 */
import "server-only";

export interface PaymentService { outcome(requested: "success" | "fail" | "pending"): "success" | "fail" | "pending" }
export const mockPayments: PaymentService = { outcome: (r) => r };

export const isValidIndianMobile = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\s|-|\+91/g, ""));
export const cleanPhone = (p: string) => p.replace(/\s|-|\+91/g, "");
