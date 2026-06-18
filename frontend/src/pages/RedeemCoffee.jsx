import { useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";

export default function RedeemCoffee() {
  const [token, setToken] = useState('CaRo1');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [requests, setRequests] = useState([]);

  const submit = () => {
    const id = '#R' + Math.floor(Math.random()*9000 + 1000);
    setRequests(s => [{ id, token, amount, location, name, phone, status: 'Chờ xác nhận' }, ...s]);
    setAmount(''); setLocation(''); setName(''); setPhone('');
    alert('Đã tạo yêu cầu ' + id);
  }

  return (
    <DashboardLayout title="Đổi Token lấy cà phê">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
          <h3>Tạo yêu cầu đổi</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <select value={token} onChange={e => setToken(e.target.value)}>
              <option>CaRo1</option>
              <option>CaRo2</option>
              <option>CaRo3</option>
            </select>
            <input placeholder="Số lượng Token" value={amount} onChange={e => setAmount(e.target.value)} />
            <input placeholder="Địa điểm nhận" value={location} onChange={e => setLocation(e.target.value)} />
            <input placeholder="Người nhận" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="Số điện thoại" value={phone} onChange={e => setPhone(e.target.value)} />
            <button onClick={submit} className="btn">Tạo yêu cầu</button>
          </div>
        </div>

        <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
          <h3>Trạng thái xử lý</h3>
          <div>
            {requests.length === 0 ? <div>Chưa có yêu cầu</div> : (
              <table style={{ width: '100%' }}>
                <thead><tr><th>Mã</th><th>Token</th><th>Số lượng</th><th>Địa điểm</th><th>Người nhận</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}><td>{r.id}</td><td>{r.token}</td><td>{r.amount}</td><td>{r.location}</td><td>{r.name}</td><td>{r.status}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
