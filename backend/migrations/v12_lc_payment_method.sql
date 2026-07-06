-- v12_lc_payment_method.sql
-- Refactor of the L/C ("Nhận nông sản thực tế") business model: after Token
-- is gathered and locked into escrow, the Trader now explicitly chooses how
-- to settle the bank's funding contribution — pay immediately, or defer to
-- a partner-bank financing plan — instead of the old single-shot "release
-- payment once Oracle confirms On-board + documents" step.
--
-- Safe to re-run: defensive ALTERs (swallow "Duplicate column"), same
-- convention as v6/v10/v11. No existing lc_contracts rows are expected at
-- migration time (Prototype), but the defensive UPDATE below is harmless
-- either way.

-- Retire the old 'payment_released' / 'delivered' resting states — the new
-- coarse status only needs to track "servicing" as a single 'active' state;
-- fine-grained progress now lives in payment_status / delivery_status.
UPDATE lc_contracts SET status = 'active' WHERE status IN ('payment_released', 'delivered');

ALTER TABLE lc_contracts MODIFY COLUMN status ENUM(
  'pending_bank_approval',
  'bank_approved',
  'tokens_locked',
  'active',
  'closed',
  'rejected'
) NOT NULL DEFAULT 'pending_bank_approval';

-- Step 4 — Trader's chosen settlement method for the bank's funding
ALTER TABLE lc_contracts ADD COLUMN payment_method ENUM('immediate', 'deferred') NULL AFTER bank_funding_amount;
ALTER TABLE lc_contracts ADD COLUMN partner_bank VARCHAR(100) NULL AFTER payment_method;
ALTER TABLE lc_contracts ADD COLUMN financing_plan VARCHAR(150) NULL AFTER partner_bank;
ALTER TABLE lc_contracts ADD COLUMN due_date DATE NULL AFTER financing_plan;

ALTER TABLE lc_contracts ADD COLUMN payment_status ENUM(
  'pending_selection',
  'awaiting_payment',
  'completed'
) NOT NULL DEFAULT 'pending_selection' AFTER due_date;

ALTER TABLE lc_contracts ADD COLUMN delivery_status ENUM(
  'not_delivered',
  'delivered'
) NOT NULL DEFAULT 'not_delivered' AFTER payment_status;

-- Denormalized latest-Oracle-status, kept in sync by addLCOracleEvent() so
-- list views don't need a per-row subquery/join against lc_oracle_events.
ALTER TABLE lc_contracts ADD COLUMN oracle_status_code VARCHAR(64) NULL AFTER delivery_status;
ALTER TABLE lc_contracts ADD COLUMN oracle_status_label VARCHAR(128) NULL AFTER oracle_status_code;

ALTER TABLE lc_contracts ADD COLUMN payment_method_selected_at TIMESTAMP NULL AFTER locked_at;
ALTER TABLE lc_contracts ADD COLUMN payment_completed_at TIMESTAMP NULL AFTER payment_method_selected_at;
