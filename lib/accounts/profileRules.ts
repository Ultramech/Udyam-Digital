/**
 * Profile-setup validation, shared by the form (instant, per-field messages) and the server (enforcement). Pure and isomorphic.
 * Each validator returns an error code or null; lib/i18n/profileErrors.ts turns codes into owner-facing words.
 *
 * Reference data, not free text, wherever we have it: business types and served cities come from the rules engine,
 * GSTIN uses the real mod-36 checksum, Udyam the official format. (Pincodes are additionally checked against India Post
 * on the server.) Identifiers entered here are NOT treated as verified — KYC verifies them against the registries.
 */
import { BUSINESS_TYPES, KNOWN_CITIES, canonicalCity } from "@/lib/rules/normalise";
import { GST_STATE_CODES, validateGstin, validateUdyam } from "@/lib/kyc/identifiers";

export type FieldError =
  | "REQUIRED" | "NAME_INVALID" | "NAME_TOO_SHORT" | "EMAIL_INVALID" | "BUSINESS_NAME_INVALID" | "TYPE_REQUIRED" | "TYPE_OTHER_INVALID"
  | "CITY_REQUIRED" | "CITY_INVALID" | "STAFF_INVALID" | "SITES_INVALID" | "ADDRESS_INVALID" | "PINCODE_INVALID"
  | "GSTIN_FORMAT" | "GSTIN_CHECKSUM" | "UDYAM_FORMAT" | "PROFILE_TYPE_REQUIRED";

export const BUSINESS_TYPE_NAMES = BUSINESS_TYPES.map((t) => t.name);
export const SERVED_CITIES = [...KNOWN_CITIES].sort();
export const OTHER = "__other__";

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/** A person's name: letters in any Indian script, spaces, dot, apostrophe, hyphen. At least 2 letters. */
export function nameError(v: string): FieldError | null {
  const s = v.trim();
  if (!s) return "REQUIRED";
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u.test(s)) return "NAME_INVALID";
  return letters(s) < 2 ? "NAME_TOO_SHORT" : null;
}
export const emailError = (v: string): FieldError | null => (!v.trim() ? null : /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(v.trim()) ? null : "EMAIL_INVALID");
export function businessNameError(v: string): FieldError | null {
  const s = v.trim();
  if (!s) return "REQUIRED";
  return s.length > 80 || !/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,&'()\/-]*$/u.test(s) || (s.match(/[\p{L}\p{N}]/gu) ?? []).length < 2 ? "BUSINESS_NAME_INVALID" : null;
}
export function businessTypeError(choice: string, other: string): FieldError | null {
  if (!choice) return "TYPE_REQUIRED";
  if (choice === OTHER) return letters(other) >= 3 && other.trim().length <= 60 ? null : "TYPE_OTHER_INVALID";
  return BUSINESS_TYPE_NAMES.includes(choice) ? null : "TYPE_REQUIRED";
}
export function cityError(choice: string, other: string): FieldError | null {
  if (!choice) return "CITY_REQUIRED";
  if (choice === OTHER) return /^[\p{L}\p{M}][\p{L}\p{M} .-]{1,39}$/u.test(other.trim()) ? null : "CITY_INVALID";
  return canonicalCity(choice) ? null : "CITY_INVALID";
}
export const staffError = (v: string): FieldError | null => (!v ? "REQUIRED" : /^\d{1,5}$/.test(v) && Number(v) >= 1 && Number(v) <= 10000 ? null : "STAFF_INVALID");
export const sitesError = (v: string): FieldError | null => (!v ? "REQUIRED" : /^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 500 ? null : "SITES_INVALID");
export function addressError(v: string): FieldError | null {
  const s = v.trim();
  if (!s) return "REQUIRED";
  return s.length < 10 || s.length > 200 || letters(s) < 4 ? "ADDRESS_INVALID" : null;
}
export const pincodeError = (v: string): FieldError | null => (!v ? "REQUIRED" : /^[1-9]\d{5}$/.test(v) ? null : "PINCODE_INVALID");
export function gstinError(v: string): FieldError | null {
  const s = v.trim().toUpperCase();
  if (!s) return null; // optional at sign-up
  const r = validateGstin(s);
  return !r.formatOk ? "GSTIN_FORMAT" : !r.checksumOk ? "GSTIN_CHECKSUM" : null;
}
export const udyamError = (v: string): FieldError | null => (!v.trim() ? null : validateUdyam(v.trim().toUpperCase()).ok ? null : "UDYAM_FORMAT");
/** State a GSTIN is registered in (first two digits), for a soft cross-check with the pincode's state. */
export const gstinState = (g: string) => GST_STATE_CODES[g.trim().slice(0, 2)] ?? null;

export interface SetupInput {
  name: string; profileType: string; email: string;
  business: { name: string; type: string; typeOther: string; city: string; cityOther: string; employees: string; sites: string; address: string; pincode: string; gstin: string; udyam: string };
}
export const PROFILE_TYPE_IDS = ["owner", "director", "manager", "accountant", "other"];

/** All field errors at once (empty object = valid). */
export function setupErrors(i: SetupInput): Partial<Record<string, FieldError>> {
  const b = i.business;
  const e: Partial<Record<string, FieldError | null>> = {
    name: nameError(i.name), profileType: PROFILE_TYPE_IDS.includes(i.profileType) ? null : "PROFILE_TYPE_REQUIRED", email: emailError(i.email),
    "business.name": businessNameError(b.name), "business.type": businessTypeError(b.type, b.typeOther), "business.city": cityError(b.city, b.cityOther),
    "business.employees": staffError(b.employees), "business.sites": sitesError(b.sites), "business.address": addressError(b.address),
    "business.pincode": pincodeError(b.pincode), "business.gstin": gstinError(b.gstin), "business.udyam": udyamError(b.udyam),
  };
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Partial<Record<string, FieldError>>;
}
