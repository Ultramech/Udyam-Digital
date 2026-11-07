import type { Params } from "@/lib/rules/types";

export type Slot = "gst_certificate" | "udyam_certificate" | "address_proof" | "signatory_id";
export const SLOTS: Slot[] = ["gst_certificate", "udyam_certificate", "address_proof", "signatory_id"];

export type Legibility = "clear" | "skewed" | "blurry" | "unreadable";

export interface ExtractedDoc {
  slot: Slot;
  /** Document type detected by the extractor (may differ from the slot it was uploaded to). */
  docType: string;
  legibility: Legibility;
  sharpness?: number;
  confidence: number;
  fields: Record<string, string | null>;
  /** "gemini" = read live by the vision model · "cached" = test fixtures only (never produced at runtime) */
  source: "gemini" | "cached" | "digilocker" | "aadhaar_offline" | "digilocker_aadhaar";
  file?: string;
  /** SHA-256 of the uploaded bytes (the bytes themselves are never stored). Used to spot the same file in two slots. */
  fileHash?: string;
  /** How many OTHER applications have uploaded this exact file — an anomaly signal for reviewers, never proof of fraud. */
  seenInOtherApplications?: number;
}

export interface GstRecord {
  gstin: string; legal_name: string; trade_name: string; constitution: string;
  principal_place_of_business: string; state: string; registration_date: string; status: "Active" | "Cancelled" | "Suspended";
}
export interface UdyamRecord {
  udyam_number: string; enterprise_name: string; enterprise_type: string; major_activity: string;
  nic_description: string; state: string; city: string; date_of_registration: string;
}

/** block = this identity can't back GST products · reupload = owner can fix it · review = a person must look · info = FYI */
export type Severity = "block" | "reupload" | "review" | "info";

export interface Check {
  code: string;
  slot?: Slot;
  severity: Severity;
  params?: Params;
  needsReview: boolean;
}

export type KycStatus = "verified" | "reupload" | "review" | "blocked";

export interface KycInput {
  today: string;
  entered: { gstin?: string | null; udyam?: string | null; siteAddress?: string | null };
  claimsUdyam: boolean;
  docs: Partial<Record<Slot, ExtractedDoc>>;
  lookups: {
    gst: (gstin: string) => GstRecord | undefined;
    udyam: (n: string) => UdyamRecord | undefined;
    nearGst?: (gstin: string) => GstRecord | undefined;
  };
}

export interface KycResult {
  status: KycStatus;
  checks: Check[];
  /** Whether GST-required products may stay in the quote. */
  gstEligible: boolean;
  gst?: GstRecord;
  udyam?: UdyamRecord;
  /** Documents the owner still needs to provide (data minimisation). */
  neededSlots: Slot[];
  /** GSTIN actually used after any OCR repair. */
  gstinUsed?: string;
}

/** Documents built from Aadhaar data (offline e-KYC or DigiLocker) carry a name and address but no business name, expiry or bill date. */
export const isAadhaarDoc = (d: { source: string }) => d.source === "aadhaar_offline" || d.source === "digilocker_aadhaar";
