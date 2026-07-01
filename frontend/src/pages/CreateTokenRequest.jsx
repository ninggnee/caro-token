import { useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from '../utils/axiosClient';
import { useNavigate } from 'react-router-dom';

export default function CreateTokenRequest() {
  const [lotId, setLotId] = useState('');
  const [kg, setKg] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!kg) return alert('Nhập kg_amount');
    setLoading(true);
    try {
      const res = await axios.post('/token/requests', { kg_amount: Number(kg), lot_id: lotId || null, grade: grade || null });
      if (res.data && res.data.success) {
        alert('Yêu cầu đã gửi');
        navigate('/token/requests');
      } else alert(res.data?.message || 'Lỗi');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || err.message || 'Lỗi mạng');
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout title="Tạo yêu cầu Token hóa">
      <div style={{ width: "100%" }}>
        <h2>Tạo yêu cầu Token hóa</h2>
        <label>Mã lô</label>
        <input value={lotId} onChange={(e) => setLotId(e.target.value)} />

        <label style={{ marginTop: 8 }}>Khối lượng (kg)</label>
        <input value={kg} onChange={(e) => setKg(e.target.value)} />

        <label style={{ marginTop: 8 }}>Grade</label>
        <input value={grade} onChange={(e) => setGrade(e.target.value)} />

        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={handleSubmit} disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
