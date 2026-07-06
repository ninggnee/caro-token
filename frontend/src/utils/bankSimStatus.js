/**
 * Status constants + derived DISPLAY-ONLY labels for the Admin "Mô phỏng
 * Ngân hàng" (Bank simulation) screens and the Farmer-facing loan/discount
 * history views.
 *
 * Values MUST match backend/constants/financeStatus.js and the `status`
 * ENUM in backend/migrations/v4_finance_tables.sql. Import these constants
 * instead of comparing against raw string literals.
 *
 * ── Collateral Loan lifecycle ──────────────────────────────────────────
 *   PENDING → (bank approves)  → APPROVED → (bank disburses) → ACTIVE
 *   ACTIVE  → (farmer repays)  → REPAID
 *   PENDING → (bank rejects)   → REJECTED
 *
 * ── Token Discounting lifecycle ────────────────────────────────────────
 *   PENDING → (bank approves: pays out + transfers token ownership) → COMPLETED
 *   PENDING → (bank rejects) → REJECTED
 */

export const LOAN_STATUS = {
  PENDING:  'pending',
  APPROVED: 'approved',
  ACTIVE:   'active',
  REPAID:   'repaid',
  REJECTED: 'rejected',
};

// Only ACTIVE loans are repayable — APPROVED means the bank hasn't
// disbursed yet, so there is no principal in the farmer's wallet to repay.
export const LOAN_REPAYABLE_STATUSES = [LOAN_STATUS.ACTIVE];

export const DISCOUNT_STATUS = {
  PENDING:   'pending',
  COMPLETED: 'completed',
  REJECTED:  'rejected',
};

// Token is PLEDGED (locked) for the entire life of the loan except once
// rejected or repaid — approval alone does NOT unlock it, only a reject or
// a full repayment does.
export function loanTokenStatus(loanStatus) {
  if (loanStatus === LOAN_STATUS.REJECTED || loanStatus === LOAN_STATUS.REPAID) return 'AVAILABLE';
  return 'PLEDGED';
}

export function discountTokenStatus(discountStatus) {
  if (discountStatus === DISCOUNT_STATUS.REJECTED) return 'AVAILABLE';
  if (discountStatus === DISCOUNT_STATUS.COMPLETED) return 'TRANSFERRED';
  return 'PENDING_DISCOUNT';
}

/**
 * Vietnamese display labels for the internal Token-status codes above.
 * The codes themselves (AVAILABLE / PLEDGED / TRANSFERRED / ...) stay in
 * English in the code — only what's rendered on screen is translated.
 */
export const TOKEN_STATUS_LABELS_VI = {
  AVAILABLE:        'Sẵn sàng',
  PLEDGED:          'Đã thế chấp',
  LOCKED:           'Đang khóa',
  MINTED:           'Đã đúc',
  DISCOUNTED:       'Đã chiết khấu',
  REDEEMED:         'Đã quy đổi',
  TRANSFERRED:      'Đã chuyển nhượng',
  PENDING_DISCOUNT: 'Đang chờ chiết khấu',
};

export function loanTokenStatusLabel(loanStatus) {
  const code = loanTokenStatus(loanStatus);
  return TOKEN_STATUS_LABELS_VI[code] || code;
}

export function discountTokenStatusLabel(discountStatus) {
  const code = discountTokenStatus(discountStatus);
  return TOKEN_STATUS_LABELS_VI[code] || code;
}

export const LOAN_STATUS_LABELS = {
  pending:  { label: 'Chờ Ngân hàng duyệt', color: '#f0b90b' },
  approved: { label: 'Đã phê duyệt (chờ giải ngân)', color: '#f0b90b' },
  active:   { label: 'Đang vay (đã giải ngân)', color: '#B0E4CC' },
  repaid:   { label: 'Đã tất toán', color: '#487573' },
  rejected: { label: 'Đã từ chối', color: '#f6465d' },
  // Legacy ENUM values kept valid at the DB layer for forward-compat; not
  // reachable through the current Admin bank-simulation flow.
  admin_reviewing: { label: 'Đang xem xét', color: '#f0b90b' },
  bank_reviewing:  { label: 'Ngân hàng đang xem', color: '#f0b90b' },
  disbursed:       { label: 'Đã giải ngân', color: '#B0E4CC' },
  defaulted:       { label: 'Vỡ nợ', color: '#f6465d' },
};

export const DISCOUNT_STATUS_LABELS = {
  pending:   { label: 'Chờ Ngân hàng duyệt', color: '#f0b90b' },
  completed: { label: 'Hoàn tất (đã chuyển Token)', color: '#B0E4CC' },
  rejected:  { label: 'Đã từ chối', color: '#f6465d' },
  // Legacy ENUM values kept valid at the DB layer for forward-compat.
  admin_reviewing: { label: 'Đang xem xét', color: '#f0b90b' },
  bank_valuation:  { label: 'Định giá', color: '#f0b90b' },
  approved:        { label: 'Đã duyệt', color: '#B0E4CC' },
  payment_pending: { label: 'Chờ thanh toán', color: '#f77f00' },
};

/**
 * Lifecycle stepper for the loan detail page — computed from the loan's
 * actual status + timestamps, not a separate stored field. `rejected` is a
 * terminal side-branch off "pending" and is rendered separately by callers.
 */
export function loanLifecycleSteps(loan) {
  const steps = [
    { key: 'pending',  label: 'Chờ Ngân hàng duyệt', done: true, at: loan.created_at },
    { key: 'approved', label: 'Đã phê duyệt', done: [LOAN_STATUS.APPROVED, LOAN_STATUS.ACTIVE, LOAN_STATUS.REPAID].includes(loan.status), at: loan.approved_at },
    { key: 'disbursed', label: 'Đã giải ngân', done: [LOAN_STATUS.ACTIVE, LOAN_STATUS.REPAID].includes(loan.status), at: loan.disbursed_at },
    { key: 'active',   label: 'Đang vay', done: [LOAN_STATUS.ACTIVE, LOAN_STATUS.REPAID].includes(loan.status), at: loan.disbursed_at },
    { key: 'repaid',   label: 'Đã tất toán', done: loan.status === LOAN_STATUS.REPAID, at: loan.repaid_at },
  ];
  return steps;
}

export function discountLifecycleSteps(td) {
  return [
    { key: 'pending',   label: 'Chờ Ngân hàng duyệt', done: true, at: td.created_at },
    { key: 'completed', label: 'Hoàn tất — Token đã chuyển Ngân hàng', done: td.status === DISCOUNT_STATUS.COMPLETED, at: td.completed_at },
  ];
}
