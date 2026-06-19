import { Link } from "react-router-dom";
import '../styles/landing.css';

function StatCard({ title, value }) {
  return (
    <div
      className="glass-card"
      style={{
        padding: 16,
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 12, color: '#9fcfc6' }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default function Landing() {
  return (
    <div
        style={{
            color: "#e8f6f4",
            minHeight: "100vh",
        }}
        >
        
      {/* Header area - simplified, Topbar exists globally but keep local quick links */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20, background: '#0f1a18' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ fontWeight: 800, color: '#7fe0c9' }}>🫘 CaRo Exchange</div>
          <nav style={{ display: 'flex', gap: 12 }}>
            <Link className="caro-link" to="/landing">Marketplace</Link>
            <a className="caro-link" href="#tokenization">Quy trình</a>
            <a className="caro-link" href="#assets">Tài sản</a>
            <a className="caro-link" href="#tech">Công nghệ</a>
          </nav>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link
            className="caro-link"
            to="/login"
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: '1px solid #16a085',
              color: '#7fe0c9',
              borderRadius: 8
            }}
          >
            Đăng nhập
          </Link>
          <Link
            className="caro-link"
            to="/register"
            style={{
              padding: '12px 18px',
              background: '#16a085',
              color: 'white',
              borderRadius: 8
            }}
          >
            Đăng ký ngay
          </Link>
        </div>
      </header>
    
      {/* Hero */}
      <section style={{ display: 'flex', gap: 24, padding: '40px 48px', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h1
            style={{
                fontSize: 54,
                lineHeight: 1.1,
                color: "#7fe0c9",
                fontWeight: 800,
            }}
            >Token hóa cà phê Robusta Việt Nam</h1>
          <p style={{ fontSize: 18, opacity: 0.9 }}>Biến nông sản thực thành tài sản số có thể giao dịch. Minh bạch nguồn gốc. Giao dịch tức thời. Quy đổi thành hàng hóa thực.</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Link to="/register" style={{ padding: '12px 20px', background: '#16a085', color: 'white', borderRadius: 8 }}>Bắt đầu giao dịch</Link>
            <a href="#tokenization" style={{ padding: '12px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>Tìm hiểu thêm</a>
          </div>
        </div>

        <div
        className="glass-card"
        style={{
            width: 420,
            padding: 20,
        }}
        >
          <div style={{ fontSize: 14, color: '#9fcfc6', marginBottom: 8 }}>Card Dashboard Demo</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>CaRo1</div>
              <div style={{ fontWeight: 700 }}>100.000 VNĐ</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>CaRo2</div>
              <div style={{ fontWeight: 700 }}>85.000 VNĐ</div>
            </div>
            <div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>CaRo3</div>
              <div style={{ fontWeight: 700 }}>70.000 VNĐ</div>
            </div>
          </div>

          <div style={{ height: 80, background: 'linear-gradient(90deg, rgba(127,224,201,0.08), rgba(11,21,18,0.02))', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#7fe0c9' }}>Mini chart (placeholder)</div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <div>Khối lượng giao dịch: <b>12.450.000 kg</b></div>
            <div style={{ color: '#7be27b' }}>Tăng trưởng: +14%</div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section style={{ padding: '8px 48px', display: 'flex', gap: 12 }}>
        <StatCard title="Tổng tài sản RWA" value="52.000.000 kg" />
        <StatCard title="Farmer tham gia" value="1.250" />
        <StatCard title="Trader tham gia" value="3.560" />
        <StatCard title="Khối lượng giao dịch" value="125 tỷ VNĐ" />
        <StatCard title="Token lưu hành" value="45.000.000 CaRo" />
      </section>

      {/* Tokenization timeline */}
      <section id="tokenization" style={{ padding: '40px 48px' }}>
        <h2 className="section-title">Quy trình Token hóa cà phê</h2>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          {[
            { s: 'Farmer đăng ký và xác thực danh tính', i: 'VNeID / CCCD' },
            { s: 'Khai báo lô hàng cà phê', i: 'Warehouse' },
            { s: 'Admin kiểm định và phân loại', i: 'Inspection' },
            { s: 'Đúc Token RWA', i: 'Blockchain' },
            { s: 'Giao dịch hoặc đổi lấy cà phê thực', i: 'Marketplace' },
          ].map((step, idx) => (
            <div key={idx} style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#9fcfc6' }}>{step.i}</div>
              <div style={{ fontWeight: 700 }}>{step.s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Assets list */}
      <section id="assets" style={{ padding: '20px 48px' }}>
        <h2 className="section-title">Danh sách tài sản RWA</h2>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          {[
            { code: 'CaRo1', name: 'Robusta Grade 1', price: '100.000 VNĐ', vol: '245.000 kg', change: '+2.1%' },
            { code: 'CaRo2', name: 'Robusta Grade 2', price: '85.000 VNĐ', vol: '150.000 kg', change: '-0.8%' },
            { code: 'CaRo3', name: 'Robusta Grade 3', price: '70.000 VNĐ', vol: '95.000 kg', change: '+1.0%' },
          ].map((t) => (
            <div key={t.code} className="asset-card" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{t.code}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{t.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{t.price}</div>
                  <div style={{ fontSize: 12, color: t.change.startsWith('+') ? '#7be27b' : '#f28b82' }}>{t.change}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12 }}>Khối lượng giao dịch: {t.vol}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Market charts (placeholder) */}
      <section style={{ padding: '20px 48px' }}>
        <h2 className="section-title">Biểu đồ thị trường</h2>
        <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{ padding: '8px 12px' }}>CaRo1</button>
            <button style={{ padding: '8px 12px' }}>CaRo2</button>
            <button style={{ padding: '8px 12px' }}>CaRo3</button>
          </div>
          <div style={{ height: 220, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div>Chart placeholder (price / volume / high / low)</div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section style={{ padding: '60px 48px' }}>
        <h2 className="section-title" style={{ marginBottom: 16 }}>
          Tham gia hệ sinh thái CaRo Exchange
        </h2>

        <div className="role-grid">
          {/* Farmer */}
          <div className="role-card-v2 farmer">
            <div className="role-top">
              <div className="role-icon">👨‍🌾</div>
              <h3>Farmer</h3>
              <p>Chủ sở hữu và token hóa tài sản cà phê</p>
            </div>

            <div className="role-body">
              <div className="role-feature">
                ✓ Token hóa lô hàng cà phê Robusta
              </div>
              <div className="role-feature">
                ✓ Quản lý & theo dõi tài sản
              </div>
              <div className="role-feature">
                ✓ Nhận thanh toán từ giao dịch Token
              </div>
            </div>

            <button className="role-btn">
              Tham gia với Farmer
            </button>
          </div>

          {/* Trader */}
          <div className="role-card-v2 trader">
            <div className="role-top">
              <div className="role-icon">📈</div>
              <h3>Trader</h3>
              <p>Nhà đầu tư và giao dịch tài sản số</p>
            </div>

            <div className="role-body">
              <div className="role-feature">
                ✓ Mua bán Token cà phê
              </div>
              <div className="role-feature">
                ✓ Theo dõi biến động giá
              </div>
              <div className="role-feature">
                ✓ Quy đổi Token thành hàng hóa thực
              </div>
            </div>

            <button className="role-btn">
              Tham gia với Trader
            </button>
          </div>
        </div>
      </section>

      {/* Tech / partners */}
      <section id="tech" style={{ padding: '20px 48px' }}>
        <h2 className="section-title">Đối tác / Công nghệ</h2>
        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>VNeID</div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>DID</div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>Verifiable Credential</div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>Blockchain</div>
          <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>MetaMask</div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
            padding: 40,
            margin: "32px 48px",
            borderRadius: 20,
            background:
            "linear-gradient(90deg,#0f5c4f,#0b312c)",
            border:
            "1px solid rgba(127,224,201,0.12)",
        }}
        >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Sẵn sàng giao dịch tài sản cà phê số hóa?</h2>
            <div>Tham gia ngay để token hóa, giao dịch hoặc đổi trả hàng hóa thực.</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/login" style={{ padding: '12px 18px', background: 'transparent', border: '1px solid #16a085', color: '#7fe0c9', borderRadius: 8 }}>Đăng nhập</Link>
            <Link to="/register" style={{ padding: '12px 18px', background: '#16a085', color: 'white', borderRadius: 8 }}>Đăng ký ngay</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '20px 48px', marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800 }}>CaRo Exchange</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Nền tảng giao dịch tài sản thực RWA — Phiên bản 1.0</div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <a href="#">Điều khoản sử dụng</a>
            <a href="#">Chính sách bảo mật</a>
            <a href="#">Liên hệ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
