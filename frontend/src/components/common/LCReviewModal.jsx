/**
 * LCReviewModal — confirmation popup for a bank/Oracle decision on an L/C
 * ("Nhận nông sản thực tế") contract: approve / reject / gather+lock Token /
 * settle deferred credit / confirm completion.
 *
 * Mirrors BankReviewModal.jsx's conventions exactly (same visual structure,
 * same plain business-system language — no "demo"/"simulation"/"mô phỏng"
 * wording anywhere in the rendered copy). Rejecting REQUIRES a reason,
 * passed to onConfirm(reason); the caller sends it as `note` to the review
 * API, which stores it in `rejection_reason` so the Trader can see why.
 */

import { useEffect, useState } from 'react';

const TITLES = {
  approve:          'Xác nhận phê duyệt hợp đồng',
  reject:           'Xác nhận từ chối hợp đồng',
  gather_lock:      'Xác nhận gom và khóa Token',
  settle_credit:    'Xác nhận tất toán tín dụng',
  complete:         'Xác nhận hoàn tất hợp đồng',
};

const BODY = {
  approve: 'Bạn có chắc chắn muốn phê duyệt hợp đồng này? Ngân hàng sẽ tài trợ phần còn lại của hợp đồng và hợp đồng chuyển sang trạng thái "Đã phê duyệt", sẵn sàng gom Token.',
  gather_lock: 'Ngân hàng sẽ gom Token đang lưu hành trên nền tảng từ các ví hiện có (không phải Token của Trader) và khóa toàn bộ vào ví ký quỹ Smart Contract Escrow. Hành động này không thể hoàn tác.',
  settle_credit: 'Xác nhận khoản tín dụng trả chậm của Trader đã được tất toán. Số tiền ngân hàng tài trợ sẽ được trừ từ ví VND của Trader.',
  complete: (
    <div>
      <div style={{ marginBottom: 10 }}>Bạn có chắc chắn muốn hoàn tất hợp đồng L/C này?</div>
      <div style={{ marginBottom: 6 }}>Sau khi xác nhận, hệ thống sẽ:</div>
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
        <li>Burn toàn bộ Token đang bị khóa trong Ví ký quỹ giao dịch L/C.</li>
        <li>Đóng hợp đồng.</li>
        <li>Kết thúc vòng đời Token.</li>
      </ul>
      <div style={{ marginTop: 10, fontWeight: 700, color: '#f6465d' }}>Thao tác này không thể hoàn tác.</div>
    </div>
  ),
};

const REJECT_BODY = 'Vui lòng nhập lý do từ chối trước khi xác nhận. Tiền ký quỹ của Trader sẽ được hoàn lại đầy đủ.';

const CONFIRM_LABEL = {
  approve:          'Phê duyệt',
  reject:           'Từ chối',
  gather_lock:      'Gom & Khóa Token',
  settle_credit:    'Xác nhận tất toán',
  complete:         'Xác nhận',
};

export default function LCReviewModal({ open, action, item, submitting, onConfirm, onClose }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open, item?.id, action]);

  if (!open) return null;

  const isReject = action === 'reject';
  const reasonTrimmed = reason.trim();
  const canConfirm = !isReject || reasonTrimmed.length > 0;
  const title = TITLES[action] || 'Xác nhận thao tác';

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="caro-card"
        style={{ width: 460, maxWidth: '100%', padding: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="caro-section-header">
          <h3 className="caro-section-title" style={{ fontSize: 15, margin: 0 }}>{title}</h3>
        </div>

        <div style={{ padding: 24 }}>
          {!isReject ? (
            <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 }}>
              {BODY[action]}
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
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(255,255,255,0.01)',
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
