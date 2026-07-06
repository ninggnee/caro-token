-- v13_lc_ready_to_close.sql
-- Adds an explicit "Sẵn sàng hoàn tất" (Ready to Close) intermediate state
-- between the Oracle/payment/delivery conditions being satisfied and the
-- Admin's final "Hoàn tất hợp đồng" confirmation that actually burns Token
-- and closes the contract. Previously these two things happened in the
-- same action — now they're deliberately split into two steps.
--
-- Safe to re-run: defensive ALTERs (swallow "Duplicate column"), same
-- convention as v11/v12.

ALTER TABLE lc_contracts MODIFY COLUMN status ENUM(
  'pending_bank_approval',
  'bank_approved',
  'tokens_locked',
  'active',
  'ready_to_close',
  'closed',
  'rejected'
) NOT NULL DEFAULT 'pending_bank_approval';

-- Distinct from the pre-existing oracle_status_code/oracle_status_label
-- (which just mirror the *latest* Oracle event for display). This new
-- column tracks whether the FULL Oracle attestation bundle is done:
-- warehouse + quality events logged, logistics reached On-board, AND all
-- required documents uploaded.
ALTER TABLE lc_contracts ADD COLUMN oracle_completion_status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress' AFTER oracle_status_label;

ALTER TABLE lc_contracts ADD COLUMN ready_to_close_at TIMESTAMP NULL AFTER payment_completed_at;

-- Allow system-generated milestone rows (Đã hoàn tất thanh toán / Sẵn sàng
-- hoàn tất / Admin xác nhận hoàn tất hợp đồng / Token đã Burn / Hợp đồng đã
-- đóng) to live in the same lc_oracle_events table as real Oracle updates,
-- so the Timeline reads back in correct chronological order from one query.
ALTER TABLE lc_oracle_events MODIFY COLUMN category ENUM('warehouse', 'quality', 'logistics', 'system') NOT NULL;
