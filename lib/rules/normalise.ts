import type { Segment } from "@/lib/catalogue";
import type { BusinessProfile } from "./types";

/** The 35 business types in smb_leads.csv (+ a few generic ones) → segment, with keywords for extraction (en + hi). */
export interface BusinessTypeDef { name: string; segment: Segment; keywords: string[] }
/** Generic catch-all types lose to any specific match (so "दवा की दुकान" is a Pharmacy, not just a Shop). */
const GENERIC = new Set(["Shop", "Office", "Factory", "Clinic", "Restaurant"]);

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  // Micro retail & services
  { name: "Kirana store", segment: "micro", keywords: ["kirana", "grocery", "general store", "किराना", "परचून"] },
  { name: "Pharmacy", segment: "micro", keywords: ["pharmacy", "chemist", "medical store", "medicals", "दवा", "दवाई", "फार्मेसी", "केमिस्ट", "मेडिकल"] },
  { name: "Salon", segment: "micro", keywords: ["salon", "parlour", "parlor", "beauty", "barber", "सैलून", "पार्लर"] },
  { name: "Boutique", segment: "micro", keywords: ["boutique", "tailor", "बुटीक", "दर्जी"] },
  { name: "Bakery", segment: "micro", keywords: ["bakery", "बेकरी"] },
  { name: "Sweet shop", segment: "micro", keywords: ["sweet", "mithai", "मिठाई"] },
  { name: "Hardware store", segment: "micro", keywords: ["hardware", "हार्डवेयर"] },
  { name: "Stationery shop", segment: "micro", keywords: ["stationery", "स्टेशनरी"] },
  { name: "Mobile repair shop", segment: "micro", keywords: ["mobile repair", "mobile shop", "मोबाइल रिपेयर", "मोबाइल की दुकान"] },
  { name: "Optician", segment: "micro", keywords: ["optician", "optical", "चश्मा", "ऑप्टिकल"] },
  { name: "Restaurant", segment: "micro", keywords: ["restaurant", "cafe", "café", "dhaba", "hotel", "रेस्टोरेंट", "ढाबा", "होटल"] },
  { name: "Shop", segment: "micro", keywords: ["shop", "store", "दुकान"] },
  // Professional offices
  { name: "Dental clinic", segment: "prof", keywords: ["dental", "dentist", "दंत", "डेंटल"] },
  { name: "Physiotherapy clinic", segment: "prof", keywords: ["physio", "फिजियो"] },
  { name: "Diagnostic lab", segment: "prof", keywords: ["diagnostic", "pathology", "lab", "लैब"] },
  { name: "Clinic", segment: "prof", keywords: ["clinic", "doctor", "hospital", "क्लिनिक", "डॉक्टर", "अस्पताल"] },
  { name: "CA firm", segment: "prof", keywords: ["ca firm", "chartered accountant", "accountant", "ca office", "सीए"] },
  { name: "Law office", segment: "prof", keywords: ["law", "lawyer", "advocate", "legal", "वकील", "लॉ"] },
  { name: "Coaching centre", segment: "prof", keywords: ["coaching", "tuition", "institute", "कोचिंग", "ट्यूशन"] },
  { name: "Travel agency", segment: "prof", keywords: ["travel", "tours", "ट्रैवल", "टूर"] },
  { name: "Architecture studio", segment: "prof", keywords: ["architect", "आर्किटेक्ट"] },
  { name: "Real estate agency", segment: "prof", keywords: ["real estate", "property", "realty", "प्रॉपर्टी"] },
  { name: "Insurance agency", segment: "prof", keywords: ["insurance", "बीमा", "इंश्योरेंस"] },
  { name: "Office", segment: "prof", keywords: ["office", "consultancy", "agency", "ऑफिस", "दफ्तर"] },
  // Multi-site (chains)
  { name: "Restaurant chain", segment: "multi", keywords: ["restaurant chain", "restaurants", "रेस्टोरेंट चेन"] },
  { name: "Pharmacy chain", segment: "multi", keywords: ["pharmacy chain", "pharmacies", "medical chain"] },
  { name: "Apparel retail chain", segment: "multi", keywords: ["apparel", "clothing", "garment store", "fashion"] },
  { name: "Electronics retail chain", segment: "multi", keywords: ["electronics"] },
  { name: "Bakery chain", segment: "multi", keywords: ["bakery chain", "bakeries"] },
  { name: "Gym chain", segment: "multi", keywords: ["gym", "fitness", "जिम"] },
  { name: "Pre-school chain", segment: "multi", keywords: ["pre-school", "preschool", "play school", "प्ले स्कूल"] },
  { name: "Budget hotel group", segment: "multi", keywords: ["hotel group", "budget hotel", "hotels", "guest house"] },
  // Manufacturers
  { name: "Textile unit", segment: "mfg", keywords: ["textile", "weaving", "कपड़ा मिल", "टेक्सटाइल"] },
  { name: "Auto-parts unit", segment: "mfg", keywords: ["auto-parts", "auto parts", "automotive"] },
  { name: "Plastic moulding unit", segment: "mfg", keywords: ["plastic", "moulding", "molding"] },
  { name: "Packaging unit", segment: "mfg", keywords: ["packaging"] },
  { name: "Printing press", segment: "mfg", keywords: ["printing", "press", "प्रिंटिंग"] },
  { name: "Furniture workshop", segment: "mfg", keywords: ["furniture", "woodcraft", "carpentry", "फर्नीचर"] },
  { name: "Food processing unit", segment: "mfg", keywords: ["food processing"] },
  { name: "Factory", segment: "mfg", keywords: ["factory", "manufactur", "unit", "workshop", "फैक्ट्री", "कारखाना"] },
];

const TYPE_BY_NAME = new Map(BUSINESS_TYPES.map((t) => [t.name.toLowerCase(), t]));

/** Cities present in the dataset, with their tiers. Anything else → null (outside Tier 1/2). */
const CITY_TIERS: Record<string, 1 | 2> = {
  ahmedabad: 1, bengaluru: 1, chennai: 1, delhi: 1, hyderabad: 1, kolkata: 1, mumbai: 1, pune: 1,
  bhopal: 2, coimbatore: 2, indore: 2, jaipur: 2, kochi: 2, lucknow: 2, ludhiana: 2, mysuru: 2,
  nagpur: 2, nashik: 2, patna: 2, surat: 2, vadodara: 2, visakhapatnam: 2,
};
const CITY_ALIASES: Record<string, string> = {
  bangalore: "bengaluru", bombay: "mumbai", calcutta: "kolkata", vizag: "visakhapatnam", mysore: "mysuru",
  "new delhi": "delhi", cochin: "kochi", baroda: "vadodara", madras: "chennai",
  इंदौर: "indore", दिल्ली: "delhi", मुंबई: "mumbai", पुणे: "pune", जयपुर: "jaipur", लखनऊ: "lucknow", भोपाल: "bhopal", पटना: "patna", नागपुर: "nagpur", सूरत: "surat", कोलकाता: "kolkata",
};

export const KNOWN_CITIES = Object.keys(CITY_TIERS).map((c) => c[0].toUpperCase() + c.slice(1));

export function canonicalCity(city: string): string | null {
  const c = city.trim().toLowerCase();
  const key = CITY_ALIASES[c] ?? c;
  return key in CITY_TIERS ? key[0].toUpperCase() + key.slice(1) : null;
}

export function cityTier(city: string): 1 | 2 | null {
  const c = canonicalCity(city);
  return c ? CITY_TIERS[c.toLowerCase()] : null;
}

export function findBusinessType(text: string): BusinessTypeDef | undefined {
  const exact = TYPE_BY_NAME.get(text.trim().toLowerCase());
  if (exact) return exact;
  const t = text.toLowerCase();
  // longest keyword wins so "pharmacy chain" beats "pharmacy" and "dental" beats "lab"
  let best: { def: BusinessTypeDef; score: number } | undefined;
  for (const def of BUSINESS_TYPES) for (const k of def.keywords) {
    if (!t.includes(k)) continue;
    const score = (GENERIC.has(def.name) ? 0 : 1000) + k.length;
    if (!best || score > best.score) best = { def, score };
  }
  return best?.def;
}

export function deriveSegment(p: Pick<BusinessProfile, "businessType" | "employees" | "sites">): Segment {
  const def = p.businessType ? findBusinessType(p.businessType) : undefined;
  if (def?.segment === "mfg") return "mfg";
  if (p.sites >= 3) return "multi";
  if (def) return def.segment === "multi" ? "multi" : def.segment;
  return p.employees >= 10 ? "prof" : "micro";
}
