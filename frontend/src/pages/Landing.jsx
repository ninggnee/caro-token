import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";
import '../styles/landing.css';

// Mock Data for Charts
const MOCK_MARKET_DATA = [
  { time: "08:00", CR1: 100000, CR2: 85000, CR3: 70000, volume: 1200 },
  { time: "09:00", CR1: 102000, CR2: 86500, CR3: 71000, volume: 1500 },
  { time: "10:00", CR1: 101500, CR2: 86000, CR3: 70500, volume: 1400 },
  { time: "11:00", CR1: 104000, CR2: 88000, CR3: 72000, volume: 1800 },
  { time: "12:00", CR1: 103500, CR2: 87500, CR3: 71500, volume: 1600 },
  { time: "13:00", CR1: 105000, CR2: 89000, CR3: 73000, volume: 2100 },
  { time: "14:00", CR1: 107000, CR2: 90500, CR3: 74500, volume: 2400 },
  { time: "15:00", CR1: 106500, CR2: 90000, CR3: 74000, volume: 1900 },
  { time: "16:00", CR1: 108000, CR2: 91500, CR3: 75500, volume: 2200 },
];

function StatCard({ title, value, icon, change }) {
  return (
    <div className="caro-card caro-stat-card" style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,0.02)" }}>
      <div className="caro-stat-icon" style={{ background: "rgba(127,224,201,0.1)", color: "#B0E4CC" }}>{icon}</div>
      <div className="caro-stat-label">{title}</div>
      <div className="caro-stat-value">{value}</div>
      {change && (
        <div className="caro-stat-sub" style={{ color: change.startsWith('+') ? '#B0E4CC' : '#ef4444' }}>
          {change} so với tháng trước
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  const [activeTab, setActiveTab] = useState("CR1");

  return (
    <div className="landing-page">
      {/* ── Header ── */}
      <header className="landing-header">
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#408A71', letterSpacing: '-0.5px' }}>
            <span style={{ fontSize: 24 }}>🫘</span> CaRo
          </div>
          <nav className="landing-nav">
            <a href="#market">Thị trường</a>
            <a href="#tokenization">Quy trình RWA</a>
            <a href="#assets">Tài sản Số</a>
            <a href="#tech">Công nghệ</a>
          </nav>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" className="caro-btn caro-btn-ghost">
            Đăng nhập
          </Link>
          <Link to="/register" className="caro-btn caro-btn-primary">
            Tham gia ngay
          </Link>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">🚀 Nền tảng Coffee RWA đầu tiên tại Việt Nam</div>
          <h1 className="hero-title">
            Token hóa <span className="text-gradient">Cà phê Robusta</span>
          </h1>
          <p className="hero-subtitle">
            Biến nông sản thực thành tài sản số có thể giao dịch. Minh bạch nguồn gốc bằng Blockchain. Thanh khoản tức thời. Dễ dàng quy đổi thành hàng hóa thực (Redeem & Burn).
          </p>
          <div style={{ display: 'flex', gap: 16, marginTop: 32 }}>
            <Link to="/register" className="caro-btn caro-btn-primary caro-btn-lg">Bắt đầu giao dịch</Link>
            <a href="#market" className="caro-btn caro-btn-secondary caro-btn-lg">Khám phá thị trường</a>
          </div>
        </div>

        {/* Hero Dashboard Preview */}
        <div className="hero-dashboard-preview caro-glass">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Thị trường RWA Trực tiếp</div>
            <div className="pulse-indicator">
              <span className="dot"></span> Trực tiếp
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div className="mini-ticker">
              <div className="ticker-label">CaRo-CR1</div>
              <div className="ticker-price">108.000đ</div>
              <div className="ticker-change positive">+8.0%</div>
            </div>
            <div className="mini-ticker">
              <div className="ticker-label">CaRo-CR2</div>
              <div className="ticker-price">91.500đ</div>
              <div className="ticker-change positive">+7.6%</div>
            </div>
            <div className="mini-ticker">
              <div className="ticker-label">CaRo-CR3</div>
              <div className="ticker-price">75.500đ</div>
              <div className="ticker-change positive">+7.8%</div>
            </div>
          </div>

          <div style={{ height: 120, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_MARKET_DATA}>
                <defs>
                  <linearGradient id="colorCR1_mini" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#B0E4CC" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#B0E4CC" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="CR1" stroke="#B0E4CC" strokeWidth={2} fillOpacity={1} fill="url(#colorCR1_mini)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12 }}>
            <div style={{ color: "#94a3b8" }}>Khối lượng (24h): <strong style={{ color: "#f8fafc" }}>12.45M kg</strong></div>
            <div style={{ color: '#B0E4CC', fontWeight: 700 }}>TVL: $4.2M</div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="landing-section" style={{ paddingTop: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <StatCard title="Tổng tài sản RWA" value="52.4M kg" icon="📦" change="+12.5%" />
          <StatCard title="Tổng TVL" value="$14.2M" icon="💎" change="+8.2%" />
          <StatCard title="Farmer tham gia" value="1,254" icon="👨‍🌾" change="+4.1%" />
          <StatCard title="Khối lượng giao dịch" value="125 Tỷ VNĐ" icon="💹" change="+15.3%" />
        </div>
      </section>

      {/* ── Market Charts ── */}
      <section id="market" className="landing-section">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 className="section-title">Biểu đồ thị trường thời gian thực</h2>
          <p style={{ color: "#94a3b8", fontSize: 16, maxWidth: 600, margin: "0 auto" }}>
            Theo dõi diễn biến giá của các chứng chỉ cà phê số hóa. Mỗi token được bảo chứng 1:1 bởi cà phê vật lý tại kho lưu ký.
          </p>
        </div>
        
        <div className="caro-card" style={{ padding: "32px 40px" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: "center", marginBottom: 32 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {["CR1", "CR2", "CR3"].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`caro-btn ${activeTab === tab ? "caro-btn-primary" : "caro-btn-ghost"}`}
                  style={{ padding: "8px 24px", borderRadius: 30 }}
                >
                  {tab === "CR1" ? "Cao cấp (A)" : tab === "CR2" ? "Tiêu chuẩn (B)" : "Phổ thông (C)"}
                </button>
              ))}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: activeTab === "CR1" ? "#B0E4CC" : activeTab === "CR2" ? "#408A71" : "#f0b90b" }}>
                {MOCK_MARKET_DATA[MOCK_MARKET_DATA.length - 1][activeTab].toLocaleString()} VNĐ
              </div>
              <div style={{ color: "#B0E4CC", fontSize: 14, fontWeight: 700 }}>+8.0% (24h)</div>
            </div>
          </div>
          
          <div style={{ height: 350, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_MARKET_DATA} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeTab === "CR1" ? "#B0E4CC" : activeTab === "CR2" ? "#408A71" : "#f0b90b"} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={activeTab === "CR1" ? "#B0E4CC" : activeTab === "CR2" ? "#408A71" : "#f0b90b"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#64748b" 
                  tick={{ fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#f8fafc" }}
                  itemStyle={{ color: activeTab === "CR1" ? "#B0E4CC" : activeTab === "CR2" ? "#408A71" : "#f0b90b", fontWeight: 700 }}
                  formatter={(value) => [`${value.toLocaleString()} VNĐ`, "Giá"]}
                />
                <Area 
                  type="monotone" 
                  dataKey={activeTab} 
                  stroke={activeTab === "CR1" ? "#B0E4CC" : activeTab === "CR2" ? "#408A71" : "#f0b90b"} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorMain)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Assets List ── */}
      <section id="assets" className="landing-section">
        <h2 className="section-title">Các hạng tài sản RWA</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 24 }}>
          {[
            { code: 'CaRo-CR1', name: 'Robusta Cao cấp (S18)', price: '108.000 VNĐ', vol: '12.45M kg', change: '+8.0%', color: '#B0E4CC' },
            { code: 'CaRo-CR2', name: 'Robusta Tiêu chuẩn (S16)', price: '91.500 VNĐ', vol: '25.30M kg', change: '+7.6%', color: '#408A71' },
            { code: 'CaRo-CR3', name: 'Robusta Phổ thông (S13)', price: '75.500 VNĐ', vol: '14.65M kg', change: '+7.8%', color: '#f0b90b' },
          ].map((t) => (
            <div key={t.code} className="caro-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: t.color, fontFamily: "monospace" }}>{t.code}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{t.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#f8fafc" }}>{t.price}</div>
                  <div style={{ fontSize: 13, color: t.change.startsWith('+') ? '#B0E4CC' : '#ef4444', fontWeight: 600, marginTop: 4 }}>{t.change}</div>
                </div>
              </div>
              <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Khối lượng lưu hành:</span>
                <strong style={{ color: "#e2e8f0" }}>{t.vol}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tokenization Timeline ── */}
      <section id="tokenization" className="landing-section">
        <h2 className="section-title">Chuỗi cung ứng minh bạch</h2>
        <div className="timeline-grid">
          {[
            { s: 'Xác thực định danh', i: 'VNeID / CCCD', icon: '🪪' },
            { s: 'Thu hoạch & Vận chuyển', i: 'Theo dõi GPS', icon: '🚚' },
            { s: 'Kiểm định chất lượng', i: 'Oracle & IoT', icon: '🔍' },
            { s: 'Lưu ký kho bãi', i: 'Biên nhận Kho', icon: '📦' },
            { s: 'Đúc Token RWA', i: 'Hợp đồng Thông minh', icon: '🪙' },
          ].map((step, idx) => (
            <div key={idx} className="timeline-card caro-card">
              <div className="timeline-icon">{step.icon}</div>
              <div className="timeline-step">Bước {idx + 1}</div>
              <h3 className="timeline-title">{step.s}</h3>
              <div className="timeline-tech">{step.i}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="landing-section">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 className="section-title">Tham gia hệ sinh thái CaRo</h2>
        </div>

        <div className="role-grid">
          {/* Farmer */}
          <div className="role-card-v2 farmer">
            <div className="role-top">
              <div className="role-icon">👨‍🌾</div>
              <h3>Farmer</h3>
              <p>Chủ sở hữu vùng trồng và nhà sản xuất cà phê. Số hóa tài sản để tiếp cận nguồn vốn toàn cầu.</p>
            </div>
            <div className="role-body">
              <div className="role-feature">✓ Token hóa lô hàng cà phê Robusta</div>
              <div className="role-feature">✓ Lưu ký an toàn tại kho bảo chứng</div>
              <div className="role-feature">✓ Thanh khoản ngay khi phát hành token</div>
            </div>
            <Link to="/register" className="role-btn">Trở thành Farmer</Link>
          </div>

          {/* Trader */}
          <div className="role-card-v2 trader">
            <div className="role-top">
              <div className="role-icon">📈</div>
              <h3>Trader / Buyer</h3>
              <p>Nhà đầu tư, nhà rang xay, thương mại. Giao dịch cà phê số hóa hoặc đổi lấy hàng vật lý.</p>
            </div>
            <div className="role-body">
              <div className="role-feature">✓ Mua bán token CaRo 24/7</div>
              <div className="role-feature">✓ Hưởng lợi từ chênh lệch giá thị trường</div>
              <div className="role-feature">✓ Redeem token để nhận cà phê thực (Burn)</div>
            </div>
            <Link to="/register" className="role-btn">Bắt đầu Giao dịch</Link>
          </div>
        </div>
      </section>

      {/* ── Tech / partners ── */}
      <section id="tech" className="landing-section" style={{ textAlign: "center" }}>
        <h2 className="section-title">Công nghệ cốt lõi</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 24 }}>
          {["Blockchain (Ethereum L2)", "Hợp đồng Thông minh", "API3 Oracles", "Xác thực VNeID", "Lưu trữ IPFS", "Ví Web3 (MetaMask)"].map(tech => (
            <div key={tech} className="tech-badge">{tech}</div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#408A71', letterSpacing: '-0.5px' }}>
              <span style={{ fontSize: 20 }}>🫘</span> CaRo Exchange
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
              Nền tảng Token hóa Tài sản Thực (RWA) Cà phê Robusta Việt Nam.
            </div>
          </div>
          <div className="footer-links">
            <a href="#">Thị trường</a>
            <a href="#">Sách trắng</a>
            <a href="#">Điều khoản sử dụng</a>
            <a href="#">Chính sách bảo mật</a>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 40, color: "#475569", fontSize: 12 }}>
          &copy; 2024 CaRo Exchange. Đã đăng ký bản quyền. Được xây dựng cho Web3.
        </div>
      </footer>
    </div>
  );
}
