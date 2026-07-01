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
    try {
      navigate('/kyc-cccd');
    } catch (e) {
      console.error(e);
      navigate('/kyc-cccd');
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "radial-gradient(circle at top left,#408A71 0%,transparent 35%), radial-gradient(circle at bottom right,#18332d 0%,transparent 40%), linear-gradient(135deg,#285A48,#091413)",
        color: "#f8fafc",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        className="caro-card"
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#122622",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="hero-badge" style={{ margin: "0 auto 12px" }}>
            VNeID Authorization
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#B0E4CC" }}>
            Chia sẻ dữ liệu VNeID
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 6 }}>
            ✓ Xác thực VNeID thành công. Vui lòng cấp quyền chia sẻ thông tin để khởi tạo tài khoản.
          </p>
        </div>

        {/* User Info Preview */}
        <div
          style={{
            background: "rgba(176, 228, 204, 0.05)",
            border: "1px solid rgba(176, 228, 204, 0.15)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
            <div>
              <span style={{ color: "#94a3b8" }}>Họ tên:</span>{" "}
              <strong>{received.fullname}</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Mã định danh:</span>{" "}
              <strong>{received.id}</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Ngày sinh:</span>{" "}
              <strong>{received.dob}</strong>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Trạng thái VNeID:</span>{" "}
              <strong style={{ color: "#B0E4CC" }}>Mức độ {received.level}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Mandatory Data */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#B0E4CC", marginBottom: 12 }}>
              Dữ liệu bắt buộc
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                <input type="checkbox" checked readOnly style={{ accentColor: "#408A71" }} /> Họ và tên
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                <input type="checkbox" checked readOnly style={{ accentColor: "#408A71" }} /> Mã định danh
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                <input type="checkbox" checked readOnly style={{ accentColor: "#408A71" }} /> Ngày sinh
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1" }}>
                <input type="checkbox" checked readOnly style={{ accentColor: "#408A71" }} /> Trạng thái VNeID
              </label>
            </div>
          </div>

          {/* Optional Data */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#B0E4CC", marginBottom: 12 }}>
              Dữ liệu tùy chọn
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={shareAddress}
                  onChange={(e) => setShareAddress(e.target.checked)}
                  style={{ accentColor: "#B0E4CC" }}
                />{" "}
                Địa chỉ ({received.address})
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={shareEmail}
                  onChange={(e) => setShareEmail(e.target.checked)}
                  style={{ accentColor: "#B0E4CC" }}
                />{" "}
                Email ({received.email})
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={sharePhone}
                  onChange={(e) => setSharePhone(e.target.checked)}
                  style={{ accentColor: "#B0E4CC" }}
                />{" "}
                Số điện thoại ({received.phone})
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={sharePortrait}
                  onChange={(e) => setSharePortrait(e.target.checked)}
                  style={{ accentColor: "#B0E4CC" }}
                />{" "}
                Ảnh chân dung
              </label>
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#B0E4CC", marginBottom: 12 }}>
            Chọn vai trò tài khoản
          </h3>
          <div style={{ display: "flex", gap: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#cbd5e1", fontSize: 14 }}>
              <input
                type="radio"
                name="role"
                checked={role === 'farmer'}
                onChange={() => setRole('farmer')}
                style={{ accentColor: "#B0E4CC" }}
              />{" "}
              Farmer (Nông dân / HTX)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#cbd5e1", fontSize: 14 }}>
              <input
                type="radio"
                name="role"
                checked={role === 'trader'}
                onChange={() => setRole('trader')}
                style={{ accentColor: "#B0E4CC" }}
              />{" "}
              Trader (Nhà kinh doanh / Giao dịch)
            </label>
          </div>
        </div>

        {/* Terms Consent */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              style={{ accentColor: "#B0E4CC", marginTop: 2 }}
            />
            <span>
              Tôi đồng ý cho phép hệ thống sử dụng dữ liệu VNeID đã chọn để xác thực danh tính và tạo tài khoản trên CaRo Exchange.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button
            onClick={handleCreate}
            className="caro-btn caro-btn-primary"
            style={{ flex: 1, padding: 14, borderRadius: 10 }}
          >
            Tạo tài khoản
          </button>
          <button
            onClick={() => navigate('/login')}
            className="caro-btn caro-btn-ghost"
            style={{
              padding: "14px 28px",
              borderRadius: 10,
              color: "#B0E4CC",
              borderColor: "rgba(176, 228, 204, 0.25)",
              background: "transparent",
            }}
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
}
