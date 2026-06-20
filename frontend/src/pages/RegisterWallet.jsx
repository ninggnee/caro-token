import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import "../styles/kyc.css";

export default function RegisterWallet() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { account, connect, disconnect } = useWallet();
  const [loading, setLoading] = useState(false);

  // Clear any existing wallet connection on mount for registration flow
  useEffect(() => {
    disconnect();
  }, []);

  const role = auth.user?.role || "farmer";

  // Redirect target based on role
  const getHomeRedirect = () => {
    if (role === "trader") return "/trader";
    return "/farmer";
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      await connect();
    } catch (err) {
      console.error(err);
      alert("Kết nối ví thất bại. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    navigate(getHomeRedirect());
  };

  const handleSkip = () => {
    navigate(getHomeRedirect());
  };

  return (
    <div className="kyc-page">
      {/* LEFT PANEL */}
      <div className="kyc-left">
        <div className="hero-badge">
          Real World Asset • Coffee Tokenization
        </div>

        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h1>CaRo Exchange</h1>
        </Link>

        <p style={{ marginTop: 8 }}>
          Kết nối ví điện tử để tham gia giao dịch token cà phê trực tiếp trên blockchain.
        </p>

        <div className="kyc-features">
          <div>
            🔑 Quản lý tài sản an toàn qua ví Web3 (MetaMask)
          </div>
          <div>
            ⚡ Thực hiện giao dịch nạp/rút token nhanh chóng
          </div>
          <div>
            🛡️ Bảo mật tuyệt đối, phi tập trung hóa quyền sở hữu
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="kyc-right">
        <div className="kyc-card" style={{ maxWidth: 480 }}>
          {/* STEPPER */}
          <div className="stepper">
            <div className="step-item">
              <div className="step">1</div>
              <span>Tài khoản</span>
            </div>

            <div className="line"></div>

            <div className="step-item">
              <div className="step">2</div>
              <span>KYC</span>
            </div>

            <div className="line"></div>

            <div className="step-item">
              <div className="step active">3</div>
              <span>Kết nối ví</span>
            </div>
          </div>

          <h2>Kết nối ví điện tử</h2>
          <div className="kyc-subtitle" style={{ marginBottom: 30 }}>
            Bước cuối cùng để hoàn tất đăng ký tài khoản của bạn.
          </div>

          {account ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 50, marginBottom: 16 }}>🎉</div>
              <h3 style={{ color: "#2f5f5d", marginBottom: 8, fontSize: 18 }}>Kết nối thành công!</h3>
              <p style={{ color: "#666", fontSize: 14, marginBottom: 20 }}>
                Địa chỉ ví đã được liên kết với tài khoản của bạn.
              </p>
              
              <div style={{
                background: "rgba(72, 117, 115, 0.08)",
                border: "1.5px solid #d8e0e0",
                borderRadius: 12,
                padding: "16px",
                fontFamily: "monospace",
                fontSize: 14,
                color: "#243b3a",
                wordBreak: "break-all",
                marginBottom: 30
              }}>
                {account}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button className="primary-btn" onClick={handleFinish} style={{ width: "100%", padding: 15 }}>
                  Hoàn tất đăng ký & Vào trang chủ
                </button>
                <button className="secondary-btn" onClick={disconnect} style={{ width: "100%", padding: 15 }}>
                  Hủy kết nối ví
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                background: "#fafcfc",
                border: "1.5px dashed #cfd8d8",
                borderRadius: 16,
                padding: "32px 24px",
                textAlign: "center",
                marginBottom: 30
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🦊</div>
                <h4 style={{ color: "#487573", marginBottom: 8, fontWeight: 700 }}>MetaMask Wallet</h4>
                <p style={{ color: "#888", fontSize: 13, lineHeight: 1.5 }}>
                  Liên kết ví Web3 của bạn để bắt đầu giao dịch, ký hợp đồng và sở hữu token cà phê.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  className="primary-btn"
                  onClick={handleConnect}
                  disabled={loading}
                  style={{ width: "100%", padding: 15, position: "relative" }}
                >
                  {loading ? "Đang kết nối..." : "Kết nối ví ngay"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={handleSkip}
                  style={{ width: "100%", padding: 15 }}
                >
                  Thiết lập sau (Bỏ qua)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
