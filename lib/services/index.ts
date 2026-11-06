/**
 * Where each external dependency lives. Every one is a real service that fails closed (503) when its key is missing —
 * nothing is faked in a running app:
 *
 *   Advisor          → lib/advisor/{orchestrator + rules engine (decides), llm.ts → Gemini (understands and explains)}
 *   Document reading → lib/kyc/ocr.ts            (Gemini vision; sharpness gate; checksum + registry repair)
 *   GSTIN / Udyam    → lib/kyc/registry.ts       (the case's supplied registries — the case specifies mocked lookups)
 *   OTP              → lib/otp (2Factor SMS)      Payments → lib/services/razorpay.ts (Razorpay)
 *   e-Sign           → lib/esign (PDF + SHA-256 + SMS OTP)   Feasibility → lib/feasibility (ops coverage + India Post)
 *   Chat             → lib/channels (Meta WhatsApp Cloud API, Twilio, Telegram)
 */
import "server-only";

export interface PaymentService { outcome(requested: "success" | "fail" | "pending"): "success" | "fail" | "pending" }
/** Automated-test seam only (ALLOW_TEST_VERIFY=1, never in production): lets the journey script choose a payment outcome. */
export const testPaymentOutcome: PaymentService = { outcome: (r) => r };

export const isValidIndianMobile = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\s|-|\+91/g, ""));
export const cleanPhone = (p: string) => p.replace(/\s|-|\+91/g, "");
