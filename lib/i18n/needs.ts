import type { Lang } from "@/lib/catalogue/plain";
import type { Need } from "@/lib/rules/types";

/** Owner-facing names for each need the advisor can capture. Used by the package comparison, maturity score and report. */
export const NEED_LABEL: Record<Need, { en: string; hi: string }> = {
  payments: { en: "UPI / card billing", hi: "UPI / कार्ड बिलिंग" },
  cctv: { en: "CCTV cameras", hi: "CCTV कैमरा" },
  whatsapp: { en: "WhatsApp for customers", hi: "ग्राहकों के लिए WhatsApp" },
  sms: { en: "SMS to customers", hi: "ग्राहकों को SMS" },
  email: { en: "Work email", hi: "वर्क ईमेल" },
  backup: { en: "Cloud backup", hi: "क्लाउड बैकअप" },
  uptime: { en: "Stay online if the line drops", hi: "लाइन बंद होने पर भी ऑनलाइन" },
  static_ip: { en: "Fixed IP address", hi: "फिक्स्ड IP" },
  phone_system: { en: "Office phone system", hi: "ऑफिस फोन सिस्टम" },
  tollfree: { en: "Toll-free number", hi: "टोल-फ्री नंबर" },
  wifi: { en: "Wi-Fi for staff/guests", hi: "स्टाफ/ग्राहकों के लिए Wi-Fi" },
  website: { en: "Website", hi: "वेबसाइट" },
  fleet: { en: "Vehicle tracking", hi: "वाहन ट्रैकिंग" },
  machines: { en: "Machine monitoring", hi: "मशीन मॉनिटरिंग" },
  security: { en: "Virus & data protection", hi: "वायरस और डेटा सुरक्षा" },
  multisite_mgmt: { en: "Manage all branches centrally", hi: "सभी ब्रांच एक जगह से" },
  sim_only: { en: "Business mobile lines", hi: "बिज़नेस मोबाइल लाइन" },
  fast_internet: { en: "Very fast internet", hi: "बहुत तेज़ इंटरनेट" },
};
export const needLabel = (n: Need, lang: Lang = "en") => NEED_LABEL[n]?.[lang === "hi" || lang === "mr" ? "hi" : "en"] ?? n;
