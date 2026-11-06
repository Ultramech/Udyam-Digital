/** Customer-facing plain-language names. Product codes (P01…) are never shown to owners. */
export type Lang = "en" | "hi" | "mr" | "ta";

interface Plain { name: Record<"en" | "hi", string>; benefit: Record<"en" | "hi", string>; icon: string }

export const PLAIN: Record<string, Plain> = {
  P01: { icon: "wifi", name: { en: "Business fibre internet (100 Mbps)", hi: "बिज़नेस फाइबर इंटरनेट (100 Mbps)" }, benefit: { en: "Fast, unlimited internet for UPI, billing and daily work", hi: "UPI, बिलिंग और रोज़ के काम के लिए तेज़, अनलिमिटेड इंटरनेट" } },
  P02: { icon: "wifi", name: { en: "Business fibre internet (300 Mbps)", hi: "बिज़नेस फाइबर इंटरनेट (300 Mbps)" }, benefit: { en: "Smooth video calls, cloud apps and many users at once", hi: "वीडियो कॉल, क्लाउड ऐप और कई लोगों के लिए स्मूद इंटरनेट" } },
  P03: { icon: "zap", name: { en: "Ultra-fast fibre (1 Gbps)", hi: "अल्ट्रा-फास्ट फाइबर (1 Gbps)" }, benefit: { en: "Priority support and top speed for heavy usage", hi: "ज़्यादा इस्तेमाल के लिए टॉप स्पीड और प्राथमिकता सपोर्ट" } },
  P04: { icon: "radio", name: { en: "5G AirFiber wireless internet (100 Mbps)", hi: "5G AirFiber वायरलेस इंटरनेट (100 Mbps)" }, benefit: { en: "No cables to lay — plug in and go live in about 2 days", hi: "केबल की ज़रूरत नहीं — प्लग करें और लगभग 2 दिन में चालू" } },
  P05: { icon: "server", name: { en: "Dedicated internet line (20 Mbps)", hi: "डेडिकेटेड इंटरनेट लाइन (20 Mbps)" }, benefit: { en: "Your own line, not shared, with 99.5% uptime promise", hi: "आपकी अपनी लाइन, शेयर नहीं होती, 99.5% अपटाइम" } },
  P06: { icon: "server", name: { en: "Dedicated internet line (100 Mbps)", hi: "डेडिकेटेड इंटरनेट लाइन (100 Mbps)" }, benefit: { en: "Your own high-speed line with 99.9% uptime promise", hi: "आपकी अपनी हाई-स्पीड लाइन, 99.9% अपटाइम" } },
  P07: { icon: "smartphone", name: { en: "Business mobile line (50 GB)", hi: "बिज़नेस मोबाइल लाइन (50 GB)" }, benefit: { en: "Unlimited calls and 50 GB data for you and your team", hi: "आप और आपकी टीम के लिए अनलिमिटेड कॉल और 50 GB डेटा" } },
  P08: { icon: "smartphone", name: { en: "Business mobile line (150 GB + roaming)", hi: "बिज़नेस मोबाइल लाइन (150 GB + रोमिंग)" }, benefit: { en: "More data, roaming and priority customer care", hi: "ज़्यादा डेटा, रोमिंग और प्राथमिकता कस्टमर केयर" } },
  P09: { icon: "shield-check", name: { en: "Backup internet (switches on automatically)", hi: "बैकअप इंटरनेट (अपने-आप चालू)" }, benefit: { en: "Your business stays online even if the main line goes down", hi: "मुख्य लाइन बंद होने पर भी आपका काम चलता रहे" } },
  P10: { icon: "network", name: { en: "One control panel for all your locations", hi: "सभी लोकेशन के लिए एक कंट्रोल पैनल" }, benefit: { en: "Manage every branch's internet from one screen", hi: "हर ब्रांच का इंटरनेट एक ही स्क्रीन से संभालें" } },
  P11: { icon: "hash", name: { en: "Fixed IP address", hi: "फिक्स्ड IP एड्रेस" }, benefit: { en: "For CCTV viewing, servers or remote access", hi: "CCTV देखने, सर्वर या रिमोट एक्सेस के लिए" } },
  P12: { icon: "phone-call", name: { en: "Cloud phone system with IVR", hi: "क्लाउड फोन सिस्टम (IVR के साथ)" }, benefit: { en: "Business phone lines over internet with call recording", hi: "इंटरनेट पर बिज़नेस फोन लाइन, कॉल रिकॉर्डिंग के साथ" } },
  P13: { icon: "phone", name: { en: "Toll-free 1800 number", hi: "टोल-फ्री 1800 नंबर" }, benefit: { en: "Customers call you free of charge", hi: "ग्राहक आपको मुफ़्त में कॉल करें" } },
  P14: { icon: "message-square", name: { en: "Bulk SMS (10,000 a month)", hi: "बल्क SMS (10,000 प्रति माह)" }, benefit: { en: "Send alerts and offers to customers, registration help included", hi: "ग्राहकों को अलर्ट और ऑफ़र भेजें, रजिस्ट्रेशन में मदद शामिल" } },
  P15: { icon: "message-circle", name: { en: "WhatsApp Business (verified)", hi: "WhatsApp Business (वेरिफाइड)" }, benefit: { en: "Verified WhatsApp with catalogue and 1,000 chats a month", hi: "कैटलॉग और हर माह 1,000 चैट के साथ वेरिफाइड WhatsApp" } },
  P16: { icon: "mail", name: { en: "Work email & office apps", hi: "वर्क ईमेल और ऑफिस ऐप" }, benefit: { en: "Email on your own business name, documents and video meetings", hi: "अपने बिज़नेस नाम का ईमेल, डॉक्यूमेंट और वीडियो मीटिंग" } },
  P17: { icon: "cloud", name: { en: "Cloud backup (1 TB)", hi: "क्लाउड बैकअप (1 TB)" }, benefit: { en: "Your PC and phone files are backed up automatically", hi: "आपके PC और फोन की फाइलें अपने-आप सुरक्षित" } },
  P18: { icon: "globe", name: { en: "Website + domain", hi: "वेबसाइट + डोमेन" }, benefit: { en: "A 5-page website with your own web address", hi: "अपने वेब एड्रेस के साथ 5-पेज की वेबसाइट" } },
  P19: { icon: "receipt", name: { en: "GST billing + UPI/card machine", hi: "GST बिलिंग + UPI/कार्ड मशीन" }, benefit: { en: "GST-ready billing and stock on a tablet; accept UPI and cards", hi: "टैबलेट पर GST बिलिंग और स्टॉक; UPI और कार्ड स्वीकार करें" } },
  P20: { icon: "shield", name: { en: "Antivirus & ransomware protection", hi: "एंटीवायरस और रैंसमवेयर सुरक्षा" }, benefit: { en: "Protects every PC and phone from viruses and ransomware", hi: "हर PC और फोन को वायरस और रैंसमवेयर से सुरक्षा" } },
  P21: { icon: "flame", name: { en: "Managed firewall", hi: "मैनेज्ड फ़ायरवॉल" }, benefit: { en: "Your network guarded by Airtel's security team", hi: "आपका नेटवर्क Airtel की सिक्योरिटी टीम की निगरानी में" } },
  P22: { icon: "wifi", name: { en: "Secure Wi-Fi + guest Wi-Fi", hi: "सिक्योर Wi-Fi + गेस्ट Wi-Fi" }, benefit: { en: "Separate customer Wi-Fi with content filtering", hi: "कंटेंट फ़िल्टर के साथ ग्राहकों के लिए अलग Wi-Fi" } },
  P23: { icon: "video", name: { en: "Cloud CCTV camera", hi: "क्लाउड CCTV कैमरा" }, benefit: { en: "HD camera, 30-day cloud recording, view on your phone", hi: "HD कैमरा, 30 दिन की क्लाउड रिकॉर्डिंग, फोन पर लाइव देखें" } },
  P24: { icon: "activity", name: { en: "Machine monitoring sensor", hi: "मशीन मॉनिटरिंग सेंसर" }, benefit: { en: "Track machine uptime and energy use live", hi: "मशीन की अपटाइम और बिजली खपत लाइव देखें" } },
  P25: { icon: "truck", name: { en: "Vehicle GPS tracker", hi: "वाहन GPS ट्रैकर" }, benefit: { en: "Live location of every vehicle on one dashboard", hi: "हर वाहन की लाइव लोकेशन एक डैशबोर्ड पर" } },
};

export const UNIT_LABEL: Record<string, Record<"en" | "hi", string>> = {
  "per site": { en: "per location", hi: "प्रति लोकेशन" },
  "per line": { en: "per line", hi: "प्रति लाइन" },
  "per user": { en: "per person", hi: "प्रति व्यक्ति" },
  "per device": { en: "per device", hi: "प्रति डिवाइस" },
  "per camera": { en: "per camera", hi: "प्रति कैमरा" },
  "per counter": { en: "per counter", hi: "प्रति काउंटर" },
  "per vehicle": { en: "per vehicle", hi: "प्रति वाहन" },
  "per account": { en: "per account", hi: "प्रति अकाउंट" },
  "per channel": { en: "per channel", hi: "प्रति चैनल" },
  "per number": { en: "per number", hi: "प्रति नंबर" },
  "per pack": { en: "per pack", hi: "प्रति पैक" },
  "per IP": { en: "per IP", hi: "प्रति IP" },
};

const pick = <T extends Record<"en" | "hi", string>>(m: T, lang: Lang) => (lang === "hi" ? m.hi : m.en);
export const plainName = (id: string, lang: Lang = "en") => (PLAIN[id] ? pick(PLAIN[id].name, lang) : id);
export const plainBenefit = (id: string, lang: Lang = "en") => (PLAIN[id] ? pick(PLAIN[id].benefit, lang) : "");
export const plainUnit = (unit: string, lang: Lang = "en") => (UNIT_LABEL[unit] ? pick(UNIT_LABEL[unit], lang) : unit);
export const productIcon = (id: string) => PLAIN[id]?.icon ?? "package";
