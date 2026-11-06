/** Demo personas. Each is wired to a real supplied specimen applicant (K01–K12), so the demo exercises the actual dataset. */
export interface Persona {
  id: string;
  title: Record<"en" | "hi", string>;
  blurb: Record<"en" | "hi", string>;
  prompt: Record<"en" | "hi", string>;
  phone: string;
  sites: { address: string; pincode: string }[];
  /** specimen applicant whose documents the owner "uploads" */
  applicant: string;
  gstin?: string;
  udyam?: string;
  demoOnly: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "sharma", applicant: "D01", phone: "9876500001",
    title: { en: "Sharma-ji · Pharmacy, Indore", hi: "शर्मा जी · फार्मेसी, इंदौर" },
    blurb: { en: "Small shop, no GST — fully self-serve", hi: "छोटी दुकान, GST नहीं — पूरी तरह खुद करें" },
    prompt: {
      en: "I run a pharmacy in Indore. I have three employees, one shop and need reliable internet, billing and CCTV. I don't have a GST number. I also want WhatsApp for my customers.",
      hi: "मेरी इंदौर में दवा की दुकान है। 3 कर्मचारी हैं, एक दुकान। भरोसेमंद इंटरनेट, बिलिंग और CCTV चाहिए। मेरे पास जीएसटी नंबर नहीं है। ग्राहकों के लिए WhatsApp भी चाहिए।",
    },
    sites: [{ address: "Shop 14, MG Road, Indore, Madhya Pradesh", pincode: "452008" }],
    demoOnly: "Fibre isn't available at this address, so you'll see the AirFiber fallback.",
  },
  {
    id: "menon", applicant: "K07", phone: "9876500002", gstin: "07CPCXN0398P1ZT", udyam: "UDYAM-DL-00-9565547",
    title: { en: "Dr. Menon · Clinic, Delhi", hi: "डॉ. मेनन · क्लिनिक, दिल्ली" },
    blurb: { en: "GST-registered clinic — KYC catches a name mismatch → human review", hi: "GST वाला क्लिनिक — KYC में नाम का फ़र्क → मानव समीक्षा" },
    prompt: {
      en: "I run a physiotherapy clinic in Delhi with 5 staff. We have GST. I need work email, security and a backup internet line.",
      hi: "मेरा दिल्ली में फिजियोथेरेपी क्लिनिक है, 5 स्टाफ हैं। हमारे पास जीएसटी है। वर्क ईमेल, सुरक्षा और बैकअप इंटरनेट चाहिए।",
    },
    sites: [{ address: "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596", pincode: "334596" }],
    demoOnly: "Uses sample documents K07 — the certificate's business name doesn't match GST records.",
  },
  {
    id: "spice", applicant: "K10", phone: "9876500003", gstin: "27QHJXK0658U1ZL", udyam: "UDYAM-MH-00-7183141",
    title: { en: "Spice Route · 3-branch restaurants", hi: "स्पाइस रूट · 3 ब्रांच रेस्टोरेंट" },
    blurb: { en: "High-value multi-site — a specialist is assigned", hi: "ज़्यादा कीमत वाला मल्टी-साइट — विशेषज्ञ नियुक्त" },
    prompt: {
      en: "We run a restaurant chain in Mumbai with 3 branches and 12 employees. We have GST, need billing and CCTV in every branch and one bill for everything.",
      hi: "हमारी मुंबई में रेस्टोरेंट चेन है — 3 ब्रांच और 12 कर्मचारी। हमारे पास जीएसटी है। हर ब्रांच में बिलिंग और CCTV चाहिए और सब कुछ एक बिल में।",
    },
    sites: [
      { address: "Shop/Unit 21, Sector 14, Mumbai, Maharashtra - 570043", pincode: "400001" },
      { address: "Plot 8, Andheri East, Mumbai, Maharashtra", pincode: "400003" },
      { address: "Unit 3, Powai, Mumbai, Maharashtra", pincode: "400078" },
    ],
    demoOnly: "Branch 3 has no fibre, so only that branch falls back to AirFiber.",
  },
  {
    id: "vindhya", applicant: "K01", phone: "9876500004", gstin: "37IHKXV5167L1ZS",
    title: { en: "Vindhya Tours · Cancelled GST", hi: "विंध्या टूर्स · रद्द GST" },
    blurb: { en: "GST is cancelled → live re-quote; Udyam number missing", hi: "GST रद्द → लाइव री-कोट; उद्यम नंबर गायब" },
    prompt: {
      en: "I run a travel agency in Visakhapatnam with 6 staff, 1 office. We have GST. Need email and WhatsApp for customers.",
      hi: "मेरी विशाखापत्तनम में ट्रैवल एजेंसी है, 6 स्टाफ, 1 ऑफिस। हमारे पास जीएसटी है। ईमेल और ग्राहकों के लिए WhatsApp चाहिए।",
    },
    sites: [{ address: "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383", pincode: "118383" }],
    demoOnly: "Uses sample documents K01: GSTIN is cancelled and the Udyam number is blank.",
  },
  {
    id: "saffron", applicant: "K04", phone: "9876500005", gstin: "27PZSXS1936O1ZH",
    title: { en: "Saffron Dental · Blurred certificate", hi: "सैफ़रन डेंटल · धुंधला सर्टिफिकेट" },
    blurb: { en: "Photo quality check → retake", hi: "फोटो क्वालिटी जाँच → दोबारा लें" },
    prompt: {
      en: "I run a dental clinic in Nagpur with 8 staff. We have GST. I need email, security and billing.",
      hi: "मेरा नागपुर में डेंटल क्लिनिक है, 8 स्टाफ। हमारे पास जीएसटी है। ईमेल, सुरक्षा और बिलिंग चाहिए।",
    },
    sites: [{ address: "Shop/Unit 75, Lake View Colony, Nagpur, Maharashtra - 137452", pincode: "137452" }],
    demoOnly: "Uses sample documents K04: the GST certificate photo is blurred.",
  },
  {
    id: "factory", applicant: "K03", phone: "9876500006", gstin: "27XUIXG0767D1ZP", udyam: "UDYAM-MH-00-9516696",
    title: { en: "Ganesh Woodcraft · Factory, Nagpur", hi: "गणेश वुडक्राफ्ट · फैक्ट्री, नागपुर" },
    blurb: { en: "Field-led: dedicated line needs a site survey", hi: "फील्ड-आधारित: डेडिकेटेड लाइन के लिए साइट सर्वे" },
    prompt: {
      en: "We run a furniture workshop in Nagpur with 20 employees and 1 unit. We have GST. We want machine monitoring for 6 machines and a secure dedicated internet line.",
      hi: "हमारी नागपुर में फर्नीचर वर्कशॉप है — 20 कर्मचारी, 1 यूनिट। हमारे पास जीएसटी है। 6 मशीनों की मॉनिटरिंग और सुरक्षित डेडिकेटेड इंटरनेट चाहिए।",
    },
    sites: [{ address: "Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231", pincode: "411231" }],
    demoOnly: "A dedicated line needs a field survey, so a field engineer is assigned.",
  },
];
export const getPersona = (id?: string | null) => PERSONAS.find((p) => p.id === id);
