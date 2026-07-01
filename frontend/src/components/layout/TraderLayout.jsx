import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";
import NotificationBell from "./NotificationBell";

const SW  = 256;
const HH  = 62;

function Ico({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const I = {
  home:    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  shop:    "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
  bar:     "M18 20V10 M12 20V4 M6 20v-6",
  wallet:  "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a1 1 0 0 0 0 2 1 1 0 0 0 0-2z",
  list:    "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  out:     "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  chevron: "M6 9l6 6 6-6",
  chev:    "M9 18l6-6-6-6",
};

const MARKET_SUB = [
  { id: "overview",  label: "Tổng quan",     path: "/trader/market/overview"  },
  { id: "trading",   label: "Giao dịch",     path: "/trader/market/trading"   },
  { id: "financing", label: "Tài chính",     path: "/trader/market/financing" },
  { id: "redeem",    label: "Đổi hàng hóa", path: "/trader/market/redeem"    },
];

const MARKET_PATHS = MARKET_SUB.map(s => s.path);

const TOP_MENU = [
  { id: "dash", label: "Bảng điều khiển", icon: "home", path: "/trader" },
];

const WALLET_SUB = [
  { id: "wallet-overview", label: "Tổng quan",  path: "/trader/wallet"           },
  { id: "financing",       label: "Tài chính",  path: "/trader/wallet/financing" },
];

const WALLET_PATHS = WALLET_SUB.map(s => s.path);

const BOTTOM_MENU = [
  { id: "portfolio", label: "Danh mục đầu tư",   icon: "bar",    path: "/trader/portfolio" },
  { id: "history",   label: "Lịch sử giao dịch", icon: "list",   path: "/trader/trades"    },
  { id: "profile",   label: "Hồ sơ cá nhân",     icon: "user",   path: "/trader/profile"   },
];

export default function TraderLayout({ children, title = "Trader Portal" }) {
  const { user, logout } = useAuth();
  const { account, connect, disconnect } = useWallet();
  const loc = useLocation();
  const nav = useNavigate();

  const isOnMarket = MARKET_PATHS.some(p => loc.pathname === p || loc.pathname.startsWith(p + "/"));
  const isOnWallet = WALLET_PATHS.some(p => loc.pathname === p || loc.pathname.startsWith(p + "/"));
  const [marketOpen, setMarketOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  useEffect(() => {
    if (isOnMarket) setMarketOpen(true);
  }, [isOnMarket]);

  useEffect(() => {
    if (isOnWallet) setWalletOpen(true);
  }, [isOnWallet]);

  const isActive = (path) =>
    path === "/trader"
      ? loc.pathname === "/trader"
      : loc.pathname === path || loc.pathname.startsWith(path + "/");

  const initials = (user?.full_name || user?.email || "T")[0].toUpperCase();

  // Breadcrumb active item
  const allItems = [...TOP_MENU, ...BOTTOM_MENU, ...WALLET_SUB];
  const activePage = allItems.find(m => isActive(m.path));

  const css = `
    .trader-sidebar {
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
    .trader-brand {
      height: ${HH}px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
      text-decoration: none;
    }
    .trader-brand-name {
      font-weight: 800;
      font-size: 15px;
      color: #fff;
      font-family: 'Manrope', 'Space Grotesk', sans-serif;
      letter-spacing: -0.01em;
    }
    .trader-brand-sub {
      font-size: 9px;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .trader-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 0;
    }
    .trader-nav-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #475569;
      text-transform: uppercase;
      padding: 10px 22px 4px;
    }
    .trader-nav-item {
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
    .trader-nav-item:hover {
      background: rgba(255,255,255,0.05);
      color: #f1f5f9;
    }
    .trader-nav-item.active {
      background: rgba(64, 138, 113,0.10);
      color: #408A71;
      font-weight: 700;
    }
    .trader-nav-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #408A71;
      margin-left: auto;
      flex-shrink: 0;
      box-shadow: 0 0 6px rgba(64, 138, 113,0.6);
    }
    .trader-market-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      margin: 1px 8px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #94a3b8;
      cursor: pointer;
      border: none;
      background: transparent;
      width: calc(100% - 16px);
      text-align: left;
      transition: all 0.18s ease;
      font-family: 'Inter', sans-serif;
      box-sizing: border-box;
    }
    .trader-market-btn.active {
      background: rgba(64, 138, 113,0.10);
      color: #408A71;
      font-weight: 700;
    }
    .trader-market-btn:hover {
      background: rgba(255,255,255,0.05);
      color: #f1f5f9;
    }
    .trader-sub-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px 7px 34px;
      margin: 1px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 400;
      color: #64748b;
      text-decoration: none;
      transition: all 0.15s;
      box-sizing: border-box;
      cursor: pointer;
    }
    .trader-sub-item:hover { color: #94a3b8; background: rgba(255,255,255,0.04); }
    .trader-sub-item.active { color: #408A71; background: rgba(64, 138, 113,0.08); font-weight: 600; }
    .trader-footer {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 10px 8px;
      flex-shrink: 0;
    }
    .trader-user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      margin-bottom: 2px;
    }
    .trader-logout-btn {
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
    .trader-logout-btn:hover {
      background: rgba(239,68,68,0.08);
      color: #ef4444;
    }
    .trader-main {
      flex: 1;
      margin-left: ${SW}px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .trader-header {
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
    .trader-header-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0e2a3a, #408A71);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      color: #fff;
      flex-shrink: 0;
      cursor: pointer;
      box-shadow: 0 0 0 2px #091413, 0 0 0 4px rgba(64, 138, 113,0.3);
      transition: box-shadow 0.2s;
      font-family: 'Manrope', sans-serif;
    }
    .trader-header-avatar:hover {
      box-shadow: 0 0 0 2px #091413, 0 0 0 5px rgba(64, 138, 113,0.5);
    }
    .trader-wallet-btn {
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
    .trader-wallet-connected {
      background: rgba(64, 138, 113,0.08);
      border: 1px solid rgba(64, 138, 113,0.25);
      color: #408A71;
    }
    .trader-wallet-connected:hover {
      background: rgba(64, 138, 113,0.14);
    }
    .trader-wallet-connect {
      background: linear-gradient(135deg, rgba(64, 138, 113,0.15), rgba(139,92,246,0.1));
      border: 1px solid rgba(64, 138, 113,0.3);
      color: #408A71;
    }
    .trader-wallet-connect:hover {
      background: linear-gradient(135deg, rgba(64, 138, 113,0.22), rgba(139,92,246,0.15));
    }
    .trader-content {
      flex: 1;
      padding: 28px;
      overflow-y: auto;
    }
    @media (max-width: 768px) {
      .trader-sidebar { transform: translateX(-100%); }
      .trader-main { margin-left: 0; }
      .trader-content { padding: 16px; }
    }
  `;

  const renderNavItem = (m) => {
    const act = isActive(m.path);
    return (
      <Link key={m.id} to={m.path}
        className={`trader-nav-item${act ? " active" : ""}`}
        onMouseEnter={e => { if (!act) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#f1f5f9"; } }}
        onMouseLeave={e => { if (!act) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
      >
        <Ico d={I[m.icon]} size={15} />
        <span style={{ flex: 1 }}>{m.label}</span>
        {act && <span className="trader-nav-dot" />}
      </Link>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#091413", color: "#f8fafc", fontFamily: "'Inter', -apple-system, sans-serif", display: "flex" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── Sidebar ── */}
      <aside className="trader-sidebar">

        {/* Brand */}
        <Link to="/trader" className="trader-brand" style={{ textDecoration: "none" }}>
          <div className="caro-brand-icon" style={{ background: "linear-gradient(135deg, #408A71, #408A71)" }}>🫘</div>
          <div>
            <div className="trader-brand-name">CaRo Exchange</div>
            <div className="trader-brand-sub">Trader Portal</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="trader-nav">
          <div className="trader-nav-label">Tổng quan</div>
          {TOP_MENU.map(renderNavItem)}

          <div className="trader-nav-label" style={{ marginTop: 8 }}>Thị trường</div>
          {/* Market group */}
          <button
            onClick={() => setMarketOpen(o => !o)}
            className={`trader-market-btn${isOnMarket ? " active" : ""}`}
            onMouseEnter={e => { if (!isOnMarket) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#f1f5f9"; } }}
            onMouseLeave={e => { if (!isOnMarket) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
          >
            <Ico d={I.shop} size={15} />
            <span style={{ flex: 1 }}>Thị trường</span>
            <span style={{ fontSize: 10, transition: "transform 0.2s", display: "block", transform: marketOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <Ico d={I.chevron} size={12} />
            </span>
          </button>

          {marketOpen && (
            <div style={{ paddingBottom: 4 }}>
              {MARKET_SUB.map(s => {
                const act = isActive(s.path);
                return (
                  <Link key={s.id} to={s.path}
                    className={`trader-sub-item${act ? " active" : ""}`}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: act ? "#408A71" : "#334155", flexShrink: 0 }} />
                    {s.label}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="trader-nav-label" style={{ marginTop: 8 }}>Tài khoản</div>
          {/* Wallet group */}
          <button
            onClick={() => setWalletOpen(o => !o)}
            className={`trader-market-btn${isOnWallet ? " active" : ""}`}
            onMouseEnter={e => { if (!isOnWallet) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#f1f5f9"; } }}
            onMouseLeave={e => { if (!isOnWallet) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
          >
            <Ico d={I.wallet} size={15} />
            <span style={{ flex: 1 }}>Ví tài khoản</span>
            <span style={{ fontSize: 10, transition: "transform 0.2s", display: "block", transform: walletOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
              <Ico d={I.chevron} size={12} />
            </span>
          </button>

          {walletOpen && (
            <div style={{ paddingBottom: 4 }}>
              {WALLET_SUB.map(s => {
                const act = isActive(s.path);
                return (
                  <Link key={s.id} to={s.path}
                    className={`trader-sub-item${act ? " active" : ""}`}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: act ? "#408A71" : "#334155", flexShrink: 0 }} />
                    {s.label}
                  </Link>
                );
              })}
            </div>
          )}

          {BOTTOM_MENU.map(renderNavItem)}
        </nav>

        {/* Footer */}
        <div className="trader-footer">
          <div className="trader-user-row">
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #0e2a3a, #408A71)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name || user?.email || "Trader"}
              </div>
              <div style={{ fontSize: 9, color: "#408A71", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                💼 Trader
              </div>
            </div>
          </div>
          <button className="trader-logout-btn" onClick={() => { logout(); nav("/"); }}>
            <Ico d={I.out} size={14} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="trader-main">

        {/* Header */}
        <header className="trader-header">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", fontFamily: "'Manrope', sans-serif" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
              <span>CaRo</span>
              <span style={{ color: "#334155" }}>›</span>
              <span>Trader</span>
              {activePage && (
                <>
                  <span style={{ color: "#334155" }}>›</span>
                  <span style={{ color: "#408A71" }}>{activePage.label}</span>
                </>
              )}
              {isOnMarket && (
                <>
                  <span style={{ color: "#334155" }}>›</span>
                  <span style={{ color: "#408A71" }}>Thị trường</span>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Notification Bell */}
            <NotificationBell />

            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

            {/* Wallet */}
            {account ? (
              <button onClick={disconnect} title="Click để ngắt kết nối"
                className="trader-wallet-btn trader-wallet-connected">
                🦊 {account.slice(0, 6)}…{account.slice(-4)}
              </button>
            ) : (
              <button onClick={connect}
                className="trader-wallet-btn trader-wallet-connect">
                🦊 Kết nối ví
              </button>
            )}

            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

            {/* User info + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => nav("/trader/profile")}
              title="Xem hồ sơ cá nhân"
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                  {user?.full_name || user?.email || "Trader"}
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{user?.email}</div>
              </div>
              <div className="trader-header-avatar">{initials}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="trader-content">
          {children}
        </main>
      </div>
    </div>
  );
}
