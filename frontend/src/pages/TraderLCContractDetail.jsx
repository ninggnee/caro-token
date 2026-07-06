import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TraderLayout from '../components/layout/TraderLayout';
import axios from '../utils/axiosClient';
import { formatVND, formatKg } from '../utils/formatters';
import {
  LC_STATUS, LC_STATUS_LABELS, LC_PAYMENT_METHOD, LC_PAYMENT_METHOD_LABELS,
  LC_PAYMENT_STATUS_LABELS, LC_DELIVERY_STATUS_LABELS, LC_ORACLE_CATEGORY_LABELS,
  lcDocumentTypeLabel, lcLifecycleSteps, formatDueDate,
} from '../utils/lcStatus';

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#408A71', red: '#f6465d', text: '#eaecef',
  muted: '#848e9c', dim: '#1e2d2f', accent: '#408A71', yellow: '#f0b90b',
};

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const Row = ({ l, v, highlight }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
    <span style={{ color: C.muted }}>{l}</span>
    <span style={{ fontWeight: 700, color: highlight || C.text, fontFamily: 'monospace' }}>{v}</span>
  </div>
);

function LifecycleStepper({ steps, rejected }) {
  if (rejected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.red, fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.red }} />
        Chờ Ngân hàng duyệt → Đã từ chối
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, alignItems: 'center' }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 110 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800,
              background: s.done ? C.green : 'rgba(255,255,255,0.08)',
              color: s.done ? '#06251a' : C.muted,
              border: s.done ? 'none' : '1px solid rgba(255,255,255,0.15)',
            }}>
              {s.done ? '✓' : i + 1}
            </div>
            <div style={{ fontSize: 10, color: s.done ? C.green : C.muted, textAlign: 'center', marginTop: 6, fontWeight: s.done ? 700 : 500, maxWidth: 110 }}>
              {s.label}
            </div>
            {s.done && s.at && <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{formatDateTime(s.at)}</div>}
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 28, height: 2, background: steps[i + 1].done ? C.green : 'rgba(255,255,255,0.1)', marginBottom: 24 }} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function TraderLCContractDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [contract, setContract] = useState(null);
  const [events, setEvents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Payment-method selection (BƯỚC 4)
  const [partnerBanks, setPartnerBanks] = useState([]);
  const [pmMethod, setPmMethod] = useState(null);
  const [pmBank, setPmBank] = useState('');
  const [pmPlanKey, setPmPlanKey] = useState('');
  const [pmSubmitting, setPmSubmitting] = useState(false);
  const [pmMsg, setPmMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/lc/contracts/${id}`);
      setContract(res.data?.data || null);
      setEvents(res.data?.events || []);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Không tải được chi tiết hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadDocuments = useCallback(async () => {
    try {
      const res = await axios.get('/warehouse-documents', { params: { lc_contract_id: id } });
      setDocuments(res.data?.documents || []);
    } catch {
      // Documents may not exist yet — not a fatal error for this page.
    }
  }, [id]);

  useEffect(() => {
    load();
    loadDocuments();
    const interval = setInterval(() => { load(); loadDocuments(); }, 15_000);
    return () => clearInterval(interval);
  }, [load, loadDocuments]);

  useEffect(() => {
    axios.get('/lc/partner-banks').then(res => setPartnerBanks(res.data?.data || [])).catch(() => {});
  }, []);

  const submitPaymentMethod = async () => {
    if (!pmMethod) return;
    setPmSubmitting(true);
    setPmMsg(null);
    try {
      const body = pmMethod === LC_PAYMENT_METHOD.IMMEDIATE
        ? { method: LC_PAYMENT_METHOD.IMMEDIATE }
        : { method: LC_PAYMENT_METHOD.DEFERRED, partner_bank: pmBank, plan_key: pmPlanKey };
      const res = await axios.patch(`/lc/contracts/${id}/payment-method`, body);
      setPmMsg({ ok: true, text: res.data?.message });
      load();
    } catch (e) {
      setPmMsg({ ok: false, text: e?.response?.data?.message || 'Chọn phương thức thanh toán thất bại' });
    } finally {
      setPmSubmitting(false);
    }
  };

  const selectedBankPlans = partnerBanks.find(b => b.name === pmBank)?.plans || [];

  if (loading) {
    return <TraderLayout title="Chi tiết hợp đồng"><div style={{ color: C.muted, padding: 32, textAlign: 'center' }}>Đang tải...</div></TraderLayout>;
  }
  if (err || !contract) {
    return <TraderLayout title="Chi tiết hợp đồng"><div style={{ color: C.red, padding: 32, textAlign: 'center' }}>{err || 'Không tìm thấy hợp đồng'}</div></TraderLayout>;
  }

  const s = LC_STATUS_LABELS[contract.status] || { label: contract.status, color: C.muted };
  const isRejected = contract.status === LC_STATUS.REJECTED;

  return (
    <TraderLayout title={`Hợp đồng L/C #${contract.id}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, color: C.text, fontSize: 13 }}>

        <div>
          <button onClick={() => nav('/trader/market/lc-contracts')} style={{ marginBottom: 10, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, fontSize: 11, cursor: 'pointer' }}>← Danh sách</button>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Hợp đồng nhận nông sản #{contract.id}</h2>
          <p style={{ margin: 0, color: C.muted }}>Trạng thái hiện tại: <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span></p>
        </div>

        {contract.status === LC_STATUS.CLOSED && (
          <div style={{ background: 'rgba(176,228,204,0.08)', border: '1px solid rgba(176,228,204,0.3)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.green, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Hợp đồng đã hoàn tất</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {['Đã thanh toán', 'Đã giao hàng', 'Token đã Burn', 'Hợp đồng đã đóng'].map(label => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.green, fontWeight: 700 }}>
                  <span>✔</span>{label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lifecycle stepper */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, overflowX: 'auto' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 14, textTransform: 'uppercase' }}>Vòng đời hợp đồng</div>
          <LifecycleStepper steps={lcLifecycleSteps(contract)} rejected={isRejected} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Thông tin hợp đồng</div>
              <Row l="Khối lượng yêu cầu" v={formatKg(contract.requested_weight_kg)} />
              <Row l="Đơn giá tham chiếu" v={`${formatVND(contract.unit_price)}/kg`} />
              <Row l="Giá trị hợp đồng" v={formatVND(contract.contract_value)} highlight={C.yellow} />
              <Row l="Tỷ lệ ký quỹ" v={`${(Number(contract.deposit_rate) * 100).toFixed(2)}%`} />
              <Row l="Số tiền ký quỹ (Trader)" v={formatVND(contract.deposit_amount)} />
              <Row l="Ngân hàng tài trợ" v={formatVND(contract.bank_funding_amount)} highlight={C.green} />
              <Row l="Ngày tạo yêu cầu" v={formatDateTime(contract.created_at)} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Token đã khóa trong Escrow</div>
              {contract.total_token_locked ? (
                <>
                  <Row l="Tổng Token đã khóa" v={formatKg(contract.total_token_locked)} highlight={C.green} />
                  <Row l="Thời điểm khóa" v={formatDateTime(contract.locked_at)} />
                </>
              ) : (
                <div style={{ color: C.muted, fontSize: 12.5 }}>Ngân hàng chưa gom và khóa Token cho hợp đồng này.</div>
              )}
            </div>

            {contract.status === LC_STATUS.TOKENS_LOCKED && !contract.payment_method && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Chọn phương thức thanh toán</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <button onClick={() => setPmMethod(LC_PAYMENT_METHOD.IMMEDIATE)} style={{
                    padding: '12px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${pmMethod === LC_PAYMENT_METHOD.IMMEDIATE ? C.green : C.border}`,
                    background: pmMethod === LC_PAYMENT_METHOD.IMMEDIATE ? 'rgba(64,138,113,0.1)' : 'transparent',
                  }}>
                    <div style={{ fontWeight: 700, color: pmMethod === LC_PAYMENT_METHOD.IMMEDIATE ? C.green : C.text, marginBottom: 4 }}>Thanh toán ngay</div>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>Thanh toán toàn bộ {formatVND(contract.bank_funding_amount)} ngay bây giờ. Nghĩa vụ tài chính hoàn tất ngay lập tức.</div>
                  </button>
                  <button onClick={() => setPmMethod(LC_PAYMENT_METHOD.DEFERRED)} style={{
                    padding: '12px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${pmMethod === LC_PAYMENT_METHOD.DEFERRED ? C.green : C.border}`,
                    background: pmMethod === LC_PAYMENT_METHOD.DEFERRED ? 'rgba(64,138,113,0.1)' : 'transparent',
                  }}>
                    <div style={{ fontWeight: 700, color: pmMethod === LC_PAYMENT_METHOD.DEFERRED ? C.green : C.text, marginBottom: 4 }}>Mua trả chậm</div>
                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>Nhận hàng trước, thanh toán sau theo gói tài trợ của ngân hàng đối tác.</div>
                  </button>
                </div>

                {pmMethod === LC_PAYMENT_METHOD.DEFERRED && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <select value={pmBank} onChange={(e) => { setPmBank(e.target.value); setPmPlanKey(''); }}
                      style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.dim, color: C.text, fontSize: 12.5 }}>
                      <option value="">— Chọn ngân hàng đối tác —</option>
                      {partnerBanks.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                    </select>
                    <select value={pmPlanKey} onChange={(e) => setPmPlanKey(e.target.value)} disabled={!pmBank}
                      style={{ padding: '8px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.dim, color: C.text, fontSize: 12.5 }}>
                      <option value="">— Chọn gói trả chậm —</option>
                      {selectedBankPlans.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                )}

                <button
                  onClick={submitPaymentMethod}
                  disabled={pmSubmitting || !pmMethod || (pmMethod === LC_PAYMENT_METHOD.DEFERRED && (!pmBank || !pmPlanKey))}
                  style={{
                    padding: '10px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 13,
                    background: pmSubmitting || !pmMethod ? '#2b3a3a' : C.accent,
                    color: pmSubmitting || !pmMethod ? C.muted : '#fff',
                    cursor: pmSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >{pmSubmitting ? 'Đang xử lý…' : 'Xác nhận phương thức thanh toán'}</button>

                {pmMsg && (
                  <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 6, fontSize: 12,
                    background: pmMsg.ok ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
                    border: `1px solid ${pmMsg.ok ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                    color: pmMsg.ok ? C.green : C.red,
                  }}>{pmMsg.text}</div>
                )}
              </div>
            )}

            {contract.payment_method && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Thông tin thanh toán</div>
                <Row l="Phương thức" v={LC_PAYMENT_METHOD_LABELS[contract.payment_method] || contract.payment_method} />
                {contract.payment_method === LC_PAYMENT_METHOD.DEFERRED && (
                  <>
                    <Row l="Ngân hàng đối tác" v={contract.partner_bank} />
                    <Row l="Gói tài trợ" v={contract.financing_plan} />
                    <Row l="Hạn thanh toán" v={formatDueDate(contract.due_date)} />
                  </>
                )}
                <Row l="Trạng thái thanh toán" v={LC_PAYMENT_STATUS_LABELS[contract.payment_status]?.label} highlight={LC_PAYMENT_STATUS_LABELS[contract.payment_status]?.color} />
                <Row l="Trạng thái nhận hàng" v={LC_DELIVERY_STATUS_LABELS[contract.delivery_status]?.label} highlight={LC_DELIVERY_STATUS_LABELS[contract.delivery_status]?.color} />
              </div>
            )}

            {isRejected && contract.rejection_reason && (
              <div style={{ background: C.card, border: '1px solid rgba(246,70,93,0.3)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Lý do từ chối</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{contract.rejection_reason}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {/* Oracle timeline */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Nhật ký Oracle (Timeline)</div>
              {events.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 12.5 }}>Chưa có cập nhật nào từ Oracle.</div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {events.map(ev => (
                    <div key={ev.id} style={{ padding: '9px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: C.text, fontSize: 12.5 }}>{ev.status_label}</span>
                        <span style={{ fontSize: 10, color: C.accent }}>{LC_ORACLE_CATEGORY_LABELS[ev.category] || ev.category}</span>
                      </div>
                      {ev.note && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{ev.note}</div>}
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{formatDateTime(ev.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Chứng từ</div>
              {documents.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 12.5 }}>Chưa có chứng từ nào được tải lên.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {documents.map(doc => (
                    <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{lcDocumentTypeLabel(doc.document_type)}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{doc.document_name} · {formatDateTime(doc.created_at)}</div>
                      </div>
                      {doc.cid && (
                        <a href={`https://ipfs.io/ipfs/${doc.cid}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: C.accent, textDecoration: 'none', fontWeight: 700 }}>Xem</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TraderLayout>
  );
}
