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

export default function WithdrawPage() {
  const [amount,     setAmount]     = useState('');
  const [bankName,   setBankName]   = useState('');
  const [accNumber,  setAccNumber]  = useState('');
  const [accName,    setAccName]    = useState('');
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState('');
  const [wallet,     setWallet]     = useState(null);

  const loadHistory = async () => {
    const data = await apiFetch('/wallet/withdraw');
    if (data.success) setHistory(data.data || []);
  };

  const loadWallet = async () => {
    const data = await apiFetch('/wallet/balance');
    if (data.success) setWallet(data);
  };

  useEffect(() => { loadHistory(); loadWallet(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return setMsg('Nhập số tiền hợp lệ');
    if (!bankName || !accNumber || !accName) return setMsg('Điền đầy đủ thông tin ngân hàng');
    setLoading(true);
    setMsg('');
    const data = await apiFetch('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: Number(amount), bank_name: bankName, account_number: accNumber, account_name: accName }),
    });
    setLoading(false);
    if (data.success) {
      setMsg('✅ Yêu cầu rút tiền đã được gửi. Vui lòng chờ Admin duyệt.');
      setAmount(''); setBankName(''); setAccNumber(''); setAccName('');
      loadHistory(); loadWallet();
    } else {
      setMsg(`❌ ${data.message}`);
    }
  };

  return (
    <DashboardLayout title="Rút VND">
      {wallet && (
        <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Số dư ví VND</div>
          <div>Khả dụng: <b style={{ color: '#27ae60' }}>{Number(wallet.vnd_available).toLocaleString()} VNĐ</b></div>
          <div style={{ fontSize: 13, color: '#aaa' }}>
            Tổng: {Number(wallet.vnd_balance).toLocaleString()} | Đang lock: {Number(wallet.vnd_locked).toLocaleString()}
          </div>
        </div>
      )}

      <div style={{ padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px' }}>Tạo yêu cầu rút tiền</h3>
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          {[
            { label: 'Số tiền (VNĐ)', value: amount, set: setAmount, placeholder: 'VD: 500000', type: 'number' },
            { label: 'Tên ngân hàng', value: bankName, set: setBankName, placeholder: 'VD: Vietcombank', type: 'text' },
            { label: 'Số tài khoản', value: accNumber, set: setAccNumber, placeholder: 'VD: 0123456789', type: 'text' },
            { label: 'Tên chủ tài khoản', value: accName, set: setAccName, placeholder: 'VD: NGUYEN VAN A', type: 'text' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>{f.label}</label>
              <input
                type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid #555', background: '#1a1a2e', color: '#fff', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ padding: '10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: '#e67e22', color: '#fff', fontWeight: 600 }}>
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu rút tiền'}
          </button>
        </form>
        {msg && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 6,
            background: msg.startsWith('✅') ? 'rgba(39,174,96,0.1)' : 'rgba(231,76,60,0.1)',
            color: msg.startsWith('✅') ? '#27ae60' : '#e74c3c' }}>
            {msg}
          </div>
        )}
      </div>

      <div style={{ padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
        <h3 style={{ margin: '0 0 10px' }}>Lịch sử rút tiền</h3>
        {history.length === 0
          ? <div style={{ color: '#888' }}>Chưa có yêu cầu nào</div>
          : (
          <div style={{ display: 'grid', gap: 8 }}>
            {history.map(w => (
              <div key={w.id} style={{ padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>−{Number(w.amount).toLocaleString()} VNĐ</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    {w.bank_name} — {w.account_number}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {new Date(w.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: `${STATUS_COLOR[w.status] || '#555'}20`,
                  color: STATUS_COLOR[w.status] || '#fff' }}>
                  {w.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
