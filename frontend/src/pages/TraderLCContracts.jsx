import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TraderLayout from '../components/layout/TraderLayout';
import axios from '../utils/axiosClient';
import { formatVND, formatKg } from '../utils/formatters';
import { useTraderPrices, useTraderWallet, useInvalidateWallet, getPriceOf } from '../hooks/useTraderData';
import { LC_STATUS_LABELS, LC_PAYMENT_METHOD_LABELS, LC_PAYMENT_STATUS_LABELS, LC_DELIVERY_STATUS_LABELS } from '../utils/lcStatus';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#408A71', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', input: '#162020',
  accent: '#408A71', yellow: '#f0b90b',
};

export default function TraderLCContracts() {
  const nav = useNavigate();
  const invalidateWallet = useInvalidateWallet();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weightKg, setWeightKg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const { data: pricesData } = useTraderPrices();
  const { data: walletData } = useTraderWallet();
  const stats = pricesData?.stats || [];
  const vndAvailable = Number(walletData?.vnd_available || 0);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/lc/contracts');
      setContracts(res.data?.data || []);
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.message || 'Không tải được danh sách hợp đồng' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll so a Bank/Oracle action performed on the Admin side (approve,
    // lock Token, log an Oracle event, release payment, deliver) shows up
    // here without the Trader needing to manually refresh.
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  // Blended CR1/CR2/CR3 average price — same convention the backend uses to
  // price a contract that isn't tied to a single token grade. This is only
  // a live ESTIMATE for the form preview; the exact deposit rate (10–20%,
  // weighted by contract size) is generated once by the server at creation.
  const prices = ['CR1', 'CR2', 'CR3'].map(t => getPriceOf(stats, t)).filter(p => p > 0);
  const blendedPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const weightN = parseFloat(weightKg) || 0;
  const estContractValue = weightN * blendedPrice;

  const handleCreate = async () => {
    if (!weightN || weightN <= 0) {
      setMsg({ ok: false, text: 'Nhập khối lượng hợp lệ (kg)' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await axios.post('/lc/contracts', { requested_weight_kg: weightN });
      const d = res.data;
      setMsg({
        ok: true,
        text: `Tạo yêu cầu thành công (Hợp đồng #${d.id}). Giá trị hợp đồng: ${formatVND(d.contract_value)} — Đã ký quỹ: ${formatVND(d.deposit_amount)} (${(d.deposit_rate * 100).toFixed(1)}%). Đang chờ Ngân hàng phê duyệt.`,
      });
      setWeightKg('');
      invalidateWallet();
      load();
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.message || 'Tạo yêu cầu thất bại' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TraderLayout title="Nhận nông sản thực tế — Digital L/C">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: C.text, fontSize: 13 }}>

        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Nhận nông sản thực tế qua Thư tín dụng số (L/C)</h2>
          <p style={{ margin: 0, color: C.muted }}>
            Ngân hàng gom Token đang lưu hành trên nền tảng, khóa vào ví ký quỹ Smart Contract và tài trợ phần còn lại của hợp đồng.
            Sau khi Token được khóa, Trader chọn thanh toán ngay hoặc mua trả chậm qua ngân hàng đối tác.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

          {/* Contract list */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, fontWeight: 700 }}>
              Danh sách hợp đồng
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 8 }}>({contracts.length})</span>
            </div>
            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted }}>Đang tải...</div>
            ) : contracts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted }}>Chưa có hợp đồng nào</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Hợp đồng', 'Khối lượng', 'Giá trị hợp đồng', 'Ký quỹ', 'Ngân hàng tài trợ', 'Token đã khóa', 'Phương thức TT', 'Ngân hàng đối tác', 'Trạng thái Oracle', 'Thanh toán', 'Nhận hàng', 'Giai đoạn hiện tại', ''].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map(c => {
                      const stage = LC_STATUS_LABELS[c.status] || { label: c.status, color: C.muted };
                      const pay = LC_PAYMENT_STATUS_LABELS[c.payment_status] || { label: '—', color: C.muted };
                      const del = LC_DELIVERY_STATUS_LABELS[c.delivery_status] || { label: '—', color: C.muted };
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>#{c.id}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{formatKg(c.requested_weight_kg)}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{formatVND(c.contract_value)}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{formatVND(c.deposit_amount)}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: C.yellow }}>{formatVND(c.bank_funding_amount)}</td>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{c.total_token_locked ? formatKg(c.total_token_locked) : '—'}</td>
                          <td style={{ padding: '9px 10px' }}>{c.payment_method ? LC_PAYMENT_METHOD_LABELS[c.payment_method] : '—'}</td>
                          <td style={{ padding: '9px 10px', color: C.muted }}>{c.partner_bank || '—'}</td>
                          <td style={{ padding: '9px 10px', color: C.muted }}>{c.oracle_status_label || 'Chưa có cập nhật'}</td>
                          <td style={{ padding: '9px 10px' }}><span style={{ color: pay.color, fontWeight: 700 }}>{pay.label}</span></td>
                          <td style={{ padding: '9px 10px' }}><span style={{ color: del.color, fontWeight: 700 }}>{del.label}</span></td>
                          <td style={{ padding: '9px 10px' }}><span style={{ color: stage.color, fontWeight: 700 }}>{stage.label}</span></td>
                          <td style={{ padding: '9px 10px' }}>
                            <button
                              onClick={() => nav(`/trader/market/lc-contracts/${c.id}`)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 11, cursor: 'pointer' }}
                            >Chi tiết</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create request form */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Tạo yêu cầu nhận nông sản</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>KHỐI LƯỢNG MUỐN NHẬN (KG)</div>
              <input
                type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', background: C.input, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                Số dư VND khả dụng: <b style={{ color: C.green }}>{formatVND(vndAvailable)}</b>
              </div>
            </div>

            {weightN > 0 && blendedPrice > 0 && (
              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>Giá trị hợp đồng (ước tính)</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: C.yellow }}>{formatVND(estContractValue)}</span>
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
                  Ký quỹ (10–20%) và phần Ngân hàng tài trợ sẽ được hệ thống tính chính xác khi tạo yêu cầu, dựa trên quy mô hợp đồng.
                </div>
              </div>
            )}

            <div style={{ marginBottom: 12, padding: '9px 12px', background: 'rgba(240,185,11,0.06)', borderRadius: 6, border: '1px solid rgba(240,185,11,0.15)', fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
              Tiền ký quỹ sẽ được trừ ngay từ ví VND khi tạo yêu cầu. Nếu Ngân hàng từ chối, tiền ký quỹ sẽ được hoàn lại đầy đủ.
            </div>

            <button
              onClick={handleCreate}
              disabled={submitting || !weightKg || weightN <= 0}
              style={{
                width: '100%', padding: 12, borderRadius: 6, border: 'none',
                background: submitting || !weightKg || weightN <= 0 ? '#2b3a3a' : C.accent,
                color: submitting || !weightKg || weightN <= 0 ? C.muted : '#fff',
                fontWeight: 700, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >{submitting ? 'Đang xử lý…' : 'Tạo yêu cầu'}</button>

            {msg && (
              <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 6, fontSize: 12,
                background: msg.ok ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
                border: `1px solid ${msg.ok ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                color: msg.ok ? C.green : C.red,
              }}>{msg.text}</div>
            )}
          </div>
        </div>
      </div>
    </TraderLayout>
  );
}
