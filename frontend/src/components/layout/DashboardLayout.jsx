import { useAuth } from "../../context/AuthContext";
import axios from "../../utils/axiosClient";
import { useNavigate } from "react-router-dom";
import '../../styles/admin.css';
import WalletButton from "../wallet/WalletButton";
import { Link, useLocation } from "react-router-dom";

export default function DashboardLayout({ title, children }) {
  const { user, updateUser, logout } = useAuth();
  const auth = { updateUser, logout };
  const navigate = useNavigate();
  const location = useLocation();

  const connectWallet = async () => {
    if (!window.ethereum) return alert("MetaMask not found");
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const wallet = accounts[0];
      // send to backend
      const res = await axios.post(`/auth/save-wallet`, { wallet_address: wallet });
      const returnedRole = res.data.role || user?.role;
      alert("Wallet connected: " + wallet);
      // update user in context and localStorage; store role-specific wallet
      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (storedUser) {
        // set both the legacy field and role-specific field
        storedUser.wallet_address = wallet;
        if (returnedRole) storedUser[`wallet_${returnedRole}`] = wallet;
        updateUser(storedUser);
      }
    } catch (err) {
      console.error(err);
      alert("Wallet connection failed");
    }
  };

  const handleLogout = () => {
    auth.logout();
    navigate("/");
  };
  const isActive = (path) => {
    if (path === "/admin") {
      return (
        location.pathname === "/admin" ||
        location.pathname === "/admin/dashboard"
      );
    }

    return location.pathname.startsWith(path);
  };

  return (
    <div style={{ background: "#0b0e11", minHeight: "100vh", color: "white" }}>
      
      {/* TOP BAR */}
      <div style={{
        padding: "12px 20px",
        background: "#141a1f",
        display: "flex",
        justifyContent: "space-between"
      }}>
        <div>🫘 CaRo | {title}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="topbar-user">{user?.email} | {user?.role}</div>
            {user?.role !== 'admin' && <WalletButton />}
            <button onClick={handleLogout} className="btn">Logout</button>
          </div>
      </div>

        {/* CONTENT */}
        {user?.role === 'admin' ? (
          <div className="dashboard-container">
            <aside className="sidebar">
                <div className="sidebar-brand">CaRo Admin</div>
                <nav className="sidebar-nav">
                  <Link
                    to="/admin"
                    className={isActive("/admin") ? "active" : ""}
                  >
                    📊 Dashboard
                  </Link>

                  <Link
                    to="/admin/kyc"
                    className={isActive("/admin/kyc") ? "active" : ""}
                  >
                    ✅ KYC Approval
                  </Link>

                  <Link
                    to="/admin/users"
                    className={isActive("/admin/users") ? "active" : ""}
                  >
                    👥 Users
                  </Link>

                  <Link
                    to="/admin/requests"
                    className={isActive("/admin/requests") ? "active" : ""}
                  >
                    🪙 Yêu cầu Token hóa
                  </Link>

                  <Link
                    to="/admin/mint"
                    className={isActive("/admin/mint") ? "active" : ""}
                  >
                    🏭 Mint
                  </Link>

                  <Link
                    to="/admin/mint-requests"
                    className={isActive("/admin/mint-requests") ? "active" : ""}
                  >
                    📦 Asset Batches
                  </Link>

                  <Link
                    to="/admin/logs"
                    className={isActive("/admin/logs") ? "active" : ""}
                  >
                    📜 Nhật ký
                  </Link>
                </nav>
              </aside>
            <main className="main-content">{children}</main>
          </div>
        ) : (
          <div style={{ padding: 20 }}>{children}</div>
        )}
    </div>
  );
}