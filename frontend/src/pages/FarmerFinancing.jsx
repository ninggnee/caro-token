import { useState, useEffect, useCallback } from 'react';
import FarmerLayout from '../components/layout/FarmerLayout';
import BankSelect from '../components/common/BankSelect';
import { API_URL } from '../config/api';
import { formatVND, formatToken, formatNumber, formatPct } from '../utils/formatters';
import { sanitizeNonNegative } from '../utils/validation';
import { useTraderPrices, useTraderTokenBals, useTraderWallet, useInvalidateWallet, getPriceOf } from '../hooks/useTraderData';
import { estimateLoanTerms } from '../utils/loanRisk';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#B0E4CC', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#487573', yellow: '#f0b90b', orange: '#f77f00',
  purple: '#9b87f5',
};

const TOKENS = [
  { key: 'CR1', label: 'CaRo1', color: C.yellow,  desc: 'Robusta Cao cấp' },
  { key: 'CR2', label: 'CaRo2', color: C.green,   desc: 'Robusta Tiêu chuẩn' },
  { key: 'CR3', label: 'CaRo3', color: C.purple,  desc: 'Robusta Phổ thông' },
];

const LOAN_TERMS = [1, 3, 6, 12];

// Collateral loan lifecycle: pending → approved (bank credit decision,
// not yet disbursed) → active (funds disbursed, loan outstanding) → repaid.
// Token discounting lifecycle: pending → completed (paid + token
// transferred to bank) — see backend/constants/financeStatus.js.
const STATUS_LABELS = {
  pending:         { label: 'Chờ Ngân hàng duyệt',        color: C.yellow },
  admin_reviewing: { label: 'Đang xem xét',                color: C.yellow },
  bank_reviewing:  { label: 'Ngân hàng đang xem',          color: C.yellow },
  bank_valuation:  { label: 'Định giá',                     color: C.yellow },
  approved:        { label: 'Đã phê duyệt (chờ giải ngân)', color: C.yellow },
  disbursed:       { label: 'Đã giải ngân',                 color: C.green  },
  active:          { label: 'Đang vay (đã giải ngân)',      color: C.green  },
  payment_pending: { label: 'Chờ thanh toán',               color: C.orange },
  repaid:          { label: 'Đã tất toán',                  color: C.accent },
  completed:       { label: 'Hoàn tất (đã chuyển Token)',   color: C.accent },
  defaulted:       { label: 'Vỡ nợ',                        color: C.red    },
  rejected:        { label: 'Đã từ chối',                   color: C.red    },
};

function authHeader() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
  });
  return res.json();
}

const InfoRow = ({ l, v, highlight, last }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0',
    borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
    <span style={{ color: C.muted }}>{l}</span>
    <span style={{ fontWeight: 600, color: highlight || C.text, fontFamily: 'monospace' }}>{v}</span>
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.6px', marginBottom: 8 }}>{children}</div>
);

function TokenSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {TOKENS.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          flex: 1, padding: '8px 0', borderRadius: 6,
          border: `1px solid ${value === t.key ? t.color : C.border}`,
          background: value === t.key ? `${t.color}18` : 'transparent',
          color: value === t.key ? t.color : C.muted,
          fontWeight: value === t.key ? 700 : 400,
          cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
        }}>
          <div>{t.label}</div>
          <div style={{ fontSize: 10, marginTop: 1, opacity: 0.7 }}>{t.desc}</div>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: C.muted };
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: `${s.color}18`, color: s.color, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Repay (tất toán) confirmation modal ─────────────────────────────────────
function RepayModal({ loan, vndAvailable, submitting, onConfirm, onClose }) {
  if (!loan) return null;
  const annualInterest = Number(loan.max_loan_amount) * Number(loan.interest_rate);
  const termInterest   = annualInterest * (Number(loan.loan_term_months) / 12);
  const totalRepay     = Number(loan.max_loan_amount) + termInterest;
  const insufficient   = vndAvailable < totalRepay;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
      onClick={() => !submitting && onClose()}>
      <div className="caro-card" style={{ width: 420, maxWidth: '100%', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Tất toán khoản vay #{loan.id}</div>
        </div>
        <div style={{ padding: 20 }}>
          <InfoRow l="Gốc" v={formatVND(loan.max_loan_amount)} />
          <InfoRow l="Lãi" v={formatVND(termInterest)} highlight={C.red} />
          <InfoRow l="Tổng thanh toán" v={formatVND(totalRepay)} highlight={C.orange} />
          <InfoRow l="Số dư ví VND hiện tại" v={formatVND(vndAvailable)} highlight={insufficient ? C.red : C.green} last />
          {insufficient && (
            <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(246,70,93,0.08)',
              border: '1px solid rgba(246,70,93,0.2)', borderRadius: 6, fontSize: 12, color: C.red }}>
              Số dư ví VND không đủ để tất toán khoản vay này. Vui lòng nạp thêm VND vào ví.
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} disabled={submitting} style={{
            padding: '9px 16px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13,
          }}>Đóng</button>
          <button onClick={onConfirm} disabled={submitting || insufficient} style={{
            padding: '9px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 13,
            background: (submitting || insufficient) ? '#2b3a3a' : C.green,
            color: (submitting || insufficient) ? C.muted : '#000',
            cursor: (submitting || insufficient) ? 'not-allowed' : 'pointer',
          }}>
            {submitting ? 'Đang xử lý...' : 'Xác nhận tất toán'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Collateral Loan Tab ────────────────────────────────────────────────────
function CollateralLoanTab({ tokenBals, stats }) {
  const [token, setToken]             = useState('CR1');
  const [qty, setQty]                 = useState('');
  const [term, setTerm]               = useState(3);
  const [submitting, setSubmitting]   = useState(false);
  const [msg, setMsg]                 = useState(null);
  const [history, setHistory]         = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [repayLoan, setRepayLoan]     = useState(null);
  const [repaySubmitting, setRepaySubmitting] = useState(false);

  const { data: walletData } = useTraderWallet();
  const invalidateWallet = useInvalidateWallet();
  const vndAvailable = Number(walletData?.vnd_available ?? walletData?.vnd_balance ?? 0);

  const avail = Number(tokenBals[token]?.available || 0);
  const total = Number(tokenBals[token]?.total || avail);
  const price = getPriceOf(stats, token);
  const qtyN  = Math.min(parseFloat(qty) || 0, avail);

  // Preview only — deterministic estimate based on pledged quantity. The
  // real interest rate and LTV are generated (and fixed) server-side when
  // the loan is actually created; every later screen shows those saved
  // values instead of recomputing this estimate.
  const { interestRate: estInterestRate, ltv: estLtv } = estimateLoanTerms(qtyN);

  const collateralValue = qtyN * price;
  const maxLoan         = collateralValue * estLtv;
  const annualInterest  = maxLoan * estInterestRate;
  const termInterest    = annualInterest * (term / 12);
  const totalRepay      = maxLoan + termInterest;
  const monthlyPayment  = totalRepay / term;

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await apiFetch('/finance/collateral-loans');
      if (r.success) setHistory(r.data);
    } catch {}
    setHistLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    // Poll so a Bank decision made elsewhere (Admin bank-simulation screens)
    // shows up here without the farmer needing to manually refresh the page.
    const interval = setInterval(loadHistory, 15_000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  const handleSubmit = async () => {
    if (!qtyN || qtyN <= 0) return setMsg({ type: 'error', text: 'Vui lòng nhập số lượng hợp lệ' });
    if (price <= 0) return setMsg({ type: 'error', text: 'Không lấy được giá thị trường' });

    setSubmitting(true);
    setMsg(null);
    try {
      const r = await apiFetch('/finance/collateral-loans', {
        method: 'POST',
        body: JSON.stringify({
          token_type: token,
          quantity: qtyN,
          market_price: price,
          loan_term_months: term,
        }),
      });
      if (r.success) {
        setMsg({ type: 'success', text: `Hồ sơ vay #${r.id} đã được gửi: ${formatVND(r.max_loan_amount)} với lãi suất ${formatPct(r.interest_rate * 100, 1)}/năm (LTV ${formatPct(r.ltv * 100, 1)}). Token đã chuyển sang trạng thái Đã thế chấp.` });
        setQty('');
        loadHistory();
      } else {
        setMsg({ type: 'error', text: r.message || 'Lỗi gửi yêu cầu' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Lỗi kết nối máy chủ' });
    }
    setSubmitting(false);
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Hủy khoản vay này? Token sẽ được mở khóa.')) return;
    const r = await apiFetch(`/finance/collateral-loans/${id}`, { method: 'DELETE' });
    if (r.success) { setMsg({ type: 'success', text: 'Đã hủy. Token được mở khóa.' }); loadHistory(); }
    else setMsg({ type: 'error', text: r.message });
  };

  const handleRepayConfirm = async () => {
    if (!repayLoan) return;
    setRepaySubmitting(true);
    try {
      const r = await apiFetch(`/finance/collateral-loans/${repayLoan.id}/repay`, { method: 'POST' });
      if (r.success) {
        setMsg({ type: 'success', text: `Đã tất toán khoản vay #${repayLoan.id} (${formatVND(r.total_repaid)}). Token đã được mở khóa về trạng thái khả dụng.` });
        setRepayLoan(null);
        loadHistory();
        invalidateWallet();
      } else {
        alert(r.message || 'Tất toán thất bại');
      }
    } catch {
      alert('Lỗi kết nối máy chủ');
    }
    setRepaySubmitting(false);
  };

  const inputStyle = { padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* Left: Form */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Đăng ký vay thế chấp</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
            Dùng token làm tài sản bảo đảm. Bạn vẫn là <b style={{ color: C.green }}>chủ sở hữu</b> token.
          </div>

          <TokenSelector value={token} onChange={v => { setToken(v); setQty(''); }} />

          <SectionTitle>SỐ LƯỢNG THẾ CHẤP</SectionTitle>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input type="number" value={qty} onChange={e => setQty(sanitizeNonNegative(e.target.value))}
              placeholder="0" min="0" max={avail} style={inputStyle} />
            <button onClick={() => setQty(String(avail))} style={{
              padding: '9px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.dim, color: C.muted, cursor: 'pointer', fontSize: 12, flexShrink: 0,
            }}>Tối đa</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Khả dụng: <b style={{ color: C.green }}>{formatToken(avail, token)}</b>
            {total > avail && <> / Tổng: <b style={{ color: C.text }}>{formatToken(total, token)}</b></>}
            {price > 0 && <> · Giá: <b style={{ color: C.yellow }}>{formatVND(price)}/{token}</b></>}
          </div>

          <SectionTitle>THỜI HẠN VAY</SectionTitle>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {LOAN_TERMS.map(m => (
              <button key={m} onClick={() => setTerm(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12,
                border: `1px solid ${term === m ? C.accent : C.border}`,
                background: term === m ? `${C.accent}28` : 'transparent',
                color: term === m ? C.text : C.muted, cursor: 'pointer', fontWeight: term === m ? 700 : 400,
              }}>{m} tháng</button>
            ))}
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(246,70,93,0.06)',
            border: '1px solid rgba(246,70,93,0.15)', borderRadius: 6, fontSize: 11,
            color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
            <b style={{ color: C.red }}>Trạng thái token:</b>{' '}
            <span style={{ fontFamily: 'monospace', color: C.green }}>Khả dụng</span>
            {' → '}
            <span style={{ fontFamily: 'monospace', color: C.yellow }}>Đã thế chấp</span>
            {' — '}Token bị khóa, không thể giao dịch hay đổi hàng hóa cho đến khi hoàn trả xong.
          </div>

          {msg && (
            <div style={{ padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12,
              background: msg.type === 'success' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
              border: `1px solid ${msg.type === 'success' ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}`,
              color: msg.type === 'success' ? C.green : C.red }}>
              {msg.text}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting || qtyN <= 0 || price <= 0} style={{
            width: '100%', padding: 12, borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
            background: qtyN > 0 && price > 0 ? C.green : '#2b3a3a',
            color: qtyN > 0 && price > 0 ? '#000' : C.muted,
            cursor: qtyN > 0 && price > 0 ? 'pointer' : 'not-allowed',
          }}>
            {submitting ? 'Đang gửi...' : 'Gửi đơn vay thế chấp'}
          </button>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <SectionTitle>ĐIỀU KIỆN VAY</SectionTitle>
          <InfoRow l="Tỉ lệ LTV" v="70–80% giá trị tài sản thế chấp" />
          <InfoRow l="Lãi suất/năm" v="4,5% – 7,5% (tùy khối lượng thế chấp)" />
          <InfoRow l="Tính lãi" v="Tuyến tính theo kỳ hạn" />
          <InfoRow l="Bảo đảm tài sản" v="Ngân hàng giữ quyền bảo đảm" />
          <InfoRow l="Hoàn trả" v="Gốc + lãi → token được mở khóa" last />
        </div>
      </div>

      {/* Right: Summary + History */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chi tiết khoản vay</div>

          <SectionTitle>TÀI SẢN THẾ CHẤP</SectionTitle>
          <InfoRow l="Token" v={`${TOKENS.find(t => t.key === token)?.label} (${token})`} />
          <InfoRow l="Số lượng" v={qtyN > 0 ? formatToken(qtyN, token) : '—'} />
          <InfoRow l="Giá thị trường" v={price > 0 ? `${formatVND(price)}/${token}` : '—'} />
          <InfoRow l="Giá trị thế chấp" v={qtyN > 0 ? formatVND(collateralValue) : '—'} highlight={C.yellow} />

          <div style={{ margin: '12px 0' }} />
          <SectionTitle>KHOẢN VAY</SectionTitle>
          <InfoRow l="Tỉ lệ LTV áp dụng" v={qtyN > 0 ? `${formatPct(estLtv * 100, 1)} giá trị thế chấp` : '—'} />
          <InfoRow l="Số tiền vay tối đa" v={qtyN > 0 ? formatVND(maxLoan) : '—'} highlight={C.green} />
          <InfoRow l="Kỳ hạn" v={`${term} tháng`} />
          <InfoRow l="Lãi suất/năm" v={qtyN > 0 ? formatPct(estInterestRate * 100, 1) : '—'} highlight={C.yellow} />
          <InfoRow l={`Tiền lãi (${term} tháng)`}
            v={qtyN > 0 ? formatVND(termInterest) : '—'} highlight={C.red} />
          <InfoRow l="Tổng hoàn trả" v={qtyN > 0 ? formatVND(totalRepay) : '—'} highlight={C.orange} />
          <InfoRow l="Trả mỗi tháng (ước tính)" v={qtyN > 0 ? formatVND(monthlyPayment) : '—'} last />
          {qtyN > 0 && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
              * Ước tính. Lãi suất và LTV chính thức được xác định khi tạo khoản vay và giữ nguyên trong suốt thời hạn vay.
            </div>
          )}

          {qtyN > 0 && price > 0 && (
            <div style={{ marginTop: 16, padding: '12px 14px',
              background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.2)',
              borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Nhận ngay</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>
                  {formatVND(maxLoan)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                Hoàn trả {formatVND(totalRepay)} sau {term} tháng
              </div>
            </div>
          )}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Lịch sử vay thế chấp</div>
            <button onClick={loadHistory} style={{ fontSize: 11, color: C.muted, background: 'none',
              border: 'none', cursor: 'pointer' }}>↻ Làm mới</button>
          </div>
          {histLoading ? (
            <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Đang tải...</div>
          ) : history.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Chưa có khoản vay nào</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Ngày</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Token / KL</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Lãi suất / LTV</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Số tiền vay</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}>Trạng thái</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 6px', color: C.muted }}>{formatDate(row.created_at)}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                        <span style={{ color: TOKENS.find(t => t.key === row.token_type)?.color, fontWeight: 600 }}>
                          {row.token_type}
                        </span>
                        <span style={{ color: C.muted }}> {formatToken(row.quantity, '')}</span>
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', color: C.muted, fontFamily: 'monospace' }}>
                        {formatPct(Number(row.interest_rate) * 100, 1)} / {formatPct(Number(row.ltv) * 100, 1)}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: C.green }}>
                        {formatVND(row.requested_amount)}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                        <StatusBadge status={row.status} />
                        {row.status === 'rejected' && (row.rejection_reason || row.admin_note) && (
                          <div title={row.rejection_reason || row.admin_note} style={{ fontSize: 10, color: C.red, marginTop: 4, maxWidth: 140,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginInline: 'auto' }}>
                            Lý do: {row.rejection_reason || row.admin_note}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                        {row.status === 'pending' && (
                          <button onClick={() => handleCancel(row.id)} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            border: '1px solid rgba(246,70,93,0.4)', background: 'rgba(246,70,93,0.08)',
                            color: C.red, cursor: 'pointer',
                          }}>Hủy</button>
                        )}
                        {row.status === 'active' && (
                          <button onClick={() => setRepayLoan(row)} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            border: `1px solid ${C.green}66`, background: `${C.green}18`,
                            color: C.green, cursor: 'pointer', fontWeight: 700,
                          }}>Tất toán</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <RepayModal
        loan={repayLoan}
        vndAvailable={vndAvailable}
        submitting={repaySubmitting}
        onConfirm={handleRepayConfirm}
        onClose={() => !repaySubmitting && setRepayLoan(null)}
      />
    </div>
  );
}

// ── Token Discounting Tab ──────────────────────────────────────────────────
function TokenDiscountingTab({ tokenBals, stats }) {
  const [token, setToken]             = useState('CR1');
  const [qty, setQty]                 = useState('');
  const [banks, setBanks]             = useState([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [bankName, setBankName]       = useState('');
  const [confirmed, setConfirmed]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [msg, setMsg]                 = useState(null);
  const [history, setHistory]         = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const avail = Number(tokenBals[token]?.available || 0);
  const total = Number(tokenBals[token]?.total || avail);
  const price = getPriceOf(stats, token);
  const qtyN  = Math.min(parseFloat(qty) || 0, avail);

  // Haircut is decided by the bank, not the customer — fetched from the
  // server's bank policy list; picking a bank never triggers a new request,
  // the whole calculation below updates instantly from local state.
  const bankPolicy   = banks.find(b => b.name === bankName) || null;
  const nominalValue = qtyN * price;
  const haircutAmt   = bankPolicy ? nominalValue * bankPolicy.haircut : 0;
  const paymentAmt   = bankPolicy ? nominalValue * bankPolicy.disbursementRatio : 0;

  useEffect(() => {
    (async () => {
      setBanksLoading(true);
      try {
        const r = await apiFetch('/finance/banks');
        if (r.success) {
          setBanks(r.data);
          if (r.data.length) setBankName(r.data[0].name);
        }
      } catch {}
      setBanksLoading(false);
    })();
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await apiFetch('/finance/token-discounting');
      if (r.success) setHistory(r.data);
    } catch {}
    setHistLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    // Poll so a Bank decision made elsewhere (Admin bank-simulation screens)
    // shows up here without the farmer needing to manually refresh the page.
    const interval = setInterval(loadHistory, 15_000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  const handleSubmit = async () => {
    if (!qtyN || qtyN <= 0) return setMsg({ type: 'error', text: 'Vui lòng nhập số lượng hợp lệ' });
    if (price <= 0) return setMsg({ type: 'error', text: 'Không lấy được giá thị trường' });
    if (!bankName) return setMsg({ type: 'error', text: 'Vui lòng chọn ngân hàng nhận chuyển nhượng' });
    if (!confirmed) return setMsg({ type: 'error', text: 'Vui lòng xác nhận điều khoản chuyển nhượng quyền sở hữu' });

    setSubmitting(true);
    setMsg(null);
    try {
      const r = await apiFetch('/finance/token-discounting', {
        method: 'POST',
        body: JSON.stringify({
          token_type: token,
          quantity: qtyN,
          market_price: price,
          bank_name: bankName,
        }),
      });
      if (r.success) {
        setMsg({ type: 'success', text: `Giao dịch chiết khấu #${r.id} đã được gửi. Bạn sẽ nhận ${formatVND(r.payment_amount)}.` });
        setQty(''); setConfirmed(false);
        loadHistory();
      } else {
        setMsg({ type: 'error', text: r.message || 'Lỗi gửi yêu cầu' });
      }
    } catch {
      setMsg({ type: 'error', text: 'Lỗi kết nối máy chủ' });
    }
    setSubmitting(false);
  };

  const inputStyle = { padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };

  const canSubmit = qtyN > 0 && price > 0 && bankName && confirmed;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* Left: Form */}
      <div style={{ display: 'grid', gap: 14 }}>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chiết khấu token</div>

          <TokenSelector value={token} onChange={v => { setToken(v); setQty(''); }} />

          <SectionTitle>SỐ LƯỢNG BÁN CHIẾT KHẤU</SectionTitle>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input type="number" value={qty} onChange={e => setQty(sanitizeNonNegative(e.target.value))}
              placeholder="0" min="0" max={avail} style={inputStyle} />
            <button onClick={() => setQty(String(avail))} style={{
              padding: '9px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.dim, color: C.muted, cursor: 'pointer', fontSize: 12, flexShrink: 0,
            }}>Tối đa</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Khả dụng: <b style={{ color: C.green }}>{formatToken(avail, token)}</b>
            {total > avail && <> / Tổng: <b style={{ color: C.text }}>{formatToken(total, token)}</b></>}
            {price > 0 && <> · Giá: <b style={{ color: C.yellow }}>{formatVND(price)}/{token}</b></>}
          </div>

          <SectionTitle>NGÂN HÀNG NHẬN CHUYỂN NHƯỢNG</SectionTitle>
          <div style={{ marginBottom: 8 }}>
            <BankSelect banks={banks} value={bankName} onChange={setBankName} loading={banksLoading} />
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(176,228,204,0.06)',
            border: '1px solid rgba(176,228,204,0.15)', borderRadius: 6, fontSize: 11,
            color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Ngân hàng sẽ áp dụng tỷ lệ <b style={{ color: C.text }}>Haircut</b> theo chính sách nội bộ đối với tài sản bảo đảm là Token RWA.
            Giá trị giải ngân được xác định sau khi trừ Haircut.
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
            padding: '10px 12px', background: 'rgba(246,70,93,0.05)',
            border: `1px solid ${confirmed ? 'rgba(246,70,93,0.4)' : C.border}`, borderRadius: 6, marginBottom: 14 }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0, accentColor: C.red }} />
            <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              Tôi hiểu đây là <b style={{ color: C.red }}>giao dịch bán vĩnh viễn</b>.
              Tôi đồng ý chuyển nhượng toàn bộ quyền sở hữu token cho ngân hàng và xác nhận không thể hoàn tác.
            </span>
          </label>

          {msg && (
            <div style={{ padding: '9px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12,
              background: msg.type === 'success' ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
              border: `1px solid ${msg.type === 'success' ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}`,
              color: msg.type === 'success' ? C.green : C.red }}>
              {msg.text}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting || !canSubmit} style={{
            width: '100%', padding: 12, borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 14,
            background: canSubmit ? C.red : '#2b3a3a',
            color: canSubmit ? '#fff' : C.muted,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}>
            {submitting ? 'Đang gửi...' : 'Xác nhận chiết khấu & chuyển nhượng token'}
          </button>
        </div>
      </div>

      {/* Right: Summary + History */}
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Tính toán chiết khấu</div>

          <SectionTitle>TÀI SẢN BÁN CHIẾT KHẤU</SectionTitle>
          <InfoRow l="Token" v={`${TOKENS.find(t => t.key === token)?.label} (${token})`} />
          <InfoRow l="Số lượng" v={qtyN > 0 ? formatToken(qtyN, token) : '—'} />
          <InfoRow l="Giá thị trường" v={price > 0 ? `${formatVND(price)}/${token}` : '—'} />
          <InfoRow l="Giá trị danh nghĩa" v={qtyN > 0 ? formatVND(nominalValue) : '—'} highlight={C.yellow} />

          <div style={{ margin: '12px 0' }} />
          <SectionTitle>THÔNG TIN CHIẾT KHẤU</SectionTitle>
          <InfoRow l="Ngân hàng" v={bankPolicy?.name || '—'} />
          <InfoRow l="Haircut" v={bankPolicy ? formatPct(bankPolicy.haircut * 100, 0) : '—'} highlight={C.red} />
          <InfoRow l="Tỷ lệ giải ngân" v={bankPolicy ? formatPct(bankPolicy.disbursementRatio * 100, 0) : '—'} highlight={C.green} />
          <InfoRow l="Giá trị danh nghĩa" v={qtyN > 0 ? formatVND(nominalValue) : '—'} />
          <InfoRow l="Giá trị Haircut" v={qtyN > 0 && bankPolicy ? `− ${formatVND(haircutAmt)}` : '—'} highlight={C.red} />
          <InfoRow l="Giá trị thực nhận" v={qtyN > 0 && bankPolicy ? formatVND(paymentAmt) : '—'} highlight={C.green} last />

          {qtyN > 0 && price > 0 && bankPolicy && (
            <div style={{ marginTop: 16, padding: '12px 14px',
              background: 'rgba(14,203,129,0.06)', border: '1px solid rgba(14,203,129,0.2)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Nhận ngay (sau duyệt)</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>
                  {formatVND(paymentAmt)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {formatPct(bankPolicy.disbursementRatio * 100, 0)} giá trị danh nghĩa · Mất {formatVND(haircutAmt)} Haircut ({bankPolicy.name})
              </div>
            </div>
          )}

        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Lịch sử chiết khấu token</div>
            <button onClick={loadHistory} style={{ fontSize: 11, color: C.muted, background: 'none',
              border: 'none', cursor: 'pointer' }}>↻ Làm mới</button>
          </div>
          {histLoading ? (
            <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Đang tải...</div>
          ) : history.length === 0 ? (
            <div style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: 16 }}>Chưa có giao dịch nào</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: 10, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Ngày</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Token / KL</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Ngân hàng</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Haircut</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Nhận</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => (
                    <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '6px 6px', color: C.muted }}>{formatDate(row.created_at)}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                        <span style={{ color: TOKENS.find(t => t.key === row.token_type)?.color, fontWeight: 600 }}>
                          {row.token_type}
                        </span>
                        <span style={{ color: C.muted }}> {formatToken(row.quantity, '')}</span>
                      </td>
                      <td style={{ padding: '6px 6px', color: C.muted }}>{row.bank_name}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', color: C.muted }}>
                        {formatPct(Number(row.haircut) * 100, 0)}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right',
                        fontFamily: 'monospace', color: C.green }}>
                        {formatVND(row.payment_amount)}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                        <StatusBadge status={row.status} />
                        {row.status === 'rejected' && (row.rejection_reason || row.admin_note) && (
                          <div title={row.rejection_reason || row.admin_note} style={{ fontSize: 10, color: C.red, marginTop: 4, maxWidth: 140,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginInline: 'auto' }}>
                            Lý do: {row.rejection_reason || row.admin_note}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FarmerFinancing() {
  const [tab, setTab] = useState('collateral');

  const { data: balsData }   = useTraderTokenBals();
  const { data: pricesData } = useTraderPrices();
  const tokenBals = balsData?.data || {};
  const stats     = pricesData?.stats || [];

  return (
    <FarmerLayout title="Tài chính">
      <div style={{ width: "100%", color: C.text, fontSize: 13 }}>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Dịch vụ tài chính</h2>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {[
            { key: 'collateral',  label: 'Vay thế chấp',    color: C.green },
            { key: 'discounting', label: 'Chiết khấu Token', color: C.red  },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '12px 28px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: tab === t.key ? C.text : C.muted, textAlign: 'left',
              borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>
              <div style={{ fontWeight: tab === t.key ? 700 : 400, fontSize: 14 }}>{t.label}</div>
            </button>
          ))}
        </div>

        {tab === 'collateral'  && <CollateralLoanTab   tokenBals={tokenBals} stats={stats} />}
        {tab === 'discounting' && <TokenDiscountingTab tokenBals={tokenBals} stats={stats} />}

        <div style={{ marginTop: 36 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', marginBottom: 14 }}>TÀI SẢN TOKEN HIỆN CÓ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {TOKENS.map(t => {
              const avail  = Number(tokenBals[t.key]?.available || 0);
              const total  = Number(tokenBals[t.key]?.total || avail);
              const price  = getPriceOf(stats, t.key);
              const value  = avail * price;
              const stat   = stats.find(s => s.token === t.key) || {};
              const change = Number(stat.change_24h || 0);
              return (
                <div key={t.key} style={{ background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: t.color, fontSize: 14 }}>{t.label}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: change >= 0 ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                      color: change >= 0 ? C.green : C.red, fontWeight: 700 }}>
                      {change >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(change), 2)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>
                    {formatToken(avail, t.key)}
                  </div>
                  {total > avail && (
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                      / {formatToken(total, t.key)} tổng · {formatToken(total - avail, t.key)} đang khóa
                    </div>
                  )}
                  {price > 0 && (
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {formatVND(price)}/{t.key} · ≈ <b style={{ color: C.text }}>{formatVND(value)}</b>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </FarmerLayout>
  );
}
