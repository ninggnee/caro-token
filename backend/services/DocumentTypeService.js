/**
 * DocumentTypeService — single source of truth for:
 *  1. classifying a `document_type` string into a display label + Vietnamese group name
 *  2. the minimum batch logistics_status stage at which each group may be shown
 *
 * New document_type values (from batch uploads, warehouse uploads, or any future
 * source) are classified automatically via keyword matching — nothing here needs
 * to be edited when the backend starts producing a new type. LABELS below only
 * improves the cosmetic label for well-known types; any type missing from it still
 * gets a readable label via prettify().
 */

const GROUP_RULES = [
  { group: 'Tài liệu nông hộ',              test: /harvest|coffee_photo|^photo|farm/i },
  { group: 'Tài liệu nhập kho',             test: /warehouse|receipt|storage|stock/i },
  { group: 'Tài liệu kiểm định chất lượng', test: /quality|inspect|audit|lab|analysis|certificate/i },
  { group: 'Tài liệu logistics',            test: /logistic|transport|shipping|delivery/i },
];

// Display order follows the batch workflow: farmer docs → warehouse intake →
// quality inspection → logistics → everything else.
export const DOCUMENT_GROUP_ORDER = [
  'Tài liệu nông hộ',
  'Tài liệu nhập kho',
  'Tài liệu kiểm định chất lượng',
  'Tài liệu logistics',
  'Tài liệu khác',
];

// Batch logistics pipeline, earliest → latest (mirrors SimulationDaemon's
// LOGISTICS_FLOW, extended with the terminal MINTED stage). A document's group
// determines the earliest stage the batch must have reached before that
// document may be shown — regardless of when the underlying row was inserted,
// since a farmer can attach a "quality_inspection" file at batch-creation time
// well before the batch has actually gone through inspection.
export const LOGISTICS_STAGE_ORDER = [
  'PENDING_PICKUP',
  'IN_TRANSIT',
  'DELIVERED',
  'STANDARDIZED',
  'STORED',
  'INSPECTED',
  'MINTED',
];

const GROUP_REQUIRED_STAGE = {
  'Tài liệu nông hộ':              'PENDING_PICKUP',
  'Tài liệu logistics':            'IN_TRANSIT',
  'Tài liệu nhập kho':             'STORED',
  'Tài liệu kiểm định chất lượng': 'INSPECTED',
  'Tài liệu khác':                 'PENDING_PICKUP', // unclassified docs are never gated
};

const LABELS = {
  harvest_certificate:       'Giấy chứng nhận thu hoạch',
  coffee_photos:             'Ảnh sản phẩm',
  quality_inspection:        'Báo cáo kiểm định chất lượng',
  quality_audit:             'Đánh giá chất lượng',
  inspection_report:         'Giấy chứng nhận kiểm định độc lập',
  lab_analysis:              'Kết quả phân tích phòng thí nghiệm',
  warehouse_receipt:         'Biên bản bàn giao và nhập kho',
  coffee_storage_report:     'Báo cáo lưu trữ cà phê',
  warehouse_license:         'Giấy phép kho bãi',
  warehouse_certificate:     'Giấy chứng nhận kho bãi',
  warehouse_insurance:       'Bảo hiểm kho bãi',
  warehouse_ownership_proof: 'Chứng từ sở hữu kho bãi',
  warehouse_photos:          'Ảnh kho bãi',
  farmer_identity:           'Giấy tờ tùy thân nông hộ',
  farm_ownership:            'Giấy chứng nhận quyền sử dụng đất',
  additional_docs:           'Tài liệu bổ sung',
  other:                     'Tài liệu khác',
};

function prettify(type) {
  return String(type)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function stageIndex(stage) {
  const i = LOGISTICS_STAGE_ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}

export function classifyDocumentType(type) {
  const label = LABELS[type] || prettify(type);
  const rule = GROUP_RULES.find(r => r.test.test(type));
  const group = rule ? rule.group : 'Tài liệu khác';
  const requiredStage = GROUP_REQUIRED_STAGE[group] ?? 'PENDING_PICKUP';
  return { label, group, requiredStage };
}

// True once the batch's current logistics stage has reached (or passed) the
// stage that produces documents of this group.
export function isVisibleAtStage(requiredStage, currentStage) {
  return stageIndex(requiredStage) <= stageIndex(currentStage);
}

// asset_batches.logistics_status was added by a later migration (v9) with
// DEFAULT 'PENDING_PICKUP' — batches that were already MINTED/APPROVED before
// that migration ran never had it backfilled, so their raw logistics_status
// can understate how far the batch actually got. batch.status is the older,
// authoritative field for the terminal outcome, so once a batch is MINTED or
// APPROVED it must never be treated as earlier than the final stage — that
// would incorrectly hide real, already-existing documents (e.g. the quality
// inspection report of an already-minted batch).
const TERMINAL_STATUSES = new Set(['MINTED', 'APPROVED']);

export function effectiveLogisticsStage(status, logisticsStatus) {
  const raw = logisticsStatus || 'PENDING_PICKUP';
  if (TERMINAL_STATUSES.has(status)) {
    return stageIndex(raw) >= stageIndex('MINTED') ? raw : 'MINTED';
  }
  return raw;
}

// Single source of truth for "how many documents is the farmer actually
// allowed to see right now" — used both to build the visible document list
// (getBatchById/getBatchDocuments, filtered again client-side) and to compute
// the doc_count badge in batch list endpoints, so the two can never diverge.
export function countVisibleDocuments(documentTypes, currentStage) {
  return documentTypes.filter(type => {
    const { requiredStage } = classifyDocumentType(type);
    return isVisibleAtStage(requiredStage, currentStage || 'PENDING_PICKUP');
  }).length;
}
