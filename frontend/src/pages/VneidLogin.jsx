import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";

export default function VneidLogin() {
  const [status, setStatus] = useState("waiting");
  const navigate = useNavigate();

  const statusConfig = {
    waiting: {
      color: "#f59e0b",
      text: "Đang chờ xác thực",
      icon: "⏳",
    },
    success: {
      color: "#10b981",
      text: "Xác thực thành công",
      icon: "✅",
    },
    failed: {
      color: "#ef4444",
      text: "Xác thực thất bại",
      icon: "❌",
    },
  };

  return (
    <div className="auth-page">
      {/* Left */}
      <div className="auth-left">
        <Link to="/" className="auth-brand" style={{ textDecoration: "none" }}>
          <div className="auth-brand-icon">🫘</div>
          <div>
            <div className="auth-brand-name">CaRo Exchange</div>
            <div className="auth-brand-sub">Coffee RWA Platform</div>
          </div>
        </Link>

        <div className="auth-badge">
          🪪 National Digital Identity · VNeID
        </div>

        <h1>
          Xác thực định danh<br />
          <span>qua VNeID</span>
        </h1>

        <p>
          Giải pháp liên kết tài khoản định danh điện tử quốc gia (VNeID) giúp xác thực người dùng, bảo mật thông tin và tuân thủ các quy định KYC trên CaRo Exchange.
        </p>

        <div className="auth-features">
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🪪</div>
            <div className="auth-feature-title">Định danh số</div>
            <div className="auth-feature-desc">
              Xác thực danh tính công dân mức độ 2.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🔒</div>
            <div className="auth-feature-title">Bảo mật tối đa</div>
            <div className="auth-feature-desc">
              Dữ liệu mã hóa và bảo vệ an toàn tuyệt đối.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">⚡</div>
            <div className="auth-feature-title">Xác thực nhanh</div>
            <div className="auth-feature-desc">
              Quét mã QR và đăng nhập chỉ trong vài giây.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🏛️</div>
            <div className="auth-feature-title">Chuẩn KYC</div>
            <div className="auth-feature-desc">
              Đáp ứng các yêu cầu pháp lý về KYC giao dịch.
            </div>
          </div>
        </div>
      </div>

      {/* Right */}
      <div
        style={{
          width: 520,
          background: "#122622",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          padding: 50,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        }}
      >
        <h2
          style={{
            color: "#B0E4CC",
            fontSize: 32,
            marginBottom: 12,
          }}
        >
          Quét mã QR
        </h2>

        <p
          style={{
            color: "#94a3b8",
            marginBottom: 30,
            lineHeight: 1.6,
          }}
        >
          Mở ứng dụng VNeID trên điện thoại và quét mã QR bên dưới để xác thực.
        </p>

        <div
          style={{
            width: 280,
            height: 280,
            margin: "0 auto",
            borderRadius: 20,
            background: "#fff",
            padding: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,.3)"
          }}
        >
          <img
            src="/images/vneid-qr.png"
            alt="VNeID QR"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain"
            }}
          />
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 12,
            background: "rgba(176, 228, 204, 0.05)",
            border: "1px solid rgba(176, 228, 204, 0.15)",
            textAlign: "center",
            lineHeight: 1.7
          }}
        >
          <div style={{ fontWeight: 700, color: "#B0E4CC" }}>
            Chờ xác thực từ ứng dụng VNeID
          </div>

          <div
            style={{
              marginTop: 8,
              color: "#94a3b8",
              fontSize: 14
            }}
          >
            Sau khi người dùng hoàn thành xác thực trên ứng dụng
            VNeID, hệ thống sẽ tiếp tục sang bước chia sẻ dữ liệu
            định danh điện tử.
          </div>
        </div>

        <button
          onClick={() => navigate("/vneid-share")}
          className="caro-btn caro-btn-primary caro-btn-full"
          style={{
            marginTop: 24,
            padding: 14,
            borderRadius: 10,
          }}
        >
          Tôi đã xác thực trên VNeID
        </button>

        <button
          onClick={() => navigate("/login")}
          className="caro-btn caro-btn-ghost caro-btn-full"
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 10,
            color: "#B0E4CC",
            borderColor: "rgba(176, 228, 204, 0.25)",
            background: "transparent",
          }}
        >
          Quay lại đăng nhập
        </button>
      </div>
    </div>
  );
}