import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../utils/axiosClient";
import { useAuth } from "../context/AuthContext";
import "../styles/register.css";

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [fullName, setFullName] = useState(() => sessionStorage.getItem("reg_fullName") || "");
  const [email, setEmail]       = useState(() => sessionStorage.getItem("reg_email") || "");
  const [phone, setPhone]       = useState(() => sessionStorage.getItem("reg_phone") || "");
  const [password, setPassword] = useState(() => sessionStorage.getItem("reg_password") || "");
  const [confirm, setConfirm]   = useState(() => sessionStorage.getItem("reg_confirm") || "");
  const [role, setRole]         = useState(() => sessionStorage.getItem("reg_role") || "farmer");
  const [agree, setAgree]       = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    sessionStorage.setItem("reg_fullName", fullName);
  }, [fullName]);

  useEffect(() => {
    sessionStorage.setItem("reg_email", email);
  }, [email]);

  useEffect(() => {
    sessionStorage.setItem("reg_phone", phone);
  }, [phone]);

  useEffect(() => {
    sessionStorage.setItem("reg_password", password);
  }, [password]);

  useEffect(() => {
    sessionStorage.setItem("reg_confirm", confirm);
  }, [confirm]);

  useEffect(() => {
    sessionStorage.setItem("reg_role", role);
  }, [role]);

  const validate = () => {
    if (!fullName.trim())                                    return "Họ tên không được để trống";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email không hợp lệ";
    if (!phone || !/^0[0-9]{8,9}$/.test(phone))             return "Số điện thoại không hợp lệ (VD: 0901234567)";
    if (!password || password.length < 8)                    return "Mật khẩu tối thiểu 8 ký tự";
    if (password !== confirm)                                return "Mật khẩu xác nhận không khớp";
    if (!agree)                                              return "Bạn phải đồng ý với Điều khoản sử dụng";
    return null;
  };

  const handleRegister = async () => {
    setError("");
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const res = await axios.post("/auth/register", {
        full_name: fullName,
        email,
        phone,
        password,
        role,
      });

      if (res.data?.success && res.data?.token) {
        auth.login({ token: res.data.token, user: res.data.user });

        // Clear forms data on success
        sessionStorage.removeItem("reg_fullName");
        sessionStorage.removeItem("reg_email");
        sessionStorage.removeItem("reg_phone");
        sessionStorage.removeItem("reg_password");
        sessionStorage.removeItem("reg_confirm");
        sessionStorage.removeItem("reg_role");

        navigate("/kyc-cccd");
      } else {
        setError(res.data?.message || "Đăng ký thất bại");
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e.message || "Lỗi khi đăng ký");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      {/* LEFT SIDE */}
      <div className="register-left">
        <div className="hero-badge">
          Real World Asset • Coffee Tokenization
        </div>

        <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
          <h1>CaRo Exchange</h1>
        </Link>

        <p style={{ marginTop: 8 }}>
          Nền tảng giao dịch tài sản số hóa từ cà phê Robusta Việt Nam
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🪪</div>
            <div className="feature-title">Định danh số</div>
            <div className="feature-desc">Xác thực bằng CCCD, VNeID và KYC điện tử.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">☕</div>
            <div className="feature-title">Token hóa cà phê</div>
            <div className="feature-desc">Chuyển cà phê Robusta thành tài sản số trên blockchain.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <div className="feature-title">Giao dịch minh bạch</div>
            <div className="feature-desc">Theo dõi lịch sử và quyền sở hữu theo thời gian thực.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <div className="feature-title">Quy đổi tài sản thực</div>
            <div className="feature-desc">Đổi token lấy lô hàng cà phê vật lý đã chứng thực.</div>
          </div>
        </div>
      </div>

      {/* Right panel - 50% Full white */}
      <div className="register-right">
        <div className="register-card">
          <h2>Tạo tài khoản</h2>

          {error && (
            <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: 14, marginBottom: 8 }}>
              {error}
            </div>
          )}

          <label>Họ và tên</label>
          <input
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label>Số điện thoại</label>
          <input
            type="tel"
            placeholder="0901234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <label>Mật khẩu</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showPass ? "text" : "password"}
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{ minWidth: 80 }}
            >
              {showPass ? "Ẩn" : "Hiện"}
            </button>
          </div>

          <label>Xác nhận mật khẩu</label>
          <input
            type={showPass ? "text" : "password"}
            placeholder="Nhập lại mật khẩu"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          <label>Vai trò</label>
          <div style={{ display: "flex", gap: 16 }}>
            {["farmer", "trader"].map((r) => (
              <label
                key={r}
                style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  padding: "10px 20px", borderRadius: 10, border: "1.5px solid",
                  borderColor: role === r ? "#487573" : "#d8e0e0",
                  background: role === r ? "rgba(72,117,115,0.08)" : "#fafcfc",
                  color: "#243b3a", fontWeight: 600, fontSize: 15, transition: ".2s",
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRole(r)}
                  style={{ accentColor: "#487573" }}
                />
                {r === "farmer" ? "🌱 Farmer" : "📊 Trader"}
              </label>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 500, fontSize: 14, color: "#365f5d", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#487573" }}
            />
            Tôi đồng ý với{" "}
            <span style={{ color: "#487573", fontWeight: 700 }}>Điều khoản sử dụng</span>{" "}
            và{" "}
            <span style={{ color: "#487573", fontWeight: 700 }}>Chính sách bảo mật</span>
          </label>

          <button
            onClick={handleRegister}
            className="btn"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Đang xử lý..." : "Đăng ký"}
          </button>

          <button
            type="button"
            onClick={() => navigate("/vneid-login")}
            className="vneid-btn"
            style={{ background: "transparent", border: "1.5px solid #487573", color: "#487573" }}
          >
            Đăng ký bằng VNeID
          </button>

          <div className="register-text">
            Đã có tài khoản?{" "}
            <Link to="/login" className="register-link">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
