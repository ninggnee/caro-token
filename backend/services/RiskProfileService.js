/**
 * RiskProfileService — dynamic LTV / Haircut for Trader collateral finance.
 *
 * Replaces the old fixed 70% LTV / 20% haircut constants. `token_risk_profiles`
 * holds the bank's configurable policy baseline per token type (grade tier,
 * insurance, quality score, and the min/max bounds the bank allows). On top of
 * that baseline, this service applies a small live adjustment from:
 *
 *   - price volatility  — 24h change from the market engine (same source used
 *                          for the real order price band in orderController.js)
 *   - market liquidity   — 24h traded volume from the market engine
 *   - storage remaining  — average age of the live MINTED asset_batches backing
 *                          this token type vs. an assumed shelf life
 *
 * Tokens are fungible per grade (CR1/CR2/CR3), so the profile reflects the
 * pooled underlying batches for that grade rather than one specific lot;
 * `batchId` is returned as null to make that explicit.
 */

import db from '../config/db.js';
import { getPrices } from './MockMarketEngine.js';

const SHELF_LIFE_DAYS = 730; // assumed max storable shelf life for green robusta coffee

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export async function getRiskProfile(tokenType) {
  const [[base]] = await db.execute(
    `SELECT * FROM token_risk_profiles WHERE token_type = ?`,
    [tokenType]
  );
  if (!base) throw new Error(`No risk profile configured for token type ${tokenType}`);

  const [[storageRow]] = await db.execute(
    `SELECT AVG(DATEDIFF(NOW(), harvest_date)) AS avg_age_days, COUNT(*) AS batch_count
     FROM asset_batches
     WHERE status = 'MINTED' AND quality_grade = ? AND harvest_date IS NOT NULL`,
    [tokenType]
  );

  const batchCount = Number(storageRow?.batch_count || 0);
  const avgAgeDays = batchCount > 0 ? Number(storageRow.avg_age_days) : 0;
  const storageRemainingDays = batchCount > 0
    ? Math.max(0, Math.round(SHELF_LIFE_DAYS - avgAgeDays))
    : SHELF_LIFE_DAYS; // no live batch data — assume freshly minted / neutral
  const storageRatio = clamp(storageRemainingDays / SHELF_LIFE_DAYS, 0, 1);

  const marketData      = getPrices()[tokenType] || { change24h: 0, volume24h: 0 };
  const volatilityScore = Math.abs(Number(marketData.change24h || 0)); // % daily move
  const liquidityRatio  = clamp(Number(marketData.volume24h || 0) / 5000, 0, 1); // 5,000kg/day ≈ fully liquid

  const volatilityPenalty = clamp(volatilityScore / 20, 0, 0.05);     // up to 5% for high volatility
  const storagePenalty    = clamp((1 - storageRatio) * 0.05, 0, 0.05); // up to 5% for near-expiry stock
  const liquidityBonus    = clamp(liquidityRatio * 0.03, 0, 0.03);     // up to 3% back for deep liquidity

  const ltv = clamp(
    Number(base.base_ltv) - volatilityPenalty - storagePenalty + liquidityBonus,
    Number(base.min_ltv), Number(base.max_ltv)
  );
  const haircut = clamp(
    Number(base.base_haircut) + volatilityPenalty + storagePenalty - liquidityBonus,
    Number(base.min_haircut), Number(base.max_haircut)
  );

  return {
    batchId:              null,
    tokenType,
    ltv:                  Number(ltv.toFixed(4)),
    haircut:              Number(haircut.toFixed(4)),
    volatilityScore:      Number(volatilityScore.toFixed(2)),
    qualityScore:         Number(base.quality_score),
    storageRemainingDays,
    insuranceStatus:      base.insurance_status,
  };
}

export default { getRiskProfile };
