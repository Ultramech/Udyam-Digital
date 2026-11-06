/**
 * Trains an explainable logistic regression: P(churned within 6 months | facts known at activation).
 * Activated customers only (n≈368). Reports 5-fold cross-validated AUC — a single 20% test split would hold ~10 churners.
 * Writes lib/leads/churn_model.json.
 */
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "node:fs";
import { CHURN_FEATURES, churnVector, type ChurnRow } from "../lib/leads/churnFeatures";

type Row = ChurnRow & { outcome: string; churned_within_6_months: string };
const rows = (parse(readFileSync("data/smb_leads.csv"), { columns: true }) as Row[]).filter((r) => r.outcome === "Activated");
const X = rows.map((r) => churnVector(r));
const y: number[] = rows.map((r) => (r.churned_within_6_months === "Y" ? 1 : 0));
const d = CHURN_FEATURES.length;
const sig = (z: number) => 1 / (1 + Math.exp(-z));

function fit(idx: number[]) {
  const mean = Array(d).fill(0), sd = Array(d).fill(0);
  for (const i of idx) for (let j = 0; j < d; j++) mean[j] += X[i][j] / idx.length;
  for (const i of idx) for (let j = 0; j < d; j++) sd[j] += (X[i][j] - mean[j]) ** 2 / idx.length;
  for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  const z = (x: number[]) => x.map((v, j) => (v - mean[j]) / sd[j]);
  const pos = idx.filter((i) => y[i]).length, wPos = (idx.length - pos) / Math.max(1, pos);
  const w = Array(d).fill(0); let b = 0;
  for (let epoch = 0; epoch < 800; epoch++) {
    const gw = Array(d).fill(0); let gb = 0, ws = 0;
    for (const i of idx) {
      const zi = z(X[i]); const p = sig(zi.reduce((s, v, j) => s + v * w[j], b)); const wt = y[i] ? wPos : 1; const e = (p - y[i]) * wt;
      for (let j = 0; j < d; j++) gw[j] += e * zi[j]; gb += e; ws += wt;
    }
    for (let j = 0; j < d; j++) w[j] -= 0.2 * (gw[j] / ws + 0.01 * w[j]); // stronger L2: small sample
    b -= 0.2 * (gb / ws);
  }
  return { mean, sd, w, b, score: (i: number) => sig(z(X[i]).reduce((s, v, j) => s + v * w[j], b)) };
}
function auc(idx: number[], score: (i: number) => number) {
  const P = idx.filter((i) => y[i]).map(score), N = idx.filter((i) => !y[i]).map(score);
  let wins = 0; for (const p of P) for (const n of N) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / Math.max(1, P.length * N.length);
}
const all = rows.map((_, i) => i);
const K = 5, oof: number[] = Array(rows.length).fill(0);
for (let k = 0; k < K; k++) {
  const test = all.filter((i) => i % K === k), m = fit(all.filter((i) => i % K !== k));
  for (const i of test) oof[i] = m.score(i);
}
const cvAuc = auc(all, (i) => oof[i]);
const final = fit(all);
const base = y.reduce((s, v) => s + v, 0) / y.length;
const ranked = [...all].sort((a, c) => oof[c] - oof[a]);
const topQ = ranked.slice(0, Math.ceil(ranked.length / 4));
const liftTopQuartile = topQ.filter((i) => y[i]).length / topQ.length / base;
const model = {
  note: "Trained on the supplied synthetic activated customers; features known at activation only (no NPS, no outcome). Correlation, not causation. Illustrative, not production-calibrated.",
  n: rows.length, churners: y.reduce((s, v) => s + v, 0), baseRate: +base.toFixed(3), aucCv5: +cvAuc.toFixed(3), liftTopQuartile: +liftTopQuartile.toFixed(2),
  features: CHURN_FEATURES, mean: final.mean, sd: final.sd, weights: final.w, intercept: final.b,
};
writeFileSync("lib/leads/churn_model.json", JSON.stringify(model, null, 1));
console.log(`n=${model.n} churners=${model.churners} base=${model.baseRate} · 5-fold CV AUC ${model.aucCv5} · top-quartile lift ${model.liftTopQuartile}x`);
console.log(CHURN_FEATURES.map((n, j) => [n, final.w[j]] as const).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 8).map(([n, v]) => `${n}:${v.toFixed(2)}`).join("  "));
