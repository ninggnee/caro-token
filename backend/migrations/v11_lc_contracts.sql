-- v11_lc_contracts.sql
-- Digital L/C (On-chain Letter of Credit) simulation — replaces the old
-- single-batch "Đổi hàng hóa" (redeem) flow for Traders.
--
-- Like Collateral Loan / Token Discounting, an L/C contract is NOT tied to
-- one fixed Batch: the bank gathers Token from whichever holders currently
-- have circulating supply across the platform (see lc_token_locks — one
-- row per source holder the bank buys from to fill the contract).
--
-- Safe to re-run: every statement is defensive (IF NOT EXISTS / swallow
-- "Duplicate column" on ALTER), same convention as v6/v10.

-- ── 1. L/C Contracts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lc_contracts (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  trader_id             INT NOT NULL,

  -- Step 1 — Trader request
  requested_weight_kg   DECIMAL(18,4) NOT NULL,
  unit_price            DECIMAL(20,2) NOT NULL,   -- blended reference VND/kg at request time
  contract_value        DECIMAL(20,2) NOT NULL,   -- requested_weight_kg * unit_price
  deposit_rate          DECIMAL(5,4)  NOT NULL,   -- generated once at creation, 10–20%
  deposit_amount        DECIMAL(20,2) NOT NULL,   -- contract_value * deposit_rate, paid by Trader up front
  bank_funding_amount   DECIMAL(20,2) NOT NULL,   -- contract_value - deposit_amount

  -- Steps 3–4 — bank gathers + locks Token from circulating supply
  total_token_locked    DECIMAL(18,4) NULL,
  total_weight_locked   DECIMAL(18,4) NULL,
  escrow_user_id        INT NULL,                 -- system account holding the LOCKED tokens

  -- Lifecycle
  status ENUM(
    'pending_bank_approval',
    'bank_approved',
    'tokens_locked',
    'payment_released',
    'delivered',
    'closed',
    'rejected'
  ) NOT NULL DEFAULT 'pending_bank_approval',

  rejection_reason      TEXT NULL,
  admin_note            TEXT NULL,
  processed_by          INT NULL,

  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_at           TIMESTAMP NULL,
  locked_at             TIMESTAMP NULL,
  payment_released_at   TIMESTAMP NULL,
  delivered_at          TIMESTAMP NULL,
  closed_at             TIMESTAMP NULL,

  INDEX idx_lc_trader (trader_id),
  INDEX idx_lc_status (status)
) ENGINE=InnoDB;

-- ── 2. Token sources gathered into escrow (many-Batch / many-holder) ────
-- One row per platform holder the bank buys circulating Token from to
-- fill a contract. Deliberately NOT linked to any Batch — the same
-- Token-fungibility model already used by Collateral Loan / Discounting.
CREATE TABLE IF NOT EXISTS lc_token_locks (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  contract_id      INT NOT NULL,
  source_user_id   INT NOT NULL,
  token_type       VARCHAR(10)   NOT NULL,
  quantity         DECIMAL(18,4) NOT NULL,
  price_at_lock    DECIMAL(20,2) NOT NULL,
  payment_amount   DECIMAL(20,2) NOT NULL,  -- quantity * price_at_lock, credited to source_user_id's VND wallet
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_ltl_contract (contract_id),
  INDEX idx_ltl_source   (source_user_id)
) ENGINE=InnoDB;

-- ── 3. Oracle event timeline (Admin simulates the Oracle) ────────────────
CREATE TABLE IF NOT EXISTS lc_oracle_events (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  contract_id    INT NOT NULL,
  category       ENUM('warehouse','quality','logistics') NOT NULL,
  status_code    VARCHAR(64)  NOT NULL,
  status_label   VARCHAR(128) NOT NULL,
  note           TEXT NULL,
  document_id    INT NULL,            -- FK-ish reference to warehouse_documents.id
  document_hash  VARCHAR(255) NULL,   -- CID / hash, if the storage backend produced one
  created_by     INT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_loe_contract (contract_id)
) ENGINE=InnoDB;

-- ── 4. Link L/C contracts into the existing document/IPFS module ────────
-- warehouse_documents already supports warehouse_id-linked uploads; add a
-- second, independent nullable link so the same upload+IPFS pipeline can
-- serve L/C documents (Warehouse Receipt, Certificate of Quality, Packing
-- List, Bill of Lading, Shipping Notice) without touching its existing
-- warehouse-linked behavior.
ALTER TABLE warehouse_documents ADD COLUMN lc_contract_id INT NULL AFTER warehouse_id;
