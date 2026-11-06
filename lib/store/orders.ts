import "server-only";
import { get, list, newId, newToken, put, putIfAbsent, update } from "@/lib/db/store";
import { addBusinessDays, estimateSchedule, priceLines } from "@/lib/rules/pricing";
import { REFERENCE_DATE } from "@/lib/config";
import { CONNECTIVITY, isDependent } from "@/lib/catalogue";
import { plainName, type Lang } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { bookSlot } from "@/lib/scheduling";
import { notifyOrderEvent } from "@/lib/channels/notify";
import type { ItemStatus, KycCase, Lead, Order, OrderEvent, OrderItem, Quote, Stage } from "./types";
import { STAGES } from "./types";

const hi = (l: string) => l === "hi" || l === "mr";
const dm = (d: string, lang: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(hi(lang) ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Demo timeline: stage dates are scheduled from the dataset's reference date so the story is internally consistent. */
function stageDates(businessDays: number, goLive: string): Record<Stage, string> {
  const at = (n: number) => addBusinessDays(REFERENCE_DATE, Math.min(n, Math.max(1, businessDays)));
  return {
    RECEIVED: REFERENCE_DATE,
    KYC_VERIFICATION: at(1),
    FEASIBILITY: at(2),
    INSTALL_SCHEDULED: at(3),
    INSTALL_IN_PROGRESS: at(Math.max(3, businessDays - 1)),
    ACTIVATED: goLive,
  };
}

export function stageText(stage: Stage, order: Pick<Order, "lang" | "bundleId" | "goLive" | "businessName">): string {
  const l = order.lang;
  const bn = bundleName(order.bundleId, l as Lang);
  const eta = dm(order.goLive, l);
  const T: Record<Stage, [string, string]> = {
    RECEIVED: [`Thank you! We've received your order for ${bn}. Expected to go live by ${eta}.`, `धन्यवाद! हमें ${bn} का आपका ऑर्डर मिल गया है। ${eta} तक चालू होने की उम्मीद है।`],
    KYC_VERIFICATION: ["We're verifying your business documents. Nothing more is needed from you right now.", "हम आपके बिज़नेस दस्तावेज़ों की जाँच कर रहे हैं। अभी आपसे कुछ और नहीं चाहिए।"],
    FEASIBILITY: ["Your documents are verified. Our team is confirming the technical setup at your location.", "आपके दस्तावेज़ वेरिफाई हो गए हैं। हमारी टीम आपकी लोकेशन पर तकनीकी सेटअप पक्का कर रही है।"],
    INSTALL_SCHEDULED: ["Installation is scheduled. An engineer has been assigned — see your slot in the tracker.", "इंस्टॉलेशन तय हो गया है। इंजीनियर नियुक्त है — ट्रैकर में अपना स्लॉट देखें।"],
    INSTALL_IN_PROGRESS: ["Our engineer is installing your services now.", "हमारा इंजीनियर अभी आपकी सेवाएँ इंस्टॉल कर रहा है।"],
    ACTIVATED: [`🎉 You're live! Everything in ${bn} is active. Add more services any time from your account.`, `🎉 आप चालू हैं! ${bn} की सभी सेवाएँ चालू हैं। अपने अकाउंट से कभी भी और सेवाएँ जोड़ें।`],
  };
  return T[stage][hi(l) ? 1 : 0];
}

export async function addEvent(orderId: string, type: OrderEvent["type"], text: string, at?: string) {
  const e: OrderEvent = { id: newId("EV"), orderId, at: at ?? REFERENCE_DATE, type, text };
  await put("event", e.id, e);
  notifyOrderEvent(e);
  return e;
}
export async function eventsFor(orderId: string): Promise<OrderEvent[]> {
  return (await list<OrderEvent>("event", { limit: 2000, newestFirst: false })).filter((e) => e.orderId === orderId);
}


export function deriveItems(order: Pick<Order, "lines" | "stage" | "stageDates">, base?: OrderItem[]): OrderItem[] {
  const sched = estimateSchedule(order.lines);
  const idx = order.stage ? STAGES.indexOf(order.stage) : -1;
  return order.lines.map((l, i) => {
    const eta = sched.items[i];
    const carrier = CONNECTIVITY.includes(l.productId);
    let status: ItemStatus = "waiting";
    if (idx >= STAGES.indexOf("INSTALL_SCHEDULED")) status = "scheduled";
    if (idx >= STAGES.indexOf("INSTALL_IN_PROGRESS")) status = carrier || !isDependent(l.productId) ? "in_progress" : "scheduled";
    if (idx >= STAGES.indexOf("ACTIVATED")) status = "live";
    return { productId: l.productId, siteIndex: l.siteIndex, qty: l.qty, status: base?.[i]?.status === "live" ? "live" : status, etaDate: eta.date };
  });
}

export async function createOrder(quote: Quote, kyc: KycCase | null, opts: { businessName: string; phone?: string; lang: string; leadId?: string }): Promise<Order> {
  const price = priceLines(quote.lines);
  const sched = estimateSchedule(quote.lines);
  const stageD = stageDates(sched.days, sched.date);
  const order: Order = {
    id: newId("UD"), quoteId: quote.id, token: newToken(), createdAt: Date.now(), businessName: opts.businessName, phone: opts.phone, lang: opts.lang,
    profile: quote.profile, bundleId: quote.bundleId, lines: quote.lines, sites: quote.sites,
    totals: { monthly: price.monthly, setup: price.setup, gstMonthly: price.gstMonthly, gstSetup: price.gstSetup, firstPayment: price.firstPayment, contractMonths: price.contractMonths },
    payment: { status: "awaiting", attempts: 0, method: "upi" },
    kycId: kyc?.id, kycStatus: "pending", stageHistory: [], stageDates: stageD, items: [], goLive: sched.date,
    chases: 0, attribution: quote.attribution, leadId: opts.leadId, consentId: quote.consentId,
  };
  order.items = deriveItems(order);
  await put("order", order.id, order);
  return order;
}

export const getOrder = (id: string) => get<Order>("order", id);

export async function pay(id: string, outcome: "success" | "fail" | "pending"): Promise<Order | null> {
  const o = await getOrder(id);
  if (!o) return null;
  o.payment.attempts++;
  if (outcome === "fail") {
    o.payment.status = "failed";
    await addEvent(o.id, "payment", o.lang === "hi" ? "भुगतान नहीं हो पाया। कृपया दोबारा कोशिश करें — आपका प्लान सेव है।" : "Payment didn't go through. Please try again — your plan is saved.");
  } else if (outcome === "pending") {
    o.payment.status = "processing";
    await addEvent(o.id, "payment", o.lang === "hi" ? "भुगतान की पुष्टि का इंतज़ार है।" : "Waiting for your bank to confirm the payment.");
  } else {
    o.payment.status = "success";
    if (!o.stage) {
      o.stage = "RECEIVED";
      o.stageChangedAt = Date.now();
      o.stageHistory.push({ stage: "RECEIVED", at: o.stageDates.RECEIVED });
      const got = o.payment.paid ?? o.totals.firstPayment, bal = o.payment.balance?.amount ?? 0, inrs = (n: number) => `₹${n.toLocaleString("en-IN")}`;
      await addEvent(o.id, "payment", o.lang === "hi"
        ? (bal ? `आरक्षण राशि ${inrs(got)} मिल गई। बाकी ${inrs(bal)} सेवा चालू होने से पहले देना होगा।` : `भुगतान मिल गया — ${inrs(got)}।`)
        : (bal ? `Reservation of ${inrs(got)} received. The remaining ${inrs(bal)} is due before your services go live.` : `Payment received — ${inrs(got)}.`));
      await addEvent(o.id, "stage", stageText("RECEIVED", o), o.stageDates.RECEIVED);
    }
  }
  o.items = deriveItems(o, o.items);
  await put("order", o.id, o);
  return o;
}

export async function recordSignature(id: string, esign: NonNullable<Order["esign"]>) {
  const o = await update<Order>("order", id, (cur) => ({ ...cur, esign }));
  if (o) await addEvent(id, "action", o.lang === "hi" ? "ऑर्डर फ़ॉर्म पर OTP से साइन हो गया।" : "Order form signed with your one-time code.");
  return o;
}

/** Moves to the next stage if preconditions hold; otherwise returns why not (shown to ops and as an action card to the owner). */
export async function advance(id: string, force = false): Promise<{ order: Order | null; blocked?: string }> {
  const o = await getOrder(id);
  if (!o) return { order: null };
  if (o.cancelled) return { order: o, blocked: "ORDER_CANCELLED" };
  if (!o.stage) return { order: o, blocked: "PAYMENT_PENDING" };
  const i = STAGES.indexOf(o.stage);
  if (i >= STAGES.length - 1) return { order: o, blocked: "ALREADY_ACTIVE" };
  const next = STAGES[i + 1];
  if (o.stage === "KYC_VERIFICATION" && !force && !(o.kycStatus === "verified" || o.kycStatus === "approved")) {
    const reason = o.kycStatus === "review" ? "KYC_REVIEW_PENDING" : "KYC_ACTION_NEEDED";
    o.actionNeeded = { code: reason };
    await put("order", o.id, o);
    return { order: o, blocked: reason };
  }
  if (next === "ACTIVATED" && o.payment.balance?.status === "due" && !force) {
    o.actionNeeded = { code: "BALANCE_DUE", params: { amount: o.payment.balance.amount } };
    await put("order", o.id, o);
    return { order: o, blocked: "BALANCE_PENDING" };
  }
  if (next === "INSTALL_SCHEDULED" && !o.engineer) {
    const b = await bookSlot(o); // the customer may already have picked a slot; otherwise take the earliest free one
    if (!b) { o.actionNeeded = { code: "NO_ENGINEER_AVAILABLE" }; await put("order", o.id, o); return { order: o, blocked: "NO_ENGINEER_AVAILABLE" }; }
    o.engineer = { ...b, slot: `${dm(b.date!, o.lang)}, ${b.window}` };
  }
  o.stage = next;
  o.stageChangedAt = Date.now();
  o.actionNeeded = undefined;
  o.delayed = undefined;
  const at = o.stageDates[next];
  o.stageHistory.push({ stage: next, at });
  o.items = deriveItems(o, o.items);
  const askBalance = next === "INSTALL_IN_PROGRESS" && o.payment.balance?.status === "due";
  if (askBalance) o.actionNeeded = { code: "BALANCE_DUE", params: { amount: o.payment.balance!.amount } };
  await put("order", o.id, o);
  await addEvent(o.id, "stage", stageText(next, o), at);
  if (askBalance) await addEvent(o.id, "action", o.lang === "hi" ? `सेवा चालू करने के लिए बाकी ₹${o.payment.balance!.amount.toLocaleString("en-IN")} ट्रैकर में चुकाएँ।` : `Please pay the remaining ₹${o.payment.balance!.amount.toLocaleString("en-IN")} in your tracker so we can switch your services on.`);
  return { order: o };
}

export async function setDelay(id: string, reason: string): Promise<Order | null> {
  const o = await getOrder(id);
  if (!o || !o.stage) return o;
  const newEta = addBusinessDays(o.goLive, 3);
  o.delayed = { reason, newEta };
  o.goLive = newEta;
  await put("order", o.id, o);
  await addEvent(o.id, "delay", o.lang === "hi" ? `हमें अफ़सोस है — ${reason}। नया अनुमानित दिन: ${dm(newEta, o.lang)}। आपको कॉल करने की ज़रूरत नहीं।` : `Sorry — ${reason}. New expected date: ${dm(newEta, o.lang)}. There's no need for you to call us.`);
  return o;
}

export async function chase(id: string): Promise<Order | null> {
  const o = await update<Order>("order", id, (x) => ({ ...x, chases: x.chases + 1 }));
  if (o) await addEvent(o.id, "chase", o.lang === "hi" ? "आपने कॉलबैक माँगा — हमारी टीम जल्द संपर्क करेगी।" : "You asked for a callback — our team will contact you shortly.");
  return o;
}

export async function setKycStatus(id: string, status: Order["kycStatus"], text?: string) {
  const o = await update<Order>("order", id, (x) => ({ ...x, kycStatus: status, actionNeeded: status === "reupload" ? { code: "KYC_ACTION_NEEDED" } : status === "verified" || status === "approved" ? undefined : x.actionNeeded }));
  if (o && text) await addEvent(o.id, "kyc", text);
  return o;
}

export async function recordLeadConversion(lead: Lead | null, orderId: string) {
  if (!lead) return;
  await update<Lead>("lead", lead.id, (l) => ({
    ...l, orderId, status: "converted",
    // credit goes to whoever actually assisted (co-pilot), else the lead's owner
    assistCredit: (l.attribution?.repId ?? l.ownerId) ? { to: (l.attribution?.repId ?? l.ownerId)!, kind: (l.attribution?.repId ?? l.ownerId)!.startsWith("P") ? "partner" : "rep" } : l.assistCredit,
  }));
}

export const itemName = (productId: string, lang: string) => plainName(productId, lang as Lang);


/** The balance of a reserve-now order has been paid (signature + amount already verified by the route). */
export async function markBalancePaid(id: string, razorpayPaymentId: string): Promise<Order | null> {
  const o = await update<Order>("order", id, (x) => {
    if (!x.payment.balance || x.payment.balance.status === "paid") return x;
    const paid = (x.payment.paid ?? 0) + x.payment.balance.amount;
    return { ...x, actionNeeded: x.actionNeeded?.code === "BALANCE_DUE" ? undefined : x.actionNeeded, payment: { ...x.payment, paid, balance: { ...x.payment.balance, status: "paid", razorpayPaymentId, paidAt: Date.now() } } };
  });
  if (o?.payment.balance?.status === "paid") await addEvent(o.id, "payment", o.lang === "hi" ? `बाकी राशि ₹${o.payment.balance.amount.toLocaleString("en-IN")} मिल गई — धन्यवाद।` : `Balance of ₹${o.payment.balance.amount.toLocaleString("en-IN")} received — thank you.`);
  return o;
}

/** Ops marks the engineer as leaving for the visit; the owner is told straight away (WhatsApp / Telegram when linked). */
export async function markEnRoute(id: string): Promise<{ order: Order | null; blocked?: string }> {
  const o = await getOrder(id);
  if (!o) return { order: null };
  if (!o.engineer || (o.stage !== "INSTALL_SCHEDULED" && o.stage !== "INSTALL_IN_PROGRESS")) return { order: o, blocked: "NO_VISIT_TO_START" };
  if (o.engineer.enRoute) return { order: o, blocked: "ALREADY_EN_ROUTE" };
  o.engineer = { ...o.engineer, enRoute: { at: Date.now() } };
  await put("order", o.id, o);
  await addEvent(o.id, "visit", o.lang === "hi" ? `${o.engineer.name} आपकी साइट के लिए निकल चुके हैं (${o.engineer.window ?? "तय समय"})। कृपया कोई मौजूद रहे।` : `${o.engineer.name} is on the way to your site (${o.engineer.window ?? "your slot"}). Please make sure someone is there.`);
  return { order: o };
}

// ---- cancellation ---------------------------------------------------------------------------------
/** An owner can cancel until the engineer starts installing. After that it's a service change handled by a person. */
export function cancellable(o: Pick<Order, "stage" | "cancelled">): { ok: true } | { ok: false; code: "ALREADY_CANCELLED" | "TOO_LATE_TO_CANCEL" } {
  if (o.cancelled) return { ok: false, code: "ALREADY_CANCELLED" };
  if (o.stage === "INSTALL_IN_PROGRESS" || o.stage === "ACTIVATED") return { ok: false, code: "TOO_LATE_TO_CANCEL" };
  return { ok: true };
}

/**
 * Cancels the order, frees the engineer slot and refunds every captured payment through Razorpay (test mode here).
 * The refund outcome is recorded honestly: if Razorpay refuses, status is "failed" and ops see it — we never claim a refund we didn't make.
 */
export async function cancelOrder(id: string, by: string, reason: string): Promise<{ order: Order | null; blocked?: string }> {
  const o = await getOrder(id);
  if (!o) return { order: null };
  const c = cancellable(o);
  if (!c.ok) return { order: o, blocked: c.code };
  // one cancellation per order, even under concurrent requests: the unique key is the lock (refunds must never run twice)
  if (!(await putIfAbsent("analytics", `cancel-lock:${o.id}`, { at: Date.now() }))) return { order: o, blocked: "ALREADY_CANCELLED" };
  const { refundRazorpayPayment, razorpayEnabled } = await import("@/lib/services/razorpay");
  const { releaseSlot } = await import("@/lib/scheduling");
  const paid: { id: string; amount: number }[] = [];
  if (o.payment.status === "success" && o.payment.razorpayPaymentId) paid.push({ id: o.payment.razorpayPaymentId, amount: o.payment.paid ?? o.totals.firstPayment });
  if (o.payment.balance?.status === "paid" && o.payment.balance.razorpayPaymentId) paid.push({ id: o.payment.balance.razorpayPaymentId, amount: o.payment.balance.amount });
  const ids: string[] = [];
  let failed = false;
  for (const p of paid) {
    const r = razorpayEnabled() ? await refundRazorpayPayment(p.id, `cancel-${o.id}`).catch(() => null) : null;
    if (r) ids.push(r.id); else failed = true;
  }
  const amount = paid.reduce((s, p) => s + p.amount, 0);
  await releaseSlot(o);
  o.cancelled = { at: Date.now(), by, reason, refund: { status: !paid.length ? "not_needed" : failed ? "failed" : "initiated", amount, razorpayRefundIds: ids } };
  o.actionNeeded = undefined;
  o.engineer = undefined;
  await put("order", o.id, o);
  const rs = `₹${amount.toLocaleString("en-IN")}`;
  await addEvent(o.id, "stage", hi(o.lang)
    ? `ऑर्डर रद्द किया गया।${paid.length ? (failed ? ` ${rs} की वापसी हमारी टीम मैन्युअली करेगी।` : ` ${rs} की वापसी शुरू हो गई है (5–7 कामकाजी दिन)।`) : ""}`
    : `Order cancelled.${paid.length ? (failed ? ` Our team will refund ${rs} manually.` : ` A refund of ${rs} has been started (5–7 working days).`) : ""}`);
  return { order: o };
}
