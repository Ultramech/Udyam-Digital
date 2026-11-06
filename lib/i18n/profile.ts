import type { Lang } from "@/lib/catalogue/plain";

/** Who is using the account for the business. Only owners, directors/partners (and authorised signatories) may sign orders. */
export type ProfileType = "owner" | "director" | "manager" | "accountant" | "other";
export const PROFILE_TYPES: { id: ProfileType; en: string; hi: string; note: { en: string; hi: string } }[] = [
  { id: "owner", en: "Owner / proprietor", hi: "मालिक / प्रोपराइटर", note: { en: "You run the business and can sign orders.", hi: "आप बिज़नेस चलाते हैं और ऑर्डर साइन कर सकते हैं।" } },
  { id: "director", en: "Partner / director", hi: "पार्टनर / डायरेक्टर", note: { en: "Authorised to sign for the firm or company.", hi: "फ़र्म या कंपनी के लिए साइन करने के अधिकारी।" } },
  { id: "manager", en: "Manager / staff", hi: "मैनेजर / स्टाफ", note: { en: "You can plan and track; an owner or director signs.", hi: "आप प्लान और ट्रैक कर सकते हैं; साइन मालिक/डायरेक्टर करेंगे।" } },
  { id: "accountant", en: "Accountant / CA", hi: "अकाउंटेंट / CA", note: { en: "Helping a client compare plans and costs.", hi: "क्लाइंट के लिए प्लान और कीमत की तुलना।" } },
  { id: "other", en: "Someone else", hi: "कोई और", note: { en: "Family member or helper.", hi: "परिवार का सदस्य या सहायक।" } },
];
export const profileTypeLabel = (id: string, lang: Lang) => { const p = PROFILE_TYPES.find((x) => x.id === id); return p ? (lang === "hi" || lang === "mr" ? p.hi : p.en) : id; };
