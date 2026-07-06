import { useState } from 'react';
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from '../utils/axiosClient';
import { useNavigate } from 'react-router-dom';

export default function CreateTokenRequest() {
  const [lotId, setLotId] = useState('');
  const [grade, setGrade] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!lotId) return alert('Nhập mã ID lô hàng (lot_id)');
    setLoading(true);
    try {
      const res = await axios.post('/token/requests', { lot_id: lotId, grade: grade || null });
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
        <label>ID Lô hàng (đã có biên nhận kho)</label>
        <input value={lotId} onChange={(e) => setLotId(e.target.value)} />
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Số lượng Token sẽ được lấy tự động bằng đúng khối lượng đã xác nhận nhập kho của lô hàng này.
        </div>

        <label style={{ marginTop: 8 }}>Grade (tùy chọn — mặc định lấy theo kết quả kiểm định của lô)</label>
        <input value={grade} onChange={(e) => setGrade(e.target.value)} />

        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={handleSubmit} disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi yêu cầu'}</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
