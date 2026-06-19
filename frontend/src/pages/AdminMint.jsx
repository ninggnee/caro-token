import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { API_URL } from '../config/api';

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

const STATUS_COLOR = {
  pending:  '#f39c12',
  approved: '#3498db',
  minted:   '#27ae60',
  rejected: '#e74c3c',
};

export default function AdminMint() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [mintingId, setMintingId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);
  const [results,   setResults]  = useState({});

  const load = async () => {
    setLoading(true);
    const data = await apiFetch('/token/admin/requests');
    if (data.success) setRequests(data.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (id, action, token_type = 'CR1') => {
    setReviewingId(id);
    const data = await apiFetch(`/token/admin/requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, token_type }),
    });
    setReviewingId(null);
    if (data.success) { load(); }
    else alert(data.message);
  };

  const mint = async (id) => {
    setMintingId(id);
    setResults(prev => ({ ...prev, [id]: { loading: true } }));
    const data = await apiFetch(`/token/admin/requests/${id}/mint`, { method: 'POST', body: '{}' });
    setMintingId(null);
    setResults(prev => ({
      ...prev,
      [id]: data.success
        ? { success: true, txHash: data.txHash, block: data.blockNumber }
        : { success: false, error: data.message },
    }));
    if (data.success) load();
  };

  const explorerUrl = (txHash) =>
    `https://sepolia.etherscan.io/tx/${txHash}`;

  const translateStatus = (s) => {
    if (s === 'pending') return 'CHỜ DUYỆT';
    if (s === 'approved') return 'ĐÃ DUYỆT';
    if (s === 'minted') return 'ĐÃ MINT';
    if (s === 'rejected') return 'BỊ TỪ CHỐI';
    return s.toUpperCase();
  };

  return (
    <DashboardLayout title="Mint Token (Quản trị)">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Danh sách yêu cầu Token hóa</h2>
        <button onClick={load} style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(72,117,115,0.15)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
          🔄 Làm mới
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#aaa', fontSize: 14 }}>Đang tải...</div>
      ) : requests.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: 14 }}>Không có yêu cầu nào</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {requests.map(r => {
            const res = results[r.id];
            return (
              <div key={r.id} style={{
                padding: 16, borderRadius: 8, background: '#172524',
                border: `1px solid rgba(72,117,115,0.15)`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Yêu cầu #{r.id} — {r.full_name} ({r.email})</div>
                    <div style={{ fontSize: 13, color: '#9aa5b4', marginTop: 4 }}>
                      {r.kg_amount} kg → {r.token_amount} token
                      {r.grade && ` | Grade: ${r.grade}`}
                      {r.token_type && ` | Loại: ${r.token_type}`}
                    </div>
                    {r.lot_code && (
                      <div style={{ fontSize: 12, color: '#6b7a99', marginTop: 4 }}>Mã lô: {r.lot_code}</div>
                    )}
                    {r.receipt_code && (
                      <div style={{ fontSize: 12, color: '#0ecb81', marginTop: 4 }}>✅ Chứng từ kho: {r.receipt_code}</div>
                    )}
                    {r.lot_id_ref && !r.receipt_code && (
                      <div style={{ fontSize: 12, color: '#f6465d', marginTop: 4 }}>⚠ Chưa có Chứng từ kho</div>
                    )}
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: `${STATUS_COLOR[r.status] || '#555'}20`,
                    color: STATUS_COLOR[r.status] || '#fff',
                  }}>{translateStatus(r.status)}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {r.status === 'pending' && (
                    <>
                      {['CR1','CR2','CR3'].map(type => (
                        <button
                          key={type}
                          onClick={() => review(r.id, 'approve', type)}
                          disabled={reviewingId === r.id}
                          style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                            background: '#487573', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600 }}
                        >
                          ✅ Duyệt ({type})
                        </button>
                      ))}
                      <button
                        onClick={() => review(r.id, 'reject')}
                        disabled={reviewingId === r.id}
                        style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                          background: '#f6465d', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600 }}
                      >
                        ❌ Từ chối
                      </button>
                    </>
                  )}

                  {r.status === 'approved' && (
                    <button
                      onClick={() => mint(r.id)}
                      disabled={mintingId === r.id}
                      style={{ padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
                        background: '#0ecb81', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13 }}
                    >
                      {mintingId === r.id ? '⏳ Đang mint trên blockchain...' : '🪙 Mint Token'}
                    </button>
                  )}
                </div>

                {/* Mint result */}
                {res && (
                  <div style={{ marginTop: 10, padding: 8, borderRadius: 6,
                    background: res.success ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)' }}>
                    {res.loading && <span style={{ fontSize: 13 }}>⏳ Đang xử lý...</span>}
                    {res.success && (
                      <div>
                        <div style={{ color: '#0ecb81', fontWeight: 600, fontSize: 13 }}>✅ Mint thành công!</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>
                          TxHash:{' '}
                          <a href={explorerUrl(res.txHash)} target="_blank" rel="noreferrer"
                            style={{ color: '#7fe0c9', wordBreak: 'break-all', textDecoration: 'none' }}>
                            {res.txHash}
                          </a>
                        </div>
                        <div style={{ fontSize: 12, color: '#9aa5b4' }}>Block: #{res.block}</div>
                      </div>
                    )}
                    {res.success === false && (
                      <div style={{ color: '#f6465d', fontSize: 13 }}>❌ {res.error}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
