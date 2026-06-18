import { useEffect, useState } from "react";
import axios from "../utils/axiosClient";
import { Link } from "react-router-dom";

export default function KycAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/admin/kyc/pending`);
      setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
      // fallback mock
      setItems([
        { id: 'K1001', full_name: 'Nguyen Van A', email: 'a@example.com', created_at: '2026-06-10', front_path: '#', back_path: '#' }
      ]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchPending(); }, []);

  const review = async (id, action) => {
    try {
      await axios.post(`/admin/kyc/${id}/review`, { action });
      fetchPending();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || err.message);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>KYC Pending</h2>
      {loading && <div>Loading...</div>}
      {!loading && items.length === 0 && <div>No pending KYC</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((it) => (
          <div key={it.id} style={{ background: '#141a1f', padding: 12 }}>
            <div><b>{it.full_name}</b> ({it.email})</div>
            <div>Submitted: {it.created_at}</div>
            <div>
              <a href={it.front_path} target="_blank" rel="noreferrer">Front</a> |
              <a href={it.back_path} target="_blank" rel="noreferrer"> Back</a>
            </div>
            <div style={{ marginTop: 8 }}>
              <Link to={`/admin/kyc/${it.id}`} style={{ marginRight: 8 }}><button>View</button></Link>
              <button onClick={() => review(it.id, 'approve')} style={{ marginRight: 8 }}>Approve</button>
              <button onClick={() => review(it.id, 'reject')}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
