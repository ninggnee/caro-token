/**
 * Collateral-loan risk tiering — shared band definitions for the Farmer
 * "Vay thế chấp" (collateral loan) feature.
 *
 * More pledged token quantity → lower risk → lower interest rate and
 * higher allowed LTV. Bands mirror backend/services/LoanRiskService.js;
 * keep both in sync if the thresholds change.
 *
 * This module only produces a deterministic ESTIMATE for the pre-submit
 * preview shown to the farmer. The authoritative interest rate and LTV
 * are generated (with weighted randomness) and persisted server-side
 * when the loan is actually created — see LoanRiskService.generateLoanTerms.
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
 * Deterministic preview estimate (no randomness) used while the farmer is
 * still filling out the loan form. The real, final figures are only fixed
 * when the loan is created (see LoanRiskService.generateLoanTerms).
 */
export function estimateLoanTerms(qty) {
  const band = pickBand(qty);
  const t = bandProgress(qty, band);
  const interestRate = band.interestMax - (band.interestMax - band.interestMin) * t;
  const ltv = band.ltvMin + (band.ltvMax - band.ltvMin) * t;
  return { interestRate, ltv };
}
