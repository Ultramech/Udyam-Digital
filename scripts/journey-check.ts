export {};
/**
 * End-to-end API journey check against a RUNNING server (npm run dev -p 3100). Walks the demo scenarios through every step,
 * including the failure paths, and asserts the guards. Usage: BASE=http://localhost:3100 npx tsx scripts/journey-check.ts
 */
const BASE = process.env.BASE ?? "http://localhost:3100";
let cookies: Record<string, string> = {};
let pass = 0, failed = 0;

async function call(method: string, path: string, body?: unknown, opts: { jar?: Record<string, string> } = {}) {
  const jar = opts.jar ?? cookies;
  const res = await fetch(BASE + path, {
    method, headers: { "content-type": "application/json", cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ") },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const [k, ...v] = kv.split("="); jar[k] = v.join("="); }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data } as { status: number; data: any };
}
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); } else { failed++; console.log("  ✗", name, extra ?? ""); }
}
const section = (s: string) => console.log("\n" + s);
let skipped = 0;
const skip = (why: string) => { skipped++; console.log("  – SKIPPED:", why); };
let aiLive = false;
let adv: any;

async function reset(phone: string) {
  cookies = {}; await call("POST", "/api/demo/reset");
  // the reset wipes the engineer roster too; installation can only be scheduled with a real roster entry
  await call("POST", "/api/ops/engineers", { name: "Journey Test Engineer", phone: "9876500999", cities: ["*"] }, { jar: await ops("OPS1") });
  await login(phone);
}
/** Every customer API needs a signed-in, set-up account. The seam skips only the SMS round-trip; setup is the real, validated one. */
async function login(phone: string, name = "Ramesh Sharma") {
  const v = await call("POST", "/api/demo/verify", { phone });
  if (v.status !== 200) throw new Error(`test-verify seam refused (${v.status}) — start the server with ALLOW_TEST_VERIFY=1`);
  const s = await call("POST", "/api/me/setup", { name, profileType: "owner", email: "",
    business: { name: "Sharma Medical Store", type: "Pharmacy", typeOther: "", city: "Indore", cityOther: "", employees: "3", sites: "1", address: "Shop 14, MG Road, Indore", pincode: "452001", gstin: "", udyam: "" } });
  if (s.status !== 200) throw new Error(`profile setup failed: ${JSON.stringify(s.data)}`);
}
async function ops(id: string) { const jar: Record<string, string> = {}; await call("POST", "/api/ops/session", { id }, { jar }); return jar; }

async function journey(opts: { prompt: string; lang: "en" | "hi"; persona: string; phone: string; sites: { address: string; pincode: string }[]; specimen: string; gstin?: string; udyam?: string; chooseDocs: string[] }) {
  await call("POST", "/api/session", { lang: opts.lang });
  const adv = await call("POST", "/api/advisor", { text: opts.prompt, lang: opts.lang, persona: opts.persona });
  return { adv, conv: adv.data.conversationId as string };
}

(async () => {
  aiLive = (await call("GET", "/api/status")).data.services?.find((x: any) => x.id === "document_ai")?.mode === "live";
  console.log(aiLive ? "Document reader: LIVE (Gemini) — running every scenario" : "Document reader: NOT configured — checks that need it assert the honest refusal and are SKIPPED, not faked");
  // ------------------------------------------------------------------ S1 Sharma-ji
  section("S0 · Nothing works before OTP sign-in + profile setup");
  cookies = {};
  check("advisor refused before sign-in", (await call("POST", "/api/advisor", { text: "pharmacy in Indore", lang: "en" })).status === 401);
  check("quote refused before sign-in", (await call("GET", "/api/quote/QT-AAAAAA")).status === 401);
  await call("POST", "/api/demo/verify", { phone: "9876500090" });
  check("signed in but no profile → advisor refused (setup required)", (await call("POST", "/api/advisor", { text: "pharmacy in Indore", lang: "en" })).data.error === "PROFILE_SETUP_REQUIRED");
  const badSetup = await call("POST", "/api/me/setup", { name: "X1", profileType: "owner", email: "x@", business: { name: "", type: "", typeOther: "", city: "", cityOther: "", employees: "0", sites: "1", address: "", pincode: "000000", gstin: "BAD", udyam: "" } });
  check("invalid profile details are refused field by field", badSetup.status === 422 && Object.keys(badSetup.data.errors ?? {}).length >= 6, badSetup.data);
  section("S1 · Sharma-ji (Hindi, no GST, fibre unavailable)");
  await reset("9876500001");
  await call("POST", "/api/session", { lang: "hi" });
  let a = await call("POST", "/api/advisor", { text: "मेरी इंदौर में दवा की दुकान है। 3 कर्मचारी हैं, एक दुकान। भरोसेमंद इंटरनेट, बिलिंग और CCTV चाहिए। मेरे पास जीएसटी नंबर नहीं है। ग्राहकों के लिए WhatsApp भी चाहिए।", lang: "hi", persona: "sharma" });
  check("advisor recommends Dukaan Digital in one turn", a.data.turn?.recommendation?.bundleId === "dukaan", a.data);
  check("reply is in Hindi and has no product codes", /[ऀ-ॿ]/.test(a.data.turn.reply) && !/\bP\d{2}\b/.test(a.data.turn.reply));
  // the engine's notice is the contract; the model may spell it "WhatsApp" or "व्हाट्सएप"
  check("WhatsApp Business refused, website offered", !a.data.turn.recommendation.lines.some((l: any) => l.productId === "P15") && a.data.turn.recommendation.notices.some((n: any) => n.code === "WHATSAPP_ALTERNATIVE_WEBSITE") && /WhatsApp|व्हाट्सएप|वॉट्सऐप/i.test(a.data.turn.reply));
  const conv1 = a.data.conversationId;
  let q = await call("POST", "/api/quote", { conversationId: conv1 });
  check("quote created", q.status === 200 && q.data.quote?.id, q.data);
  const qid = q.data.quote.id;
  check("indicative price = fibre + line + billing + 2 cameras", q.data.pricing.monthly === 999 + 299 + 599 + 2 * 199, q.data.pricing);
  let e = await call("PATCH", `/api/quote/${qid}`, { op: "edit", edit: { type: "add", productId: "P15" } });
  check("adding WhatsApp is blocked server-side with a reason", e.data.blocked?.code === "EXCL_NEEDS_GSTIN", e.data);
  e = await call("PATCH", `/api/quote/${qid}`, { op: "edit", edit: { type: "setQty", productId: "P23", qty: 4 } });
  check("changing camera quantity reprices immediately", e.data.pricing.monthly === 999 + 299 + 599 + 4 * 199, e.data.pricing);
  let f = await call("POST", "/api/feasibility", { quoteId: qid, sites: [{ index: 0, address: "Shop 14, MG Road, Indore", pincode: "452008" }] });
  check("fibre infeasible → AirFiber swap, with notice", f.data.perSite?.[0]?.connectivity === "P04" && f.data.notices.some((n: any) => n.code === "AIRFIBER_SWAP"), f.data);
  let o: any;
  check("forged/unknown OTP id refused", [401, 503].includes((await call("PUT", "/api/otp", { otpId: "OTP-FAKE", code: "000000" })).status));
  check("test-verify seam accepted (needs ALLOW_TEST_VERIFY=1)", (await call("POST", "/api/demo/verify", { phone: "9876500001" })).status === 200);
  let k = await call("POST", `/api/kyc/${qid}`, { action: "lookup", siteAddress: "Shop 14, MG Road, Indore" });
  check("KYC refused before consent (purpose limitation)", k.status === 403 && k.data.error === "KYC_CONSENT_REQUIRED", k.data);
  check("consent without KYC purpose refused", (await call("POST", "/api/consent", { quoteId: qid, purposes: { kyc: false, service: true } })).status === 400);
  const c = await call("POST", "/api/consent", { quoteId: qid, lang: "hi", purposes: { kyc: true, service: true } });
  check("consent recorded; marketing off by default", c.status === 200 && c.data.receipt.purposes.marketing === false, c.data);
  if (!aiLive) {
    const r = await call("POST", `/api/kyc/${qid}`, { action: "specimen", applicant: "D01", slot: "address_proof" });
    check("no reader configured → documents are refused honestly (503), nothing fabricated", r.status === 503 && r.data.error === "DOCUMENT_READER_UNAVAILABLE", r.data);
    skip("S1 order → tracker (KYC documents need the reader)");
  } else {
  for (const slot of ["address_proof", "signatory_id"]) k = await call("POST", `/api/kyc/${qid}`, { action: "specimen", applicant: "D01", slot });
  if (k.status === 503) { console.log(`  ! document reader unavailable (${k.data.reason}) — remaining steps need it; stopping honestly instead of faking`); process.exit(failed ? 1 : 2); }
  check("sample documents verify cleanly (no-GST path: only ID + address proof)", k.data.kyc.status === "verified", k.data.kyc);
  o = await call("POST", "/api/orders", { quoteId: qid, businessName: "Sharma Medical", lang: "hi" });
  check("order created", o.status === 200 && o.data.orderId, o.data);
  const { orderId, token } = o.data;
  check("paying before e-sign refused", (await call("POST", `/api/orders/${orderId}/pay`, { t: token, outcome: "success" })).status === 409);
  await call("POST", `/api/orders/${orderId}/test-esign`, { t: token });
  let p = await call("POST", `/api/orders/${orderId}/pay`, { t: token, outcome: "fail" });
  check("payment failure recorded; order not placed", p.data.order.payment.status === "failed" && !p.data.order.stage, p.data.order);
  p = await call("POST", `/api/orders/${orderId}/pay`, { t: token, outcome: "success" });
  check("retry succeeds → order RECEIVED", p.data.order.payment.status === "success" && p.data.order.stage === "RECEIVED", p.data.order);
  check("a timeline message exists in Hindi", p.data.events.some((x: any) => /[ऀ-ॿ]/.test(x.text)));
  check("tracker needs the token (guessing an id is not enough)", (await call("GET", `/api/orders/${orderId}`)).status === 403);
  const opsJar = await ops("OPS1");
  check("customers cannot call ops APIs", (await call("POST", `/api/ops/orders/${orderId}`, { action: "advance" })).status === 401);
  adv = await call("POST", `/api/ops/orders/${orderId}`, { action: "advance" }, { jar: opsJar });
  check("ops advances to KYC_VERIFICATION", adv.data.order.stage === "KYC_VERIFICATION", adv.data);
  for (let i = 0; i < 4; i++) adv = await call("POST", `/api/ops/orders/${orderId}`, { action: "advance" }, { jar: opsJar });
  check("…through to ACTIVATED with every item live", adv.data.order.stage === "ACTIVATED" && adv.data.order.items.every((i: any) => i.status === "live"), adv.data.order?.stage);
  const view = await call("GET", `/api/orders/${orderId}?t=${token}`);
  check("customer tracker reflects ops state", view.data.order.stage === "ACTIVATED" && view.data.events.length >= 6, view.data.events?.length);
  check("an engineer from the roster was booked for installation", !!view.data.order.engineer?.id, view.data.order.engineer);
  const refr = await call("GET", `/api/orders/${orderId}/referral?t=${token}`);
  check("referral link issued only after activation", refr.status === 200 && /^R-[a-z0-9]{8}$/.test(refr.data.code), refr.data);
  const shareQ = await call("POST", `/api/quote/${qid}/share`);
  const shared = await call("GET", `/api/share/${shareQ.data.token}`);
  check("share link shows the live plan with no personal identifiers", shared.status === 200 && shared.data.monthly > 0 && !JSON.stringify(shared.data).match(/98765|GSTIN|token/), shared.data);
  const keep = { ...cookies }; cookies = {};
  await login("9876500077"); // the referred friend is a different, signed-in owner
  const referredAdv = await call("POST", "/api/advisor", { text: "I run a salon in Pune with 2 staff, GST no, need UPI", lang: "en", attribution: { source: "referral", referrer: refr.data.code } });
  const conv = await call("GET", `/api/advisor?id=${referredAdv.data.conversationId}`);
  check("a referred conversation carries the referrer code", conv.data.conversation?.attribution?.referrer === refr.data.code, conv.data.conversation?.attribution);
  cookies = keep;

  }

  // ------------------------------------------------------------------ S2 Dr. Menon (KYC exception → human review)
  section("S2 · Dr. Menon (GST active, name mismatch → human review)");
  await reset("9876500002");
  await call("POST", "/api/session", { lang: "en" });
  a = await call("POST", "/api/advisor", { text: "I run a physiotherapy clinic in Delhi with 5 staff. We have GST. I need work email, security and a backup internet line.", lang: "en", persona: "menon" });
  check("Office Ready recommended", a.data.turn.recommendation.bundleId === "office", a.data.turn.reply);
  q = await call("POST", "/api/quote", { conversationId: a.data.conversationId });
  const q2 = q.data.quote.id;
  check("Office Ready floor price ₹3,716 + backup internet ₹499", q.data.pricing.monthly === 3716 + 499, q.data.pricing.monthly);
  await call("PATCH", `/api/quote/${q2}`, { op: "edit", edit: { type: "add", productId: "P12" } });
  f = await call("POST", "/api/feasibility", { quoteId: q2, sites: [{ index: 0, address: "Shop/Unit 52, Transport Nagar, Delhi", pincode: "334596" }] });
  check("fibre available at this address", f.data.perSite[0].fibre === true);
  await call("POST", "/api/demo/verify", { phone: "9876500002" });
  await call("POST", "/api/consent", { quoteId: q2, purposes: { kyc: true, service: true } });
  k = await call("POST", `/api/kyc/${q2}`, { action: "lookup", gstin: "07CPCXN0398P1ZT", udyam: "UDYAM-DL-00-9565547", siteAddress: "Shop/Unit 52, Transport Nagar, Delhi, Delhi - 334596" });
  check("GSTIN + Udyam verified by registry lookup (no uploads needed yet)", k.data.kyc.gstEligible === true && k.data.kyc.udyamName === "Neelgiri Physio Clinic", k.data.kyc);
  if (!aiLive) skip("S2 document upload → name mismatch → review → approval (needs the reader)");
  else {
  for (const slot of ["gst_certificate", "signatory_id"]) k = await call("POST", `/api/kyc/${q2}`, { action: "specimen", applicant: "K07", slot });
  if (!k.data?.kyc) throw new Error(`document read failed (${k.status}): ${JSON.stringify(k.data).slice(0, 200)} — usually every Gemini vision model is out of free quota; rerun later or use a paid key`);
  check("planted problem caught: name mismatch → review", k.data.kyc.status === "review" && k.data.kyc.checks.some((c: any) => c.code === "NAME_MISMATCH"), k.data.kyc.checks);
  o = await call("POST", "/api/orders", { quoteId: q2, businessName: "Neelgiri Physio Clinic", lang: "en" });
  check("order allowed while review is pending", o.status === 200, o.data);
  await call("POST", `/api/orders/${o.data.orderId}/test-esign`, { t: o.data.token });
  await call("POST", `/api/orders/${o.data.orderId}/pay`, { t: o.data.token, outcome: "success" });
  const o2 = o.data.orderId;
  const ops2 = await ops("OPS1");
  adv = await call("POST", `/api/ops/orders/${o2}`, { action: "advance" }, { jar: ops2 });
  adv = await call("POST", `/api/ops/orders/${o2}`, { action: "advance" }, { jar: ops2 });
  check("activation is blocked while KYC review is pending", adv.data.blocked === "KYC_REVIEW_PENDING", adv.data);
  const queue = await call("GET", "/api/ops/kyc", undefined, { jar: ops2 });
  check("the same case appears in the ops review queue", queue.data.rows.some((r: any) => r.quoteId === q2 && r.needsReview), queue.data);
  check("sales reps cannot review KYC", (await call("GET", "/api/ops/kyc", undefined, { jar: await ops("R01") })).status === 403);
  const caseId = queue.data.rows.find((r: any) => r.quoteId === q2).id;
  const rv = await call("POST", `/api/ops/kyc/${caseId}`, { decision: "approved", note: "Owner confirmed the trade name by phone." }, { jar: ops2 });
  check("reviewer approves; decision recorded", rv.data.kyc.review?.decision === "approved", rv.data);
  adv = await call("POST", `/api/ops/orders/${o2}`, { action: "advance" }, { jar: ops2 });
  check("order moves on after approval", adv.data.order.stage === "FEASIBILITY", adv.data);

  }

  // ------------------------------------------------------------------ S3 Spice Route (multi-site, escalation)
  section("S3 · Spice Route (3 sites, per-site feasibility, assisted)");
  await reset("9876500003");
  await call("POST", "/api/session", { lang: "en" });
  a = await call("POST", "/api/advisor", { text: "We run a restaurant chain in Mumbai with 3 branches and 12 employees. We have GST, need billing and CCTV in every branch and one bill for everything.", lang: "en", persona: "spice" });
  check("One Bill, All Shops + central control", a.data.turn.recommendation.bundleId === "allshops" && a.data.turn.recommendation.lines.some((l: any) => l.productId === "P10"), a.data.turn.reply);
  check("flagged for sales assist and a live lead exists", a.data.turn.recommendation.escalation.level === "assist" && !!a.data.leadId, a.data.leadId);
  q = await call("POST", "/api/quote", { conversationId: a.data.conversationId });
  const q3 = q.data.quote.id;
  // Powai IS an urban post office in the India Post directory, so the real check says fibre is likely there. To test a branch
  // without fibre we use the real mechanism: network planning (ops) marks the pincode as not covered.
  const cov = await call("PUT", "/api/ops/coverage", { pincode: "400078", fibre: false }, { jar: await ops("OPS1") });
  check("ops can mark a pincode as not covered by fibre", cov.status === 200, cov.data);
  f = await call("POST", "/api/feasibility", { quoteId: q3, sites: [
    { index: 0, address: "Shop/Unit 21, Sector 14, Mumbai", pincode: "400001" }, { index: 1, address: "Plot 8, Andheri East, Mumbai", pincode: "400003" }, { index: 2, address: "Unit 3, Powai, Mumbai", pincode: "400078" }] });
  check("only the branch without fibre falls back (site 3)", f.data.perSite.map((s: any) => s.connectivity).join() === "P02,P02,P04", f.data.perSite);
  check("failover is dropped only at the AirFiber branch", f.data.quote.lines.filter((l: any) => l.productId === "P09").map((l: any) => l.siteIndex).join() === "0,1", f.data.quote.lines);
  check("after re-pricing the quote is still rule-valid", f.data.issues.length === 0, f.data.issues);
  const opsJar3 = await ops("R01");
  const leads = await call("GET", "/api/ops/leads?tab=escalated", undefined, { jar: opsJar3 });
  check("lead is visible to its owner in the ops console with a next action", leads.data.rows.length >= 1 && !!leads.data.rows[0].nextAction, leads.data);
  const det = await call("GET", `/api/ops/leads/${a.data.leadId}`, undefined, { jar: opsJar3 });
  check("lead detail has an AI-style summary + transcript + quote", det.data.summary?.length === 4 && det.data.transcript.length >= 2 && !!det.data.quote, det.data.summary);

  // ------------------------------------------------------------------ S4 Vindhya (cancelled GST → live re-quote)
  section("S4 · Vindhya Tours (cancelled GSTIN → live re-quote; blank Udyam number)");
  await reset("9876500004");
  await call("POST", "/api/session", { lang: "en" });
  a = await call("POST", "/api/advisor", { text: "I run a travel agency in Visakhapatnam with 6 staff, 1 office. We have GST. Need email and WhatsApp for customers.", lang: "en", persona: "vindhya" });
  q = await call("POST", "/api/quote", { conversationId: a.data.conversationId });
  const q4 = q.data.quote.id;
  check("before KYC the quote includes WhatsApp (GST declared)", q.data.quote.lines.some((l: any) => l.productId === "P15"));
  await call("POST", "/api/demo/verify", { phone: "9876500004" });
  await call("POST", "/api/consent", { quoteId: q4, purposes: { kyc: true, service: true } });
  k = await call("POST", `/api/kyc/${q4}`, { action: "lookup", gstin: "37IHKXV5167L1ZS" });
  check("registry says GSTIN is Cancelled", k.data.kyc.gstStatus === "Cancelled" && k.data.kyc.gstEligible === false && k.data.kyc.checks.some((c: any) => c.code === "GSTIN_CANCELLED"), k.data.kyc);
  check("quote is now invalid until re-quoted", k.data.quote.issues.length > 0, k.data.quote.issues);
  k = await call("POST", `/api/kyc/${q4}`, { action: "requote" });
  check("re-quote removes only WhatsApp (GST product) and keeps the rest", k.data.removed.length === 1 && k.data.removed[0].productId === "P15" && k.data.quote.issues.length === 0, k.data.removed);
  if (!aiLive) skip("S4 blank Udyam number → re-upload (needs the reader)");
  else { k = await call("POST", `/api/kyc/${q4}`, { action: "specimen", applicant: "K01", slot: "udyam_certificate" });
  check("blank Udyam number → re-upload requested", k.data.kyc.checks.some((c: any) => c.code === "FIELD_MISSING" && c.slot === "udyam_certificate"), k.data.kyc.checks); }

  // ------------------------------------------------------------------ S5 Saffron (blurred) via real upload
  section("S5 · Saffron Dental (blurred GST certificate, real file upload)");
  await reset("9876500005");
  await call("POST", "/api/session", { lang: "en" });
  a = await call("POST", "/api/advisor", { text: "I run a dental clinic in Nagpur with 8 staff. We have GST. I need email, security and billing.", lang: "en", persona: "saffron" });
  q = await call("POST", "/api/quote", { conversationId: a.data.conversationId });
  const q5 = q.data.quote.id;
  await call("POST", "/api/demo/verify", { phone: "9876500005" });
  await call("POST", "/api/consent", { quoteId: q5, purposes: { kyc: true, service: true } });
  const { readFileSync } = await import("node:fs");
  const fd = new FormData();
  fd.set("slot", "gst_certificate");
  fd.set("file", new File([readFileSync("data/kyc_documents/K04_gst_certificate.png")], "gst.png", { type: "image/png" }));
  let up = await fetch(`${BASE}/api/kyc/${q5}/doc`, { method: "POST", body: fd, headers: { cookie: Object.entries(cookies).map(([kk, v]) => `${kk}=${v}`).join("; ") } });
  let ud = await up.json();
  check("blurred upload is flagged DOC_BLURRY from measured sharpness", ud.kyc?.checks?.some((c: any) => c.code === "DOC_BLURRY"), ud);
  if (!aiLive) {
    const fdc = new FormData(); fdc.set("slot", "gst_certificate"); fdc.set("file", new File([readFileSync("data/kyc_documents/K03_gst_certificate.png")], "g.png", { type: "image/png" }));
    const r = await fetch(`${BASE}/api/kyc/${q5}/doc`, { method: "POST", body: fdc, headers: { cookie: Object.entries(cookies).map(([kk, v]) => `${kk}=${v}`).join("; ") } });
    check("a clean document with no reader configured → 503 (not a made-up reading)", r.status === 503);
  } else {
  const fd2 = new FormData();
  fd2.set("slot", "gst_certificate");
  fd2.set("file", new File([readFileSync("data/kyc_documents/K03_gst_certificate.png")], "gst2.png", { type: "image/png" }));
  up = await fetch(`${BASE}/api/kyc/${q5}/doc`, { method: "POST", body: fd2, headers: { cookie: Object.entries(cookies).map(([kk, v]) => `${kk}=${v}`).join("; ") } });
  ud = await up.json();
  check("a clean re-upload clears the blur flag", !ud.kyc.checks.some((c: any) => c.code === "DOC_BLURRY"), ud.kyc.checks);
  }
  const bad = new FormData();
  bad.set("slot", "gst_certificate");
  bad.set("file", new File(["not an image"], "x.txt", { type: "text/plain" }));
  up = await fetch(`${BASE}/api/kyc/${q5}/doc`, { method: "POST", body: bad, headers: { cookie: Object.entries(cookies).map(([kk, v]) => `${kk}=${v}`).join("; ") } });
  check("non-image upload rejected (415)", up.status === 415);

  // ------------------------------------------------------------------ edge cases
  section("Edge cases");
  await reset("9876500006");
  await call("POST", "/api/session", { lang: "en" });
  a = await call("POST", "/api/advisor", { text: "I run a pharmacy in Dehradun, 3 staff, 1 shop, no GST, need billing", lang: "en" });
  check("unsupported city → hard escalation + lead, no quote", a.data.turn.stage === "escalated" && !!a.data.leadId);
  const qq = await call("POST", "/api/quote", { conversationId: a.data.conversationId });
  check("quote cannot be created for an escalated enquiry", qq.status === 409, qq.data);
  check("referral refused for a missing order", (await call("GET", "/api/orders/UD-NOPE00/referral?t=x")).status === 404);
  check("invalid input rejected with 400", (await call("POST", "/api/advisor", { text: "x".repeat(2000), lang: "en" })).status === 400);
  check("mock GSTIN API: bad checksum gets a suggestion", (await call("GET", "/api/mock/gstin/08YKZXS8189L1Z0")).data.suggestion !== undefined);
  check("mock GSTIN API: valid active record returned masked", (await call("GET", "/api/mock/gstin/27PZSXS1936O1ZH")).data.status === "Active");

  console.log(`\n${failed === 0 ? "ALL PASSED" : "FAILURES"} — ${pass} passed, ${failed} failed, ${skipped} skipped${skipped ? " (need GEMINI_API_KEY)" : ""}`);
  process.exit(failed ? 1 : 0);
})();
