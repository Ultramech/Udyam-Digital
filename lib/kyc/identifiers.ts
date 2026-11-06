/** GSTIN / Udyam identifier logic. Follows the dataset README, not real-world assumptions (PAN 4th char "X" and district "00" are valid here). */

const B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const UDYAM_RE = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
  "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
  "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

export const UDYAM_STATE_LETTERS: Record<string, string> = {
  Maharashtra: "MH", "West Bengal": "WB", Rajasthan: "RJ", Delhi: "DL", Gujarat: "GJ", "Andhra Pradesh": "AP", Punjab: "PB",
  Kerala: "KL", Karnataka: "KR", "Tamil Nadu": "TN", Telangana: "TS", "Madhya Pradesh": "MP", Bihar: "BR", "Uttar Pradesh": "UP",
};

export const norm = (s: string) => s.toUpperCase().replace(/[\s-]+/g, "");

export function gstinChecksum(g: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = B36.indexOf(g[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return B36[(36 - (sum % 36)) % 36];
}

export interface GstinFormat { ok: boolean; formatOk: boolean; checksumOk: boolean; stateCode?: string; pan?: string }
export function validateGstin(raw: string): GstinFormat {
  const g = norm(raw);
  const formatOk = GSTIN_RE.test(g);
  if (!formatOk) return { ok: false, formatOk: false, checksumOk: false };
  const checksumOk = gstinChecksum(g) === g[14];
  return { ok: checksumOk, formatOk, checksumOk, stateCode: g.slice(0, 2), pan: g.slice(2, 12) };
}

/** Visually confusable characters that OCR typically swaps. */
/** Characters a reader commonly confuses, each with every look-alike worth trying (a Q can come back as 0 as easily as an O can). */
const CONFUSABLE: Record<string, string[]> = {
  "0": ["O", "Q", "D"], O: ["0", "Q", "D"], Q: ["O", "0"], D: ["0", "O"],
  "1": ["I", "L"], I: ["1", "L"], L: ["1", "I"], "5": ["S"], S: ["5"], "8": ["B"], B: ["8"], "2": ["Z"], Z: ["2"], "6": ["G"], G: ["6"],
};

/**
 * OCR post-correction anchored on two independent facts: the candidate must pass the mod-36 checksum AND exist in
 * the registry. Tries every look-alike at one position, then at two positions. Returns null if nothing both validates and is registered.
 */
export function repairGstin(raw: string, inRegistry: (g: string) => boolean): string | null {
  const g = norm(raw);
  if (g.length !== 15) return null;
  const idx = [...g].map((c, i) => (CONFUSABLE[c] ? i : -1)).filter((i) => i >= 0);
  const tryCandidate = (c: string) => validateGstin(c).ok && inRegistry(c) ? c : null;
  for (const i of idx) for (const alt of CONFUSABLE[g[i]]) {
    const c = tryCandidate(g.slice(0, i) + alt + g.slice(i + 1));
    if (c) return c;
  }
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
    for (const altA of CONFUSABLE[g[idx[a]]]) for (const altB of CONFUSABLE[g[idx[b]]]) {
      const arr = [...g];
      arr[idx[a]] = altA; arr[idx[b]] = altB;
      const c = tryCandidate(arr.join(""));
      if (c) return c;
    }
  }
  return null;
}

export const editDistance = (a: string, b: string): number => {
  if (a.length !== b.length) return 99;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
};

export interface UdyamFormat { ok: boolean; stateLetters?: string }
export function validateUdyam(raw: string): UdyamFormat {
  const u = raw.toUpperCase().replace(/\s+/g, "");
  return UDYAM_RE.test(u) ? { ok: true, stateLetters: u.slice(6, 8) } : { ok: false };
}

/** Mask identifiers for UI and logs. */
export const maskGstin = (g?: string | null) => (g && g.length === 15 ? `${g.slice(0, 4)}•••••••${g.slice(-4)}` : g ? "••••" : "");
export const maskUdyam = (u?: string | null) => (u ? u.replace(/(\d{3})\d{4}$/, "•••••••").replace(/(UDYAM-[A-Z]{2}-\d{2}-)(\d+)/, "$1•••••••") : "");
export const maskPhone = (p?: string | null) => (p ? p.replace(/^(\d{2})\d{6}(\d{2})$/, "$1••••••$2") : "");
