import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';
import { formatVND, formatKg, formatNumber } from '../utils/formatters';
import { useTraderPrices, useTraderTokenBals, getPriceOf, TRADER_KEYS } from '../hooks/useTraderData';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#0ecb81', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#487573', yellow: '#f0b90b', teal: '#00d4aa',
  purple: '#9b87f5',
};

const TOKENS = ['CR1', 'CR2', 'CR3'];
const TOKEN_LABELS  = { CR1: 'CaRo1', CR2: 'CaRo2', CR3: 'CaRo3' };
const TOKEN_COLORS  = { CR1: '#f0b90b', CR2: '#0ecb81', CR3: '#9b87f5' };

const SHIPPING_METHODS = ['Đường biển', 'Đường hàng không', 'Đường bộ', 'Đường sắt'];

// ── L/C workflow statuses ──────────────────────────────────────────────────────
const LC_STATUS = {
  DRAFT:          { label: 'Nháp',               color: C.muted   },
  SUBMITTED:      { label: 'Đã nộp',             color: C.yellow  },
  ADMIN_REVIEWING:{ label: 'Admin đang xét',     color: C.yellow  },
  BANK_REVIEWING: { label: 'Ngân hàng đang xét', color: C.teal    },
  APPROVED:       { label: 'Đã duyệt',           color: C.green   },
  LC_ISSUED:      { label: 'L/C đã phát hành',   color: C.green   },
  REJECTED:       { label: 'Từ chối',            color: C.red     },
  COMPLETED:      { label: 'Hoàn thành',         color: '#a0a0a0' },
};

const WAREHOUSE_STATUS = {
  PENDING:          { label: 'Chờ xử lý',        color: C.muted  },
  PREPARING:        { label: 'Đang chuẩn bị',    color: C.yellow },
  READY_FOR_PICKUP: { label: 'Sẵn sàng lấy hàng',color: C.teal  },
  LOADED:           { label: 'Đã xếp hàng',      color: C.green  },
  RELEASED:         { label: 'Đã xuất kho',      color: '#a0a0a0'},
};

const TRANSPORT_STATUS = {
  WAITING_PICKUP:    { label: 'Chờ lấy hàng',      color: C.muted  },
  IN_TRANSIT:        { label: 'Đang vận chuyển',   color: C.yellow },
  ARRIVED_AT_PORT:   { label: 'Đến cảng',          color: C.teal   },
  CUSTOMS_PROCESSING:{ label: 'Đang thông quan',   color: C.yellow },
  EXPORTED:          { label: 'Đã xuất khẩu',      color: C.green  },
  DELIVERED:         { label: 'Đã giao',           color: '#a0a0a0'},
};

const DOC_STATUS = {
  PENDING:  { label: 'Chờ',        color: C.muted  },
  UPLOADED: { label: 'Đã tải lên', color: C.yellow },
  VERIFIED: { label: 'Đã xác nhận',color: C.teal   },
  COMPLETED:{ label: 'Hoàn tất',   color: C.green  },
};

const DOCUMENTS = [
  'Commercial Invoice',
  'Packing List',
  'Bill of Lading',
  'Warehouse Certificate',
  'Certificate of Origin',
  'Insurance Certificate',
];

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

function StatusBadge({ statusMap, value }) {
  const s = statusMap[value] || { label: value || '—', color: C.muted };
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
      background: `${s.color}18`, color: s.color, whiteSpace: 'nowrap', border: `1px solid ${s.color}33` }}>
      {s.label}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.6px', marginBottom: 6 }}>{children}</div>
  );
}

const inputStyle = (extra = {}) => ({
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: C.input, border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.text, fontSize: 13, outline: 'none', ...extra,
});

export default function TraderRedeemGoods() {
  const qc = useQueryClient();

  const [activeTab, setActiveTab]       = useState('create');
  const [step, setStep]                 = useState(1);      // 1 = select token+qty, 2 = L/C form

  // Step 1
  const [selToken, setSelToken]         = useState('CR1');
  const [qty, setQty]                   = useState('');

  // Step 2 — L/C form
  const [lc, setLc] = useState({
    warehouse_location: '',
    receiving_date: '',
    pickup_location: '',
    destination_port: '',
    receiving_company: '',
    bank_name: '',
    lc_value: '',
    transportation_cost: '',
    shipping_method: SHIPPING_METHODS[0],
    notes: '',
  });

  const [history,    setHistory]        = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [msg, setMsg]                   = useState(null);
  const [expandedPO, setExpandedPO]     = useState(null);

  const { data: balsData }   = useTraderTokenBals();
  const { data: pricesData } = useTraderPrices();
  const tokenBals = balsData?.data || {};
  const stats     = pricesData?.stats || [];

  const load = useCallback(async () => {
    const hist = await apiFetch('/redeem');
    if (hist.success) setHistory(hist.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const avail   = Number(tokenBals[selToken]?.available || 0);
  const price   = getPriceOf(stats, selToken);
  const qtyN    = Math.min(parseFloat(qty) || 0, avail);
  const value   = qtyN * price;

  const setLcField = (field, val) => setLc(prev => ({ ...prev, [field]: val }));

  const goToStep2 = () => {
    if (!qty || qtyN <= 0) return setMsg({ ok: false, text: 'Nhập số lượng hợp lệ (> 0)' });
    if (qtyN > avail)      return setMsg({ ok: false, text: `Vượt quá số lượng khả dụng (${formatKg(avail)})` });
    setMsg(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!lc.warehouse_location || !lc.receiving_date || !lc.receiving_company || !lc.bank_name) {
      return setMsg({ ok: false, text: 'Vui lòng điền đủ các trường bắt buộc (*) trong đơn L/C' });
    }
    setSubmitting(true); setMsg(null);
    try {
      const transportN   = Number(lc.transportation_cost) || 0;
      const totalLcValue = value + transportN;
      const d = await apiFetch('/redeem', {
        method: 'POST',
        body: JSON.stringify({
          kg_amount: qtyN,
          token_type: selToken,
          lc_warehouse_location: lc.warehouse_location,
          lc_receiving_date: lc.receiving_date,
          lc_pickup_location: lc.pickup_location,
          lc_destination_port: lc.destination_port,
          lc_receiving_company: lc.receiving_company,
          lc_bank_name: lc.bank_name,
          lc_value: totalLcValue || undefined,
          lc_transportation_cost: transportN || undefined,
          lc_shipping_method: lc.shipping_method,
          lc_notes: lc.notes,
        }),
      });
      if (d.success) {
        setMsg({ ok: true, text: `Tạo yêu cầu đổi hàng thành công (ID: #${d.id}). Đơn L/C đang chờ Admin xét duyệt.` });
        setQty('');
        setLc({ warehouse_location: '', receiving_date: '', pickup_location: '', destination_port: '',
          receiving_company: '', bank_name: '', lc_value: '', transportation_cost: '', shipping_method: SHIPPING_METHODS[0], notes: '' });
        setStep(1);
        qc.invalidateQueries({ queryKey: TRADER_KEYS.tokens });
        load();
      } else {
        setMsg({ ok: false, text: d.message || 'Lỗi tạo yêu cầu' });
      }
    } catch { setMsg({ ok: false, text: 'Lỗi kết nối server' }); }
    setSubmitting(false);
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <TraderLayout title="Đổi hàng hóa — Redeem Goods">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: C.text, fontSize: 13 }}>

        {/* Header */}
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Đổi token lấy cà phê thực</h2>
          <p style={{ margin: 0, color: C.muted }}>
            Chuyển đổi token CaRo thành cà phê vật lý. Token sẽ bị đốt (BURNED) sau khi yêu cầu được xử lý hoàn tất.
          </p>
        </div>

        {/* Token balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {TOKENS.map(tk => {
            const av = Number(tokenBals[tk]?.available || 0);
            const lk = Number(tokenBals[tk]?.locked || 0);
            const pr = getPriceOf(stats, tk);
            const sel = selToken === tk && activeTab === 'create';
            return (
              <div key={tk}
                onClick={() => { setSelToken(tk); setQty(''); setMsg(null); setStep(1); }}
                style={{ background: C.card, border: `1.5px solid ${sel ? TOKEN_COLORS[tk] : C.border}`,
                  borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
                  background: sel ? `${TOKEN_COLORS[tk]}0a` : C.card, transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: TOKEN_COLORS[tk] }}>{TOKEN_LABELS[tk]}</span>
                  <span style={{ fontSize: 10, color: sel ? TOKEN_COLORS[tk] : C.muted,
                    padding: '1px 6px', borderRadius: 10, border: `1px solid ${sel ? TOKEN_COLORS[tk] + '44' : C.border}` }}>
                    {sel ? '✓ Đã chọn' : 'Chọn'}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{formatKg(av)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  AVAILABLE · {lk > 0 && <span>Đang khóa: {formatKg(lk)} · </span>}
                  {pr > 0 && <span style={{ color: C.yellow }}>{formatVND(pr)}/kg</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
          {[
            { key: 'create',   label: 'Tạo yêu cầu đổi hàng' },
            { key: 'tracking', label: `Theo dõi đơn hàng (${history.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: activeTab === t.key ? C.text : C.muted,
              fontWeight: activeTab === t.key ? 700 : 400, fontSize: 14,
              borderBottom: activeTab === t.key ? `2px solid ${C.accent}` : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* ══════════════════ TAB: TẠO YÊU CẦU ══════════════════ */}
        {activeTab === 'create' && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>

              {/* Step indicator */}
              <div style={{ display: 'flex', gap: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {[
                  { n: 1, label: 'Chọn token & số lượng' },
                  { n: 2, label: 'Đơn L/C' },
                ].map(s => (
                  <div key={s.n} style={{
                    flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: step === s.n ? 700 : 400,
                    background: step === s.n ? 'rgba(72,117,115,0.15)' : 'transparent',
                    color: step >= s.n ? C.teal : C.muted,
                    borderRight: s.n < 2 ? `1px solid ${C.border}` : 'none',
                    cursor: step > s.n ? 'pointer' : 'default',
                  }} onClick={() => step > s.n && setStep(s.n)}>
                    <span style={{ marginRight: 4, fontWeight: 700 }}>Step {s.n}</span>
                    {s.label}
                  </div>
                ))}
              </div>

              {/* ─── STEP 1: Token + qty ─── */}
              {step === 1 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Chọn token & số lượng</div>

                  <SectionLabel>LOẠI TOKEN</SectionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                    {TOKENS.map(t => (
                      <button key={t} onClick={() => { setSelToken(t); setMsg(null); }} style={{
                        padding: '7px 0', borderRadius: 6, border: `1px solid ${selToken === t ? TOKEN_COLORS[t] : C.border}`,
                        background: selToken === t ? `${TOKEN_COLORS[t]}18` : 'transparent',
                        color: selToken === t ? TOKEN_COLORS[t] : C.muted,
                        fontWeight: selToken === t ? 700 : 400, cursor: 'pointer', fontSize: 12,
                      }}>{TOKEN_LABELS[t]}</button>
                    ))}
                  </div>

                  <SectionLabel>SỐ LƯỢNG ĐỔI (kg)</SectionLabel>
                  <input
                    type="number" value={qty} onChange={e => setQty(e.target.value)}
                    placeholder="0" min="0"
                    style={{ ...inputStyle(), marginBottom: 4 }}
                  />
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                    AVAILABLE: <b style={{ color: C.green }}>{formatKg(avail)}</b>
                    {price > 0 && <> · <span style={{ color: C.yellow }}>{formatVND(price)}/kg</span></>}
                  </div>

                  {qtyN > 0 && (
                    <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: C.muted }}>Số lượng</span>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatKg(qtyN)}</span>
                      </div>
                      {price > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.muted }}>Giá trị ước tính</span>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: C.yellow }}>{formatVND(value)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(72,117,115,0.08)', borderRadius: 6, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                    Trạng thái token:{' '}
                    <span style={{ fontFamily: 'monospace', color: C.green }}>AVAILABLE</span>
                    {' '}→{' '}
                    <span style={{ fontFamily: 'monospace', color: C.yellow }}>LC_LOCKED</span>
                    {' '}→{' '}
                    <span style={{ fontFamily: 'monospace', color: C.red }}>BURNED</span>.
                    Token bị khóa ngay khi yêu cầu được nộp và bị đốt sau khi hoàn tất.
                  </div>

                  {msg && !msg.ok && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 6, fontSize: 12,
                      background: 'rgba(246,70,93,0.07)', border: '1px solid rgba(246,70,93,0.25)', color: C.red }}>
                      {msg.text}
                    </div>
                  )}

                  <button onClick={goToStep2}
                    disabled={!qty || qtyN <= 0}
                    style={{ width: '100%', padding: '11px 0', borderRadius: 6, border: 'none',
                      background: !qty || qtyN <= 0 ? '#2b3a3a' : C.accent,
                      color: !qty || qtyN <= 0 ? C.muted : '#fff',
                      fontWeight: 700, fontSize: 14, cursor: !qty || qtyN <= 0 ? 'not-allowed' : 'pointer' }}>
                    Tiếp theo — Điền đơn L/C →
                  </button>
                </div>
              )}

              {/* ─── STEP 2: L/C Form ─── */}
              {step === 2 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Đơn yêu cầu L/C</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                    {TOKEN_LABELS[selToken]} · {formatKg(qtyN)}
                  </div>

                  {/* Summary row */}
                  {(() => {
                    const transportN   = Number(lc.transportation_cost) || 0;
                    const totalLcValue = value + transportN;
                    return (
                      <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(72,117,115,0.08)', borderRadius: 6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: price > 0 ? 10 : 0 }}>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted }}>Loại token</div>
                            <div style={{ fontWeight: 700, color: TOKEN_COLORS[selToken] }}>{TOKEN_LABELS[selToken]}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: C.muted }}>Số lượng</div>
                            <div style={{ fontWeight: 700 }}>{formatKg(qtyN)}</div>
                          </div>
                          {price > 0 && (
                            <div>
                              <div style={{ fontSize: 10, color: C.muted }}>Giá thị trường</div>
                              <div style={{ fontWeight: 700, color: C.yellow }}>{formatVND(price)}/kg</div>
                            </div>
                          )}
                        </div>
                        {price > 0 && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 10, display: 'grid', gap: 5 }}>
                            {[
                              { label: 'Giá trị hàng hóa (Value)', val: formatVND(value), color: C.yellow },
                              { label: 'Chi phí vận chuyển (Transportation Cost)', val: transportN > 0 ? `+ ${formatVND(transportN)}` : '+ 0 VND', color: C.muted },
                            ].map(r => (
                              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: C.muted }}>{r.label}</span>
                                <span style={{ fontWeight: 600, color: r.color }}>{r.val}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 2 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>Tổng giá trị L/C</span>
                              <span style={{ fontSize: 15, fontWeight: 800, color: C.teal, fontFamily: 'monospace' }}>{formatVND(totalLcValue)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'grid', gap: 10 }}>
                    {/* Row: warehouse + receiving date */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <SectionLabel>ĐỊA ĐIỂM KHO *</SectionLabel>
                        <input value={lc.warehouse_location} onChange={e => setLcField('warehouse_location', e.target.value)}
                          placeholder="Tên kho / địa chỉ" style={inputStyle()} />
                      </div>
                      <div>
                        <SectionLabel>NGÀY NHẬN HÀNG *</SectionLabel>
                        <input type="date" value={lc.receiving_date} onChange={e => setLcField('receiving_date', e.target.value)}
                          style={inputStyle({ colorScheme: 'dark' })} />
                      </div>
                    </div>

                    {/* Row: pickup + destination port */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <SectionLabel>ĐỊA ĐIỂM LẤY HÀNG</SectionLabel>
                        <input value={lc.pickup_location} onChange={e => setLcField('pickup_location', e.target.value)}
                          placeholder="Địa điểm lấy hàng" style={inputStyle()} />
                      </div>
                      <div>
                        <SectionLabel>CẢNG ĐÍCH</SectionLabel>
                        <input value={lc.destination_port} onChange={e => setLcField('destination_port', e.target.value)}
                          placeholder="Tên cảng đích" style={inputStyle()} />
                      </div>
                    </div>

                    {/* Row: receiving company + bank */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <SectionLabel>CÔNG TY NHẬN HÀNG *</SectionLabel>
                        <input value={lc.receiving_company} onChange={e => setLcField('receiving_company', e.target.value)}
                          placeholder="Tên công ty" style={inputStyle()} />
                      </div>
                      <div>
                        <SectionLabel>NGÂN HÀNG PHÁT HÀNH L/C *</SectionLabel>
                        <input value={lc.bank_name} onChange={e => setLcField('bank_name', e.target.value)}
                          placeholder="Tên ngân hàng" style={inputStyle()} />
                      </div>
                    </div>

                    {/* Row: transportation cost + shipping method */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <SectionLabel>CHI PHÍ VẬN CHUYỂN (VND)</SectionLabel>
                        <input type="number" value={lc.transportation_cost}
                          onChange={e => setLcField('transportation_cost', e.target.value)}
                          placeholder="0" min="0" style={inputStyle()} />
                        {lc.transportation_cost && Number(lc.transportation_cost) > 0 && (
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                            = {formatVND(Number(lc.transportation_cost))}
                          </div>
                        )}
                      </div>
                      <div>
                        <SectionLabel>PHƯƠNG THỨC VẬN CHUYỂN</SectionLabel>
                        <select value={lc.shipping_method} onChange={e => setLcField('shipping_method', e.target.value)}
                          style={inputStyle()}>
                          {SHIPPING_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <SectionLabel>GHI CHÚ BỔ SUNG</SectionLabel>
                      <textarea value={lc.notes} onChange={e => setLcField('notes', e.target.value)}
                        placeholder="Thông tin bổ sung cho yêu cầu L/C..."
                        rows={3}
                        style={{ ...inputStyle(), resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>
                  </div>

                  {/* Workflow note */}
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(0,212,170,0.06)', borderRadius: 6, border: '1px solid rgba(0,212,170,0.15)', fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
                    <b style={{ color: C.teal }}>Quy trình xét duyệt:</b>{' '}
                    Trader → Admin xét duyệt → Kiểm tra tồn kho → Ngân hàng xét duyệt → Phát hành L/C → Xuất kho
                  </div>

                  {msg && (
                    <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 6, fontSize: 12,
                      background: msg.ok ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
                      border: `1px solid ${msg.ok ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                      color: msg.ok ? C.green : C.red }}>
                      {msg.text}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <button onClick={() => { setStep(1); setMsg(null); }}
                      style={{ padding: '10px 0', flex: '0 0 80px', borderRadius: 6, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      ← Quay lại
                    </button>
                    <button onClick={handleSubmit} disabled={submitting}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 6, border: 'none',
                        background: submitting ? '#2b3a3a' : C.accent,
                        color: submitting ? C.muted : '#fff', fontWeight: 700, fontSize: 14,
                        cursor: submitting ? 'not-allowed' : 'pointer' }}>
                      {submitting ? 'Đang xử lý…' : 'Nộp yêu cầu đổi hàng & L/C'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ TAB: THEO DÕI ĐƠN HÀNG ══════════════════ */}
        {activeTab === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {history.length === 0 ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '40px 16px', textAlign: 'center', color: C.muted }}>
                Chưa có đơn hàng nào. Tạo yêu cầu đổi hàng để bắt đầu.
              </div>
            ) : (
              history.map((r, idx) => {
                const isExp  = expandedPO === r.id;
                const lcStat = r.lc_status || 'SUBMITTED';
                const whStat = r.warehouse_status || 'PENDING';
                const trStat = r.transport_status || 'WAITING_PICKUP';
                return (
                  <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    {/* Summary row */}
                    <div
                      onClick={() => setExpandedPO(isExp ? null : r.id)}
                      style={{ display: 'grid', gridTemplateColumns: '60px 100px 100px 140px 140px 28px',
                        gap: 0, padding: '12px 16px', cursor: 'pointer', alignItems: 'center',
                        background: isExp ? 'rgba(72,117,115,0.08)' : 'transparent', userSelect: 'none' }}>
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>#{r.id}</span>
                      <span style={{ fontWeight: 700, color: TOKEN_COLORS[r.token_type] || C.text, fontSize: 12 }}>
                        {TOKEN_LABELS[r.token_type] || r.token_type || '—'}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{formatKg(r.kg_amount)}</span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StatusBadge statusMap={LC_STATUS} value={lcStat} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <StatusBadge statusMap={WAREHOUSE_STATUS} value={whStat} />
                      </div>
                      <span style={{ textAlign: 'right', color: C.muted, fontSize: 13 }}>{isExp ? '▲' : '▼'}</span>
                    </div>

                    {/* Column headers (only first row) */}
                    {idx === 0 && !isExp && (
                      <div style={{ display: 'grid', gridTemplateColumns: '60px 100px 100px 140px 140px 28px',
                        gap: 0, padding: '4px 16px 2px', background: 'rgba(255,255,255,0.02)',
                        borderTop: `1px solid ${C.border}` }}>
                        {['#ID', 'Token', 'SL', 'Trạng thái L/C', 'Trạng thái kho', ''].map((h, i) => (
                          <span key={i} style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>{h}</span>
                        ))}
                      </div>
                    )}

                    {/* Expanded detail */}
                    {isExp && (
                      <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}`, display: 'grid', gap: 14 }}>

                        {/* 4-column status grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                          {/* L/C Status */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }}>TRẠNG THÁI L/C</div>
                            {Object.entries(LC_STATUS).map(([key, s]) => (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                  background: lcStat === key ? s.color : 'rgba(255,255,255,0.1)' }} />
                                <span style={{ fontSize: 10, color: lcStat === key ? s.color : C.muted, fontWeight: lcStat === key ? 700 : 400 }}>
                                  {s.label}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Warehouse Status */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }}>TRẠNG THÁI KHO</div>
                            {Object.entries(WAREHOUSE_STATUS).map(([key, s]) => (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                  background: whStat === key ? s.color : 'rgba(255,255,255,0.1)' }} />
                                <span style={{ fontSize: 10, color: whStat === key ? s.color : C.muted, fontWeight: whStat === key ? 700 : 400 }}>
                                  {s.label}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Transport Status */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }}>TRẠNG THÁI VẬN CHUYỂN</div>
                            {Object.entries(TRANSPORT_STATUS).map(([key, s]) => (
                              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                  background: trStat === key ? s.color : 'rgba(255,255,255,0.1)' }} />
                                <span style={{ fontSize: 10, color: trStat === key ? s.color : C.muted, fontWeight: trStat === key ? 700 : 400 }}>
                                  {s.label}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Document Package */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 6, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 8 }}>BỘ CHỨNG TỪ</div>
                            {DOCUMENTS.map(doc => {
                              const docStatus = r.documents?.[doc] || 'PENDING';
                              const ds = DOC_STATUS[docStatus] || DOC_STATUS.PENDING;
                              return (
                                <div key={doc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                                  <span style={{ fontSize: 9, color: C.muted, flex: 1 }}>{doc}</span>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: ds.color, flexShrink: 0 }}>{ds.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Order meta */}
                        <div style={{ display: 'flex', gap: 20, fontSize: 11, color: C.muted, flexWrap: 'wrap' }}>
                          <span>Ngày tạo: <b style={{ color: C.text }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}</b></span>
                          {r.processed_at && <span>Ngày xử lý: <b style={{ color: C.text }}>{new Date(r.processed_at).toLocaleDateString('vi-VN')}</b></span>}
                          {r.lc_warehouse_location && <span>Kho: <b style={{ color: C.text }}>{r.lc_warehouse_location}</b></span>}
                          {r.lc_shipping_method && <span>Vận chuyển: <b style={{ color: C.text }}>{r.lc_shipping_method}</b></span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </TraderLayout>
  );
}
