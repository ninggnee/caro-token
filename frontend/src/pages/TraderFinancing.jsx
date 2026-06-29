import { useState } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import { formatVND, formatNumber, formatKg } from '../utils/formatters';
import { useTraderPrices, useTraderTokenBals, getPriceOf } from '../hooks/useTraderData';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#0ecb81', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#487573', yellow: '#f0b90b', orange: '#f77f00',
};

const TOKENS = [
  { key: 'CR1', label: 'CaRo1', color: '#f0b90b', desc: 'Robusta Cao cấp' },
  { key: 'CR2', label: 'CaRo2', color: '#0ecb81', desc: 'Robusta Tiêu chuẩn' },
  { key: 'CR3', label: 'CaRo3', color: '#9b87f5', desc: 'Robusta Phổ thông' },
];

const LTV               = 0.70;   // 70% loan-to-value
const LIQUIDATION_LTV   = 0.85;   // 85% triggers auto-liquidation
const MONTHLY_RATE      = 1.5;    // 1.5%/month = 18%/year
const PROCESSING_FEE    = 0.005;  // 0.5% of loan amount
const ADVANCE_RATE      = 0.80;   // 80% advance rate
const SERVICE_FEE_PCT   = 0.02;   // 2% service fee on gross advance

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function addMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const InfoRow = ({ l, v, highlight, last }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
    borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
    <span style={{ color: C.muted }}>{l}</span>
    <span style={{ fontWeight: 600, color: highlight || C.text, fontFamily: 'monospace' }}>{v}</span>
  </div>
);

const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.6px', marginBottom: 6 }}>{children}</div>
);

function LtvBar({ ltvPct, liquidationPct }) {
  const fillPct   = Math.min(ltvPct * 100, 100);
  const liqMark   = liquidationPct * 100;
  const fillColor = fillPct >= liqMark * 0.95 ? C.red
                  : fillPct >= liqMark * 0.85 ? C.orange
                  : C.green;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 4 }}>
        <span>LTV hiện tại: <b style={{ color: fillColor }}>{fillPct.toFixed(1)}%</b></span>
        <span>Ngưỡng thanh lý: <b style={{ color: C.red }}>{liqMark.toFixed(0)}%</b></span>
      </div>
      <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'visible' }}>
        <div style={{ width: `${fillPct}%`, height: '100%', background: fillColor,
          borderRadius: 4, transition: 'width 0.3s, background 0.3s' }} />
        {/* Liquidation threshold marker */}
        <div style={{ position: 'absolute', top: -3, left: `${liqMark}%`,
          width: 2, height: 14, background: C.red, borderRadius: 1 }} />
        <div style={{ position: 'absolute', top: 12, left: `${liqMark}%`,
          transform: 'translateX(-50%)', fontSize: 9, color: C.red, whiteSpace: 'nowrap' }}>
          ▲ {liqMark.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

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

export default function TraderFinancing() {
  const [tab, setTab]           = useState('collateral');
  const [cToken, setCToken]     = useState('CR1');
  const [cQty, setCQty]         = useState('');
  const [cDuration, setCDuration] = useState(3);
  const [dToken, setDToken]     = useState('CR1');
  const [dQty, setDQty]         = useState('');
  const [dPeriod, setDPeriod]   = useState(30);

  const { data: balsData }   = useTraderTokenBals();
  const { data: pricesData } = useTraderPrices();
  const tokenBals = balsData?.data || {};
  const stats     = pricesData?.stats || [];

  // ── Collateral calculations ──────────────────────────────────────────────
  const cAvail        = Number(tokenBals[cToken]?.available || 0);
  const cTotal        = Number(tokenBals[cToken]?.total || tokenBals[cToken]?.available || 0);
  const cPrice        = getPriceOf(stats, cToken);
  const cQtyN         = Math.min(parseFloat(cQty) || 0, cAvail);
  const cCollValue    = cQtyN * cPrice;
  const cMaxLoan      = cCollValue * LTV;
  const cProcFee      = cMaxLoan * PROCESSING_FEE;
  const cNetLoan      = cMaxLoan - cProcFee;
  const cMonthlyInt   = cMaxLoan * (MONTHLY_RATE / 100);
  const cTotalInt     = cMonthlyInt * cDuration;
  const cTotalRepay   = cMaxLoan + cTotalInt;
  const cCurrentLTV   = cCollValue > 0 ? cMaxLoan / cCollValue : 0;
  const cLiqPrice     = cQtyN > 0 ? (cMaxLoan / (cQtyN * LIQUIDATION_LTV)) : 0;

  // ── Advance financing calculations ───────────────────────────────────────
  const dAvail        = Number(tokenBals[dToken]?.available || 0);
  const dTotal        = Number(tokenBals[dToken]?.total || tokenBals[dToken]?.available || 0);
  const dPrice        = getPriceOf(stats, dToken);
  const dQtyN         = Math.min(parseFloat(dQty) || 0, dAvail);
  const dTotalValue   = dQtyN * dPrice;
  const dGross        = dTotalValue * ADVANCE_RATE;
  const dServiceFee   = dGross * SERVICE_FEE_PCT;
  const dNet          = dGross - dServiceFee;

  const inputStyle = {
    flex: 1, padding: '9px 12px', background: C.input,
    border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, fontSize: 14, outline: 'none', width: '100%',
    boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, flex: 'unset' };

  return (
    <TraderLayout title="Tài chính — Financing">
      <div style={{ maxWidth: 960, color: C.text, fontSize: 13 }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Tài chính tài sản</h2>
          <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Vay thế chấp hoặc ứng trước dựa trên tài sản token CaRo</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
          {[
            { key: 'collateral', label: 'Vay thế chấp (Pledge Loan)' },
            { key: 'advance',    label: 'Ứng trước (Advance Financing)' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '11px 22px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: tab === t.key ? C.text : C.muted,
              fontWeight: tab === t.key ? 700 : 400, fontSize: 14,
              borderBottom: tab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── COLLATERAL LOAN ── */}
        {tab === 'collateral' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Form */}
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chọn tài sản thế chấp</div>
                <TokenSelector value={cToken} onChange={v => { setCToken(v); setCQty(''); }} />

                <SectionTitle>SỐ LƯỢNG THẾ CHẤP</SectionTitle>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input type="number" value={cQty} onChange={e => setCQty(e.target.value)}
                    placeholder="0" min="0" max={cAvail}
                    style={{ ...inputStyle }} />
                  <span style={{ color: C.muted, fontSize: 12, alignSelf: 'center', flexShrink: 0 }}>kg</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
                  Khả dụng: <b style={{ color: C.green }}>{formatKg(cAvail)}</b>
                  {cTotal > cAvail && <> / Tổng: <b style={{ color: C.text }}>{formatKg(cTotal)}</b></>}
                  {cPrice > 0 && <> · Giá: <b style={{ color: C.yellow }}>{formatVND(cPrice)}/kg</b></>}
                </div>

                <SectionTitle>THỜI HẠN VAY</SectionTitle>
                <select value={cDuration} onChange={e => setCDuration(Number(e.target.value))}
                  style={{ ...selectStyle, marginBottom: 16 }}>
                  {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m} tháng</option>)}
                </select>

                <div style={{ padding: '10px 14px', background: 'rgba(240,185,11,0.07)',
                  border: '1px solid rgba(240,185,11,0.18)', borderRadius: 6,
                  fontSize: 12, color: C.yellow, marginBottom: 14, lineHeight: 1.6 }}>
                  ⚙️ Tính năng đang phát triển — giao diện hiển thị để xem trước
                </div>
                <button disabled style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none',
                  background: '#2b3a3a', color: C.muted, fontWeight: 700, fontSize: 14, cursor: 'not-allowed' }}>
                  Vay ngay — Sắp ra mắt
                </button>
              </div>

              {/* Loan conditions */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: C.muted }}>
                  ĐIỀU KIỆN & ĐIỀU KHOẢN
                </div>
                {[
                  ['Tỉ lệ LTV tối đa', `${(LTV * 100).toFixed(0)}%`],
                  ['Ngưỡng thanh lý', `${(LIQUIDATION_LTV * 100).toFixed(0)}% — tự động thanh lý`],
                  ['Lãi suất', `${MONTHLY_RATE}%/tháng ≈ ${(MONTHLY_RATE * 12).toFixed(0)}%/năm`],
                  ['Phí xử lý hồ sơ', `${(PROCESSING_FEE * 100).toFixed(1)}% số tiền vay`],
                  ['Đáo hạn dự kiến', cDuration > 0 ? addMonths(cDuration) : '—'],
                ].map(([l, v]) => <InfoRow key={l} l={l} v={v} />)}
                <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.7,
                  padding: '10px 12px', background: 'rgba(246,70,93,0.06)',
                  border: '1px solid rgba(246,70,93,0.15)', borderRadius: 6 }}>
                  <b style={{ color: C.red }}>Token thế chấp bị khóa:</b> Trong thời gian vay, token không thể
                  giao dịch, chuyển nhượng, đổi lấy hàng hóa vật lý, hoặc dùng làm thế chấp cho khoản vay khác.
                  Nếu giá token giảm đến mức LTV vượt {(LIQUIDATION_LTV * 100).toFixed(0)}%, hệ thống sẽ tự động
                  thanh lý tài sản thế chấp mà không cần thông báo trước.
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chi tiết khoản vay</div>

              {cQtyN > 0 && cPrice > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <LtvBar ltvPct={cCurrentLTV} liquidationPct={LIQUIDATION_LTV} />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <SectionTitle>TÀI SẢN THẾ CHẤP</SectionTitle>
                <InfoRow l="Token" v={`${TOKENS.find(t => t.key === cToken)?.label} (${cToken})`} />
                <InfoRow l="Số lượng thế chấp" v={cQtyN > 0 ? formatKg(cQtyN) : '—'} />
                <InfoRow l="Giá thị trường" v={cPrice > 0 ? `${formatVND(cPrice)}/kg` : '—'} />
                <InfoRow l="Giá trị thế chấp" v={cQtyN > 0 ? formatVND(cCollValue) : '—'} highlight={C.yellow} />
                <InfoRow l="Giá thanh lý (dự báo)" v={cLiqPrice > 0 ? `${formatVND(cLiqPrice)}/kg` : '—'} highlight={C.red} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <SectionTitle>KHOẢN VAY</SectionTitle>
                <InfoRow l="Tỉ lệ LTV" v={`${(LTV * 100).toFixed(0)}%`} />
                <InfoRow l="Số tiền vay tối đa" v={cQtyN > 0 ? formatVND(cMaxLoan) : '—'} highlight={C.green} />
                <InfoRow l="Phí xử lý hồ sơ (0,5%)" v={cQtyN > 0 ? `− ${formatVND(cProcFee)}` : '—'} highlight={C.red} />
                <InfoRow l="Số tiền thực nhận" v={cQtyN > 0 ? formatVND(cNetLoan) : '—'} highlight={C.green} />
              </div>

              <div>
                <SectionTitle>CHI PHÍ LÃI SUẤT</SectionTitle>
                <InfoRow l={`Lãi tháng (${MONTHLY_RATE}%/tháng)`} v={cQtyN > 0 ? formatVND(cMonthlyInt) : '—'} />
                <InfoRow l={`Tổng lãi (${cDuration} tháng)`} v={cQtyN > 0 ? formatVND(cTotalInt) : '—'} />
                <InfoRow l="Ngày đáo hạn" v={addMonths(cDuration)} />
              </div>

              {cQtyN > 0 && (
                <div style={{ marginTop: 16, padding: '14px 16px',
                  background: 'rgba(14,203,129,0.07)', border: '1px solid rgba(14,203,129,0.2)',
                  borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Tổng hoàn trả khi đáo hạn</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: C.red, fontFamily: 'monospace' }}>
                      {formatVND(cTotalRepay)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Gốc {formatVND(cMaxLoan)} + Lãi {formatVND(cTotalInt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ADVANCE FINANCING ── */}
        {tab === 'advance' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* Form */}
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Ứng trước theo tài sản</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                  Nhận ngay {(ADVANCE_RATE * 100).toFixed(0)}% giá trị token — hoàn trả khi đáo hạn
                </div>
                <TokenSelector value={dToken} onChange={v => { setDToken(v); setDQty(''); }} />

                <SectionTitle>SỐ LƯỢNG TOKEN ỨNG TRƯỚC</SectionTitle>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input type="number" value={dQty} onChange={e => setDQty(e.target.value)}
                    placeholder="0" min="0" max={dAvail}
                    style={{ ...inputStyle }} />
                  <span style={{ color: C.muted, fontSize: 12, alignSelf: 'center', flexShrink: 0 }}>kg</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
                  Khả dụng: <b style={{ color: C.green }}>{formatKg(dAvail)}</b>
                  {dTotal > dAvail && <> / Tổng: <b style={{ color: C.text }}>{formatKg(dTotal)}</b></>}
                  {dPrice > 0 && <> · Giá: <b style={{ color: C.yellow }}>{formatVND(dPrice)}/kg</b></>}
                </div>

                <SectionTitle>THỜI HẠN HOÀN TRẢ</SectionTitle>
                <select value={dPeriod} onChange={e => setDPeriod(Number(e.target.value))}
                  style={{ ...selectStyle, marginBottom: 16 }}>
                  <option value={30}>30 ngày — đáo hạn {addDays(30)}</option>
                  <option value={60}>60 ngày — đáo hạn {addDays(60)}</option>
                  <option value={90}>90 ngày — đáo hạn {addDays(90)}</option>
                </select>

                <div style={{ padding: '10px 14px', background: 'rgba(240,185,11,0.07)',
                  border: '1px solid rgba(240,185,11,0.18)', borderRadius: 6,
                  fontSize: 12, color: C.yellow, marginBottom: 14 }}>
                  ⚙️ Tính năng đang phát triển — giao diện hiển thị để xem trước
                </div>
                <button disabled style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none',
                  background: '#2b3a3a', color: C.muted, fontWeight: 700, fontSize: 14, cursor: 'not-allowed' }}>
                  Ứng trước — Sắp ra mắt
                </button>
              </div>

              {/* Terms */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: C.muted }}>
                  NGHĨA VỤ HOÀN TRẢ & RỦI RO
                </div>
                {[
                  ['Tỉ lệ ứng trước', `${(ADVANCE_RATE * 100).toFixed(0)}% giá trị tài sản`],
                  ['Phí dịch vụ', `${(SERVICE_FEE_PCT * 100).toFixed(0)}% trên số tiền ứng trước`],
                  ['Ngày đáo hạn', addDays(dPeriod)],
                  ['Hoàn trả', 'Gốc ứng trước + phí dịch vụ'],
                  ['Quá hạn', 'Phí quá hạn 0,1%/ngày trên số dư'],
                ].map(([l, v]) => <InfoRow key={l} l={l} v={v} />)}
                <div style={{ marginTop: 12, fontSize: 11, color: C.muted, lineHeight: 1.7,
                  padding: '10px 12px', background: 'rgba(246,70,93,0.06)',
                  border: '1px solid rgba(246,70,93,0.15)', borderRadius: 6 }}>
                  <b style={{ color: C.red }}>Thanh lý tự động:</b> Nếu quá hạn 7 ngày mà chưa hoàn trả,
                  hệ thống sẽ tự động thanh lý token đã ứng trước để thu hồi khoản nợ. Khoản thặng dư (nếu có)
                  sẽ được hoàn trả vào tài khoản của bạn.
                </div>
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Chi tiết ứng trước</div>

              <div style={{ marginBottom: 16 }}>
                <SectionTitle>TÀI SẢN</SectionTitle>
                <InfoRow l="Token" v={`${TOKENS.find(t => t.key === dToken)?.label} (${dToken})`} />
                <InfoRow l="Số lượng" v={dQtyN > 0 ? formatKg(dQtyN) : '—'} />
                <InfoRow l="Giá thị trường" v={dPrice > 0 ? `${formatVND(dPrice)}/kg` : '—'} />
                <InfoRow l="Tổng giá trị tài sản" v={dQtyN > 0 ? formatVND(dTotalValue) : '—'} highlight={C.yellow} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <SectionTitle>TÍNH TOÁN ỨNG TRƯỚC</SectionTitle>
                <InfoRow l={`Tỉ lệ ứng trước (${(ADVANCE_RATE * 100).toFixed(0)}%)`}
                  v={dQtyN > 0 ? formatVND(dGross) : '—'} />
                <InfoRow l={`Phí dịch vụ (${(SERVICE_FEE_PCT * 100).toFixed(0)}%)`}
                  v={dQtyN > 0 ? `− ${formatVND(dServiceFee)}` : '—'} highlight={C.red} />
              </div>

              {dQtyN > 0 && (
                <div style={{ padding: '14px 16px', background: 'rgba(14,203,129,0.07)',
                  border: '1px solid rgba(14,203,129,0.2)', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Số tiền thực nhận</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>
                      {formatVND(dNet)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Sau khi trừ phí dịch vụ {formatVND(dServiceFee)}
                  </div>
                </div>
              )}

              <div>
                <SectionTitle>LỊCH HOÀN TRẢ</SectionTitle>
                <InfoRow l="Số tiền hoàn trả" v={dQtyN > 0 ? formatVND(dGross) : '—'} highlight={C.red} />
                <InfoRow l="Thời hạn" v={`${dPeriod} ngày`} />
                <InfoRow l="Ngày đáo hạn" v={addDays(dPeriod)} highlight={C.yellow} />
                <InfoRow l="Phí quá hạn" v="0,1%/ngày (nếu trễ)" last />
              </div>

              {dQtyN > 0 && (
                <div style={{ marginTop: 16, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                  fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
                  Hoàn trả đúng hạn: <b style={{ color: C.text }}>{formatVND(dGross)}</b> trước ngày{' '}
                  <b style={{ color: C.yellow }}>{addDays(dPeriod)}</b>.<br />
                  Lợi nhuận ròng của bạn: <b style={{ color: C.green }}>
                    {formatVND(dTotalValue - dGross)}
                  </b> (chênh lệch 20% giá trị tài sản).
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Token balance overview ── */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.5px' }}>TÀI SẢN HIỆN CÓ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {TOKENS.map(t => {
              const avail = Number(tokenBals[t.key]?.available || 0);
              const total = Number(tokenBals[t.key]?.total || avail);
              const price = getPriceOf(stats, t.key);
              const value = avail * price;
              const stat  = stats.find(s => s.token === t.key) || {};
              const change = Number(stat.change_24h || 0);
              return (
                <div key={t.key} style={{ background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: t.color, fontSize: 14 }}>{t.label}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: change >= 0 ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)',
                      color: change >= 0 ? C.green : C.red, fontWeight: 700 }}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
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
