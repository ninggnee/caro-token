import { useState } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { API_URL } from '../config/api';

function authHeader() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path, method = 'GET') {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  return res.json();
}

const STATUS_COLORS = {
  updated:  '#e74c3c',
  ok:       '#27ae60',
  error:    '#e67e22',
};

export default function AdminTokenSync() {
  const [statusData,  setStatusData]  = useState(null);
  const [applyResult, setApplyResult] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  const handleCheckStatus = async () => {
    setLoading(true);
    setError(null);
    setApplyResult(null);
    try {
      const data = await apiFetch('/admin/sync/status');
      if (data.message) throw new Error(data.message);
      setStatusData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!window.confirm(
      'Bạn có chắc muốn ghi đè số dư DB bằng số dư trên chuỗi mới?\n\nThao tác này không thể hoàn tác.'
    )) return;

    setLoading(true);
    setError(null);
    setStatusData(null);
    try {
      const data = await apiFetch('/admin/sync/apply', 'POST');
      if (data.message && !data.report) throw new Error(data.message);
      setApplyResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const rows = statusData?.rows || applyResult?.report || [];
  const mismatches = statusData?.mismatches;

  return (
    <DashboardLayout title="Đồng bộ Token On-Chain">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px' }}>

        {/* Header */}
        <div style={{
          background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 10,
          padding: '20px 24px', marginBottom: 24,
        }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#fff' }}>
            Đồng bộ Số Dư Token từ Smart Contract Mới
          </h2>
          <p style={{ margin: 0, color: '#aaa', fontSize: 14 }}>
            Đọc số dư trực tiếp từ hợp đồng CoffeeToken (CR1/CR2/CR3) trên blockchain và cập nhật
            bảng <code>user_balances</code> trong DB. Chỉ ảnh hưởng farmer có ví đã đăng ký.
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button
            onClick={handleCheckStatus}
            disabled={loading}
            style={{
              padding: '10px 22px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: '#3498db', color: '#fff', fontWeight: 600, fontSize: 14,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Đang kiểm tra...' : '🔍 Kiểm tra trạng thái'}
          </button>

          <button
            onClick={handleApply}
            disabled={loading}
            style={{
              padding: '10px 22px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: '#e74c3c', color: '#fff', fontWeight: 600, fontSize: 14,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Đang đồng bộ...' : '⚡ Áp dụng đồng bộ'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#3d1010', border: '1px solid #e74c3c', borderRadius: 8,
            padding: '12px 16px', marginBottom: 20, color: '#ff6b6b',
          }}>
            ❌ {error}
          </div>
        )}

        {/* Status summary */}
        {statusData && (
          <div style={{
            background: mismatches > 0 ? '#2d1c0a' : '#0a2d1c',
            border: `1px solid ${mismatches > 0 ? '#e67e22' : '#27ae60'}`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            color: mismatches > 0 ? '#f39c12' : '#2ecc71',
          }}>
            {mismatches > 0
              ? `⚠️  Phát hiện ${mismatches} chênh lệch trong ${statusData.farmerCount} farmer (${statusData.errors} lỗi RPC)`
              : `✅ Tất cả ${statusData.farmerCount} farmer — số dư DB khớp với on-chain`
            }
          </div>
        )}

        {/* Apply result */}
        {applyResult && (
          <div style={{
            background: applyResult.errors > 0 ? '#2d1c0a' : '#0a2d1c',
            border: `1px solid ${applyResult.errors > 0 ? '#e67e22' : '#27ae60'}`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            color: applyResult.errors > 0 ? '#f39c12' : '#2ecc71',
          }}>
            ✅ {applyResult.message}
          </div>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              background: '#1a1a2e', borderRadius: 10,
              fontSize: 13,
            }}>
              <thead>
                <tr style={{ background: '#16213e' }}>
                  {['Email', 'Ví', 'Token', 'DB (trước)', 'On-chain / Sau', 'Trạng thái'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      color: '#aaa', fontWeight: 600, borderBottom: '1px solid #2d2d4e',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMismatch = r.mismatch || r.status === 'updated';
                  const statusKey  = r.status || (r.mismatch ? 'updated' : (r.error ? 'error' : 'ok'));
                  return (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? '#1a1a2e' : '#1e1e38',
                        borderBottom: '1px solid #2d2d4e',
                        color: isMismatch ? '#f39c12' : '#ccc',
                      }}
                    >
                      <td style={{ padding: '8px 14px' }}>{r.email}</td>
                      <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 11 }}>
                        {(r.wallet || '—').slice(0, 12)}…
                      </td>
                      <td style={{ padding: '8px 14px', fontWeight: 700 }}>{r.tokenType}</td>
                      <td style={{ padding: '8px 14px' }}>
                        {r.dbBalance !== undefined ? r.dbBalance : (r.before ?? '—')}
                      </td>
                      <td style={{ padding: '8px 14px', fontWeight: isMismatch ? 700 : 400 }}>
                        {r.onChain !== undefined ? r.onChain : (r.after ?? r.balance ?? '—')}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11,
                          background: STATUS_COLORS[statusKey] || '#444', color: '#fff',
                        }}>
                          {statusKey === 'updated' ? '✏️ cập nhật'
                            : statusKey === 'error'   ? '❌ lỗi'
                            : '✓ khớp'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
