-- ============================================================
-- v7_risk_profiles.sql
-- Trader Finance: configurable per-token-type risk profile,
-- replacing the fixed 70% LTV / 20% haircut constants.
--
-- Baseline parameters are bank-policy config (editable by admin,
-- not hardcoded in application code). Actual LTV/haircut returned
-- to the trader are further adjusted live by RiskProfileService
-- using market volatility, liquidity and underlying batch storage
-- age — see backend/services/RiskProfileService.js.
--
-- Farmer finance flows are untouched — they keep using the
-- original fixed constants in financeController.js.
-- ============================================================

CREATE TABLE IF NOT EXISTS token_risk_profiles (
  token_type       VARCHAR(10)   NOT NULL PRIMARY KEY,
  base_ltv         DECIMAL(5,4)  NOT NULL,             -- bank policy baseline, before live adjustment
  base_haircut     DECIMAL(5,4)  NOT NULL,
  quality_score    DECIMAL(5,2)  NOT NULL,             -- 0-100, bank-assessed grade quality
  insurance_status ENUM('insured','uninsured') NOT NULL DEFAULT 'uninsured',
  min_ltv          DECIMAL(5,4)  NOT NULL DEFAULT 0.5000,  -- bank risk policy bounds for live adjustment
  max_ltv          DECIMAL(5,4)  NOT NULL DEFAULT 0.8500,
  min_haircut      DECIMAL(5,4)  NOT NULL DEFAULT 0.0500,
  max_haircut      DECIMAL(5,4)  NOT NULL DEFAULT 0.3500,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO token_risk_profiles
  (token_type, base_ltv, base_haircut, quality_score, insurance_status)
VALUES
  ('CR1', 0.8000, 0.1000, 90.00, 'insured'),
  ('CR2', 0.7500, 0.1500, 75.00, 'insured'),
  ('CR3', 0.6500, 0.2500, 55.00, 'uninsured')
ON DUPLICATE KEY UPDATE token_type = token_type;
