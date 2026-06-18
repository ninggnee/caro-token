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

  const validate = () => {
    if (!email) return "Email không được để trống";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email không hợp lệ";
    if (!password) return "Mật khẩu không được để trống";
    return null;
  };

  const handleLogin = async () => {
    const err = validate();
    if (err) return alert(err);

    try {
      const res = await axios.post(`/auth/login`, { email, password });
      const data = res.data;
      if (data && data.success) {
        auth.login(data);
        const userRole = data.user?.role || 'farmer';
        if (userRole === 'admin') return navigate('/admin');
        if (userRole === 'trader') return navigate('/trader');
        return navigate('/farmer');
      }
    } catch (e) {
      // fallback: simple heuristic if backend unavailable
      console.error(e);
      if (email.includes('admin')) return navigate('/admin');
      if (email.includes('trader')) return navigate('/trader');
      return navigate('/farmer');
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="hero-badge">
        Real World Asset • Coffee Tokenization
        </div>
        
        <h1>CaRo Exchange</h1>

        <p>
          Nền tảng giao dịch tài sản số hóa từ cà phê Robusta Việt Nam
        </p>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🪪</div>
            <div className="feature-title">Định danh số</div>
            <div className="feature-desc">
              Xác thực người dùng bằng CCCD, VNeID và KYC điện tử.
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">☕</div>
            <div className="feature-title">Token hóa cà phê</div>
            <div className="feature-desc">
              Chuyển đổi cà phê Robusta thành tài sản số trên blockchain.
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <div className="feature-title">Giao dịch minh bạch</div>
            <div className="feature-desc">
              Theo dõi lịch sử giao dịch và quyền sở hữu theo thời gian thực.
            </div>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <div className="feature-title">Quy đổi tài sản thực</div>
            <div className="feature-desc">
              Đổi token lấy lô hàng cà phê vật lý đã được chứng thực.
            </div>
          </div>
        </div>
      </div>

      <div className="login-card">
        <h2>Đăng nhập</h2>

        <label style={{ display: 'block', marginBottom: 8 }}>Email</label>
        <input placeholder="farmer@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label style={{ display: 'block', marginTop: 12 }}>Mật khẩu</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type={showPassword ? 'text' : 'password'} placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => setShowPassword(!showPassword)} style={{ minWidth: 80 }}>{showPassword ? 'Ẩn' : 'Hiện'}</button>
        </div>

        <div className="remember-row">
          <label className="remember-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Ghi nhớ đăng nhập
          </label>

          <Link
            to="#"
            className="forgot-link"
            onClick={(e) => {
              e.preventDefault();
              alert("Quy trình khôi phục mật khẩu (placeholder)");
            }}
          >
            Quên mật khẩu?
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={handleLogin} className="btn">Đăng nhập</button>
          <Link to="/vneid-login"><button className="btn">Đăng nhập bằng VNeID</button></Link>
        </div>

        <div className="register-text">
          Chưa có tài khoản?
          <Link to="/register" className="register-link">
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </div>
  );
}