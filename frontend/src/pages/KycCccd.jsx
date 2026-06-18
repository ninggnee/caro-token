import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosClient";
import { useAuth } from "../context/AuthContext";

export default function KycCccd() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [ocr, setOcr] = useState({ fullname: '', id: '', dob: '', gender: '', nationality: '', address: '' });
  const [role] = useState('farmer');
  const [loading, setLoading] = useState(false);

  const handleFile = (e, setter) => {
    const f = e.target.files[0];
    if (f) setter(Object.assign(f, { preview: URL.createObjectURL(f) }));
  };

  const runMockOcr = () => {
    setOcr({ fullname: 'Nguyễn Văn A', id: '012345678901', dob: '01/01/2000', gender: 'Nam', nationality: 'VN', address: 'Hà Nội' });
  };

  const handleSubmit = async () => {
    if (!front || !back) return alert('Vui lòng tải lên cả mặt trước và mặt sau CCCD');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('front', front);
      fd.append('back', back);
      const res = await axios.post('/kyc/submit', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data && res.data.success) {
        alert('KYC đã gửi. Trạng thái: Chờ duyệt');
        // update user kyc_status by refetching login info? simple navigate
        navigate('/farmer');
      } else {
        alert(res.data?.message || 'Lỗi khi gửi KYC');
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || err.message || 'Lỗi mạng');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>KYC CCCD</h1>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <h3>Hướng dẫn</h3>
          <ul>
            <li>Sử dụng ảnh rõ nét</li>
            <li>Không bị mờ hoặc lóa sáng</li>
            <li>Chụp đầy đủ 4 góc CCCD</li>
            <li>Định dạng JPG hoặc PNG</li>
          </ul>

          <div style={{ marginTop: 12 }}>
            <div>
              <label>Tải lên CCCD mặt trước</label>
              <input type="file" accept="image/*" onChange={(e) => handleFile(e, setFront)} />
              {front && <img src={front.preview} alt="front" style={{ maxWidth: 240, marginTop: 8 }} />}
            </div>

            <div style={{ marginTop: 12 }}>
              <label>Tải lên CCCD mặt sau</label>
              <input type="file" accept="image/*" onChange={(e) => handleFile(e, setBack)} />
              {back && <img src={back.preview} alt="back" style={{ maxWidth: 240, marginTop: 8 }} />}
            </div>
          </div>
        </div>

        <div style={{ width: 420, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
          <h3>Thông tin OCR</h3>
          <div>
            <label>Họ và tên</label>
            <input value={ocr.fullname} onChange={(e) => setOcr({ ...ocr, fullname: e.target.value })} />
            <label style={{ marginTop: 8 }}>Số CCCD</label>
            <input value={ocr.id} onChange={(e) => setOcr({ ...ocr, id: e.target.value })} />
            <label style={{ marginTop: 8 }}>Ngày sinh</label>
            <input value={ocr.dob} onChange={(e) => setOcr({ ...ocr, dob: e.target.value })} />
            <label style={{ marginTop: 8 }}>Giới tính</label>
            <input value={ocr.gender} onChange={(e) => setOcr({ ...ocr, gender: e.target.value })} />
            <label style={{ marginTop: 8 }}>Nơi thường trú</label>
            <input value={ocr.address} onChange={(e) => setOcr({ ...ocr, address: e.target.value })} />
          </div>

          <div style={{ marginTop: 12 }}>Vai trò: <b>{role}</b></div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={runMockOcr}>Chạy OCR mock</button>
            <button onClick={handleSubmit} className="btn" disabled={loading}>{loading ? 'Đang gửi...' : 'Gửi xác thực'}</button>
            <button onClick={() => alert('Lưu nháp (placeholder)')}>Lưu nháp</button>
          </div>
        </div>
      </div>
    </div>
  );
}
