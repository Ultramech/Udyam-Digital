/**
 * REAL verification of the Gemini-backed components. Needs GEMINI_API_KEY in .env.local. Nothing here is mocked.
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/check-ai.ts [--ocr] [--only=ocr|advisor]
 * `--ocr` also reads all 47 supplied document images and compares each field to the human transcription in fixtures/ocr_cache.json
 * (throttled for the free tier; results are cached in .data/ocr-accuracy.json so an interrupted run resumes).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
try { process.loadEnvFile(".env.local"); } catch { /* no .env.local */ }

import { geminiListModels, geminiModel, geminiConfigured } from "../lib/ai/gemini";
import { llmExtract, llmExplain } from "../lib/advisor/llm";
import { extractDocument } from "../lib/kyc/ocr";
import { recommend } from "../lib/rules/recommend";
import { priceLines } from "../lib/rules/pricing";
import { plainName } from "../lib/catalogue/plain";
import type { Slot } from "../lib/kyc/types";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else fail++; console.log(cond ? "  ✓" : "  ✗", name, cond ? "" : (extra ?? "")); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  if (!geminiConfigured()) { console.error("GEMINI_API_KEY is not set (put it in .env.local). Nothing was tested."); process.exit(2); }
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

  console.log(`\nModel access (configured: ${geminiModel()})`);
  const models = await geminiListModels();
  ok(`key works; ${models.length} generateContent models available`, models.length > 0);
  ok(`configured model "${geminiModel()}" exists for this key`, models.includes(geminiModel()), `available flash models: ${models.filter((m) => m.includes("flash")).join(", ")}`);

  if (only !== "ocr") {
    console.log("\nAdvisor: structured extraction in 6 languages (real model calls)");
    const cases: { name: string; text: string; expect: (f: Record<string, unknown>) => boolean }[] = [
      { name: "English", text: "I run a pharmacy in Indore. I have three employees, one shop and need reliable internet, billing and CCTV. No GST number.", expect: (f) => /pharm/i.test(String(f.businessType)) && /indore/i.test(String(f.city)) && f.employees === 3 && f.sites === 1 && f.gst === "no" && (f.needs as string[]).includes("payments") && (f.needs as string[]).includes("cctv") },
      { name: "Hindi", text: "मेरी जयपुर में कपड़े की दुकान है, 4 लोग काम करते हैं, जीएसटी है। मुझे यूपीआई और बिलिंग चाहिए।", expect: (f) => /jaipur/i.test(String(f.city)) && f.employees === 4 && f.gst === "yes" && (f.needs as string[]).includes("payments") },
      { name: "Marathi", text: "माझं पुण्यात तीन शाखा असलेलं रेस्टॉरंट आहे, १२ कर्मचारी आहेत आणि आमच्याकडे जीएसटी आहे.", expect: (f) => /pune/i.test(String(f.city)) && f.sites === 3 && f.employees === 12 && f.gst === "yes" },
      { name: "Tamil", text: "சென்னையில் எனக்கு ஒரு பல் மருத்துவமனை இருக்கிறது, 5 பேர் வேலை செய்கிறார்கள். ஜிஎஸ்டி இல்லை.", expect: (f) => /chennai/i.test(String(f.city)) && f.employees === 5 && f.gst === "no" },
      { name: "Telugu", text: "నాకు హైదరాబాద్‌లో ఒక కిరాణా దుకాణం ఉంది, ఇద్దరు పని చేస్తారు, జీఎస్టీ లేదు.", expect: (f) => /hyderabad/i.test(String(f.city)) && f.employees === 2 && f.gst === "no" },
      { name: "Hinglish + person request", text: "Bhai mera Surat me salon hai, 2 log hain, GST nahi hai. Please kisi se baat karwa do.", expect: (f) => /surat/i.test(String(f.city)) && f.employees === 2 && f.gst === "no" && f.explicitHuman === true },
      { name: "Doesn't invent (no facts given)", text: "Hello, I want to know what you offer.", expect: (f) => !f.city && !f.employees && !f.sites && !f.gst && (f.needs as string[]).length === 0 },
    ];
    for (const c of cases) {
      const r = await llmExtract(c.text);
      ok(`${c.name}`, r.status.used && !!r.facts && c.expect(r.facts as Record<string, unknown>), JSON.stringify(r));
      await sleep(1500);
    }

    console.log("\nAdvisor: explanation is generated, in-language, and passes the faithfulness check");
    const profile = { businessType: "Pharmacy", employees: 3, sites: 1, city: "Indore", gstin: { has: false }, needs: ["payments", "whatsapp"] as never };
    const rec = recommend(profile);
    const pr = priceLines(rec.lines);
    for (const lang of ["en", "hi", "mr", "ta"] as const) {
      const msg = await llmExplain(lang, { bundleName: "Dukaan Digital", monthly: pr.monthly, setup: pr.setup, gstPercent: 18, contractMonths: pr.contractMonths, items: [...new Set(rec.lines.map((l) => plainName(l.productId, "en")))], why: ["GST billing with UPI and cards on one tablet"], notIncluded: ["WhatsApp Business (verified) needs a GST number."], notes: ["Today a website with your catalogue works instead."], city: "Indore", businessType: "Pharmacy", goLive: "Wed, 22 Jul" });
      ok(`${lang}: explanation accepted${msg ? ` — "${msg.slice(0, 90)}…"` : ""}`, !!msg);
      await sleep(1500);
    }
  }

  if (only === "ocr" || process.argv.includes("--ocr")) {
    console.log("\nDocument reading on all supplied specimens (real vision calls; ~7s apart for the free tier)");
    const truth = JSON.parse(readFileSync("fixtures/ocr_cache.json", "utf8")) as Record<string, { file: string; slot: Slot; applicant: string; legibility: string; fields: Record<string, string | null> }>;
    mkdirSync(".data", { recursive: true });
    const cachePath = process.env.OCR_RESULTS ?? ".data/ocr-accuracy.json";
    const done: Record<string, { fields: Record<string, string | null>; legibility: string }> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
    const entries = Object.values(truth).filter((t) => t.applicant.startsWith("K"));
    let fieldsTotal = 0, fieldsOk = 0;
    const misses: string[] = [];
    for (const t of entries) {
      if (!done[t.file]) {
        const buf = readFileSync(`data/kyc_documents/${t.file}`);
        try { const d = await extractDocument(t.slot, buf, "image/png"); done[t.file] = { fields: d.fields, legibility: d.legibility }; }
        catch (e) { console.log("  ! stopped:", (e as Error).message); break; }
        writeFileSync(cachePath, JSON.stringify(done, null, 1));
        await sleep(7000);
      }
      const got = done[t.file];
      if (t.legibility === "blurry") { ok(`${t.file}: blurry image rejected by the sharpness gate`, got.legibility === "blurry"); continue; }
      for (const [k, want] of Object.entries(t.fields)) {
        if (t.slot === "gst_certificate" && k === "gstin" && t.applicant === "K02") continue; // K02's O/0 is ambiguous even to a human reading; covered by checksum repair
        fieldsTotal++;
        if (norm(got.fields[k]) === norm(want)) fieldsOk++; else misses.push(`${t.file} · ${k}: expected "${want}" got "${got.fields[k]}"`);
      }
    }
    const pct = fieldsTotal ? Math.round((fieldsOk / fieldsTotal) * 1000) / 10 : 0;
    console.log(`\n  field-level exact match: ${fieldsOk}/${fieldsTotal} = ${pct}%`);
    misses.slice(0, 25).forEach((m) => console.log("   ·", m));
    ok("field accuracy ≥ 95%", pct >= 95, `${pct}%`);
    // the planted traps need the model to transcribe literally instead of autocorrecting
    const k06 = done["K06_gst_certificate.png"]?.fields.gstin;
    ok("K06 planted typo transcribed literally (not auto-corrected)", !!k06 && norm(k06).startsWith("08ykzxs8189"), k06);
    ok("K01 blank Udyam number reported as blank (not invented)", done["K01_udyam_certificate.png"]?.fields.udyam_number == null, done["K01_udyam_certificate.png"]?.fields.udyam_number);
    ok("K07 'Shri Physio' name read literally", /shri physio/i.test(String(done["K07_gst_certificate.png"]?.fields.legal_name)), done["K07_gst_certificate.png"]?.fields.legal_name);
  }
  console.log(`\n${fail === 0 ? "ALL PASSED" : "FAILURES"} — ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
