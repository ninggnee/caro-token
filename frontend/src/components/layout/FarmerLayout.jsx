import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";
import NotificationBell from "./NotificationBell";

const SW = 256;
const HH = 62;

function Ico({ d, size = 16, style: sx }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...sx }}>
      <path d={d} />
    </svg>
  );
}

const I = {
  home:   "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  box:    "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  file:   "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  wallet: "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a1 1 0 0 0 0 2 1 1 0 0 0 0-2z",
  shop:   "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
  user:   "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  out:    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  chev:   "M9 18l6-6-6-6",
  leaf:   "M2 20a2.4 2.4 0 0 0 2 1c6 0 6-5 12-5s6 5 12 5m-26 0a2 2 0 0 1 0-4 2 2 0 0 1 0 4z M12 12V2",
  seed:   "M7 20h10 M12 20v-8 M5.5 9.5a6.5 6.5 0 0 0 13 0c0-5-3.5-7-6.5-7S5.5 4.5 5.5 9.5z",
};

const MENU = [
  { id: "dash",   label: "Trang chủ",         icon: "home",   path: "/farmer/dashboard"      },
  { id: "status", label: "Trạng thái lô hàng", icon: "box",    path: "/farmer/status"         },
  { id: "wallet", label: "Ví tài khoản",       icon: "wallet", path: "/farmer/wallet"         },
  { id: "market", label: "Thị trường",         icon: "shop",   path: "/farmer/marketplace"    },
  { id: "wdocs",  label: "Giấy tờ",            icon: "file",   path: "/farmer/warehouse-docs" },
  { id: "prof",   label: "Hồ sơ cá nhân",      icon: "user",   path: "/farmer/profile"        },
];

export default function FarmerLayout({ children, title = "Farmer Portal" }) {
  const { user, logout, refreshUser, updateUser } = useAuth();
  const { account: walletAddress, connect: connectWalletContext, disconnect: disconnectWalletContext } = useWallet();
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    refreshUser();
  }, []);

  const connectWallet = async () => {
    try {
      const addr = await connectWalletContext();
      if (addr) {
        updateUser({ ...user, wallet_address: addr });
      }
    } catch (err) {
      console.error("MetaMask connection error:", err);
    }
  };

  const disconnectWallet = async () => {
    if (window.confirm("Bạn có chắc chắn muốn hủy kết nối ví MetaMask?")) {
      await disconnectWalletContext();
      updateUser({ ...user, wallet_address: null });
    }
  };

  const isLeafActive = (path) =>
    path === "/farmer/status"
      ? loc.pathname === "/farmer/status" || loc.pathname.startsWith("/farmer/status/")
      : loc.pathname === path || loc.pathname.startsWith(path + "/");

  const isParentActive = (m) => m.children?.some(c => isLeafActive(c.path));

  const [open, setOpen] = useState(() => {
    const s = {};
    MENU.forEach(m => { if (isParentActive(m)) s[m.id] = true; });
    return s;
  });

  const toggle = id => setOpen(p => ({ ...p, [id]: !p[id] }));
  const initials = (user?.full_name || user?.email || "F")[0].toUpperCase();

  // Active page label for breadcrumb
  const activeMenu = MENU.find(m => isLeafActive(m.path));

  const css = `
    .farmer-sidebar {
      width: ${SW}px;
      background: #091413;
      border-right: 1px solid rgba(255,255,255,0.06);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 100;
      overflow: hidden;
    }
    .farmer-brand {
      height: ${HH}px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
      text-decoration: none;
    }
    .farmer-brand-name {
      font-weight: 800;
      font-size: 15px;
      color: #fff;
      font-family: 'Manrope', 'Space Grotesk', sans-serif;
      letter-spacing: -0.01em;
    }
    .farmer-brand-sub {
      font-size: 9px;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .farmer-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 0;
    }
    .farmer-nav-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #475569;
      text-transform: uppercase;
      padding: 10px 22px 4px;
    }
    .farmer-nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      margin: 1px 8px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #94a3b8;
      text-decoration: none;
      cursor: pointer;
      border: none;
      background: transparent;
      width: calc(100% - 16px);
      text-align: left;
      transition: all 0.18s ease;
      font-family: 'Inter', sans-serif;
      box-sizing: border-box;
    }
    .farmer-nav-item:hover {
      background: rgba(255,255,255,0.05);
      color: #f1f5f9;
    }
    .farmer-nav-item.active {
      background: rgba(176, 228, 204,0.10);
      color: #B0E4CC;
      font-weight: 700;
    }
    .farmer-nav-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #B0E4CC;
      margin-left: auto;
      flex-shrink: 0;
      box-shadow: 0 0 6px rgba(176, 228, 204,0.6);
    }
    .farmer-footer {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 10px 8px;
      flex-shrink: 0;
    }
    .farmer-user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      margin-bottom: 2px;
      cursor: default;
    }
    .farmer-user-name {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      line-height: 1.2;
    }
    .farmer-user-role {
      font-size: 9px;
      color: #B0E4CC;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .farmer-logout-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      width: 100%;
      font-size: 13px;
      color: #64748b;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      transition: all 0.18s;
      font-family: 'Inter', sans-serif;
    }
    .farmer-logout-btn:hover {
      background: rgba(239,68,68,0.08);
      color: #ef4444;
    }
    .farmer-main {
      flex: 1;
      margin-left: ${SW}px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .farmer-header {
      height: ${HH}px;
      background: rgba(11,24,42,0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      position: sticky;
      top: 0;
      z-index: 50;
      flex-shrink: 0;
    }
    .farmer-header-left { display: flex; flex-direction: column; gap: 2px; }
    .farmer-header-title {
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
      font-family: 'Manrope', sans-serif;
    }
    .farmer-header-breadcrumb {
      font-size: 11px;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .farmer-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .farmer-wallet-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      border: none;
    }
    .farmer-wallet-connected {
      background: rgba(176, 228, 204,0.08);
      border: 1px solid rgba(176, 228, 204,0.25);
      color: #B0E4CC;
    }
    .farmer-wallet-connected:hover {
      background: rgba(176, 228, 204,0.14);
      border-color: rgba(176, 228, 204,0.45);
    }
    .farmer-wallet-connect {
      background: linear-gradient(135deg, rgba(176, 228, 204,0.15), rgba(64, 138, 113,0.1));
      border: 1px solid rgba(176, 228, 204,0.3);
      color: #B0E4CC;
    }
    .farmer-wallet-connect:hover {
      background: linear-gradient(135deg, rgba(176, 228, 204,0.22), rgba(64, 138, 113,0.15));
      transform: translateY(-1px);
    }
    .farmer-header-divider {
      width: 1px; height: 28px;
      background: rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .farmer-header-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #285A48, #B0E4CC);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #fff;
      flex-shrink: 0;
      cursor: pointer;
      box-shadow: 0 0 0 2px #091413, 0 0 0 4px rgba(176, 228, 204,0.3);
      transition: box-shadow 0.2s;
      font-family: 'Manrope', sans-serif;
    }
    .farmer-header-avatar:hover {
      box-shadow: 0 0 0 2px #091413, 0 0 0 5px rgba(176, 228, 204,0.5);
    }
    .farmer-content {
      flex: 1;
      padding: 28px;
      overflow-y: auto;
    }
    @media (max-width: 1024px) {
      .farmer-content { padding: 20px; }
    }
    @media (max-width: 768px) {
      .farmer-sidebar { transform: translateX(-100%); }
      .farmer-main { margin-left: 0; }
      .farmer-content { padding: 16px; }
    }
  `;

  return (
    <div style={{ minHeight: "100vh", background: "#091413", color: "#f8fafc", fontFamily: "'Inter', -apple-system, sans-serif", display: "flex" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ─── Sidebar ─── */}
      <aside className="farmer-sidebar">

        {/* Brand */}
        <Link to="/farmer/dashboard" className="farmer-brand" style={{ textDecoration: "none" }}>
          <div className="caro-brand-icon">🫘</div>
          <div>
            <div className="farmer-brand-name">CaRo Exchange</div>
            <div className="farmer-brand-sub">Farmer Portal</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="farmer-nav">
          <div className="farmer-nav-label">Điều hướng</div>
          {MENU.map(m => {
            if (m.children) {
              const parentAct = isParentActive(m);
              const isOpen = open[m.id] || parentAct;
              return (
                <div key={m.id}>
                  <button onClick={() => toggle(m.id)}
                    className={`farmer-nav-item${parentAct ? " active" : ""}`}
                    style={{ justifyContent: "space-between" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Ico d={I[m.icon]} size={15} />
                      <span>{m.label}</span>
                    </div>
                    <Ico d={I.chev} size={12} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", color: "inherit" }} />
                  </button>
                  {isOpen && (
                    <div style={{ paddingLeft: 8, paddingBottom: 4 }}>
                      {m.children.map(c => {
                        const a = isLeafActive(c.path);
                        return (
                          <Link key={c.path} to={c.path}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "7px 14px 7px 34px",
                              margin: "1px 8px",
                              borderRadius: 8,
                              fontSize: 12, fontWeight: a ? 600 : 400,
                              color: a ? "#B0E4CC" : "#64748b",
                              background: a ? "rgba(176, 228, 204,0.08)" : "transparent",
                              textDecoration: "none",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (!a) { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
                            onMouseLeave={e => { if (!a) { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "transparent"; } }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: a ? "#B0E4CC" : "#334155", flexShrink: 0 }} />
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const act = isLeafActive(m.path);
            return (
              <Link key={m.id} to={m.path}
                className={`farmer-nav-item${act ? " active" : ""}`}
                onMouseEnter={e => { if (!act) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#f1f5f9"; } }}
                onMouseLeave={e => { if (!act) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
              >
                <Ico d={I[m.icon]} size={15} />
                <span style={{ flex: 1 }}>{m.label}</span>
                {act && <span className="farmer-nav-dot" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="farmer-footer">
          <div className="farmer-user-row">
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #285A48, #B0E4CC)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="farmer-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name || user?.email || "Farmer"}
              </div>
              <div className="farmer-user-role">🌱 Farmer</div>
            </div>
          </div>
          <button className="farmer-logout-btn" onClick={() => { logout(); nav("/"); }}>
            <Ico d={I.out} size={14} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="farmer-main">

        {/* Header */}
        <header className="farmer-header">
          <div className="farmer-header-left">
            <div className="farmer-header-title">{title}</div>
            <div className="farmer-header-breadcrumb">
              <span>CaRo</span>
              <span style={{ color: "#334155" }}>›</span>
              <span>Farmer</span>
              {activeMenu && (
                <>
                  <span style={{ color: "#334155" }}>›</span>
                  <span style={{ color: "#B0E4CC" }}>{activeMenu.label}</span>
                </>
              )}
            </div>
          </div>

          <div className="farmer-header-right">
            {/* Notification Bell */}
            <NotificationBell />

            <div className="farmer-header-divider" style={{ width: 1, height: 24, background: "rgba(255,255,255,0.07)", margin: "0 4px", flexShrink: 0 }} />

            {/* MetaMask button */}
            {walletAddress ? (
              <button className="farmer-wallet-btn farmer-wallet-connected"
                onClick={disconnectWallet}
                title="Click để ngắt kết nối"
              >
                🦊 {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </button>
            ) : (
              <button className="farmer-wallet-btn farmer-wallet-connect"
                onClick={connectWallet}
              >
                🦊 Kết nối ví
              </button>
            )}

            <div className="farmer-header-divider" />

            {/* User info + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => nav("/farmer/profile")}
              title="Xem hồ sơ cá nhân"
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                  {user?.full_name || user?.email || "Farmer"}
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{user?.email}</div>
              </div>
              <div className="farmer-header-avatar">{initials}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="farmer-content">
          {children}
        </main>
      </div>
    </div>
  );
}
