import "server-only";
import { publicBaseUrl } from "@/lib/channels/twilio";
import { whatsappProvider } from "@/lib/channels/whatsapp";
import { telegramConfigured } from "@/lib/channels/telegram";
import { digilockerConfigured } from "@/lib/digilocker/client";
import { twoFactorConfigured } from "@/lib/otp/twofactor";
import { geminiConfigured, geminiModel } from "@/lib/ai/gemini";
import { razorpayEnabled, razorpayTestMode } from "@/lib/services/razorpay";

export type ServiceMode = "live" | "not_configured" | "simulated";
export interface ServiceStatus { id: string; label: string; mode: ServiceMode; detail: string }

/**
 * The single source of truth for "is this component real right now?". Shown in the UI so nobody has to guess what is live.
 * A component is only reported "live" when its credentials exist; "simulated" means no real service can back it from this prototype.
 */
export function serviceStatus(): ServiceStatus[] {
  const ai = geminiConfigured();
  return [
    { id: "advisor_ai", label: "Advisor language understanding", mode: ai ? "live" : "not_configured", detail: ai ? `Gemini (${geminiModel()})` : "Set GEMINI_API_KEY — falling back to the deterministic English/Hindi extractor" },
    { id: "document_ai", label: "Document reading (OCR)", mode: ai ? "live" : "not_configured", detail: ai ? `Gemini vision (${geminiModel()})` : "Set GEMINI_API_KEY — uploads are refused until a reader is configured (no fake extraction)" },
    { id: "gst_registry", label: "GSTIN / Udyam lookup", mode: "simulated", detail: "The case's supplied registries (fictional businesses). A live provider is not configured yet." },
    { id: "otp", label: "Phone OTP", mode: twoFactorConfigured() ? "live" : "not_configured", detail: twoFactorConfigured() ? "2Factor.in (real SMS); code checked server-side, single-use, rate-limited" : "Set TWOFACTOR_API_KEY — verification is refused until configured" },
    { id: "payments", label: "Payments", mode: razorpayEnabled() ? "live" : "simulated", detail: razorpayEnabled() ? (razorpayTestMode() ? "Razorpay TEST mode (no real money moves); signature verified server-side" : "Razorpay live; signature verified server-side") : "Outcome picker; no payment gateway configured." },
    { id: "esign", label: "e-Sign", mode: twoFactorConfigured() ? "live" : "not_configured", detail: "Order-form PDF, SHA-256 hash, SMS OTP bound to that hash, signature certificate (IT Act 2000). Not Aadhaar eSign (needs an ASP licence)." },
    { id: "digilocker", label: "DigiLocker", mode: digilockerConfigured() ? "live" : "not_configured", detail: digilockerConfigured() ? "OAuth 2.0 + PKCE; one issued document per slot; token never stored" : "Needs API Setu partner credentials (registered organisation). Meanwhile, PDFs downloaded from the owner's DigiLocker can be uploaded, and Aadhaar offline e-KYC is available" },
    { id: "aadhaar_offline", label: "Aadhaar offline e-KYC", mode: "live", detail: "Owner uploads UIDAI's signed ZIP + their share phrase; the signature is verified locally against UIDAI's published key (no licence, no API key). Only name, address and the last 4 digits are kept; photo, file and phrase are never stored." },
    { id: "feasibility", label: "Fibre feasibility", mode: "live", detail: "India Post directory (real) + ops-maintained coverage overrides; pincodes outside the directory get a labelled estimate. No public operator-coverage API exists." },
    { id: "scheduling", label: "Installation slots", mode: "live", detail: "Ops-managed engineer roster; slot bookings are unique per engineer/date/window" },
    { id: "whatsapp", label: "WhatsApp (advisor + order updates)", mode: whatsappProvider() && publicBaseUrl() ? "live" : "not_configured", detail: whatsappProvider() && publicBaseUrl() ? `${whatsappProvider() === "meta" ? "Meta WhatsApp Cloud API" : "Twilio WhatsApp"}; signature-verified webhook; updates need service consent` : "Set META_WA_* (or TWILIO_*) and PUBLIC_BASE_URL" },
    { id: "telegram", label: "Telegram bot (advisor + order updates)", mode: telegramConfigured() && publicBaseUrl() ? "live" : "not_configured", detail: telegramConfigured() && publicBaseUrl() ? "Telegram Bot API; secret-checked webhook; phone verified by the user's own shared contact" : "Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and PUBLIC_BASE_URL, then npm run setup:channels" },
  ];
}
