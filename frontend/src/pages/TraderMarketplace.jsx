import { useState } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";

const TOKENS = [
  { symbol: 'CaRo1', price: 100000, change: '+2.5%', volume: '1,200' },
  { symbol: 'CaRo2', price: 85000, change: '+1.2%', volume: '900' },
  { symbol: 'CaRo3', price: 70000, change: '-0.5%', volume: '430' },
];

export default function TraderMarketplace() {
  const [filter, setFilter] = useState('all');
  const list = TOKENS.filter(t => filter === 'all' ? true : t.symbol === filter);

  return (
    <DashboardLayout title="Marketplace (Trader)">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setFilter('all')}>Tất cả</button>
          <button onClick={() => setFilter('CaRo1')}>CaRo1</button>
          <button onClick={() => setFilter('CaRo2')}>CaRo2</button>
          <button onClick={() => setFilter('CaRo3')}>CaRo3</button>
        </div>

        <table style={{ width: '100%' }}>
          <thead><tr><th>Token</th><th>Giá hiện tại</th><th>Thay đổi 24h</th><th>Khối lượng</th><th>Hành động</th></tr></thead>
          <tbody>
            {list.map(t => (
              <tr key={t.symbol}>
                <td>{t.symbol}</td>
                <td>{t.price.toLocaleString()} VNĐ</td>
                <td>{t.change}</td>
                <td>{t.volume}</td>
                <td>
                  <button onClick={() => window.location.href = `/trader/trading?pair=${t.symbol}/VND`}>Giao dịch</button>
                  <button onClick={() => window.location.href = `/trader/marketplace/${t.symbol}`}>Chi tiết</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
