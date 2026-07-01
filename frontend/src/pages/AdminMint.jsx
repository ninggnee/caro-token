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

  const explorerUrl = (txHash) => `https://sepolia.etherscan.io/tx/${txHash}`;

  const translateStatus = (s) => {
    if (s === 'pending') return 'Chờ duyệt';
    if (s === 'approved') return 'Đã duyệt';
    if (s === 'minted') return 'Đã Mint';
    if (s === 'rejected') return 'Từ chối';
    return s.toUpperCase();
  };

  return (
    <DashboardLayout title="Mint Token (Quản trị)">
      <div className="caro-page">
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">Quản lý Mint Token</h1>
            <p className="caro-page-subtitle">Duyệt và phát hành Token RWA từ các lô hàng đã được kiểm định</p>
          </div>
          <button onClick={load} className="caro-btn caro-btn-ghost">
            🔄 Làm mới
          </button>
        </div>

        {loading ? (
          <div className="caro-empty">
            <span style={{ display: "inline-block", animation: "caro-spin 1s linear infinite", fontSize: 24 }}>🔄</span>
            <div className="caro-empty-title" style={{ marginTop: 10 }}>Đang tải danh sách...</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="caro-empty caro-card" style={{ padding: "40px 20px" }}>
            <div className="caro-empty-icon">📭</div>
            <div className="caro-empty-title">Không có yêu cầu Mint Token nào</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {requests.map(r => {
              const res = results[r.id];
              let statusClass = 'caro-badge-muted';
              if (r.status === 'pending') statusClass = 'caro-badge-warning';
              else if (r.status === 'approved') statusClass = 'caro-badge-success';
              else if (r.status === 'minted') statusClass = 'caro-badge-info';
              else if (r.status === 'rejected') statusClass = 'caro-badge-danger';

              return (
                <div key={r.id} className="caro-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#f8fafc" }}>#{r.id} — {r.full_name}</div>
                        <span className={`caro-badge ${statusClass}`}>{translateStatus(r.status)}</span>
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 6, fontSize: 13 }}>
                        <div style={{ color: "#64748b" }}>Email:</div>
                        <div style={{ color: "#e2e8f0" }}>{r.email}</div>
                        
                        <div style={{ color: "#64748b" }}>Chuyển đổi:</div>
                        <div style={{ color: "#e2e8f0", fontWeight: 700 }}>{r.kg_amount} kg → <span style={{ color: "#408A71" }}>{r.token_amount} CR</span></div>
                        
                        {(r.grade || r.token_type) && (
                          <>
                            <div style={{ color: "#64748b" }}>Phân loại:</div>
                            <div style={{ color: "#e2e8f0" }}>{r.grade && `Grade ${r.grade} `}{r.token_type && `(${r.token_type})`}</div>
                          </>
                        )}
                        
                        {r.lot_code && (
                          <>
                            <div style={{ color: "#64748b" }}>Mã lô:</div>
                            <div style={{ color: "#e2e8f0" }}>{r.lot_code}</div>
                          </>
                        )}
                      </div>

                      {r.receipt_code ? (
                        <div style={{ fontSize: 12, color: '#B0E4CC', marginTop: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(176, 228, 204,0.1)", padding: "6px 10px", borderRadius: 6, display: "inline-flex" }}>
                          ✅ Chứng từ kho: <strong>{r.receipt_code}</strong>
                        </div>
                      ) : r.lot_id_ref ? (
                        <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", padding: "6px 10px", borderRadius: 6, display: "inline-flex" }}>
                          ⚠ Chưa có Chứng từ kho
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", flexWrap: 'wrap' }}>
                    {r.status === 'pending' && (
                      <>
                        {['CR1','CR2','CR3'].map(type => (
                          <button
                            key={type}
                            onClick={() => review(r.id, 'approve', type)}
                            disabled={reviewingId === r.id}
                            className="caro-btn caro-btn-success"
                          >
                            ✅ Duyệt ({type})
                          </button>
                        ))}
                        <button
                          onClick={() => review(r.id, 'reject')}
                          disabled={reviewingId === r.id}
                          className="caro-btn caro-btn-danger"
                        >
                          ❌ Từ chối
                        </button>
                      </>
                    )}

                    {r.status === 'approved' && (
                      <button
                        onClick={() => mint(r.id)}
                        disabled={mintingId === r.id}
                        className="caro-btn caro-btn-primary"
                        style={{ fontSize: 14 }}
                      >
                        {mintingId === r.id ? '⏳ Đang mint trên blockchain...' : '🪙 Mint Token'}
                      </button>
                    )}
                  </div>

                  {/* Mint result */}
                  {res && (
                    <div style={{ marginTop: 16, padding: 12, borderRadius: 8,
                      background: res.success ? 'rgba(176, 228, 204,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${res.success ? 'rgba(176, 228, 204,0.2)' : 'rgba(239,68,68,0.2)'}`
                    }}>
                      {res.loading && <span style={{ fontSize: 13, color: "#408A71" }}>⏳ Đang xử lý giao dịch trên blockchain...</span>}
                      {res.success && (
                        <div>
                          <div style={{ color: '#B0E4CC', fontWeight: 700, fontSize: 14 }}>✅ Mint Token thành công!</div>
                          <div style={{ fontSize: 13, marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <span style={{ color: "#64748b" }}>TxHash:</span>
                              <a href={explorerUrl(res.txHash)} target="_blank" rel="noreferrer" style={{ color: '#408A71', wordBreak: 'break-all', textDecoration: 'none', fontFamily: "monospace" }}>
                                {res.txHash} ↗
                              </a>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <span style={{ color: "#64748b" }}>Block:</span>
                              <span style={{ color: "#e2e8f0" }}>#{res.block}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      {res.success === false && (
                        <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>❌ {res.error}</div>
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
