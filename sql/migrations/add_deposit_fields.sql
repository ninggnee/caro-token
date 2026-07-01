-- Migration: add payment_method and transaction_code to deposit_requests
-- Required for simulated VND deposit feature (Rule set: Simulated Deposits)

ALTER TABLE deposit_requests
  ADD COLUMN IF NOT EXISTS payment_method  VARCHAR(64)  NULL AFTER note,
  ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(32)  NULL AFTER payment_method;

-- Unique index so no two deposits share the same transaction code
CREATE UNIQUE INDEX IF NOT EXISTS idx_dep_txcode ON deposit_requests (transaction_code);
