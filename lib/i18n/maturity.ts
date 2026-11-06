import { plainName, type Lang } from "@/lib/catalogue/plain";
import type { Area } from "@/lib/maturity/score";

type L2 = { en: string; hi: string };
const k = (l: Lang) => (l === "hi" || l === "mr" ? "hi" : "en");

export const AREA_LABEL: Record<Area, L2 & { what: L2 }> = {
  connectivity: { en: "Internet", hi: "इंटरनेट", what: { en: "Reliable, fast internet that stays up", hi: "भरोसेमंद, तेज़ और चालू रहने वाला इंटरनेट" } },
  reach: { en: "Reaching customers", hi: "ग्राहकों तक पहुँच", what: { en: "Phones, WhatsApp/SMS, website", hi: "फोन, WhatsApp/SMS, वेबसाइट" } },
  cloud: { en: "Cloud & office tools", hi: "क्लाउड और ऑफिस टूल", what: { en: "Work email, backup, digital billing", hi: "वर्क ईमेल, बैकअप, डिजिटल बिलिंग" } },
  security: { en: "Security", hi: "सुरक्षा", what: { en: "Antivirus, firewall, safe Wi-Fi, CCTV", hi: "एंटीवायरस, फ़ायरवॉल, सुरक्षित Wi-Fi, CCTV" } },
  operations: { en: "Running the business", hi: "बिज़नेस संचालन", what: { en: "Billing/stock, branches, machines, vehicles", hi: "बिलिंग/स्टॉक, ब्रांच, मशीनें, वाहन" } },
};
export const areaLabel = (a: Area, l: Lang) => AREA_LABEL[a][k(l)];
export const areaWhat = (a: Area, l: Lang) => AREA_LABEL[a].what[k(l)];

const names = (ids: string[], l: Lang) => [...new Set(ids.map((i) => plainName(i, l).split(" (")[0]))].join(", ");

export function roadmapText(code: string, products: string[], params: Record<string, string | number> | undefined, l: Lang): string {
  const hi = k(l) === "hi";
  switch (code) {
    case "GO_LIVE": return hi ? `चालू करें: ${names(products, l)}` : `Go live with: ${names(products, l)}`;
    case "ADD_WHEN_READY": return hi ? `जब तैयार हों तब जोड़ें: ${names(products, l)}` : `Add when you're ready: ${names(products, l)}`;
    case "UNLOCK_GST_VERIFIED": return hi ? `GST वेरिफाई होने पर मिलेगा: ${names(products, l)}` : `Once your GST is verified, you can add: ${names(products, l)}`;
    case "UNLOCK_MORE_STAFF": return hi ? `टीम ${params?.threshold}+ होने पर: ${names(products, l)}` : `When your team reaches ${params?.threshold}+: ${names(products, l)}`;
    case "UNLOCK_MORE_SITES": return hi ? `${params?.threshold}+ लोकेशन होने पर: ${names(products, l)}` : `At ${params?.threshold}+ locations: ${names(products, l)}`;
    case "GROWTH_SECOND_SITE": return hi ? `नई ब्रांच खोलें तो वही प्लान वहाँ भी; ${params?.threshold}+ लोकेशन पर सबको एक पैनल से संभालें।` : `Opening another branch? Copy this plan there; at ${params?.threshold}+ locations, manage all of them from one control panel.`;
    default: return code;
  }
}
export const HORIZON: Record<string, L2> = { now: { en: "Now", hi: "अभी" }, "3-6m": { en: "In 3–6 months", hi: "3–6 महीने में" }, "6-12m": { en: "In 6–12 months", hi: "6–12 महीने में" } };
