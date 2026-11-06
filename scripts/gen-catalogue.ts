// Generates lib/catalogue/catalogue.generated.json from the supplied CSV (source of truth).
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "node:fs";

const rows = parse(readFileSync("data/product_catalogue.csv"), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
const num = (s: string) => Number(s);
const out = rows.map((r) => ({
  id: r.product_id,
  category: r.category,
  csvName: r.product_name,
  description: r.description,
  unit: r.unit,
  priceMin: num(r.price_min_inr_per_month),
  priceMax: num(r.price_max_inr_per_month),
  setup: num(r.one_time_setup_inr),
  minContract: num(r.min_contract_months),
  tiers: r.available_city_tiers.split(";").map(num),
  minEmployees: num(r.min_employees),
  minSites: num(r.min_sites),
  requiresGstin: r.requires_gstin === "Y",
  requiresOneOf: r.requires_one_of ? r.requires_one_of.split("|") : [],
  installDays: num(r.typical_install_days),
  segments: r.target_segments.split(";"),
}));
writeFileSync("lib/catalogue/catalogue.generated.json", JSON.stringify(out, null, 1));
console.log("products:", out.length);
