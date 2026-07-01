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

const STATUS_COLOR = { pending: 'caro-badge-warning', approved: 'caro-badge-success', rejected: 'caro-badge-danger' };

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
      <div className="caro-page">
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">Quản lý Yêu Cầu Redeem</h2>
            <p className="caro-page-subtitle">Duyệt các yêu cầu đổi token RWA lấy cà phê vật lý</p>
          </div>
          <button onClick={load} className="caro-btn caro-btn-secondary">
            🔄 Làm mới
          </button>
        </div>

        {loading ? (
          <div className="caro-empty" style={{ padding: "80px 0" }}>
            <div className="caro-empty-icon" style={{ animation: "caro-spin 1.5s infinite" }}>🔄</div>
            <div className="caro-empty-title">Đang tải yêu cầu redeem...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="caro-empty" style={{ padding: "80px 0" }}>
            <div className="caro-empty-icon">🫘</div>
            <div className="caro-empty-title">Không có yêu cầu nào</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {orders.map(o => {
              const res = results[o.id];
              return (
                <div key={o.id} className="caro-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 800, color: "#408A71", fontSize: 18 }}>#{o.id}</span>
                        <span style={{ fontWeight: 700, color: "#f8fafc", fontSize: 16 }}>{o.full_name}</span>
                        <span className={`caro-badge ${STATUS_COLOR[o.status] || 'caro-badge-muted'}`} style={{ padding: "4px 10px", fontSize: 12 }}>
                          {o.status.toUpperCase()}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, color: '#94a3b8', display: "block", marginTop: 4 }}>{o.email}</span>
                      
                      <div style={{ marginTop: 12, fontSize: 14, color: "#cbd5e1" }}>
                        <strong style={{ color: "#f8fafc" }}>{o.kg_amount} kg</strong> cà phê vật lý → <strong style={{ color: "#B0E4CC" }}>{o.token_amount} {o.token_type || 'CR1'} token</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                        Ngày tạo: {new Date(o.created_at).toLocaleString('vi-VN')}
                      </div>
                      {o.tx_hash && (
                        <div style={{ fontSize: 13, marginTop: 12 }}>
                          <span style={{ color: "#64748b" }}>TxHash:</span>{' '}
                          <a href={`https://sepolia.etherscan.io/tx/${o.tx_hash}`}
                             target="_blank" rel="noreferrer" style={{ color: '#408A71', fontFamily: "monospace", textDecoration: "none", fontWeight: 600 }}>
                            {o.tx_hash} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {o.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                      <button
                        onClick={() => review(o.id, 'approve')}
                        disabled={processing === o.id}
                        className={`caro-btn ${processing === o.id ? "caro-btn-ghost" : "caro-btn-primary"}`}
                      >
                        {processing === o.id ? '⏳ Đang xử lý...' : '✅ Phê duyệt & Burn Token'}
                      </button>
                      <button
                        onClick={() => review(o.id, 'reject')}
                        disabled={processing === o.id}
                        className="caro-btn caro-btn-danger"
                      >
                        ❌ Từ chối
                      </button>
                    </div>
                  )}

                  {res && (
                    <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8, fontSize: 13,
                      background: res.success ? 'rgba(176, 228, 204,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${res.success ? 'rgba(176, 228, 204,0.2)' : 'rgba(239,68,68,0.2)'}`
                    }}>
                      {res.loading && <span style={{ color: "#408A71", fontWeight: 600 }}>⏳ Đang ghi nhận trên blockchain (Burn)...</span>}
                      {res.success && res.action === 'approve' && (
                        <span style={{ color: '#B0E4CC', fontWeight: 600 }}>
                          ✅ Burn thành công | TxHash: <span style={{ fontFamily: "monospace" }}>{res.txHash}</span>
                        </span>
                      )}
                      {res.success && res.action === 'reject' && (
                        <span style={{ color: '#f0b90b', fontWeight: 600 }}>✅ Đã từ chối yêu cầu. Token đã được unlock về ví của Trader.</span>
                      )}
                      {res.success === false && (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>❌ Lỗi: {res.error}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
