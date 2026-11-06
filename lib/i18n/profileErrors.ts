import type { Lang } from "@/lib/catalogue/plain";
import type { FieldError } from "@/lib/accounts/profileRules";

const M: Record<FieldError | "PINCODE_NOT_FOUND" | "PINCODE_CITY_MISMATCH" | "GSTIN_STATE_MISMATCH", { en: string; hi: string }> = {
  REQUIRED: { en: "This is required.", hi: "यह ज़रूरी है।" },
  PROFILE_TYPE_REQUIRED: { en: "Choose who you are for this business.", hi: "चुनें कि आप इस बिज़नेस के लिए कौन हैं।" },
  NAME_INVALID: { en: "Use letters only (spaces, . ' - allowed) — no numbers or symbols.", hi: "सिर्फ़ अक्षर लिखें (स्पेस, . ' - चल सकते हैं) — अंक या चिह्न नहीं।" },
  NAME_TOO_SHORT: { en: "Please enter your full name.", hi: "कृपया अपना पूरा नाम लिखें।" },
  EMAIL_INVALID: { en: "That doesn't look like an email address (like name@example.com).", hi: "यह सही ईमेल नहीं लगता (जैसे name@example.com)।" },
  BUSINESS_NAME_INVALID: { en: "Enter the business name as on your signboard or GST certificate.", hi: "बिज़नेस का नाम वैसा लिखें जैसा बोर्ड या GST सर्टिफिकेट पर है।" },
  TYPE_REQUIRED: { en: "Choose your type of business.", hi: "अपने बिज़नेस का प्रकार चुनें।" },
  TYPE_OTHER_INVALID: { en: "Describe your business in a few words (at least 3 letters).", hi: "कुछ शब्दों में बिज़नेस बताएँ (कम से कम 3 अक्षर)।" },
  CITY_REQUIRED: { en: "Choose your city.", hi: "अपना शहर चुनें।" },
  CITY_INVALID: { en: "Enter a valid city name (letters only).", hi: "सही शहर का नाम लिखें (सिर्फ़ अक्षर)।" },
  STAFF_INVALID: { en: "Enter a number from 1 to 10,000.", hi: "1 से 10,000 तक कोई संख्या लिखें।" },
  SITES_INVALID: { en: "Enter a number from 1 to 500.", hi: "1 से 500 तक कोई संख्या लिखें।" },
  ADDRESS_INVALID: { en: "Enter the full address: shop/building, street and area (10+ characters).", hi: "पूरा पता लिखें: दुकान/बिल्डिंग, गली और इलाका (10+ अक्षर)।" },
  PINCODE_INVALID: { en: "A pincode is 6 digits and doesn't start with 0.", hi: "पिनकोड 6 अंकों का होता है और 0 से शुरू नहीं होता।" },
  PINCODE_NOT_FOUND: { en: "India Post has no such pincode. Please check it.", hi: "इंडिया पोस्ट में यह पिनकोड नहीं है। कृपया जाँचें।" },
  PINCODE_CITY_MISMATCH: { en: "This pincode is in a different city from the one you chose.", hi: "यह पिनकोड आपके चुने शहर का नहीं है।" },
  GSTIN_FORMAT: { en: "A GSTIN has 15 characters, like 27ABCDE1234F1Z5.", hi: "GSTIN 15 अक्षरों का होता है, जैसे 27ABCDE1234F1Z5।" },
  GSTIN_CHECKSUM: { en: "This GSTIN fails its check digit — probably a typing mistake. Compare it with your certificate.", hi: "यह GSTIN चेक-डिजिट जाँच में फेल है — शायद टाइपिंग की गलती। सर्टिफिकेट से मिलाएँ।" },
  GSTIN_STATE_MISMATCH: { en: "This GSTIN is registered in a different state from this address.", hi: "यह GSTIN इस पते वाले राज्य का नहीं है।" },
  UDYAM_FORMAT: { en: "Udyam numbers look like UDYAM-MH-00-1234567.", hi: "उद्यम नंबर UDYAM-MH-00-1234567 जैसा होता है।" },
};
export const profileError = (code: string | undefined | null, lang: Lang) => (code && code in M ? M[code as keyof typeof M][lang === "hi" || lang === "mr" ? "hi" : "en"] : code ?? "");
