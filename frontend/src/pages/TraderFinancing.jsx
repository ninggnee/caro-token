import { useState, useEffect, useCallback } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';
import { formatVND, formatKg, formatNumber } from '../utils/formatters';
import { useTraderPrices, useTraderTokenBals, getPriceOf } from '../hooks/useTraderData';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#0ecb81', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#487573', yellow: '#f0b90b', orange: '#f77f00',
  purple: '#9b87f5',
};

const TOKENS = [
  { key: 'CR1', label: 'CaRo1', color: C.yellow,  desc: 'Robusta Cao cấp' },
  { key: 'CR2', label: 'CaRo2', color: C.green,   desc: 'Robusta Tiêu chuẩn' },
  { key: 'CR3', label: 'CaRo3', color: C.purple,  desc: 'Robusta Phổ thông' },
];

const RISK_LEVELS = [
  { key: 'low',    label: 'Thấp',   haircut: 0.10, ratio: 0.90, color: C.green  },
  { key: 'medium', label: 'Trung bình', haircut: 0.20, ratio: 0.80, color: C.yellow },
  { key: 'high',   label: 'Cao',    haircut: 0.30, ratio: 0.70, color: C.red    },
];

const LOAN_TERMS = [1, 3, 6, 12];
const LTV = 0.70;
const INTEREST_RATE = 0.08;  // 8% per year

const STATUS_LABELS = {
  pending:         { label: 'Chờ duyệt',   color: C.yellow },
  admin_reviewing: { label: 'Admin xem xét', color: C.yellow },
  bank_reviewing:  { label: 'Ngân hàng xem', color: C.yellow },
  bank_valuation:  { label: 'Định giá',    color: C.yellow },
  approved:        { label: 'Đã duyệt',    color: C.green  },
  disbursed:       { label: 'Đã giải ngân', color: C.green },
  active:          { label: 'Đang hoạt động', color: C.green },
  payment_pending: { label: 'Chờ thanh toán', color: C.orange },
  repaid:          { label: 'Đã trả xong',  color: C.accent },
  completed:       { label: 'Hoàn tất',    color: C.accent },
  defaulted:       { label: 'Vỡ nợ',       color: C.red    },
  rejected:        { label: 'Từ chối',     color: C.red    },
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

// ── Collateral Loan Tab ────────────────────────────────────────────────────
function CollateralLoanTab({ tokenBals, stats }) {
  const [token, setToken]         = useState('CR1');
  const [qty, setQty]             = useState('');
  const [term, setTerm]           = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState(null);
  const [history, setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const avail  = Number(tokenBals[token]?.available || 0);
  const total  = Number(tokenBals[token]?.total || avail);
  const price  = getPriceOf(stats, token);
  const qtyN   = Math.min(parseFloat(qty) || 0, avail);

  const collateralValue = qtyN * price;
  const maxLoan         = collateralValue * LTV;
  const annualInterest  = maxLoan * INTEREST_RATE;
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

  useEffect(() => { loadHistory(); }, [loadHistory]);

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
          requested_amount: maxLoan,
          loan_term_months: term,
        }),
      });
      if (r.success) {
        setMsg({ type: 'success', text: `Hồ sơ vay #${r.id} đã được gửi. Token đã chuyển sang trạng thái PLEDGED.` });
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
            <input type="number" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="0" min="0" max={avail} style={inputStyle} />
            <button onClick={() => setQty(String(avail))} style={{
              padding: '9px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.dim, color: C.muted, cursor: 'pointer', fontSize: 12, flexShrink: 0,
            }}>MAX</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Khả dụng: <b style={{ color: C.green }}>{formatKg(avail)}</b>
            {total > avail && <> / Tổng: <b style={{ color: C.text }}>{formatKg(total)}</b></>}
            {price > 0 && <> · Giá: <b style={{ color: C.yellow }}>{formatVND(price)}/kg</b></>}
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

          {/* Token state warning */}
          <div style={{ padding: '10px 12px', background: 'rgba(246,70,93,0.06)',
            border: '1px solid rgba(246,70,93,0.15)', borderRadius: 6, fontSize: 11,
            color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
            <b style={{ color: C.red }}>Trạng thái token:</b>{' '}
            <span style={{ fontFamily: 'monospace', color: C.green }}>AVAILABLE</span>
            {' → '}
            <span style={{ fontFamily: 'monospace', color: C.yellow }}>PLEDGED</span>
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

        {/* Conditions */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <SectionTitle>ĐIỀU KIỆN VAY</SectionTitle>
          <InfoRow l="Tỉ lệ LTV" v="70% giá trị thế chấp" />
          <InfoRow l="Lãi suất" v={`${(INTEREST_RATE * 100).toFixed(0)}%/năm`} />
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
          <InfoRow l="Số lượng" v={qtyN > 0 ? formatKg(qtyN) : '—'} />
          <InfoRow l="Giá thị trường" v={price > 0 ? `${formatVND(price)}/kg` : '—'} />
          <InfoRow l="Giá trị thế chấp" v={qtyN > 0 ? formatVND(collateralValue) : '—'} highlight={C.yellow} />

          <div style={{ margin: '12px 0' }} />
          <SectionTitle>KHOẢN VAY (70% LTV)</SectionTitle>
          <InfoRow l="Số tiền vay tối đa" v={qtyN > 0 ? formatVND(maxLoan) : '—'} highlight={C.green} />
          <InfoRow l="Kỳ hạn" v={`${term} tháng`} />
          <InfoRow l={`Lãi ${(INTEREST_RATE * 100).toFixed(0)}%/năm (${term} tháng)`}
            v={qtyN > 0 ? formatVND(termInterest) : '—'} highlight={C.red} />
          <InfoRow l="Tổng hoàn trả" v={qtyN > 0 ? formatVND(totalRepay) : '—'} highlight={C.orange} />
          <InfoRow l="Trả mỗi tháng (ước tính)" v={qtyN > 0 ? formatVND(monthlyPayment) : '—'} last />

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

        {/* History */}
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
                        <span style={{ color: C.muted }}> {formatKg(row.quantity)}</span>
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'monospace', color: C.green }}>
                        {formatVND(row.requested_amount)}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                        {row.status === 'pending' && (
                          <button onClick={() => handleCancel(row.id)} style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            border: '1px solid rgba(246,70,93,0.4)', background: 'rgba(246,70,93,0.08)',
                            color: C.red, cursor: 'pointer',
                          }}>Hủy</button>
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

// ── Token Discounting Tab ──────────────────────────────────────────────────
function TokenDiscountingTab({ tokenBals, stats }) {
  const [token, setToken]         = useState('CR1');
  const [qty, setQty]             = useState('');
  const [bankName, setBankName]   = useState('');
  const [riskLevel, setRiskLevel] = useState('medium');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState(null);
  const [history, setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const avail = Number(tokenBals[token]?.available || 0);
  const total = Number(tokenBals[token]?.total || avail);
  const price = getPriceOf(stats, token);
  const qtyN  = Math.min(parseFloat(qty) || 0, avail);

  const risk         = RISK_LEVELS.find(r => r.key === riskLevel);
  const nominalValue = qtyN * price;
  const haircutAmt   = nominalValue * risk.haircut;
  const paymentAmt   = nominalValue * risk.ratio;

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const r = await apiFetch('/finance/token-discounting');
      if (r.success) setHistory(r.data);
    } catch {}
    setHistLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSubmit = async () => {
    if (!qtyN || qtyN <= 0) return setMsg({ type: 'error', text: 'Vui lòng nhập số lượng hợp lệ' });
    if (price <= 0) return setMsg({ type: 'error', text: 'Không lấy được giá thị trường' });
    if (!bankName.trim()) return setMsg({ type: 'error', text: 'Vui lòng nhập tên ngân hàng' });
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
          bank_name: bankName.trim(),
          risk_level: riskLevel,
        }),
      });
      if (r.success) {
        setMsg({ type: 'success', text: `Giao dịch chiết khấu #${r.id} đã được gửi. Bạn sẽ nhận ${formatVND(r.payment_amount)}.` });
        setQty(''); setBankName(''); setConfirmed(false);
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

  const canSubmit = qtyN > 0 && price > 0 && bankName.trim() && confirmed;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* Left: Form */}
      <div style={{ display: 'grid', gap: 14 }}>

        {/* True-sale warning */}
        <div style={{ padding: '14px 16px', background: 'rgba(246,70,93,0.08)',
          border: '1px solid rgba(246,70,93,0.35)', borderRadius: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.red, marginBottom: 8 }}>
            CHUYỂN NHƯỢNG SỞ HỮU VĨNH VIỄN (TRUE SALE)
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
            Đây <b style={{ color: C.text }}>không phải khoản vay</b>. Bạn <b style={{ color: C.red }}>bán hẳn</b> token
            cho ngân hàng với giá chiết khấu. Sau khi giao dịch hoàn tất, bạn{' '}
            <b style={{ color: C.red }}>không còn quyền sở hữu</b>, không thể mua lại, và token sẽ ở trạng thái{' '}
            <span style={{ fontFamily: 'monospace', color: C.orange }}>DISCOUNTED</span>.<br />
            Ngân hàng có toàn quyền giữ, giao dịch, đổi hàng hóa, hoặc hủy token.
          </div>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chiết khấu token</div>

          <TokenSelector value={token} onChange={v => { setToken(v); setQty(''); }} />

          <SectionTitle>SỐ LƯỢNG BÁN CHIẾT KHẤU</SectionTitle>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="0" min="0" max={avail} style={inputStyle} />
            <button onClick={() => setQty(String(avail))} style={{
              padding: '9px 12px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.dim, color: C.muted, cursor: 'pointer', fontSize: 12, flexShrink: 0,
            }}>MAX</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
            Khả dụng: <b style={{ color: C.green }}>{formatKg(avail)}</b>
            {total > avail && <> / Tổng: <b style={{ color: C.text }}>{formatKg(total)}</b></>}
            {price > 0 && <> · Giá: <b style={{ color: C.yellow }}>{formatVND(price)}/kg</b></>}
          </div>

          <SectionTitle>MỨC RỦI RO (ảnh hưởng tỉ lệ chiết khấu)</SectionTitle>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {RISK_LEVELS.map(r => (
              <button key={r.key} onClick={() => setRiskLevel(r.key)} style={{
                flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 12,
                border: `1px solid ${riskLevel === r.key ? r.color : C.border}`,
                background: riskLevel === r.key ? `${r.color}18` : 'transparent',
                color: riskLevel === r.key ? r.color : C.muted,
                cursor: 'pointer', fontWeight: riskLevel === r.key ? 700 : 400,
              }}>
                <div>{r.label}</div>
                <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>
                  Haircut {(r.haircut * 100).toFixed(0)}% · Nhận {(r.ratio * 100).toFixed(0)}%
                </div>
              </button>
            ))}
          </div>

          <SectionTitle>NGÂN HÀNG NHẬN CHUYỂN NHƯỢNG</SectionTitle>
          <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
            placeholder="VD: Vietcombank, Agribank..." style={{ ...inputStyle, marginBottom: 16 }} />

          {/* Confirmation checkbox */}
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
            padding: '10px 12px', background: 'rgba(246,70,93,0.05)',
            border: `1px solid ${confirmed ? 'rgba(246,70,93,0.4)' : C.border}`, borderRadius: 6, marginBottom: 14 }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0, accentColor: C.red }} />
            <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              Tôi hiểu đây là <b style={{ color: C.red }}>giao dịch bán vĩnh viễn (true sale)</b>.
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
          <InfoRow l="Số lượng" v={qtyN > 0 ? formatKg(qtyN) : '—'} />
          <InfoRow l="Giá thị trường" v={price > 0 ? `${formatVND(price)}/kg` : '—'} />
          <InfoRow l="Giá trị danh nghĩa (Nominal)" v={qtyN > 0 ? formatVND(nominalValue) : '—'} highlight={C.yellow} />

          <div style={{ margin: '12px 0' }} />
          <SectionTitle>CHIẾT KHẤU ({risk.label} — Haircut {(risk.haircut * 100).toFixed(0)}%)</SectionTitle>
          <InfoRow l="Giá trị danh nghĩa" v={qtyN > 0 ? formatVND(nominalValue) : '—'} />
          <InfoRow l={`Haircut (${(risk.haircut * 100).toFixed(0)}%)`}
            v={qtyN > 0 ? `− ${formatVND(haircutAmt)}` : '—'} highlight={C.red} />
          <InfoRow l="Ngân hàng" v={bankName.trim() || '—'} last />

          {qtyN > 0 && price > 0 && (
            <div style={{ marginTop: 16, padding: '12px 14px',
              background: `${risk.color}0d`, border: `1px solid ${risk.color}30`, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Nhận ngay (sau duyệt)</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: risk.color, fontFamily: 'monospace' }}>
                  {formatVND(paymentAmt)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {(risk.ratio * 100).toFixed(0)}% giá trị danh nghĩa · Mất {formatVND(haircutAmt)} haircut
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 11, color: C.muted, lineHeight: 1.6,
            padding: '10px 12px', background: 'rgba(247,127,0,0.06)',
            border: '1px solid rgba(247,127,0,0.2)', borderRadius: 6 }}>
            <b style={{ color: C.orange }}>Trạng thái token:</b>{' '}
            <span style={{ fontFamily: 'monospace', color: C.green }}>AVAILABLE</span>
            {' → '}
            <span style={{ fontFamily: 'monospace', color: C.orange }}>DISCOUNTED</span>
            {' — '}Bị xóa khỏi số dư ngay khi gửi. Quyền sở hữu chuyển cho ngân hàng vĩnh viễn.
          </div>
        </div>

        {/* History */}
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
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Nhận</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 600 }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => {
                    const r = RISK_LEVELS.find(r => r.key === row.risk_level) || RISK_LEVELS[1];
                    return (
                      <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '6px 6px', color: C.muted }}>{formatDate(row.created_at)}</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right' }}>
                          <span style={{ color: TOKENS.find(t => t.key === row.token_type)?.color, fontWeight: 600 }}>
                            {row.token_type}
                          </span>
                          <span style={{ color: C.muted }}> {formatKg(row.quantity)}</span>
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'right',
                          fontFamily: 'monospace', color: r.color }}>
                          {formatVND(row.payment_amount)}
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    );
                  })}
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
export default function TraderFinancing() {
  const [tab, setTab] = useState('collateral');

  const { data: balsData }   = useTraderTokenBals();
  const { data: pricesData } = useTraderPrices();
  const tokenBals = balsData?.data || {};
  const stats     = pricesData?.stats || [];

  return (
    <TraderLayout title="Tài chính — Finance">
      <div style={{ width: "100%", color: C.text, fontSize: 13 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Dịch vụ tài chính</h2>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {[
            { key: 'collateral', label: 'Vay thế chấp', color: C.green },
            { key: 'discounting', label: 'Chiết khấu Token', color: C.red },
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

        {/* Token balance overview */}
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
                    {formatKg(avail)}
                  </div>
                  {total > avail && (
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>
                      / {formatKg(total)} tổng · {formatKg(total - avail)} đang khóa
                    </div>
                  )}
                  {price > 0 && (
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {formatVND(price)}/kg · ≈ <b style={{ color: C.text }}>{formatVND(value)}</b>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TraderLayout>
  );
}
