-- v10_finance_lifecycle.sql
-- Completes the Collateral Loan / Token Discounting lifecycle for the
-- Admin "Mô phỏng Ngân hàng" (Bank simulation) module:
--
--   collateral_loans: adds a dedicated `rejection_reason` column (separate
--   from the general-purpose `admin_note` remark field) and a
--   `disbursement_id` reference generated when the bank actually disburses
--   funds (distinct step from approval — see financeController.js).
--
--   token_discounting: adds the matching dedicated `rejection_reason`
--   column.
--
-- Safe to re-run: every statement is a defensive ADD COLUMN: swallow
-- "Duplicate column" on re-run (same pattern as v6_wallet_schema.sql).

ALTER TABLE collateral_loans ADD COLUMN rejection_reason TEXT NULL AFTER admin_note;
ALTER TABLE collateral_loans ADD COLUMN disbursement_id VARCHAR(64) NULL AFTER rejection_reason;

ALTER TABLE token_discounting ADD COLUMN rejection_reason TEXT NULL AFTER admin_note;
