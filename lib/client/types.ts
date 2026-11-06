import type { Priced } from "@/lib/rules/pricing";
import type { PackageOption } from "@/lib/rules/packages";
import type { Maturity } from "@/lib/maturity/score";
import type { CatalogueState } from "@/lib/rules/quote";
import type { BudgetResult, Counterfactual, Escalation, Exclusion, Recommendation, Ref } from "@/lib/rules/types";
import type { Quote } from "@/lib/store/types";

/** Shape returned by every quote endpoint (see lib/store/quotes.ts quoteView). */
export interface QuoteView {
  quote: Quote;
  pricing: Priced;
  schedule: { days: number; date: string; items: { productId: string; siteIndex: number | null; days: number; date: string }[] };
  issues: (Ref & { productId: string; siteIndex: number | null })[];
  catalogue: CatalogueState[];
  segment: string;
  escalation: Escalation;
  exclusions: Exclusion[];
  counterfactuals: Counterfactual[];
  why: Ref[];
  alternatives: Recommendation["alternatives"];
  budget?: BudgetResult;
  packages: PackageOption[];
  maturity: Maturity;
  notices?: Ref[];
  blocked?: (Ref & { productId?: string }) | null;
}
