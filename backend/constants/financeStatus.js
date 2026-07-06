/**
 * financeStatus — single source of truth for Collateral Loan / Token
 * Discounting lifecycle status values used by financeController.js and the
 * Admin "Mô phỏng Ngân hàng" (Bank simulation) screens.
 *
 * These values MUST match the `status` ENUM defined in
 * backend/migrations/v4_finance_tables.sql. Do not use raw string literals
 * for status comparisons/writes in new code — import from here instead.
 *
 * ── Collateral Loan lifecycle ──────────────────────────────────────────
 *   PENDING  → (bank decision) → APPROVED → (bank disburses) → ACTIVE
 *   ACTIVE   → (farmer repays) → REPAID
 *   PENDING  → (bank rejects)  → REJECTED
 *
 * "Đã giải ngân" is not a separate resting status — disbursement and the
 * loan becoming active happen in the same bank action (there is no
 * meaningful manual step between "money sent" and "loan outstanding").
 * The fact and moment of disbursement is preserved via the
 * `disbursed_at` timestamp + `disbursement_id` columns, and the Admin
 * detail page renders it as a completed step in the lifecycle stepper.
 *
 * ── Token Discounting lifecycle ────────────────────────────────────────
 *   PENDING → (bank approves: pays out + transfers token ownership) → COMPLETED
 *   PENDING → (bank rejects) → REJECTED
 *
 * Approval, payment, and token-ownership-transfer happen atomically in one
 * bank action (true-sale settlement has no meaningful manual gap between
 * those sub-steps) — but each sub-step still gets its own audit_logs entry
 * so the System Log narrates them distinctly.
 */

export const LOAN_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  ACTIVE:   'active',
  REPAID:   'repaid',
  REJECTED: 'rejected',
};

// Statuses considered "outstanding / repayable" — only ACTIVE, because that
// is the only status where the bank has actually disbursed funds to the
// farmer's wallet. A loan that is merely APPROVED has no principal to repay
// yet (disbursement is a separate, later bank action).
export const LOAN_REPAYABLE_STATUSES = [LOAN_STATUS.ACTIVE];

export const DISCOUNT_STATUS = {
  PENDING:   'pending',
  COMPLETED: 'completed',
  REJECTED:  'rejected',
};
