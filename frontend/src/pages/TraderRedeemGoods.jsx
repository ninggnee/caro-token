import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';
import { formatVND, formatKg } from '../utils/formatters';
import { useTraderPrices, useTraderTokenBals, getPriceOf, TRADER_KEYS } from '../hooks/useTraderData';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#0ecb81', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#408A71', yellow: '#f0b90b',
};

const TOKENS = ['CR1', 'CR2', 'CR3'];
const TOKEN_LABELS = { CR1: 'CaRo1', CR2: 'CaRo2', CR3: 'CaRo3' };
const TOKEN_COLORS = { CR1: '#f0b90b', CR2: '#0ecb81', CR3: '#9b87f5' };

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

const STATUS_LABEL = {
  pending:  { label: 'Chờ duyệt',  color: '#f0b90b' },
  approved: { label: 'Đã duyệt',   color: '#0ecb81' },
  rejected: { label: 'Từ chối',    color: '#f6465d' },
};

export default function TraderRedeemGoods() {
  const qc = useQueryClient();

  const [batches,   setBatches]     = useState([]);
  const [history,   setHistory]     = useState([]);

  const [selToken, setSelToken]     = useState('CR1');
  const [qty, setQty]               = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]               = useState(null);

  const { data: balsData }   = useTraderTokenBals();
  const { data: pricesData } = useTraderPrices();
  const tokenBals = balsData?.data || {};
  const stats     = pricesData?.stats || [];

  const load = useCallback(async () => {
    const [bt, hist] = await Promise.all([
      apiFetch('/asset-batches/available'),
      apiFetch('/redeem'),
    ]);
    if (bt.success)   setBatches(bt.data || []);
    if (hist.success) setHistory(hist.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const avail = Number(tokenBals[selToken]?.available || 0);
  const price = getPriceOf(stats, selToken);
  const qtyN    = Math.min(parseFloat(qty) || 0, avail);
  const value   = qtyN * price;

  const handleRedeem = async () => {
    if (!qty || qtyN <= 0) return setMsg({ ok: false, text: 'Nhập số lượng hợp lệ' });
    if (qtyN > avail) return setMsg({ ok: false, text: `Vượt quá số lượng khả dụng (${formatKg(avail)})` });
    setSubmitting(true); setMsg(null);
    try {
      const d = await apiFetch('/redeem', {
        method: 'POST',
        body: JSON.stringify({ kg_amount: qtyN, token_type: selToken }),
      });
      if (d.success) {
        setMsg({ ok: true, text: `Tạo yêu cầu đổi hàng thành công (ID: #${d.id}). Chờ admin xử lý.` });
        setQty('');
        qc.invalidateQueries({ queryKey: TRADER_KEYS.tokens });
        load();
      } else {
        setMsg({ ok: false, text: d.message || 'Lỗi tạo yêu cầu' });
      }
    } catch { setMsg({ ok: false, text: 'Lỗi kết nối server' }); }
    setSubmitting(false);
  };

  return (
    <TraderLayout title="Đổi hàng hóa — Redeem Goods">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: C.text, fontSize: 13 }}>

        {/* Header */}
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Đổi token lấy cà phê thực</h2>
          <p style={{ margin: 0, color: C.muted }}>Đổi token CaRo lấy cà phê tương ứng từ kho hàng. Token sẽ bị đốt sau khi được duyệt.</p>
        </div>

        {/* Token balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {TOKENS.map(tk => {
            const av = Number(tokenBals[tk]?.available || 0);
            const lk = Number(tokenBals[tk]?.locked    || 0);
            const pr = getPriceOf(stats, tk);
            return (
              <div key={tk} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', outline: selToken === tk ? `1.5px solid ${TOKEN_COLORS[tk]}` : 'none' }}
                onClick={() => setSelToken(tk)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: TOKEN_COLORS[tk] }}>{TOKEN_LABELS[tk]}</span>
                  <span style={{ fontSize: 10, background: selToken===tk ? `${TOKEN_COLORS[tk]}22` : 'transparent', color: TOKEN_COLORS[tk], padding: '1px 6px', borderRadius: 10, border: `1px solid ${TOKEN_COLORS[tk]}44` }}>
                    {selToken===tk ? '✓ Đã chọn' : 'Chọn'}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>{formatKg(av)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  Khả dụng · {lk > 0 && <span>Đang khóa: {formatKg(lk)} · </span>}
                  {pr > 0 && <span>≈ {formatVND(av * pr)}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Main grid: batches + form */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

          {/* Available batches */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>
              Lô hàng khả dụng trong kho
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>({batches.length} lô)</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {batches.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted }}>Chưa có lô hàng nào trong kho</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Mã lô', 'Loại cà phê', 'Hạng', 'Kho/Địa điểm', 'Tồn kho (kg)', 'Ngày nhập kho'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b, i) => {
                      const grade = b.quality_grade || 'CR1';
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: C.accent, fontWeight: 600 }}>{b.batch_id}</td>
                          <td style={{ padding: '10px 12px' }}>{b.coffee_type || 'ROBUSTA'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ color: TOKEN_COLORS[grade] || C.text, fontWeight: 700 }}>{grade} ({TOKEN_LABELS[grade] || grade})</span>
                          </td>
                          <td style={{ padding: '10px 12px', color: C.muted }}>{b.storage_location || '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                            {formatKg(b.minted_amount || b.quantity)}
                          </td>
                          <td style={{ padding: '10px 12px', color: C.muted, fontSize: 11 }}>
                            {b.minted_at ? new Date(b.minted_at).toLocaleDateString('vi-VN') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Redeem form */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Tạo yêu cầu đổi hàng</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>LOẠI TOKEN</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {TOKENS.map(t => (
                  <button key={t} onClick={() => setSelToken(t)} style={{
                    padding: '6px 0', borderRadius: 6, border: `1px solid ${selToken===t ? TOKEN_COLORS[t] : C.border}`,
                    background: selToken===t ? `${TOKEN_COLORS[t]}18` : 'transparent',
                    color: selToken===t ? TOKEN_COLORS[t] : C.muted,
                    fontWeight: selToken===t ? 700 : 400, cursor: 'pointer', fontSize: 12,
                  }}>{TOKEN_LABELS[t]}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>SỐ LƯỢNG ĐỔI (KG)</div>
              <input
                type="number" value={qty} onChange={e => setQty(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                KL có thể đổi: <b style={{ color: C.green }}>{formatKg(avail)}</b>
              </div>
            </div>

            {qtyN > 0 && (
              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>Số lượng đổi</span>
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

            <div style={{ marginBottom: 12, padding: '9px 12px', background: 'rgba(246,70,93,0.06)', borderRadius: 6, border: '1px solid rgba(246,70,93,0.15)', fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
              <b style={{ color: C.red }}>Lưu ý:</b> Token sẽ bị khóa ngay khi tạo yêu cầu và sẽ bị đốt sau khi admin phê duyệt. Hành động này không thể hoàn tác sau khi được duyệt.
            </div>

            <button
              onClick={handleRedeem}
              disabled={submitting || !qty || qtyN <= 0}
              style={{
                width: '100%', padding: 12, borderRadius: 6, border: 'none',
                background: submitting || !qty || qtyN <= 0 ? '#2b3a3a' : C.accent,
                color: submitting || !qty || qtyN <= 0 ? C.muted : '#fff',
                fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >{submitting ? 'Đang xử lý…' : 'Tạo yêu cầu đổi hàng'}</button>

            {msg && (
              <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 6, fontSize: 12,
                background: msg.ok ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
                border: `1px solid ${msg.ok ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                color: msg.ok ? C.green : C.red,
              }}>{msg.text}</div>
            )}
          </div>
        </div>

        {/* Redemption history */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>
            Lịch sử yêu cầu đổi hàng
          </div>
          <div style={{ padding: 16 }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: '20px 0' }}>Chưa có yêu cầu đổi hàng</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['#ID', 'Loại token', 'Số lượng (kg)', 'Trạng thái', 'Ngày tạo', 'Ngày duyệt'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(r => {
                      const s = STATUS_LABEL[r.status] || { label: r.status, color: C.muted };
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                          <td style={{ padding: '9px 10px', color: C.muted }}>#{r.id}</td>
                          <td style={{ padding: '9px 10px', fontWeight: 700, color: TOKEN_COLORS[r.token_type] || C.text }}>{r.token_type || '—'}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{formatKg(r.kg_amount)}</td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span>
                          </td>
                          <td style={{ padding: '9px 10px', color: C.muted, fontSize: 11 }}>
                            {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style={{ padding: '9px 10px', color: C.muted, fontSize: 11 }}>
                            {r.processed_at ? new Date(r.processed_at).toLocaleDateString('vi-VN') : '—'}
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
    </TraderLayout>
  );
}
