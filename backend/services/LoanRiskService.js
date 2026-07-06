/**
 * LoanRiskService — Farmer collateral-loan interest rate & LTV generation.
 *
 * Demo-stage risk model (no external bank data yet): the pledged token
 * quantity is used as a proxy for risk. More collateral → lower risk →
 * lower interest rate and a higher allowed LTV.
 *
 * generateLoanTerms() is the single source of truth called once, at loan
 * creation, by financeController.createCollateralLoan. The result is
 * persisted to collateral_loans.interest_rate / collateral_loans.ltv and
 * must never be recomputed afterwards — every later calculation for that
 * loan (repayment, monthly payment, etc.) reuses the stored values.
 *
 * Mirrors frontend/src/utils/loanRisk.js (which only produces a
 * deterministic pre-submit preview) — keep the band thresholds in sync.
 */

const LOAN_RISK_BANDS = [
  { qtyMin: 0,    qtyMax: 500,  interestMin: 0.072, interestMax: 0.075, ltvMin: 0.70, ltvMax: 0.72 },
  { qtyMin: 500,  qtyMax: 1500, interestMin: 0.06,  interestMax: 0.07,  ltvMin: 0.72, ltvMax: 0.75 },
  { qtyMin: 1500, qtyMax: 3000, interestMin: 0.05,  interestMax: 0.06,  ltvMin: 0.75, ltvMax: 0.78 },
  { qtyMin: 3000, qtyMax: 6000, interestMin: 0.045, interestMax: 0.05,  ltvMin: 0.78, ltvMax: 0.80 },
];

function pickBand(qty) {
  const q = Number(qty) || 0;
  if (q < 500) return LOAN_RISK_BANDS[0];
  if (q < 1500) return LOAN_RISK_BANDS[1];
  if (q < 3000) return LOAN_RISK_BANDS[2];
  return LOAN_RISK_BANDS[3];
}

function bandProgress(qty, band) {
  const span = band.qtyMax - band.qtyMin;
  if (span <= 0) return 1;
  const q = Number(qty) || 0;
  return Math.min(1, Math.max(0, (q - band.qtyMin) / span));
}

/**
 * Generate the interest rate and LTV for a new collateral loan.
 * Weighted random: the qty-driven base value dominates, with a small random
 * jitter layered on top (never leaving the band's own min/max range).
 */
export function generateLoanTerms(qty) {
  const band = pickBand(qty);
  const t = bandProgress(qty, band);

  const baseInterest = band.interestMax - (band.interestMax - band.interestMin) * t;
  const baseLtv = band.ltvMin + (band.ltvMax - band.ltvMin) * t;

  const interestJitter = (Math.random() - 0.5) * (band.interestMax - band.interestMin) * 0.3;
  const ltvJitter = (Math.random() - 0.5) * (band.ltvMax - band.ltvMin) * 0.3;

  const interestRate = Math.min(band.interestMax, Math.max(band.interestMin, baseInterest + interestJitter));
  const ltv = Math.min(band.ltvMax, Math.max(band.ltvMin, baseLtv + ltvJitter));

  return {
    interestRate: Math.round(interestRate * 10000) / 10000,
    ltv: Math.round(ltv * 10000) / 10000,
  };
}
