import { useState } from "react";
import axios from "../utils/axiosClient";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email) return "Email không được để trống";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email không hợp lệ";
    if (!password) return "Mật khẩu không được để trống";
    return null;
  };

  const handleLogin = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);

    try {
      const res = await axios.post(`/auth/login`, { email, password });
      const data = res.data;
      if (data && data.success) {
        auth.login(data);
        const userRole = data.user?.role || 'farmer';
        if (userRole === 'admin')  return navigate('/admin');
        if (userRole === 'trader') return navigate('/trader');
        return navigate('/farmer');
      }
      setError("Đăng nhập không thành công. Vui lòng thử lại.");
    } catch (e) {
      const msg = e?.response?.data?.message || "Email hoặc mật khẩu không đúng.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
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
          Giao dịch cà phê<br />
          <span>trên Blockchain</span>
        </h1>

        <p>
          Nền tảng token hóa cà phê Robusta Việt Nam — minh bạch, bảo mật,
          và kết nối trực tiếp từ nông trường đến sàn giao dịch.
        </p>

        <div className="auth-features">
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🪪</div>
            <div className="auth-feature-title">Định danh số</div>
            <div className="auth-feature-desc">
              Xác thực bằng CCCD, VNeID và KYC điện tử an toàn.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">🫘</div>
            <div className="auth-feature-title">Token hóa cà phê</div>
            <div className="auth-feature-desc">
              Chuyển Robusta thành tài sản số trên blockchain.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">📈</div>
            <div className="auth-feature-title">Giao dịch minh bạch</div>
            <div className="auth-feature-desc">
              Theo dõi lịch sử và quyền sở hữu theo thời gian thực.
            </div>
          </div>
          <div className="auth-feature-card">
            <div className="auth-feature-icon">📦</div>
            <div className="auth-feature-title">Quy đổi thực tế</div>
            <div className="auth-feature-desc">
              Đổi token lấy lô hàng cà phê vật lý đã chứng thực.
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth-right">
        <div className="auth-card">
          <h2>Đăng nhập</h2>
          <p className="auth-card-subtitle">
            Chào mừng trở lại — vui lòng nhập thông tin tài khoản
          </p>

          {error && (
            <div className="auth-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="farmer@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label">Mật khẩu</label>
            <div className="auth-input-row">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "🙈 Ẩn" : "👁 Hiện"}
              </button>
            </div>
          </div>

          {/* Remember & Forgot */}
          <div className="auth-remember-row">
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Ghi nhớ đăng nhập
            </label>
            <button
              type="button"
              className="auth-forgot-link"
              onClick={() => alert("Quy trình khôi phục mật khẩu (placeholder)")}
            >
              Quên mật khẩu?
            </button>
          </div>

          {/* Login button */}
          <button
            className="auth-btn-primary"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "⏳ Đang xử lý..." : "🚀 Đăng nhập"}
          </button>

          <div className="auth-divider">hoặc</div>

          {/* VNeID login */}
          <Link to="/vneid-login" style={{ textDecoration: "none" }}>
            <button className="auth-btn-secondary" type="button">
              🪪 Đăng nhập bằng VNeID
            </button>
          </Link>

          {/* Register link */}
          <div className="auth-footer-text">
            Chưa có tài khoản?
            <Link to="/register" className="auth-footer-link">
              Đăng ký ngay →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}