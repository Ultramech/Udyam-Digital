/**
 * Reserve-now, pay-the-rest-before-go-live. Pure arithmetic shared by the server (authoritative) and the checkout screen (display).
 * Policy knobs are environment-driven so Accel Business can change them without a code change:
 *   NEXT_PUBLIC_DEPOSIT_PERCENT  share of the first payment taken up front (default 20)
 *   NEXT_PUBLIC_DEPOSIT_MIN      smallest reservation in rupees (default 500)
 *   NEXT_PUBLIC_DEPOSIT_OFFER_FROM  smallest first payment for which the option is offered (default 2000)
 * The balance is always `firstPayment - deposit` — nothing is added or discounted.
 */
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
export const depositPolicy = () => ({
  percent: Math.min(90, num(process.env.NEXT_PUBLIC_DEPOSIT_PERCENT, 20)),
  min: num(process.env.NEXT_PUBLIC_DEPOSIT_MIN, 500),
  offerFrom: num(process.env.NEXT_PUBLIC_DEPOSIT_OFFER_FROM, 2000),
});

export interface DepositSplit { offered: boolean; deposit: number; balance: number; total: number }
export function splitFirstPayment(firstPayment: number): DepositSplit {
  const p = depositPolicy();
  const total = Math.round(firstPayment);
  if (total < p.offerFrom) return { offered: false, deposit: total, balance: 0, total };
  const deposit = Math.min(total - 1, Math.max(p.min, Math.round((total * p.percent) / 100)));
  return { offered: true, deposit, balance: total - deposit, total };
}
