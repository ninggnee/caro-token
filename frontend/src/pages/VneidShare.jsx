import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function VneidShare() {
  const navigate = useNavigate();
  // sample data from VNeID
  const received = {
    fullname: 'Nguyễn Văn A',
    id: '012345678901',
    dob: '01/01/2000',
    gender: 'Nam',
    level: '2',
    address: 'Hà Nội',
    email: 'nvA@example.com',
    phone: '0987654321'
  };

  const [shareAddress, setShareAddress] = useState(false);
  const [shareEmail, setShareEmail] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [sharePortrait, setSharePortrait] = useState(false);
  const [role, setRole] = useState('farmer');
  const [agree, setAgree] = useState(false);

  const handleCreate = async () => {
    if (!agree) return alert('Bạn phải đồng ý điều khoản');
    // send to backend to create account; fallback navigate to KYC
    try {
      // await axios.post('/auth/create-from-vneid', { received, share: { shareAddress, shareEmail, sharePhone, sharePortrait }, role });
      navigate('/kyc-cccd');
    } catch (e) {
      console.error(e);
      navigate('/kyc-cccd');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Chia sẻ dữ liệu VNeID</h1>
      <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
        <div>✓ Xác thực thành công</div>
        <div style={{ marginTop: 8 }}>
          <div><b>Họ tên:</b> {received.fullname}</div>
          <div><b>Mã định danh:</b> {received.id}</div>
          <div><b>Ngày sinh:</b> {received.dob}</div>
          <div><b>Trạng thái VNeID:</b> Mức độ {received.level}</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Dữ liệu bắt buộc</h3>
        <div>
          <label><input type="checkbox" checked readOnly /> Họ và tên</label>
        </div>
        <div>
          <label><input type="checkbox" checked readOnly /> Mã định danh</label>
        </div>
        <div>
          <label><input type="checkbox" checked readOnly /> Ngày sinh</label>
        </div>
        <div>
          <label><input type="checkbox" checked readOnly /> Trạng thái VNeID</label>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Dữ liệu tùy chọn</h3>
        <div><label><input type="checkbox" checked={shareAddress} onChange={(e) => setShareAddress(e.target.checked)} /> Địa chỉ ({received.address})</label></div>
        <div><label><input type="checkbox" checked={shareEmail} onChange={(e) => setShareEmail(e.target.checked)} /> Email ({received.email})</label></div>
        <div><label><input type="checkbox" checked={sharePhone} onChange={(e) => setSharePhone(e.target.checked)} /> Số điện thoại ({received.phone})</label></div>
        <div><label><input type="checkbox" checked={sharePortrait} onChange={(e) => setSharePortrait(e.target.checked)} /> Ảnh chân dung</label></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Chọn vai trò tài khoản</h3>
        <label><input type="radio" name="role" checked={role==='farmer'} onChange={() => setRole('farmer')} /> Farmer</label>
        <label style={{ marginLeft: 8 }}><input type="radio" name="role" checked={role==='trader'} onChange={() => setRole('trader')} /> Trader</label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Tôi đồng ý cho phép hệ thống sử dụng dữ liệu VNeID để xác thực danh tính và tạo tài khoản.</label>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={handleCreate} className="btn">Tạo tài khoản</button>
        <button onClick={() => navigate('/login')}>Hủy</button>
      </div>
    </div>
  );
}
