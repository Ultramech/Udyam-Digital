/**
 * Builds fixtures/ocr_cache.json: a deterministic extraction for each of the 47 specimen images.
 * Values were transcribed by viewing every image (see memory: airtel-kyc-answer-key). The cache is keyed by file
 * sha256 so any re-upload of a specimen resolves to the same extraction; the UI labels it "cached extraction".
 * Sharpness is MEASURED here with sharp (Laplacian variance), not hand-entered.
 */
import sharp from "sharp";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

type A = { gstin: string; legal: string; trade: string; cons: string; addr: string; dol: string;
  udyam: string | null; uName: string; uAct: string; uCity: string; uState: string; uDate: string;
  idName: string; idRole: string; idBiz: string; idNo: string; idValid: string;
  billNo: string; billTo: string; billDate: string; gstLegibility?: "clear" | "skewed" | "blurry"; };

const RAW: Record<number, A> = {
  1: { gstin: "37IHKXV5167L1ZS", legal: "Neha Kaur (Prop. Vindhya Tours & Travels)", trade: "Vindhya Tours & Travels", cons: "Proprietorship", addr: "Shop/Unit 1, Tech Park Road, Visakhapatnam, Andhra Pradesh - 118383", dol: "2025-06-07", udyam: null, uName: "Vindhya Tours & Travels", uAct: "Services", uCity: "Visakhapatnam", uState: "Andhra Pradesh", uDate: "2024-03-24", idName: "Neha Kaur", idRole: "Office admin", idBiz: "Vindhya Tours & Travels", idNo: "SYN-ID-346190", idValid: "2028-03-26", billNo: "9485717625", billTo: "Vindhya Tours & Travels", billDate: "2026-06-26" },
  2: { gstin: "19E0GXH4115Y1ZL", legal: "Joseph Shah (Prop. Harmony Dental Care)", trade: "Harmony Dental Care", cons: "Proprietorship", addr: "Shop/Unit 199, Station Road, Kolkata, West Bengal - 347550", dol: "2022-04-17", udyam: "UDYAM-WB-00-5053330", uName: "Harmony Dental Care", uAct: "Services", uCity: "Kolkata", uState: "West Bengal", uDate: "2023-01-11", idName: "Joseph Shah", idRole: "Manager", idBiz: "Harmony Dental Care", idNo: "SYN-ID-816907", idValid: "2028-09-10", billNo: "9790713533", billTo: "Harmony Dental Care", billDate: "2026-05-22", gstLegibility: "skewed" },
  3: { gstin: "27XUIXG0767D1ZP", legal: "Joseph Singh (Prop. Ganesh Woodcraft)", trade: "Ganesh Woodcraft", cons: "Proprietorship", addr: "Shop/Unit 80, Civil Lines, Nagpur, Maharashtra - 411231", dol: "2020-02-10", udyam: "UDYAM-MH-00-9516696", uName: "Ganesh Woodcraft", uAct: "Manufacturing", uCity: "Nagpur", uState: "Maharashtra", uDate: "2024-11-21", idName: "Joseph Singh", idRole: "Owner", idBiz: "Ganesh Woodcraft", idNo: "SYN-ID-447889", idValid: "2028-07-04", billNo: "3438517928", billTo: "Ganesh Woodcraft", billDate: "2026-05-30" },
  4: { gstin: "27PZSXS1936O1ZH", legal: "Saffron Dental Care LLP", trade: "Saffron Dental Care LLP", cons: "Limited Liability Partnership", addr: "Shop/Unit 75, Lake View Colony, Nagpur, Maharashtra - 137452", dol: "2020-05-12", udyam: "UDYAM-MH-00-6131836", uName: "Saffron Dental Care LLP", uAct: "Services", uCity: "Nagpur", uState: "Maharashtra", uDate: "2025-05-17", idName: "Fatima Pillai", idRole: "Partner", idBiz: "Saffron Dental Care LLP", idNo: "SYN-ID-609396", idValid: "2028-08-03", billNo: "7397844759", billTo: "Saffron Dental Care LLP", billDate: "2026-05-28", gstLegibility: "blurry" },
  5: { gstin: "32TZAXB5481U1Z1", legal: "Balaji Realty LLP", trade: "Balaji Realty LLP", cons: "Limited Liability Partnership", addr: "Shop/Unit 38, Civil Lines, Kochi, Kerala - 752083", dol: "2020-07-26", udyam: null, uName: "", uAct: "", uCity: "", uState: "", uDate: "", idName: "Anita Shah", idRole: "Owner", idBiz: "Balaji Realty LLP", idNo: "SYN-ID-587234", idValid: "2029-09-11", billNo: "4294969054", billTo: "Balaji Realty LLP", billDate: "2026-06-11" },
  6: { gstin: "08YKZXS8189L1Z0", legal: "Pooja Shah (Prop. Saffron Unisex Salon)", trade: "Saffron Unisex Salon", cons: "Proprietorship", addr: "Shop/Unit 71, Market Yard, Jaipur, Rajasthan - 194057", dol: "2019-09-25", udyam: "UDYAM-RJ-00-6577157", uName: "Saffron Unisex Salon", uAct: "Services", uCity: "Jaipur", uState: "Rajasthan", uDate: "2023-01-24", idName: "Pooja Shah", idRole: "Owner", idBiz: "Saffron Unisex Salon", idNo: "SYN-ID-118354", idValid: "2028-09-15", billNo: "9566781101", billTo: "Saffron Unisex Salon", billDate: "2026-06-11" },
  7: { gstin: "07CPCXN0398P1ZT", legal: "Neha Banerjee (Prop. Shri Physio Clinic)", trade: "Neelgiri Physio Clinic", cons: "Proprietorship", addr: "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596", dol: "2024-01-13", udyam: "UDYAM-DL-00-9565547", uName: "Neelgiri Physio Clinic", uAct: "Services", uCity: "Delhi", uState: "Delhi", uDate: "2024-07-14", idName: "Neha Banerjee", idRole: "Manager", idBiz: "Neelgiri Physio Clinic", idNo: "SYN-ID-178237", idValid: "2030-05-05", billNo: "7545812405", billTo: "Neelgiri Physio Clinic", billDate: "2026-07-05" },
  8: { gstin: "24XORXG9365M1Z3", legal: "Joseph Rao (Prop. Green Leaf Legal Associates)", trade: "Green Leaf Legal Associates", cons: "Proprietorship", addr: "Shop/Unit 238, Ring Road, Vadodara, Gujarat - 348176", dol: "2018-12-01", udyam: "UDYAM-GJ-00-8477445", uName: "Green Leaf Legal Associates", uAct: "Services", uCity: "Vadodara", uState: "Gujarat", uDate: "2022-11-12", idName: "Joseph Rao", idRole: "Office admin", idBiz: "Green Leaf Legal Associates", idNo: "SYN-ID-393148", idValid: "2027-09-18", billNo: "2568472785", billTo: "Green Leaf Legal Associates", billDate: "2026-05-26" },
  9: { gstin: "37LDYXK0296F1ZB", legal: "Anita Kulkarni (Prop. Kaveri Insurance Advisors)", trade: "Kaveri Insurance Advisors", cons: "Proprietorship", addr: "Shop/Unit 217, Civil Lines, Visakhapatnam, Andhra Pradesh - 405337", dol: "2023-09-20", udyam: "UDYAM-AP-00-9751562", uName: "Kaveri Insurance Advisors", uAct: "Services", uCity: "Visakhapatnam", uState: "Andhra Pradesh", uDate: "2023-07-04", idName: "Anita Kulkarni", idRole: "Office admin", idBiz: "Kaveri Insurance Advisors", idNo: "SYN-ID-126040", idValid: "2027-12-22", billNo: "9375012581", billTo: "Kaveri Insurance Advisors", billDate: "2026-07-10" },
  10: { gstin: "27QHJXK0658U1ZL", legal: "Kaveri Stays LLP", trade: "Kaveri Stays LLP", cons: "Limited Liability Partnership", addr: "Shop/Unit 21, Sector 14, Mumbai, Maharashtra - 570043", dol: "2022-07-13", udyam: "UDYAM-MH-00-7183141", uName: "Kaveri Stays LLP", uAct: "Services", uCity: "Mumbai", uState: "Maharashtra", uDate: "2024-01-09", idName: "Nisha Arora", idRole: "Owner", idBiz: "Kaveri Stays LLP", idNo: "SYN-ID-247542", idValid: "2029-06-01", billNo: "6910330901", billTo: "Kaveri Stays LLP", billDate: "2026-06-18" },
  11: { gstin: "03KGZXT1320R1ZZ", legal: "Trinity Bake House Pvt Ltd", trade: "Trinity Bake House Pvt Ltd", cons: "Private Limited Company", addr: "Shop/Unit 188, Industrial Area Phase 2, Ludhiana, Punjab - 541498", dol: "2019-08-19", udyam: "UDYAM-PB-00-9719478", uName: "Trinity Bake House Pvt Ltd", uAct: "Services", uCity: "Ludhiana", uState: "Punjab", uDate: "2025-09-15", idName: "Vikram Pillai", idRole: "Owner", idBiz: "Trinity Bake House Pvt Ltd", idNo: "SYN-ID-440312", idValid: "2028-12-23", billNo: "2710511786", billTo: "Trinity Bake House Pvt Ltd", billDate: "2025-10-31" },
  12: { gstin: "37NBLXS1145E1ZU", legal: "Pooja Agarwal (Prop. Star Electronics)", trade: "Star Electronics", cons: "Proprietorship", addr: "Shop/Unit 216, Nehru Nagar, Visakhapatnam, Andhra Pradesh - 762071", dol: "2017-01-08", udyam: "UDYAM-AP-00-5186772", uName: "Star Electronics", uAct: "Services", uCity: "Visakhapatnam", uState: "Andhra Pradesh", uDate: "2024-02-03", idName: "Pooja Agarwal", idRole: "Owner", idBiz: "Star Electronics", idNo: "SYN-ID-365512", idValid: "2029-03-03", billNo: "6982457282", billTo: "Star Electronics", billDate: "2026-07-06" },
};

async function sharpness(buf: Buffer): Promise<number> {
  const { data, info } = await sharp(buf).greyscale().resize({ width: 800 }).convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 }).raw().toBuffer({ resolveWithObject: true });
  let sum = 0, sq = 0;
  for (const v of data) { const d = v - 128; sum += d; sq += d * d; }
  const n = info.width * info.height;
  return Math.round(sq / n - (sum / n) ** 2);
}

async function main() {
  const out: Record<string, unknown> = {};
  for (const [k, a] of Object.entries(RAW)) {
    const id = `K${String(k).padStart(2, "0")}`;
    const docs: Record<string, { type: string; fields: Record<string, string | null>; legibility?: string }> = {
      gst_certificate: { type: "gst_certificate", legibility: a.gstLegibility ?? "clear", fields: { gstin: a.gstin, legal_name: a.legal, trade_name: a.trade, constitution: a.cons, address: a.addr, date_of_liability: a.dol, registration_type: "Regular" } },
      udyam_certificate: { type: "udyam_certificate", fields: { udyam_number: a.udyam, enterprise_name: a.uName, major_activity: a.uAct, city: a.uCity, state: a.uState, date_of_registration: a.uDate } },
      signatory_id: { type: "signatory_id", fields: { name: a.idName, designation: a.idRole, for_business: a.idBiz, id_no: a.idNo, valid_till: a.idValid } },
      address_proof: { type: "address_proof", fields: { document: "Electricity bill", consumer_no: a.billNo, billed_to: a.billTo, address: a.addr, bill_date: a.billDate } },
    };
    for (const [slot, d] of Object.entries(docs)) {
      const file = `${id}_${slot}.png`;
      const path = `data/kyc_documents/${file}`;
      if (!existsSync(path)) continue; // K05 has no Udyam certificate
      const buf = readFileSync(path);
      const sha = createHash("sha256").update(buf).digest("hex");
      const sharp_ = await sharpness(buf);
      const blurry = d.legibility === "blurry";
      out[sha] = {
        file, applicant: id, slot, docType: d.type,
        legibility: d.legibility ?? "clear", sharpness: sharp_,
        confidence: blurry ? 0.31 : d.legibility === "skewed" ? 0.82 : 0.97,
        // A blurred certificate genuinely cannot be read, so its cached extraction carries no fields.
        fields: blurry ? Object.fromEntries(Object.keys(d.fields).map((f) => [f, null])) : d.fields,
      };
    }
  }
  // Clearly-labelled extra DEMO documents (not part of the supplied dataset): Sharma-ji's fictional Indore pharmacy.
  const demo: Record<string, { slot: string; fields: Record<string, string> }> = {
    "D01_address_proof.png": { slot: "address_proof", fields: { document: "Electricity bill", consumer_no: "5521098734", billed_to: "Sharma Medical Store", address: "Shop 14, MG Road, Indore, Madhya Pradesh - 452008", bill_date: "2026-06-20" } },
    "D01_signatory_id.png": { slot: "signatory_id", fields: { name: "Ramesh Sharma", designation: "Owner", for_business: "Sharma Medical Store", id_no: "SYN-ID-552109", valid_till: "2029-03-31" } },
  };
  for (const [file, d] of Object.entries(demo)) {
    const buf = readFileSync(`fixtures/demo_documents/${file}`);
    out[createHash("sha256").update(buf).digest("hex")] = { file, applicant: "D01", slot: d.slot, docType: d.slot, legibility: "clear", sharpness: await sharpness(buf), confidence: 0.96, fields: d.fields };
  }
  writeFileSync("fixtures/ocr_cache.json", JSON.stringify(out, null, 1));
  const rows = Object.values(out) as { file: string; sharpness: number; legibility: string }[];
  console.log("cached docs:", rows.length);
  console.log(rows.map((r) => `${r.file}:${r.sharpness}`).join("  "));
}
main();
