import { useEffect, useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from '../utils/axiosClient';
import { formatKg, formatToken } from '../utils/formatters';

export default function TokenRequestsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/token/requests');
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <DashboardLayout title="Danh sách yêu cầu">
      <h2>Danh sách yêu cầu Token hóa</h2>
      {loading && <div>Loading...</div>}
      {!loading && items.length === 0 && <div>Chưa có yêu cầu</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map(it => (
          <div key={it.id} style={{ background: '#0f1619', padding: 12 }}>
            <div><b>#{it.id}</b> - {it.lot_id || 'Lô chưa đặt'} - {formatKg(it.kg_amount)}</div>
            <div>Tokens: {formatToken(it.token_amount)} - Status: {it.status}</div>
            <div>Created: {it.created_at}</div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
