import "server-only";
import { CATALOGUE, CONNECTIVITY, getProduct } from "@/lib/catalogue";
import { plainBenefit, plainName } from "@/lib/catalogue/plain";
import { bundleName } from "@/lib/i18n/bundles";
import { ruleReason } from "@/lib/i18n/reasons";
import { estimateSchedule, priceLines } from "@/lib/rules/pricing";
import { KNOWN_CITIES } from "@/lib/rules/normalise";
import { eligibility } from "@/lib/rules/eligibility";
import { DECLINABLE, recommend } from "@/lib/rules/recommend";
import type { Need } from "@/lib/rules/types";
import { ADDRESS_PROOF_MAX_DAYS, GST_RATE } from "@/lib/config";
import type { BusinessProfile } from "@/lib/rules/types";
import type { Recommendation } from "@/lib/rules/types";

/**
 * Everything the advisor may say when answering a free-form question, assembled by CODE from the catalogue, the rules engine and the
 * app's real journey. The LLM reads this; it is not allowed to add to it (see llmAnswer's faithfulness gate).
 */
const JOURNEY = [
  "Exploring and getting a recommendation needs no login. Your phone number is verified with a one-time SMS code only when you save a quote, ask for a callback or order.",
  "Steps to buy: customise the quote → check each location (fibre or AirFiber) → give consent → KYC → sign the order form with an SMS code → pay → track installation.",
  "KYC: GSTIN and Udyam numbers are checked against the registry first; then only the missing documents are asked for — GST certificate, Udyam certificate, address proof and the signatory's ID. You can also fetch documents from DigiLocker if you allow it.",
  `Address proof must be no older than ${ADDRESS_PROOF_MAX_DAYS} days.`,
  "Products marked as needing a GST number need a valid and Active GSTIN; without one they are left out and everything else still works.",
  `Prices shown are monthly, before GST at ${GST_RATE * 100}%. Today you pay the first month plus the one-time setup, both with GST.`,
  "Payment is online (UPI, cards, netbanking, wallets).",
  "After payment, the live tracker shows each stage — order received, KYC verification, technical feasibility, installation scheduled, installation, activated — and you pick your installation slot there. Updates also come on WhatsApp or Telegram.",
  "If fibre does not reach a location, AirFiber (wireless broadband) is used instead, and products that cannot run on it are explained.",
  "Your documents are used only to verify the business for this order. You can withdraw optional consents or ask for deletion from your account.",
  "Plans with many locations, a dedicated leased line or very large teams get a specialist; you can also type 'human' at any time.",
];

function eligibilityText(id: string): string {
  const p = getProduct(id as never);
  const parts: string[] = [];
  if (p.tiers.length && p.tiers.length < 2) parts.push(`only in tier-${p.tiers.join("/")} cities`);
  if (p.minEmployees > 1) parts.push(`for teams of ${p.minEmployees}+ people`);
  if (p.minSites > 1) parts.push(`for ${p.minSites}+ locations`);
  if (p.requiresGstin) parts.push("needs an Active GSTIN");
  if (p.requiresOneOf.length) parts.push(`works on: ${p.requiresOneOf.map((x) => plainName(x, "en")).join(" / ")}`);
  return parts.join("; ") || "available to every business";
}

export function knowledgeContext(profile: BusinessProfile | undefined, rec: Recommendation | undefined) {
  const plan = rec?.lines.length ? (() => {
    const pr = priceLines(rec.lines), sc = estimateSchedule(rec.lines);
    return {
      name: bundleName(rec.bundleId, "en"), monthlyBeforeGst: pr.monthly, gstMonthly: pr.gstMonthly, setup: pr.setup, gstOnSetup: pr.gstSetup, payToday: pr.firstPayment,
      contractMonths: pr.contractMonths, goLiveEstimate: sc.date, totalInstallWorkingDays: sc.days,
      items: pr.lines.map((l, i) => ({ item: plainName(l.productId, "en"), what: plainBenefit(l.productId, "en"), qty: l.qty, location: l.siteIndex == null ? "account" : `location ${l.siteIndex + 1}`, monthly: l.monthly, setup: l.setup, readyInWorkingDays: sc.items[i]?.days })),
      why: rec.why.map((w) => ruleReason(w, "en")),
      notIncluded: rec.exclusions.map((e) => `${plainName(e.productId, "en")}: ${ruleReason({ code: e.code, params: e.params, productId: e.productId }, "en")}`),
      notes: rec.notices.map((n) => ruleReason(n, "en")),
      optionalAddOns: rec.addons.map((id) => plainName(id, "en")),
      lighterOrFuller: rec.alternatives.map((a) => ({ option: a.id, monthly: a.monthly, setup: a.setup })),
      budget: rec.budget ? { target: rec.budget.target, met: rec.budget.met, cheapestPossible: rec.budget.minPossible } : undefined,
      // What-ifs computed by the rules engine (not by the model): the plan re-run without each removable feature it contains.
      ifRemoved: profile ? (Object.entries(DECLINABLE) as [Need, string[]][])
        .filter(([, ids]) => rec.lines.some((l) => ids.includes(l.productId)))
        .map(([need, ids]) => {
          const alt = recommend({ ...profile, declined: [...(profile.declined ?? []), need], needs: profile.needs.filter((n) => n !== need) });
          const ap = priceLines(alt.lines);
          return { remove: ids.map((id) => plainName(id, "en")).join(" + "), newMonthlyBeforeGst: ap.monthly, monthlySaving: pr.monthly - ap.monthly, newSetup: ap.setup };
        }) : [],
    };
  })() : null;
  const catalogue = CATALOGUE.map((p) => ({
    item: plainName(p.id, "en"), what: plainBenefit(p.id, "en"), kind: CONNECTIVITY.includes(p.id) ? "connectivity" : p.category,
    priceMonthly: p.priceMin === p.priceMax ? p.priceMin : `${p.priceMin}–${p.priceMax}`, per: p.unit, setup: p.setup, minContractMonths: p.minContract,
    installWorkingDays: p.installDays, eligibility: eligibilityText(p.id),
    ...(profile ? { availableToThisBusiness: eligibility(p.id, profile).ok } : {}),
  }));
  return {
    business: profile ? { type: profile.businessType, people: profile.employees, locations: profile.sites, city: profile.city, hasGst: profile.gstin.has } : null,
    currentPlan: plan,
    catalogue,
    citiesServed: KNOWN_CITIES,
    howItWorks: JOURNEY,
  };
}
