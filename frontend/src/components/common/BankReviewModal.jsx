/**
 * BankReviewModal — confirmation popup for a bank decision on a collateral
 * loan / token discounting request (approve / disburse / reject).
 *
 * Copy is deliberately plain business-system language — no "demo",
 * "simulation", or similar wording anywhere in the rendered UI.
 *
 * Rejecting REQUIRES a reason, passed to onConfirm(reason). The caller
 * sends it as `note` to the review API, which stores it in
 * `rejection_reason` (+ `admin_note`) so the Farmer can see why they were
 * rejected.
 */

import { useEffect, useState } from 'react';

const TITLES = {
  loan:     { approve: 'Xác nhận phê duyệt khoản vay', disburse: 'Xác nhận giải ngân khoản vay', reject: 'Xác nhận từ chối khoản vay' },
  discount: { approve: 'Xác nhận phê duyệt chiết khấu', reject: 'Xác nhận từ chối chiết khấu' },
};

const BODY = {
  loan: {
    approve: 'Bạn có chắc chắn muốn phê duyệt khoản vay này? Sau khi phê duyệt, khoản vay sẽ được chuyển sang trạng thái "Đã phê duyệt" và sẵn sàng giải ngân.',
    disburse: 'Bạn có chắc chắn muốn giải ngân khoản vay này? Sau khi giải ngân, số tiền vay sẽ được chuyển vào ví của Farmer và khoản vay chuyển sang trạng thái "Đang vay".',
  },
  discount: {
    approve: 'Bạn có chắc chắn muốn phê duyệt yêu cầu chiết khấu này? Sau khi phê duyệt, hệ thống sẽ thực hiện giải ngân theo tỷ lệ chiết khấu đã tính toán.',
  },
};

const REJECT_BODY = 'Vui lòng nhập lý do từ chối trước khi xác nhận.';

const CONFIRM_LABEL = {
  approve:  'Phê duyệt',
  disburse: 'Giải ngân',
  reject:   'Từ chối',
};

export default function BankReviewModal({ open, action, product, item, submitting, onConfirm, onClose }) {
  const [reason, setReason] = useState('');

  // Reset the reason field every time a new confirmation is opened, so a
  // stale reason from a previous reject can't be silently reused.
  useEffect(() => {
    if (open) setReason('');
  }, [open, item?.id, action]);

  if (!open) return null;

  const isReject = action === 'reject';
  const reasonTrimmed = reason.trim();
  const canConfirm = !isReject || reasonTrimmed.length > 0;
  const title = TITLES[product]?.[action] || 'Xác nhận thao tác';

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(4px)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 9999, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="caro-card"
        style={{ width: 440, maxWidth: "100%", padding: 0, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="caro-section-header">
          <h3 className="caro-section-title" style={{ fontSize: 15, margin: 0 }}>{title}</h3>
        </div>

        <div style={{ padding: 24 }}>
          {!isReject ? (
            <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 }}>
              {BODY[product]?.[action]}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 16 }}>
                {REJECT_BODY}
              </div>
              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>
                Lý do từ chối <span style={{ color: '#f6465d' }}>*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Nhập lý do từ chối..."
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 6,
                  border: `1px solid ${reasonTrimmed ? 'rgba(255,255,255,0.15)' : 'rgba(246,70,93,0.4)'}`,
                  background: 'rgba(255,255,255,0.03)', color: '#e2e8f0', fontSize: 13,
                  fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "flex-end", gap: 12, background: "rgba(255,255,255,0.01)",
        }}>
          <button className="caro-btn caro-btn-ghost" onClick={onClose} disabled={submitting}>Hủy</button>
          <button
            className={`caro-btn ${isReject ? 'caro-btn-danger' : 'caro-btn-primary'}`}
            onClick={() => onConfirm(reasonTrimmed)}
            disabled={submitting || !canConfirm}
          >
            {submitting ? 'Đang xử lý...' : CONFIRM_LABEL[action]}
          </button>
        </div>
      </div>
    </div>
  );
}
