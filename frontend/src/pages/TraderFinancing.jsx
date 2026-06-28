import { useState, useEffect, useCallback } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#0ecb81', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#487573', yellow: '#f0b90b',
};

const TOKENS = [
  { key: 'CR1', label: 'CaRo1', color: '#f0b90b', desc: 'Robusta Cao cấp'    },
  { key: 'CR2', label: 'CaRo2', color: '#0ecb81', desc: 'Robusta Tiêu chuẩn' },
  { key: 'CR3', label: 'CaRo3', color: '#9b87f5', desc: 'Robusta Phổ thông'  },
];

const LTV = 0.70;
const INTEREST = 1.5;
const DISCOUNT_RATE = 0.80;

function authHeader() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function apiFetch(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  return res.json();
}

const fmtVND = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const fmtKg  = (n) => Number(n || 0).toLocaleString('en-US');

export default function TraderFinancing() {
  const [tab, setTab] = useState('collateral');
  const [tokenBals, setTokenBals] = useState({});
  const [tickers, setTickers] = useState({});

  const [cToken, setCToken] = useState('CR1');
  const [cQty, setCQty]     = useState('');
  const [cDuration, setCDuration] = useState(3);

  const [dToken, setDToken] = useState('CR1');
  const [dQty, setDQty]     = useState('');
  const [dPeriod, setDPeriod] = useState(30);

  const [toast, setToast] = useState(null);

  const loadData = useCallback(async () => {
    const [tb, tk] = await Promise.all([
      apiFetch('/orders/my-balances'),
      apiFetch('/orders/tickers'),
    ]);
    if (tb.success) setTokenBals(tb.data || {});
    if (tk.success) {
      const m = {};
      tk.data.forEach(t => {
        const key = t.pair?.split('/')[0];
        if (key) m[key] = t;
      });
      setTickers(m);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Collateral calculations
  const cAvail = Number(tokenBals[cToken]?.available || 0);
  const cPrice = Number(tickers[cToken]?.last_price || 0);
  const cQtyN  = Math.min(parseFloat(cQty) || 0, cAvail);
  const cValue = cQtyN * cPrice;
  const cMaxLoan = cValue * LTV;
  const cMonthlyInterest = (cMaxLoan * INTEREST) / 100;
  const cTotalRepay = cMaxLoan + cMonthlyInterest * cDuration;

  // Discount calculations
  const dAvail = Number(tokenBals[dToken]?.available || 0);
  const dPrice = Number(tickers[dToken]?.last_price || 0);
  const dQtyN  = Math.min(parseFloat(dQty) || 0, dAvail);
  const dValue = dQtyN * dPrice;
  const dAdvance = dValue * DISCOUNT_RATE;

  const card = (children, extra = {}) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, ...extra }}>
      {children}
    </div>
  );

  const label = (text) => (
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{text}</div>
  );

  const TokenSelector = ({ value, onChange }) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {TOKENS.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          flex: 1, padding: '8px 0', borderRadius: 6, border: `1px solid ${value === t.key ? t.color : C.border}`,
          background: value === t.key ? `${t.color}18` : 'transparent',
          color: value === t.key ? t.color : C.muted, fontWeight: value === t.key ? 700 : 400,
          cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
        }}>
          <div>{t.label}</div>
          <div style={{ fontSize: 10, marginTop: 1, opacity: 0.7 }}>{t.desc}</div>
        </button>
      ))}
    </div>
  );

  const InfoRow = ({ label: l, value: v, highlight }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
      <span style={{ color: C.muted }}>{l}</span>
      <span style={{ fontWeight: 600, color: highlight || C.text, fontFamily: 'monospace' }}>{v}</span>
    </div>
  );

  const ComingSoonBadge = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(240,185,11,0.08)', border: '1px solid rgba(240,185,11,0.2)', borderRadius: 6, fontSize: 12, color: C.yellow, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>⚙️</span>
      <span>Tính năng đang phát triển — giao diện hiển thị để xem trước</span>
    </div>
  );

  return (
    <TraderLayout title="Tài chính — Financing">
      <div style={{ maxWidth: 900, color: C.text, fontSize: 13 }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Tài chính</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Vay vốn hoặc ứng trước dựa trên tài sản token CaRo</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {[
            { key: 'collateral', label: 'Vay thế chấp (Collateral Loan)' },
            { key: 'discount',   label: 'Chiết khấu trước (Discount Loan)' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '11px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: tab === t.key ? C.text : C.muted,
              fontWeight: tab === t.key ? 700 : 400, fontSize: 14,
              borderBottom: tab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── COLLATERAL LOAN TAB ── */}
        {tab === 'collateral' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Form */}
            <div>
              {card(<>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chọn tài sản thế chấp</div>
                <TokenSelector value={cToken} onChange={setCToken} />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>
                    SỐ LƯỢNG THẾ CHẤP (KG)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input
                      type="number" value={cQty} onChange={e => setCQty(e.target.value)}
                      placeholder="0"
                      style={{ flex: 1, padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14, outline: 'none' }}
                    />
                    <span style={{ color: C.muted, fontSize: 12 }}>kg</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Khả dụng: <b style={{ color: C.green }}>{fmtKg(cAvail)} kg</b>
                    {cPrice > 0 && <> · Giá thị trường: <b style={{ color: C.text }}>{fmtVND(cPrice)} VND/kg</b></>}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>THỜI HẠN VAY</div>
                  <select value={cDuration} onChange={e => setCDuration(Number(e.target.value))}
                    style={{ width: '100%', padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, outline: 'none' }}>
                    {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m} tháng</option>)}
                  </select>
                </div>

                <ComingSoonBadge />
                <button
                  disabled
                  style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#2b3a3a', color: C.muted, fontWeight: 700, fontSize: 14, cursor: 'not-allowed', letterSpacing: '0.5px' }}
                >Vay ngay — Sắp ra mắt</button>
              </>)}
            </div>

            {/* Summary */}
            {card(<>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chi tiết khoản vay</div>
              <InfoRow label="Loại token" value={`${TOKENS.find(t=>t.key===cToken)?.label} (${cToken})`} />
              <InfoRow label="Số lượng thế chấp" value={cQtyN > 0 ? `${fmtKg(cQtyN)} kg` : '—'} />
              <InfoRow label="Giá trị thế chấp" value={cQtyN > 0 ? `${fmtVND(cValue)} VND` : '—'} highlight={C.yellow} />
              <InfoRow label="Tỉ lệ LTV" value={`${(LTV * 100).toFixed(0)}%`} />
              <InfoRow label="Số tiền vay tối đa" value={cQtyN > 0 ? `${fmtVND(cMaxLoan)} VND` : '—'} highlight={C.green} />
              <InfoRow label="Lãi suất" value={`${INTEREST}%/tháng`} />
              <InfoRow label="Thời hạn" value={`${cDuration} tháng`} />
              {cQtyN > 0 && <>
                <InfoRow label="Lãi hàng tháng" value={`${fmtVND(cMonthlyInterest)} VND`} />
                <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 700, color: C.text }}>Tổng hoàn trả</span>
                  <span style={{ fontWeight: 800, color: C.red, fontFamily: 'monospace' }}>{fmtVND(cTotalRepay)} VND</span>
                </div>
              </>}

              <div style={{ marginTop: 16, padding: 12, background: 'rgba(72,117,115,0.08)', borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                <b style={{ color: C.text }}>Lưu ý:</b> Token thế chấp sẽ bị khóa trong thời gian vay. Không thể bán, chuyển nhượng hoặc đổi hàng hóa trong thời gian này.
              </div>
            </>)}
          </div>
        )}

        {/* ── DISCOUNT LOAN TAB ── */}
        {tab === 'discount' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Form */}
            <div>
              {card(<>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chiết khấu trước token</div>
                <TokenSelector value={dToken} onChange={setDToken} />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>SỐ LƯỢNG TOKEN (KG)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input
                      type="number" value={dQty} onChange={e => setDQty(e.target.value)}
                      placeholder="0"
                      style={{ flex: 1, padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14, outline: 'none' }}
                    />
                    <span style={{ color: C.muted, fontSize: 12 }}>kg</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Khả dụng: <b style={{ color: C.green }}>{fmtKg(dAvail)} kg</b>
                    {dPrice > 0 && <> · <b style={{ color: C.text }}>{fmtVND(dPrice)} VND/kg</b></>}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>THỜI HẠN HOÀN TRẢ</div>
                  <select value={dPeriod} onChange={e => setDPeriod(Number(e.target.value))}
                    style={{ width: '100%', padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, outline: 'none' }}>
                    <option value={30}>30 ngày</option>
                    <option value={60}>60 ngày</option>
                    <option value={90}>90 ngày</option>
                  </select>
                </div>

                <ComingSoonBadge />
                <button
                  disabled
                  style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#2b3a3a', color: C.muted, fontWeight: 700, fontSize: 14, cursor: 'not-allowed' }}
                >Ứng trước — Sắp ra mắt</button>
              </>)}
            </div>

            {/* Summary */}
            {card(<>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chi tiết ứng trước</div>
              <InfoRow label="Loại token" value={`${TOKENS.find(t=>t.key===dToken)?.label} (${dToken})`} />
              <InfoRow label="Số lượng" value={dQtyN > 0 ? `${fmtKg(dQtyN)} kg` : '—'} />
              <InfoRow label="Giá thị trường" value={dPrice > 0 ? `${fmtVND(dPrice)} VND/kg` : '—'} />
              <InfoRow label="Giá trị toàn bộ" value={dQtyN > 0 ? `${fmtVND(dValue)} VND` : '—'} />
              <InfoRow label="Tỉ lệ chiết khấu" value={`${(DISCOUNT_RATE * 100).toFixed(0)}%`} />
              <div style={{ padding: '14px 0 4px', display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
                <span style={{ fontWeight: 700, color: C.text }}>Số tiền ứng trước</span>
                <span style={{ fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>
                  {dQtyN > 0 ? `${fmtVND(dAdvance)} VND` : '—'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Thời hạn hoàn trả: <b style={{ color: C.text }}>{dPeriod} ngày</b></div>

              <div style={{ marginTop: 16, padding: 12, background: 'rgba(246,70,93,0.06)', borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                <b style={{ color: C.red }}>Quan trọng:</b> Nếu quá hạn, token sẽ được thanh lý tự động để hoàn trả khoản ứng trước.
              </div>
            </>)}
          </div>
        )}

        {/* Token balance overview */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: C.muted }}>TÀI SẢN HIỆN CÓ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {TOKENS.map(t => {
              const avail = Number(tokenBals[t.key]?.available || 0);
              const price = Number(tickers[t.key]?.last_price || 0);
              return (
                <div key={t.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: t.color }}>{t.label}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{t.desc}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', marginBottom: 2 }}>{fmtKg(avail)} kg</div>
                  {price > 0 && <div style={{ fontSize: 11, color: C.muted }}>≈ {fmtVND(avail * price)} VND</div>}
                </div>
              );
            })}
          </div>
        </div>

        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', background: '#1e3a3a', border: `1px solid ${C.accent}`, borderRadius: 8, color: C.text, fontSize: 13, zIndex: 1000 }}>
            {toast}
          </div>
        )}

      </div>
    </TraderLayout>
  );
}
