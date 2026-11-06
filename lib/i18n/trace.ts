import { plainName, type Lang } from "@/lib/catalogue/plain";
import type { TraceEntry } from "@/lib/rules/types";
import { ruleReason } from "./reasons";

const SEGMENT: Record<string, { en: string; hi: string }> = {
  micro: { en: "small shop / service", hi: "छोटी दुकान / सेवा" }, prof: { en: "professional office", hi: "प्रोफेशनल ऑफिस" },
  multi: { en: "multi-location business", hi: "मल्टी-लोकेशन बिज़नेस" }, mfg: { en: "manufacturer", hi: "निर्माता" },
};
const inr = (n: unknown) => "₹" + Number(n).toLocaleString("en-IN");

/** One line of the "How I decided" panel. Every recommendation can be explained rule by rule. */
export function traceLine(e: TraceEntry, lang: Lang = "en"): { status: TraceEntry["status"]; text: string } {
  const hi = lang === "hi" || lang === "mr";
  const p = e.params ?? {};
  const name = e.productId ? plainName(e.productId, hi ? "hi" : "en") : "";
  const T = (en: string, h: string) => (hi ? h : en);
  switch (e.code) {
    case "SEGMENT": return { status: "info", text: T(`Treated as a ${SEGMENT[String(p.segment)]?.en ?? p.segment}${p.businessType && p.businessType !== "—" ? ` (${p.businessType})` : ""}`, `${SEGMENT[String(p.segment)]?.hi ?? p.segment} के रूप में देखा${p.businessType && p.businessType !== "—" ? ` (${p.businessType})` : ""}`) };
    case "CITY_TIER": return { status: "info", text: T(`${p.city} is a Tier ${p.tier} city`, `${p.city} टियर ${p.tier} शहर है`) };
    case "CITY_UNKNOWN": return { status: "fail", text: T(`We can't sign up "${p.city || "this city"}" online yet`, `"${p.city || "यह शहर"}" में अभी ऑनलाइन साइन-अप नहीं`) };
    case "GST_STATE": return { status: "info", text: p.state === "ok" ? T("GST number declared — will be verified at KYC", "GST नंबर बताया — KYC में वेरिफाई होगा") : p.state === "none" ? T("No GST number — GST-only products are off the table", "GST नंबर नहीं — सिर्फ़ GST वाले प्रोडक्ट नहीं मिलेंगे") : T("GST registration is not active", "GST रजिस्ट्रेशन चालू नहीं") };
    case "ELIGIBLE": return { status: "pass", text: T(`${name}: allowed`, `${name}: मिल सकता है`) };
    case "ELIGIBLE_PENDING_GST": return { status: "pass", text: T(`${name}: allowed once GST is verified`, `${name}: GST वेरिफाई होने पर मिलेगा`) };
    case "AIRFIBER_SWAP": return { status: "info", text: T(`Location ${p.site}: no fibre → switched to wireless AirFiber`, `लोकेशन ${p.site}: फाइबर नहीं → वायरलेस AirFiber`) };
    case "NETWORK_CONTROL_ADDED": return { status: "add", text: T("3+ locations, 10+ people and GST → added one control panel for all branches", "3+ लोकेशन, 10+ लोग और GST → सभी ब्रांच के लिए एक कंट्रोल पैनल जोड़ा") };
    case "DEDICATED_LINE_NEEDS_GST": return { status: "warn", text: T("A dedicated line needs GST — using regular fibre instead", "डेडिकेटेड लाइन के लिए GST चाहिए — इसलिए सामान्य फाइबर") };
    case "SIM_ONLY_ROUTE": return { status: "info", text: T("You only asked for phone lines → SIM-only plan", "आपने सिर्फ़ फोन लाइन माँगी → सिर्फ़-सिम प्लान") };
    case "PRICE_MATH": return { status: "info", text: T(`${inr(p.monthly)} a month + ${inr(p.setup)} setup; GST ${inr(p.gst)} a month on top (lower end of list prices)`, `${inr(p.monthly)} प्रति माह + ${inr(p.setup)} सेटअप; ऊपर से GST ${inr(p.gst)} प्रति माह (सूची कीमत का निचला स्तर)`) };
    case "BUDGET_MET": case "BUDGET_NOT_MET": return { status: e.status, text: ruleReason({ code: e.code, params: p }, lang) };
    default:
      if (e.code.startsWith("EXCL_")) return { status: "fail", text: ruleReason({ code: e.code, params: p, productId: e.productId }, lang) };
      return { status: e.status, text: e.code };
  }
}
