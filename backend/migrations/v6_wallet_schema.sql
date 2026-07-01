-- v6_wallet_schema.sql
-- Ensures wallet, deposit, and withdraw tables exist with full column set.
-- Safe to re-run: CREATE TABLE uses IF NOT EXISTS; ALTER TABLE ADD COLUMN
-- statements will error on duplicate (the migration runner swallows those).

-- ── 1. VND Wallets ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id               INT           AUTO_INCREMENT PRIMARY KEY,
  user_id          INT           NOT NULL UNIQUE,
  vnd_balance      DECIMAL(20,2) NOT NULL DEFAULT 0,
  vnd_locked       DECIMAL(20,2) NOT NULL DEFAULT 0,
  pending_withdraw DECIMAL(20,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_w_user (user_id)
) ENGINE=InnoDB;

-- ── 2. Deposit Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deposit_requests (
  id               INT           AUTO_INCREMENT PRIMARY KEY,
  user_id          INT           NOT NULL,
  amount           DECIMAL(20,2) NOT NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  payment_method   VARCHAR(50)   NULL,
  transaction_code VARCHAR(30)   NULL,
  proof_image      VARCHAR(512)  NULL,
  note             TEXT          NULL,
  reviewed_by      INT           NULL,
  reviewed_at      TIMESTAMP     NULL,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dep_user   (user_id),
  INDEX idx_dep_status (status)
) ENGINE=InnoDB;

-- Add columns that may be missing from an older deposit_requests table
ALTER TABLE deposit_requests ADD COLUMN payment_method   VARCHAR(50)  NULL AFTER status;
ALTER TABLE deposit_requests ADD COLUMN transaction_code VARCHAR(30)  NULL AFTER payment_method;
ALTER TABLE deposit_requests ADD COLUMN note             TEXT         NULL AFTER transaction_code;
ALTER TABLE deposit_requests ADD COLUMN reviewed_by      INT          NULL AFTER note;
ALTER TABLE deposit_requests ADD COLUMN reviewed_at      TIMESTAMP    NULL AFTER reviewed_by;

-- ── 3. Withdraw Requests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id             INT           AUTO_INCREMENT PRIMARY KEY,
  user_id        INT           NOT NULL,
  amount         DECIMAL(20,2) NOT NULL,
  bank_name      VARCHAR(100)  NULL,
  account_number VARCHAR(50)   NULL,
  account_name   VARCHAR(100)  NULL,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  note           TEXT          NULL,
  reviewed_by    INT           NULL,
  reviewed_at    TIMESTAMP     NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wd_user   (user_id),
  INDEX idx_wd_status (status)
) ENGINE=InnoDB;

-- Add columns that may be missing from an older withdraw_requests table
ALTER TABLE withdraw_requests ADD COLUMN note        TEXT      NULL AFTER status;
ALTER TABLE withdraw_requests ADD COLUMN reviewed_by INT       NULL AFTER note;
ALTER TABLE withdraw_requests ADD COLUMN reviewed_at TIMESTAMP NULL AFTER reviewed_by;
