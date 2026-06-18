import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background:
          "radial-gradient(circle at top left,#6fa9a6 0%,transparent 35%), radial-gradient(circle at bottom right,#2d4d4b 0%,transparent 40%), linear-gradient(135deg,#3f6664,#203433)",
      }}
    >
      {/* Left */}
      <div
        style={{
          flex: 1,
          color: "#fff",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div className="hero-badge">
        National Digital Identity • VNeID
        </div>

        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            marginBottom: 20,
          }}
        >
          Đăng nhập bằng VNeID
        </h1>

        <p
          style={{
            fontSize: 20,
            lineHeight: 1.7,
            maxWidth: 600,
            color: "rgba(255,255,255,.9)",
          }}
        >
          Xác thực danh tính điện tử thông qua ứng dụng VNeID để truy cập hệ
          sinh thái giao dịch tài sản số hóa cà phê Robusta Việt Nam.
        </p>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 16,
            maxWidth: 650,
          }}
        >
          {[
            {
              icon: "🪪",
              title: "Định danh điện tử",
              desc: "Xác thực danh tính người dùng.",
            },
            {
              icon: "🔒",
              title: "Bảo mật cao",
              desc: "Liên kết với tài khoản VNeID.",
            },
            {
              icon: "⚡",
              title: "Đăng nhập nhanh",
              desc: "Không cần ghi nhớ mật khẩu.",
            },
            {
              icon: "🏛️",
              title: "Tuân thủ pháp lý",
              desc: "Đáp ứng yêu cầu KYC điện tử.",
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(255,255,255,.08)",
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 16,
                padding: 18,
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ fontSize: 24 }}>{item.icon}</div>
              <div
                style={{
                  marginTop: 10,
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "rgba(255,255,255,.8)",
                }}
              >
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div
        style={{
          width: 520,
          background: "#fff",
          padding: 50,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,.15)",
        }}
      >
        <h2
          style={{
            color: "#2f5f5d",
            fontSize: 32,
            marginBottom: 12,
          }}
        >
          Quét mã QR
        </h2>

        <p
          style={{
            color: "#64748b",
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
            boxShadow: "0 8px 30px rgba(0,0,0,.08)"
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
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            textAlign: "center",
            lineHeight: 1.7
        }}
        >
        <div style={{ fontWeight: 700, color: "#487573" }}>
            Chờ xác thực từ ứng dụng VNeID
        </div>

        <div
            style={{
            marginTop: 8,
            color: "#64748b",
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
        style={{
            marginTop: 24,
            width: "100%",
            padding: 14,
            border: "none",
            borderRadius: 10,
            background: "#487573",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer"
        }}
        >
        Tôi đã xác thực trên VNeID
        </button>

        <button
          onClick={() => navigate("/login")}
          style={{
            marginTop: 10,
            padding: 14,
            borderRadius: 10,
            border: "1px solid #dbe4e4",
            background: "#fff",
            color: "#487573",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Quay lại đăng nhập
        </button>
      </div>
    </div>
  );
}