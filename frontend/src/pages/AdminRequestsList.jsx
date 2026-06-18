import { useEffect, useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from '../utils/axiosClient';

export default function AdminRequestsList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/token/admin/requests');
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const review = async (id, action) => {
    try {
      let payload = { action };
      if (action === 'approve') {
        // ask admin to choose token type
        const t = window.prompt('Enter token type to mint for this request (CR1, CR2, CR3)', 'CR1');
        if (!t) return; // cancel
        payload.token_type = t;
      }
      await axios.post(`/token/admin/requests/${id}/review`, payload);
      fetch();
    } catch (err) { console.error(err); alert(err?.response?.data?.message || err.message); }
  };

  const mint = async (id) => {
    try {
      await axios.post(`/token/admin/requests/${id}/mint`, { tx_hash: null });
      fetch();
    } catch (err) { console.error(err); alert(err?.response?.data?.message || err.message); }
  };

  return (
    <DashboardLayout title="Danh sách yêu cầu Token hóa (Admin)">
      <h2>Danh sách yêu cầu Token hóa</h2>
      {loading && <div>Loading...</div>}
      {!loading && items.length === 0 && <div>Không có yêu cầu</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map(it => (
          <div key={it.id} style={{ background: '#0f1619', padding: 12 }}>
            <div><b>#{it.id}</b> - {it.lot_id || 'Lô chưa đặt'} - {it.kg_amount} kg</div>
            <div>Farmer: {it.full_name} ({it.email})</div>
            <div>Tokens: {it.token_amount} - Status: {it.status}</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => review(it.id, 'approve')} style={{ marginRight: 8 }}>Approve</button>
              <button onClick={() => review(it.id, 'reject')} style={{ marginRight: 8 }}>Reject</button>
              <button onClick={() => mint(it.id)}>Mint</button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
