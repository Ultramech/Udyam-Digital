import type { Lang } from "@/lib/catalogue/plain";
import type { BundleId } from "@/lib/rules/types";

export const BUNDLES: Record<BundleId, { name: Record<"en" | "hi", string>; tagline: Record<"en" | "hi", string>; accent: string }> = {
  dukaan: { name: { en: "Dukaan Digital", hi: "दुकान डिजिटल" }, tagline: { en: "Simple, affordable digital tools to help your shop run better.", hi: "आपकी दुकान को बेहतर चलाने के लिए सरल और किफ़ायती डिजिटल टूल।" }, accent: "#E40000" },
  office: { name: { en: "Office Ready", hi: "ऑफिस रेडी" }, tagline: { en: "Everything your office needs to stay connected, secure and productive.", hi: "आपके ऑफिस को जोड़े रखने, सुरक्षित और उत्पादक बनाने की हर ज़रूरत।" }, accent: "#E40000" },
  allshops: { name: { en: "One Bill, All Shops", hi: "एक बिल, सारी दुकानें" }, tagline: { en: "Connectivity and essentials across every location — one plan, one bill.", hi: "हर लोकेशन पर कनेक्टिविटी और ज़रूरी सेवाएँ — एक प्लान, एक बिल।" }, accent: "#E40000" },
  factory: { name: { en: "Factory Line", hi: "फैक्ट्री लाइन" }, tagline: { en: "Reliable connectivity, security and monitoring for your industrial operations.", hi: "आपकी औद्योगिक यूनिट के लिए भरोसेमंद कनेक्टिविटी, सुरक्षा और मॉनिटरिंग।" }, accent: "#E40000" },
  justphones: { name: { en: "Just Phones", hi: "सिर्फ़ फोन" }, tagline: { en: "Business mobile lines for you and your team — nothing extra.", hi: "आप और आपकी टीम के लिए बिज़नेस मोबाइल लाइन — कुछ एक्स्ट्रा नहीं।" }, accent: "#E40000" },
};
const k = (l: Lang) => (l === "hi" || l === "mr" ? "hi" : "en");
export const bundleName = (id: BundleId, lang: Lang = "en") => BUNDLES[id].name[k(lang)];
export const bundleTagline = (id: BundleId, lang: Lang = "en") => BUNDLES[id].tagline[k(lang)];
