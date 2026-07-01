import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../utils/axiosClient";
import { useAuth } from "../context/AuthContext";
import "../styles/login.css";

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

  useEffect(() => { sessionStorage.setItem("reg_fullName", fullName); }, [fullName]);
  useEffect(() => { sessionStorage.setItem("reg_email", email); }, [email]);
  useEffect(() => { sessionStorage.setItem("reg_phone", phone); }, [phone]);
  useEffect(() => { sessionStorage.setItem("reg_password", password); }, [password]);
  useEffect(() => { sessionStorage.setItem("reg_confirm", confirm); }, [confirm]);
  useEffect(() => { sessionStorage.setItem("reg_role", role); }, [role]);

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
    <div className="auth-page">

      {/* ── LEFT PANEL ── */}
      <div className="auth-left">
        <Link to="/" className="auth-brand" style={{ textDecoration: "none" }}>
          <div className="auth-brand-icon">🫘</div>
          <div>
            <div className="auth-brand-name">CaRo Exchange</div>
            <div className="auth-brand-sub">Coffee RWA Platform</div>
          </div>
        </Link>

        <div className="auth-badge">
          ⛓️ Real World Asset · Coffee Tokenization
        </div>

        <h1>
          Tham gia <span>CaRo</span><br />
          ngay hôm nay
        </h1>

        <p>
          Tạo tài khoản và bắt đầu hành trình token hóa cà phê Robusta
          Việt Nam trên nền tảng blockchain minh bạch nhất.
        </p>

        <div className="auth-features">
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🌱</div>
            <div className="auth-feature-title">Farmer</div>
            <div className="auth-feature-desc">
              Gửi lô hàng, đúc token CR và nhận thanh toán trực tiếp.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">💼</div>
            <div className="auth-feature-title">Trader</div>
            <div className="auth-feature-desc">
              Mua bán token cà phê, tài trợ nông dân và đổi hàng vật lý.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🔐</div>
            <div className="auth-feature-title">Bảo mật cao</div>
            <div className="auth-feature-desc">
              KYC bằng CCCD, xác thực 2 lớp, ví MetaMask cá nhân.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">⛓️</div>
            <div className="auth-feature-title">On-chain minh bạch</div>
            <div className="auth-feature-desc">
              Mọi giao dịch đều có thể kiểm tra trên Ethereum.
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-card">
          <h2>Tạo tài khoản</h2>
          <p className="auth-card-subtitle">
            Điền thông tin bên dưới để bắt đầu
          </p>

          {error && (
            <div className="auth-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="auth-field">
            <label className="auth-label">Họ và tên</label>
            <input
              className="auth-input"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="auth-field">
            <label className="auth-label">Số điện thoại</label>
            <input
              className="auth-input"
              type="tel"
              placeholder="0901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label">Mật khẩu</label>
            <div className="auth-input-row">
              <input
                className="auth-input"
                type={showPass ? "text" : "password"}
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-toggle-btn"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? "🙈 Ẩn" : "👁 Hiện"}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="auth-field">
            <label className="auth-label">Xác nhận mật khẩu</label>
            <input
              className="auth-input"
              type={showPass ? "text" : "password"}
              placeholder="Nhập lại mật khẩu"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {/* Role selector */}
          <div className="auth-field">
            <label className="auth-label">Vai trò</label>
            <div className="auth-role-grid">
              {["farmer", "trader"].map((r) => (
                <div key={r} className="auth-role-option">
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    id={`role-${r}`}
                    checked={role === r}
                    onChange={() => setRole(r)}
                  />
                  <label htmlFor={`role-${r}`} className="auth-role-label">
                    {r === "farmer" ? "🌱 Farmer" : "📊 Trader"}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Terms */}
          <label className="auth-terms-label">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            <span>
              Tôi đồng ý với{" "}
              <span className="auth-terms-link">Điều khoản sử dụng</span>{" "}
              và{" "}
              <span className="auth-terms-link">Chính sách bảo mật</span>
            </span>
          </label>

          {/* Register button */}
          <button
            className="auth-btn-primary"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? "⏳ Đang xử lý..." : "🚀 Tạo tài khoản"}
          </button>

          <div className="auth-divider">hoặc</div>

          {/* VNeID */}
          <button
            type="button"
            className="auth-btn-secondary"
            onClick={() => navigate("/vneid-login")}
          >
            🪪 Đăng ký bằng VNeID
          </button>

          {/* Login link */}
          <div className="auth-footer-text">
            Đã có tài khoản?
            <Link to="/login" className="auth-footer-link">
              Đăng nhập →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
