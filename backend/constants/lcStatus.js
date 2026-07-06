/**
 * lcStatus — single source of truth for the L/C (Letter of Credit)
 * contract lifecycle used by lcController.js and the Admin bank-simulation
 * screens for "Nhận nông sản thực tế".
 *
 * MUST match the `status`/`category`/`payment_method`/`payment_status`/
 * `delivery_status`/`oracle_completion_status` ENUMs in
 * backend/migrations/v11_lc_contracts.sql + v12_lc_payment_method.sql +
 * v13_lc_ready_to_close.sql. Import these constants instead of comparing
 * against raw string literals.
 *
 * ── Lifecycle (coarse `status`) ──────────────────────────────────────────
 *   PENDING_BANK_APPROVAL → (bank approves)              → BANK_APPROVED
 *   BANK_APPROVED         → (bank gathers+locks Token)   → TOKENS_LOCKED
 *   TOKENS_LOCKED         → (Trader chọn phương thức thanh toán) → ACTIVE
 *   ACTIVE                → (Oracle hoàn tất + chứng từ đủ + thanh toán xong — tự động) → READY_TO_CLOSE
 *   READY_TO_CLOSE        → (Admin xác nhận hoàn tất — burn Token)        → CLOSED
 *   PENDING_BANK_APPROVAL → (bank rejects)                → REJECTED
 *
 * While `status = ACTIVE`, `payment_status`, `delivery_status` and
 * `oracle_completion_status` progress independently (Oracle events,
 * document uploads, and payment settlement can arrive in any order) — see
 * their respective sections below. The moment all three read COMPLETED/
 * DELIVERED/COMPLETED, the contract auto-advances to READY_TO_CLOSE — Token
 * is NOT burned yet; that only happens when the Admin explicitly confirms
 * via the "Hoàn tất hợp đồng" action (completeLCContract).
 */

export const LC_STATUS = {
  PENDING_BANK_APPROVAL: 'pending_bank_approval',
  BANK_APPROVED:         'bank_approved',
  TOKENS_LOCKED:         'tokens_locked',
  ACTIVE:                'active',
  READY_TO_CLOSE:        'ready_to_close',
  CLOSED:                'closed',
  REJECTED:              'rejected',
};

export const LC_PAYMENT_METHOD = {
  IMMEDIATE: 'immediate',
  DEFERRED:  'deferred',
};

// ── Payment status ─────────────────────────────────────────────────────
//   PENDING_SELECTION → (Trader chọn "Thanh toán ngay", trả ngay lập tức) → COMPLETED
//   PENDING_SELECTION → (Trader chọn "Mua trả chậm")                     → AWAITING_PAYMENT
//   AWAITING_PAYMENT  → (Admin xác nhận khoản tín dụng đã tất toán)      → COMPLETED
export const LC_PAYMENT_STATUS = {
  PENDING_SELECTION: 'pending_selection',
  AWAITING_PAYMENT:  'awaiting_payment',
  COMPLETED:         'completed',
};

// ── Delivery status ─────────────────────────────────────────────────────
// Set to DELIVERED automatically the moment the Oracle logs the "On-board"
// logistics event — see LC_ONBOARD_CODE below.
export const LC_DELIVERY_STATUS = {
  NOT_DELIVERED: 'not_delivered',
  DELIVERED:     'delivered',
};

// ── Oracle completion status ────────────────────────────────────────────
// Distinct from the per-event `status_code`/`status_label` — this tracks
// whether the FULL Oracle attestation bundle is done: at least one
// Warehouse event, at least one Quality event, Logistics reaching
// On-board, AND every required document type uploaded. Recomputed by
// recomputeLCReadiness() in lcController.js on every Oracle event and
// every document upload.
export const LC_ORACLE_COMPLETION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
};

export const LC_ORACLE_CATEGORY = {
  WAREHOUSE: 'warehouse',
  QUALITY:   'quality',
  LOGISTICS: 'logistics',
};

// System-generated Timeline milestones (BƯỚC 6→7 of the "Hoàn tất hợp
// đồng" flow) — stored as `category = 'system'` rows in lc_oracle_events
// so the Timeline reads back in one query, correctly time-ordered, mixed
// in with the real Oracle events. Not part of LC_ORACLE_CATEGORY / not
// selectable in the Admin's manual "add Oracle event" form — these are
// only ever inserted by the backend itself (see insertMilestone()).
export const LC_SYSTEM_MILESTONES = {
  PAYMENT_COMPLETED: { code: 'payment_completed',          label: 'Đã hoàn tất thanh toán' },
  READY_TO_CLOSE:    { code: 'ready_to_close',              label: 'Sẵn sàng hoàn tất' },
  ADMIN_CONFIRMED:   { code: 'admin_confirmed_completion',  label: 'Admin xác nhận hoàn tất hợp đồng' },
  TOKENS_BURNED:     { code: 'tokens_burned',                label: 'Token đã Burn' },
  CONTRACT_CLOSED:   { code: 'contract_closed',              label: 'Hợp đồng đã đóng' },
};

// Predefined event catalogue per category — Admin (as Oracle) picks one of
// these when logging an update; `status_label` is stored denormalized on
// the event row so history displays correctly even if this catalogue
// changes later.
export const LC_ORACLE_EVENTS = {
  [LC_ORACLE_CATEGORY.WAREHOUSE]: [
    { code: 'goods_prepared',    label: 'Đã chuẩn bị hàng' },
    { code: 'warehouse_export',  label: 'Xuất kho' },
  ],
  [LC_ORACLE_CATEGORY.QUALITY]: [
    { code: 'quality_inspection', label: 'Kiểm định chất lượng' },
  ],
  [LC_ORACLE_CATEGORY.LOGISTICS]: [
    { code: 'goods_received', label: 'Đã nhận hàng' },
    { code: 'in_transit',     label: 'Đang vận chuyển' },
    { code: 'arrived_port',   label: 'Đến cảng' },
    { code: 'onboard',        label: 'Đã lên tàu (On-board)' },
  ],
};

export const LC_ONBOARD_CODE = 'onboard';

// Document types required for `oracle_completion_status` to reach
// COMPLETED — checked against distinct `document_type` values uploaded
// (via the shared warehouse_documents/IPFS module) and linked to the
// contract.
export const LC_REQUIRED_DOCUMENT_TYPES = [
  'warehouse_receipt',
  'certificate_of_quality',
  'packing_list',
  'bill_of_lading',
  'shipping_notice',
];

export function findOracleEvent(category, statusCode) {
  const list = LC_ORACLE_EVENTS[category] || [];
  return list.find(e => e.code === statusCode) || null;
}
