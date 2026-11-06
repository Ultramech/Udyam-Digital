/** Trains an explainable logistic regression: P(activated | lead-time features). Writes lib/leads/propensity_model.json. */
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "node:fs";
import { FEATURE_NAMES, featureVector, type LeadRow } from "../lib/leads/features";

type Row = LeadRow & { outcome: string };
const rows = parse(readFileSync("data/smb_leads.csv"), { columns: true }) as Row[];
const X = rows.map((r) => featureVector(r));
const y = rows.map((r) => (r.outcome === "Activated" ? 1 : 0));
const d = FEATURE_NAMES.length;

const isTest = (i: number) => i % 5 === 0; // deterministic 80/20 split
const trainIdx = rows.map((_, i) => i).filter((i) => !isTest(i));
const testIdx = rows.map((_, i) => i).filter(isTest);

const mean = Array(d).fill(0), sd = Array(d).fill(0);
for (const i of trainIdx) for (let j = 0; j < d; j++) mean[j] += X[i][j] / trainIdx.length;
for (const i of trainIdx) for (let j = 0; j < d; j++) sd[j] += (X[i][j] - mean[j]) ** 2 / trainIdx.length;
for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1;
const Z = X.map((x) => x.map((v, j) => (v - mean[j]) / sd[j]));

const pos = trainIdx.filter((i) => y[i]).length;
const wPos = (trainIdx.length - pos) / pos; // balance the 7% positive class
const w = Array(d).fill(0); let b = 0;
const sig = (z: number) => 1 / (1 + Math.exp(-z));
for (let epoch = 0; epoch < 600; epoch++) {
  const gw = Array(d).fill(0); let gb = 0, wsum = 0;
  for (const i of trainIdx) {
    const p = sig(Z[i].reduce((s, v, j) => s + v * w[j], b));
    const wt = y[i] ? wPos : 1;
    const e = (p - y[i]) * wt;
    for (let j = 0; j < d; j++) gw[j] += e * Z[i][j];
    gb += e; wsum += wt;
  }
  for (let j = 0; j < d; j++) w[j] -= 0.3 * (gw[j] / wsum + 0.01 * w[j]);
  b -= 0.3 * (gb / wsum);
}

const score = (i: number) => sig(Z[i].reduce((s, v, j) => s + v * w[j], b));
function auc(idx: number[]) {
  const P = idx.filter((i) => y[i]).map(score), N = idx.filter((i) => !y[i]).map(score);
  let wins = 0;
  for (const p of P) for (const n of N) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (P.length * N.length);
}
const ranked = [...testIdx].sort((a, c) => score(c) - score(a));
const top = ranked.slice(0, Math.ceil(ranked.length * 0.1));
const base = testIdx.filter((i) => y[i]).length / testIdx.length;
const lift = top.filter((i) => y[i]).length / top.length / base;

const model = {
  note: "Trained on the supplied synthetic leads (lead-time features only, no leakage). Illustrative, not production-calibrated.",
  n: rows.length, trainN: trainIdx.length, testN: testIdx.length,
  aucTrain: +auc(trainIdx).toFixed(3), aucTest: +auc(testIdx).toFixed(3), liftTopDecile: +lift.toFixed(2), baseRate: +base.toFixed(3),
  features: FEATURE_NAMES, mean, sd, weights: w, intercept: b,
};
writeFileSync("lib/leads/propensity_model.json", JSON.stringify(model, null, 1));
console.log(`AUC train ${model.aucTrain} · TEST ${model.aucTest} · top-decile lift ${model.liftTopDecile}x (base rate ${model.baseRate})`);
const top3 = FEATURE_NAMES.map((n, j) => [n, w[j]] as const).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 8);
console.log(top3.map(([n, v]) => `${n}:${v.toFixed(2)}`).join("  "));
