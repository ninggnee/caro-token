-- ============================================================
-- CaRo Token Platform — Full Migration
-- Run once against an existing `caro_token` database.
-- All blocks are idempotent (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- -------------------------------------------------------
-- PART 3: user_balances — split into available + locked
-- -------------------------------------------------------
ALTER TABLE user_balances
  ADD COLUMN IF NOT EXISTS available_balance DECIMAL(36,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_balance    DECIMAL(36,8) DEFAULT 0;

UPDATE user_balances
SET available_balance = balance
WHERE available_balance = 0 AND balance > 0;

-- -------------------------------------------------------
-- PART 4: orders (Matching Engine)
-- Separate markets per grade: CR1/VND, CR2/VND, CR3/VND
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT           NOT NULL,
  pair       VARCHAR(32)   NOT NULL,          -- CR1/VND | CR2/VND | CR3/VND
  side       ENUM('buy','sell') NOT NULL,
  type       ENUM('limit') NOT NULL DEFAULT 'limit',
  price      DECIMAL(20,4) NOT NULL,
  amount     DECIMAL(36,8) NOT NULL,
  filled     DECIMAL(36,8) NOT NULL DEFAULT 0,
  remaining  DECIMAL(36,8) NOT NULL,
  status     ENUM('open','partial','filled','cancelled') DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pair_status     (pair, status),
  INDEX idx_pair_side_price (pair, side, price),
  INDEX idx_user_id         (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- PART 5: VND Wallet — deposit & withdraw requests
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS deposit_requests (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  amount      DECIMAL(20,2) NOT NULL,
  proof_image VARCHAR(500)  DEFAULT NULL,
  status      ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by INT           DEFAULT NULL,
  reviewed_at DATETIME      DEFAULT NULL,
  note        TEXT          DEFAULT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdraw_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT           NOT NULL,
  amount         DECIMAL(20,2) NOT NULL,
  bank_name      VARCHAR(128)  DEFAULT NULL,
  account_number VARCHAR(64)   DEFAULT NULL,
  account_name   VARCHAR(128)  DEFAULT NULL,
  status         ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by    INT           DEFAULT NULL,
  reviewed_at    DATETIME      DEFAULT NULL,
  note           TEXT          DEFAULT NULL,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS vnd_balance      DECIMAL(20,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vnd_locked       DECIMAL(20,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_withdraw DECIMAL(20,2) DEFAULT 0;

-- -------------------------------------------------------
-- PART 6: sessions — refresh token support
-- -------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(512) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_revoked    TINYINT(1)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ip_address    VARCHAR(64)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_agent    TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP;

-- -------------------------------------------------------
-- PART 7: audit_logs — extended schema
-- -------------------------------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS entity_id   INT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS old_data    JSON        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS new_data    JSON        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_address  VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_agent  TEXT        DEFAULT NULL;

-- -------------------------------------------------------
-- PART 2 & 9: redeem_requests — token_type, tx_hash, lock
-- -------------------------------------------------------
ALTER TABLE redeem_requests
  ADD COLUMN IF NOT EXISTS token_type VARCHAR(64)  DEFAULT 'CR1',
  ADD COLUMN IF NOT EXISTS tx_hash    VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS locked_at  DATETIME     DEFAULT NULL;

-- -------------------------------------------------------
-- PART 8 & 11: Custodian Model — RWA full flow
-- -------------------------------------------------------

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  warehouse_code VARCHAR(32)  NOT NULL UNIQUE,
  name           VARCHAR(128) NOT NULL,
  address        VARCHAR(256) DEFAULT NULL,
  capacity_kg    DECIMAL(12,2) DEFAULT 0,
  manager_name   VARCHAR(128) DEFAULT NULL,
  status         ENUM('active','inactive') DEFAULT 'active',
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Coffee Lots (1 grade = 1 lot = 1 token type)
-- A farmer submission may be split into multiple lots at inspection time.
CREATE TABLE IF NOT EXISTS coffee_lots (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  lot_code               VARCHAR(64)   NOT NULL UNIQUE,   -- e.g. LOT-2026-001-A
  parent_submission_id   INT           DEFAULT NULL,      -- original token_request_id
  farmer_id              INT           NOT NULL,
  warehouse_id           INT           DEFAULT NULL,
  weight_kg              DECIMAL(12,4) NOT NULL,
  grade                  ENUM('CR1','CR2','CR3','REJECTED') DEFAULT NULL,
  warehouse_confirmed    TINYINT(1)    DEFAULT 0,
  warehouse_confirmed_at DATETIME      DEFAULT NULL,
  warehouse_confirmed_by INT           DEFAULT NULL,
  inspection_passed      TINYINT(1)    DEFAULT 0,
  inspection_passed_at   DATETIME      DEFAULT NULL,
  status ENUM('pending','warehouse_confirmed','inspected','receipt_issued','minted','redeemed','rejected') DEFAULT 'pending',
  created_at             DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_farmer_id         (farmer_id),
  INDEX idx_status            (status),
  INDEX idx_parent_submission (parent_submission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inspection Reports — grade determination per SCAA/ICE EU Robusta standard
-- Grade logic lives in backend GradeService, NOT in smart contract.
CREATE TABLE IF NOT EXISTS inspection_reports (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  lot_id           INT           NOT NULL,
  inspector_id     INT           DEFAULT NULL,
  defect_count     INT           DEFAULT NULL,   -- defects per 300g sample
  moisture_pct     DECIMAL(5,2)  DEFAULT NULL,   -- must be 9–13%
  immature_beans   INT           DEFAULT NULL,   -- count of immature beans
  sample_weight_g  DECIMAL(8,2)  DEFAULT 300,
  screen_size_ok   TINYINT(1)    DEFAULT 0,
  grade_result     ENUM('CR1','CR2','CR3','REJECTED') DEFAULT NULL,  -- computed by GradeService
  passed           TINYINT(1)    DEFAULT 0,
  notes            TEXT          DEFAULT NULL,
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lot_id (lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Warehouse Receipts — issued after warehouse_confirmed + inspection_passed
CREATE TABLE IF NOT EXISTS warehouse_receipts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  receipt_code VARCHAR(32)   NOT NULL UNIQUE,    -- e.g. WR-2026-001
  lot_id       INT           NOT NULL UNIQUE,    -- 1 receipt per lot
  warehouse_id INT           NOT NULL,
  grade        ENUM('CR1','CR2','CR3') NOT NULL,
  weight_kg    DECIMAL(12,4) NOT NULL,
  issued_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  issued_by    INT           DEFAULT NULL,
  status       ENUM('active','used','cancelled') DEFAULT 'active',
  INDEX idx_lot_id     (lot_id),
  INDEX idx_warehouse  (warehouse_id),
  INDEX idx_status     (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- token_requests: link lot_id for custodian gate
ALTER TABLE token_requests
  ADD COLUMN IF NOT EXISTS lot_id_ref INT DEFAULT NULL;
