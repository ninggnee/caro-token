import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <div style={{
      width: 220,
      background: "#11161c",
      padding: 16,
      color: "#f8fafc"
    }}>
      <h3 style={{ color: "#408A71" }}>🫘 CaRo DEX</h3>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Public</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <Link to="/landing">Landing</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </nav>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Farmer</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <Link to="/farmer">Dashboard</Link>
          <Link to="/farmer/wallet">Ví</Link>
          <Link to="/farmer/marketplace">Marketplace</Link>
          <Link to="/farmer/request/new">Tạo yêu cầu</Link>
          <Link to="/farmer/requests">Danh sách yêu cầu</Link>
        </nav>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Trader</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <Link to="/trader">Dashboard</Link>
          <Link to="/trader/wallet">Ví</Link>
          <Link to="/trader/marketplace">Marketplace</Link>
          <Link to="/trader/trading">Trading</Link>
          <Link to="/trader/trades">Lịch sử</Link>
        </nav>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Admin</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/kyc">KYC</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/requests">Yêu cầu Token hóa</Link>
          <Link to="/admin/mint">Mint</Link>
          <Link to="/admin/logs">Nhật ký</Link>
        </nav>
      </div>
    </div>
  );
}