import { useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";

export default function TradeHistory() {
  const [rows] = useState([
    { id: '#T1001', asset: 'CaRo1', type: 'Buy', price: '100000', amount: 50, time: '2026-06-10' },
    { id: '#T1002', asset: 'CaRo2', type: 'Sell', price: '85000', amount: 10, time: '2026-06-09' },
  ]);

  return (
    <DashboardLayout title="Lịch sử giao dịch">
      <div style={{ padding: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <input placeholder="Filter token" />
          <input type="date" />
          <button>Áp dụng</button>
        </div>
        <table style={{ width: '100%' }}>
          <thead><tr><th>Mã</th><th>Tài sản</th><th>Loại</th><th>Giá</th><th>Khối lượng</th><th>Thời gian</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}><td>{r.id}</td><td>{r.asset}</td><td>{r.type}</td><td>{r.price}</td><td>{r.amount}</td><td>{r.time}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
