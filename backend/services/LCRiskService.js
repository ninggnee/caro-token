/**
 * LCRiskService — deposit-rate generation for L/C ("Nhận nông sản thực tế")
 * contracts.
 *
 * Mirrors LoanRiskService.js: contract size is used as a proxy for risk —
 * a larger contract (more collateral/volume backing the trade) → lower
 * risk to the bank → a lower deposit rate is required from the Trader.
 * Generated ONCE at contract creation and persisted; never regenerated —
 * every later calculation for this contract reuses the stored rate.
 *
 * Deposit rate stays within 10–20% per the business spec.
 */

const DEPOSIT_RATE_MIN = 0.10;
const DEPOSIT_RATE_MAX = 0.20;

const BANDS = [
  { weightMin: 0,     weightMax: 500,   rateMin: 0.18, rateMax: 0.20 },
  { weightMin: 500,   weightMax: 2000,  rateMin: 0.14, rateMax: 0.18 },
  { weightMin: 2000,  weightMax: 5000,  rateMin: 0.12, rateMax: 0.14 },
  { weightMin: 5000,  weightMax: 15000, rateMin: 0.10, rateMax: 0.12 },
];

function pickBand(weightKg) {
  const w = Number(weightKg) || 0;
  if (w < 500) return BANDS[0];
  if (w < 2000) return BANDS[1];
  if (w < 5000) return BANDS[2];
  return BANDS[3];
}

function bandProgress(weightKg, band) {
  const span = band.weightMax - band.weightMin;
  if (span <= 0) return 1;
  const w = Number(weightKg) || 0;
  return Math.min(1, Math.max(0, (w - band.weightMin) / span));
}

/**
 * Generate the deposit rate for a new L/C contract. Weighted random: the
 * weight-driven base value dominates, with a small random jitter layered
 * on top (never leaving the band's own min/max, and always within the
 * overall 10–20% range).
 */
export function generateDepositRate(weightKg) {
  const band = pickBand(weightKg);
  const t = bandProgress(weightKg, band);

  // Larger weight (closer to top of its band) → lower deposit rate.
  const base = band.rateMax - (band.rateMax - band.rateMin) * t;
  const jitter = (Math.random() - 0.5) * (band.rateMax - band.rateMin) * 0.3;

  const rate = Math.min(band.rateMax, Math.max(band.rateMin, base + jitter));
  const clamped = Math.min(DEPOSIT_RATE_MAX, Math.max(DEPOSIT_RATE_MIN, rate));

  return Math.round(clamped * 10000) / 10000;
}
