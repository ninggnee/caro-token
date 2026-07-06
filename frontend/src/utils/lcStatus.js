/**
 * Status constants + derived DISPLAY-ONLY labels for the L/C ("Nhận nông
 * sản thực tế") Trader + Admin (Bank simulation / Oracle) screens.
 *
 * Values MUST match backend/constants/lcStatus.js and the ENUMs in
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
 *   PENDING_BANK_APPROVAL → (bank từ chối)                → REJECTED
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

export const LC_STATUS_LABELS = {
  pending_bank_approval: { label: 'Chờ Ngân hàng duyệt',        color: '#f0b90b' },
  bank_approved:         { label: 'Đã phê duyệt (chờ gom Token)', color: '#f0b90b' },
  tokens_locked:         { label: 'Đã khóa Token — chờ chọn thanh toán', color: '#f0b90b' },
  active:                { label: 'Đang thực hiện hợp đồng',    color: '#B0E4CC' },
  ready_to_close:        { label: 'Sẵn sàng hoàn tất',          color: '#f0b90b' },
  closed:                { label: 'Hợp đồng đã hoàn tất',       color: '#487573' },
  rejected:              { label: 'Đã từ chối',                 color: '#f6465d' },
};

// ── Oracle completion status ────────────────────────────────────────────
// Distinct from the per-event display (`oracle_status_label`, the *latest*
// event) — this tracks whether the FULL Oracle attestation bundle is done.
export const LC_ORACLE_COMPLETION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
};

export const LC_ORACLE_COMPLETION_STATUS_LABELS = {
  in_progress: { label: 'Đang thực hiện', color: '#f0b90b' },
  completed:   { label: 'Đã hoàn tất',     color: '#B0E4CC' },
};

export const LC_PAYMENT_METHOD = {
  IMMEDIATE: 'immediate',
  DEFERRED:  'deferred',
};

export const LC_PAYMENT_METHOD_LABELS = {
  immediate: 'Thanh toán ngay',
  deferred:  'Mua trả chậm',
};

export const LC_PAYMENT_STATUS = {
  PENDING_SELECTION: 'pending_selection',
  AWAITING_PAYMENT:  'awaiting_payment',
  COMPLETED:         'completed',
};

export const LC_PAYMENT_STATUS_LABELS = {
  pending_selection: { label: 'Chưa chọn phương thức', color: '#64748b' },
  awaiting_payment:  { label: 'Chờ thanh toán',         color: '#f0b90b' },
  completed:         { label: 'Đã hoàn tất',            color: '#B0E4CC' },
};

export const LC_DELIVERY_STATUS = {
  NOT_DELIVERED: 'not_delivered',
  DELIVERED:     'delivered',
};

export const LC_DELIVERY_STATUS_LABELS = {
  not_delivered: { label: 'Chưa nhận hàng', color: '#64748b' },
  delivered:     { label: 'Đã nhận hàng',   color: '#B0E4CC' },
};

export const LC_ORACLE_CATEGORY = {
  WAREHOUSE: 'warehouse',
  QUALITY:   'quality',
  LOGISTICS: 'logistics',
};

export const LC_ORACLE_CATEGORY_LABELS = {
  warehouse: 'Kho vận',
  quality:   'Kiểm định',
  logistics: 'Vận chuyển',
  // System-generated Timeline milestones (payment completed, ready to
  // close, admin confirmation, burn, closed) — see backend
  // LC_SYSTEM_MILESTONES. Not selectable in the Admin's manual event form.
  system:    'Hệ thống',
};

// Predefined event catalogue per category — MUST match
// backend/constants/lcStatus.js LC_ORACLE_EVENTS.
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

// Required document types before the bank will confirm the final "hoàn
// tất" step — MUST match backend/constants/lcStatus.js LC_REQUIRED_DOCUMENT_TYPES.
export const LC_REQUIRED_DOCUMENT_TYPES = [
  { value: 'warehouse_receipt',      label: 'Phiếu nhập kho' },
  { value: 'certificate_of_quality', label: 'Chứng nhận chất lượng' },
  { value: 'packing_list',           label: 'Phiếu đóng gói' },
  { value: 'bill_of_lading',         label: 'Vận đơn' },
  { value: 'shipping_notice',        label: 'Thông báo vận chuyển' },
];

export function lcDocumentTypeLabel(type) {
  return LC_REQUIRED_DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
}

export function formatDueDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Lifecycle stepper for the contract detail page — computed from the
 * contract's actual status + timestamps, not a separate stored field.
 * `rejected` is a terminal side-branch off "pending" and is rendered
 * separately by callers.
 */
export function lcLifecycleSteps(c) {
  return [
    { key: 'pending_bank_approval', label: 'Chờ ngân hàng duyệt',        done: true, at: c.created_at },
    { key: 'bank_approved',         label: 'Đã phê duyệt',               done: [LC_STATUS.BANK_APPROVED, LC_STATUS.TOKENS_LOCKED, LC_STATUS.ACTIVE, LC_STATUS.READY_TO_CLOSE, LC_STATUS.CLOSED].includes(c.status), at: c.approved_at },
    { key: 'tokens_locked',         label: 'Đã khóa Token (Escrow)',     done: [LC_STATUS.TOKENS_LOCKED, LC_STATUS.ACTIVE, LC_STATUS.READY_TO_CLOSE, LC_STATUS.CLOSED].includes(c.status), at: c.locked_at },
    { key: 'payment_method',        label: 'Đã chọn phương thức thanh toán', done: [LC_STATUS.ACTIVE, LC_STATUS.READY_TO_CLOSE, LC_STATUS.CLOSED].includes(c.status), at: c.payment_method_selected_at },
    { key: 'ready_to_close',        label: 'Sẵn sàng hoàn tất',          done: [LC_STATUS.READY_TO_CLOSE, LC_STATUS.CLOSED].includes(c.status), at: c.ready_to_close_at },
    { key: 'closed',                label: 'Hoàn tất hợp đồng',          done: c.status === LC_STATUS.CLOSED, at: c.closed_at },
  ];
}

/**
 * Missing-condition reasons for the Admin "Hoàn tất hợp đồng" button —
 * shown when the contract hasn't yet auto-advanced to READY_TO_CLOSE.
 */
export function lcCompletionBlockers(c) {
  const reasons = [];
  if (c.oracle_completion_status !== LC_ORACLE_COMPLETION_STATUS.COMPLETED) reasons.push('Chưa hoàn tất Oracle');
  if (c.payment_status !== LC_PAYMENT_STATUS.COMPLETED) reasons.push('Chưa hoàn tất thanh toán');
  if (c.delivery_status !== LC_DELIVERY_STATUS.DELIVERED) reasons.push('Chưa xác nhận giao hàng');
  return reasons;
}
