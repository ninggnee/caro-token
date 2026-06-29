import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { API_URL } from '../config/api';
import { formatNumber, formatVND } from '../utils/formatters';

function authHeader() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const STATUS_COLOR = { pending: '#f39c12', approved: '#27ae60', rejected: '#e74c3c' };

export default function DepositPage() {
  const [amount,   setAmount]   = useState('');
  const [file,     setFile]     = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');
  const [wallet,   setWallet]   = useState(null);

  const loadHistory = async () => {
    const res = await fetch(`${API_URL}/wallet/deposit`, { headers: authHeader() });
    const data = await res.json();
    if (data.success) setHistory(data.data || []);
  };

  const loadWallet = async () => {
    const res = await fetch(`${API_URL}/wallet/balance`, { headers: authHeader() });
    const data = await res.json();
    if (data.success) setWallet(data);
  };

  useEffect(() => { loadHistory(); loadWallet(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return setMsg('Nhập số tiền hợp lệ');
    setLoading(true);
    setMsg('');
    const form = new FormData();
    form.append('amount', amount);
    if (file) form.append('proof_image', file);
    const res = await fetch(`${API_URL}/wallet/deposit`, {
      method: 'POST',
      headers: authHeader(),
      body: form,
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setMsg('✅ Yêu cầu nạp tiền đã được gửi. Vui lòng chờ Admin duyệt.');
      setAmount(''); setFile(null);
      loadHistory();
    } else {
      setMsg(`❌ ${data.message}`);
    }
  };

  return (
    <DashboardLayout title="Nạp VND">
      {/* Wallet summary */}
      {wallet && (
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Số dư ví VND</div>
          <div>Khả dụng: <b style={{ color: '#27ae60' }}>{formatVND(wallet.vnd_available)}</b></div>
          <div style={{ fontSize: 13, color: '#aaa' }}>
            Tổng: {formatNumber(wallet.vnd_balance)} | Đang lock: {formatNumber(wallet.vnd_locked)}
          </div>
        </div>
      )}

      {/* Deposit form */}
      <div style={{ padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>Tạo yêu cầu nạp tiền</h3>
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>Số tiền (VNĐ)</label>
            <input
              type="number" min="10000" step="1000"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="VD: 1000000"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6,
                border: '1px solid #555', background: '#1a1a2e', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
              Ảnh biên lai chuyển khoản (tùy chọn)
            </label>
            <input
              type="file" accept="image/*"
              onChange={e => setFile(e.target.files[0])}
              style={{ color: '#ccc' }}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{ padding: '10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#3498db', color: '#fff', fontWeight: 600 }}>
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu nạp tiền'}
          </button>
        </form>
        {msg && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6,
            background: msg.startsWith('✅') ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
            color: msg.startsWith('✅') ? '#27ae60' : '#e74c3c' }}>
            {msg}
          </div>
        )}
        <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: 13, color: '#aaa' }}>
          <b>Hướng dẫn:</b> Chuyển khoản về tài khoản ngân hàng của CaRo Token, sau đó upload biên lai và gửi yêu cầu.
          Admin sẽ duyệt trong vòng 1–2 giờ làm việc.
        </div>
      </div>

      {/* History */}
      <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 10px' }}>Lịch sử nạp tiền</h3>
        {history.length === 0
          ? <div style={{ color: '#888' }}>Chưa có yêu cầu nào</div>
          : (
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map(d => (
              <div key={d.id} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>+{formatVND(d.amount)}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {new Date(d.created_at).toLocaleString('vi-VN')}
                  </div>
                  {d.note && <div style={{ fontSize: 12, color: '#aaa' }}>{d.note}</div>}
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: `${STATUS_COLOR[d.status] || '#555'}20`,
                  color: STATUS_COLOR[d.status] || '#fff' }}>
                  {d.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
