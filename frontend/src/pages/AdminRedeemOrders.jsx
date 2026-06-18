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

const STATUS_COLOR = { pending: '#f39c12', approved: '#27ae60', rejected: '#e74c3c' };

export default function AdminRedeemOrders() {
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(null);
  const [results,    setResults]    = useState({});

  const load = async () => {
    setLoading(true);
    const data = await apiFetch('/redeem/admin');
    if (data.success) setOrders(data.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (id, action) => {
    setProcessing(id);
    setResults(prev => ({ ...prev, [id]: { loading: true } }));
    const data = await apiFetch(`/redeem/admin/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    setProcessing(null);
    setResults(prev => ({
      ...prev,
      [id]: data.success
        ? { success: true, txHash: data.txHash, action }
        : { success: false, error: data.message, action },
    }));
    if (data.success) load();
  };

  return (
    <DashboardLayout title="Quản lý đổi Token → Cà phê">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Redeem Orders</h2>
        <button onClick={load} style={{ padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#aaa' }}>Đang tải...</div>
      ) : orders.length === 0 ? (
        <div style={{ color: '#aaa' }}>Không có yêu cầu nào</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {orders.map(o => {
            const res = results[o.id];
            return (
              <div key={o.id} style={{
                padding: 14, borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${STATUS_COLOR[o.status] || '#444'}30`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>#{o.id} — {o.full_name}</span>
                    <span style={{ fontSize: 13, color: '#aaa', marginLeft: 8 }}>{o.email}</span>
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      {o.kg_amount} kg → {o.token_amount} {o.token_type || 'CR1'} token
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {new Date(o.created_at).toLocaleString('vi-VN')}
                    </div>
                    {o.tx_hash && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        TxHash:{' '}
                        <a href={`https://sepolia.etherscan.io/tx/${o.tx_hash}`}
                           target="_blank" rel="noreferrer" style={{ color: '#3498db' }}>
                          {o.tx_hash.slice(0,20)}…
                        </a>
                      </div>
                    )}
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    height: 'fit-content',
                    background: `${STATUS_COLOR[o.status] || '#555'}20`,
                    color: STATUS_COLOR[o.status] || '#fff',
                  }}>{o.status.toUpperCase()}</span>
                </div>

                {o.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => review(o.id, 'approve')}
                      disabled={processing === o.id}
                      style={{ padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                        background: '#27ae60', color: '#fff', border: 'none', fontWeight: 600 }}
                    >
                      {processing === o.id ? '⏳ Xử lý...' : '✅ Approve & Burn'}
                    </button>
                    <button
                      onClick={() => review(o.id, 'reject')}
                      disabled={processing === o.id}
                      style={{ padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                        background: '#e74c3c', color: '#fff', border: 'none' }}
                    >
                      ❌ Từ chối
                    </button>
                  </div>
                )}

                {res && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 6, fontSize: 13,
                    background: res.success ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)' }}>
                    {res.loading && '⏳ Đang burn trên blockchain...'}
                    {res.success && res.action === 'approve' && (
                      <span style={{ color: '#27ae60' }}>
                        ✅ Burn thành công | TxHash: {res.txHash?.slice(0,20)}…
                      </span>
                    )}
                    {res.success && res.action === 'reject' && (
                      <span style={{ color: '#f39c12' }}>✅ Đã từ chối. Token đã được unlock.</span>
                    )}
                    {res.success === false && (
                      <span style={{ color: '#e74c3c' }}>❌ {res.error}</span>
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
