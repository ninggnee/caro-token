import { useEffect, useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from '../utils/axiosClient';

export default function FarmerMarketplace() {
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/market/tickers');
      setTickers(res.data.data || []);
    } catch (err) {
      console.error(err);
      setTickers([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <DashboardLayout title="Marketplace">
      <h2>Marketplace (Farmer)</h2>
      {loading && <div>Loading...</div>}
      {!loading && tickers.length === 0 && <div>Không có dữ liệu</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {tickers.map(t => (
          <div key={t.pair} style={{ background: '#0f1619', padding: 12 }}>
            <div style={{ fontWeight: 700 }}>{t.pair}</div>
            <div>Price: {t.price} • Volume: {t.volume}</div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
