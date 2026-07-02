import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../utils/axiosClient";
import { useAuth } from "../context/AuthContext";
import { useRegisterForm } from "../context/RegisterFormContext";
import "../styles/login.css";

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { formData, updateFormData, clearFormData } = useRegisterForm();

  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!formData.fullName.trim())                                    return "Họ tên không được để trống";
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return "Email không hợp lệ";
    if (!formData.phone || !/^0[0-9]{8,9}$/.test(formData.phone))             return "Số điện thoại không hợp lệ (VD: 0901234567)";
    if (!formData.password || formData.password.length < 6)                    return "Mật khẩu tối thiểu 6 ký tự";
    if (formData.password !== formData.confirm)                                return "Mật khẩu xác nhận không khớp";
    if (!formData.agree)                                              return "Bạn phải đồng ý với Điều khoản sử dụng";
    return null;
  };

  const handleRegister = async () => {
    setError("");
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const res = await axios.post("/auth/register", {
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      });

      if (res.data?.success && res.data?.token) {
        auth.login({ token: res.data.token, user: res.data.user });
        clearFormData();
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
              value={formData.fullName}
              onChange={(e) => updateFormData({ fullName: e.target.value })}
            />
          </div>

          {/* Email */}
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              placeholder="example@email.com"
              value={formData.email}
              onChange={(e) => updateFormData({ email: e.target.value })}
            />
          </div>

          {/* Phone */}
          <div className="auth-field">
            <label className="auth-label">Số điện thoại</label>
            <input
              className="auth-input"
              type="tel"
              placeholder="0901234567"
              value={formData.phone}
              onChange={(e) => updateFormData({ phone: e.target.value })}
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label className="auth-label">Mật khẩu</label>
            <div className="auth-input-row">
              <input
                className="auth-input"
                type={showPass ? "text" : "password"}
                placeholder="Tối thiểu 6 ký tự"
                value={formData.password}
                onChange={(e) => updateFormData({ password: e.target.value })}
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
              value={formData.confirm}
              onChange={(e) => updateFormData({ confirm: e.target.value })}
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
                    checked={formData.role === r}
                    onChange={() => updateFormData({ role: r })}
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
              checked={formData.agree}
              onChange={(e) => updateFormData({ agree: e.target.checked })}
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
