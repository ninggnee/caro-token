-- ============================================================
-- v4_finance_tables.sql
-- Finance module: Collateral Loan + Token Discounting
--
-- Two completely independent products with different business
-- logic, ownership rights, and token state transitions.
-- ============================================================

-- ── 1. Collateral Loans ──────────────────────────────────────
-- Trader retains ownership. Tokens move to PLEDGED state.
-- Bank holds security rights only.
-- Upon repayment: PLEDGED → AVAILABLE
-- Upon default: bank may liquidate.

CREATE TABLE IF NOT EXISTS collateral_loans (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT          NOT NULL,
  batch_id         VARCHAR(50)  NULL,
  token_type       VARCHAR(10)  NOT NULL,
  quantity         DECIMAL(18,4) NOT NULL,
  market_price     DECIMAL(20,2) NOT NULL,
  collateral_value DECIMAL(20,2) NOT NULL,   -- quantity × market_price
  ltv              DECIMAL(5,4)  NOT NULL DEFAULT 0.70,
  max_loan_amount  DECIMAL(20,2) NOT NULL,   -- collateral_value × ltv
  requested_amount DECIMAL(20,2) NOT NULL,   -- amount trader actually wants
  interest_rate    DECIMAL(5,4)  NOT NULL DEFAULT 0.08,  -- 8% per year
  loan_term_months TINYINT      NOT NULL DEFAULT 3,
  status           ENUM(
                     'pending',
                     'admin_reviewing',
                     'bank_reviewing',
                     'approved',
                     'disbursed',
                     'active',
                     'repaid',
                     'defaulted',
                     'rejected'
                   ) NOT NULL DEFAULT 'pending',
  admin_note       TEXT         NULL,
  processed_by     INT          NULL,       -- admin user_id
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_at      TIMESTAMP    NULL,
  disbursed_at     TIMESTAMP    NULL,
  repaid_at        TIMESTAMP    NULL,

  INDEX idx_cl_user   (user_id),
  INDEX idx_cl_status (status),
  INDEX idx_cl_token  (token_type)
);

-- ── 2. Token Discounting ─────────────────────────────────────
-- TRUE SALE — trader permanently transfers ownership to bank.
-- Trader receives immediate cash. Tokens move to DISCOUNTED state.
-- No repayment obligation. Bank becomes new owner.

CREATE TABLE IF NOT EXISTS token_discounting (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  user_id               INT          NOT NULL,
  bank_name             VARCHAR(100) NOT NULL,
  batch_id              VARCHAR(50)  NULL,
  token_type            VARCHAR(10)  NOT NULL,
  quantity              DECIMAL(18,4) NOT NULL,
  market_price          DECIMAL(20,2) NOT NULL,
  nominal_value         DECIMAL(20,2) NOT NULL,  -- quantity × market_price
  haircut               DECIMAL(5,4)  NOT NULL DEFAULT 0.20,  -- e.g. 0.20 = 20%
  discount_ratio        DECIMAL(5,4)  NOT NULL DEFAULT 0.80,  -- 1 - haircut
  payment_amount        DECIMAL(20,2) NOT NULL,  -- nominal_value × discount_ratio
  risk_level            ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  ownership_transfer_tx VARCHAR(100)  NULL,       -- blockchain tx when tokens transferred
  status                ENUM(
                          'pending',
                          'admin_reviewing',
                          'bank_valuation',
                          'approved',
                          'payment_pending',
                          'completed',
                          'rejected'
                        ) NOT NULL DEFAULT 'pending',
  admin_note            TEXT         NULL,
  processed_by          INT          NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at          TIMESTAMP    NULL,

  INDEX idx_td_user   (user_id),
  INDEX idx_td_status (status),
  INDEX idx_td_token  (token_type)
);
