import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";

const SW = 220;
const HH = 56;
const A   = "#487573";
const ABG = "rgba(72, 117, 115, 0.08)";

function Ico({ d, size = 15 }) {
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
};

const MARKET_SUB = [
  { id: "overview",  label: "Tổng quan",     path: "/trader/market/overview"  },
  { id: "trading",   label: "Giao dịch",     path: "/trader/market/trading"   },
  { id: "redeem",    label: "Đổi hàng hóa", path: "/trader/market/redeem"    },
];

const WALLET_SUB = [
  { id: "wallet-overview", label: "Tổng quan",  path: "/trader/wallet"           },
  { id: "financing",       label: "Tài chính",  path: "/trader/wallet/financing" },
];

const MARKET_PATHS = MARKET_SUB.map(s => s.path);
const WALLET_PATHS = WALLET_SUB.map(s => s.path);

const TOP_MENU = [
  { id: "dash", label: "Dashboard", icon: "home", path: "/trader" },
];

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

  const linkStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 9,
    padding: "9px 16px",
    background: active ? ABG : "transparent",
    borderWidth: "0 0 0 2px", borderStyle: "solid",
    borderColor: active ? A : "transparent",
    color: active ? "#7fe0c9" : "#9aa5b4",
    textDecoration: "none",
    fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: "pointer", width: "100%", textAlign: "left",
    transition: "background 0.15s, color 0.15s",
    boxSizing: "border-box",
  });

  const subLinkStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 16px 7px 38px",
    background: active ? "rgba(72,117,115,0.06)" : "transparent",
    borderWidth: "0 0 0 2px", borderStyle: "solid",
    borderColor: active ? A : "transparent",
    color: active ? "#7fe0c9" : "#7a8898",
    textDecoration: "none",
    fontSize: 12, fontWeight: active ? 600 : 400,
    cursor: "pointer", width: "100%", textAlign: "left",
    transition: "background 0.15s, color 0.15s",
    boxSizing: "border-box",
  });

  const initials = (user?.full_name || user?.email || "T")[0].toUpperCase();

  const renderNavItem = (m) => {
    const act = isActive(m.path);
    return (
      <Link key={m.id} to={m.path} style={linkStyle(act)}
        onMouseEnter={e => { if (!act) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
        onMouseLeave={e => { if (!act) { e.currentTarget.style.color = "#9aa5b4"; e.currentTarget.style.background = "transparent"; } }}
      >
        <Ico d={I[m.icon]} />
        <span style={{ flex: 1 }}>{m.label}</span>
      </Link>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d1413", color: "#e2e8f0", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: SW, background: "#172524", borderRight: "1px solid rgba(72,117,115,0.15)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, overflow: "hidden" }}>

        {/* Brand */}
        <div style={{ height: HH, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(72,117,115,0.15)", flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#487573,#2d4d4b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10 }}>☕</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>CaRo Exchange</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>

          {/* Top items */}
          {TOP_MENU.map(renderNavItem)}

          {/* Market group */}
          <div>
            {/* Group header */}
            <button
              onClick={() => setMarketOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "9px 16px", width: "100%", textAlign: "left",
                background: isOnMarket && !marketOpen ? ABG : "transparent",
                border: "none",
                borderLeft: isOnMarket ? `2px solid ${A}` : "2px solid transparent",
                color: isOnMarket ? "#7fe0c9" : "#9aa5b4",
                fontSize: 13, fontWeight: isOnMarket ? 600 : 400,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
                boxSizing: "border-box",
              }}
              onMouseEnter={e => { if (!isOnMarket) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
              onMouseLeave={e => { if (!isOnMarket) { e.currentTarget.style.color = "#9aa5b4"; e.currentTarget.style.background = "transparent"; } }}
            >
              <Ico d={I.shop} />
              <span style={{ flex: 1 }}>Thị trường</span>
              <span style={{ fontSize: 10, transition: "transform 0.2s", display: "block", transform: marketOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <Ico d={I.chevron} size={12} />
              </span>
            </button>

            {/* Sub-items */}
            {marketOpen && (
              <div style={{ borderBottom: "1px solid rgba(72,117,115,0.08)" }}>
                {MARKET_SUB.map(s => {
                  const act = isActive(s.path);
                  return (
                    <Link key={s.id} to={s.path} style={subLinkStyle(act)}
                      onMouseEnter={e => { if (!act) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
                      onMouseLeave={e => { if (!act) { e.currentTarget.style.color = "#7a8898"; e.currentTarget.style.background = "transparent"; } }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: act ? "#7fe0c9" : "#4a5568", flexShrink: 0 }} />
                      {s.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Wallet group */}
          <div>
            <button
              onClick={() => setWalletOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "9px 16px", width: "100%", textAlign: "left",
                background: isOnWallet && !walletOpen ? ABG : "transparent",
                border: "none",
                borderLeft: isOnWallet ? `2px solid ${A}` : "2px solid transparent",
                color: isOnWallet ? "#7fe0c9" : "#9aa5b4",
                fontSize: 13, fontWeight: isOnWallet ? 600 : 400,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
                boxSizing: "border-box",
              }}
              onMouseEnter={e => { if (!isOnWallet) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
              onMouseLeave={e => { if (!isOnWallet) { e.currentTarget.style.color = "#9aa5b4"; e.currentTarget.style.background = "transparent"; } }}
            >
              <Ico d={I.wallet} />
              <span style={{ flex: 1 }}>Ví tài khoản</span>
              <span style={{ fontSize: 10, transition: "transform 0.2s", display: "block", transform: walletOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <Ico d={I.chevron} size={12} />
              </span>
            </button>

            {walletOpen && (
              <div style={{ borderBottom: "1px solid rgba(72,117,115,0.08)" }}>
                {WALLET_SUB.map(s => {
                  const act = isActive(s.path);
                  return (
                    <Link key={s.id} to={s.path} style={subLinkStyle(act)}
                      onMouseEnter={e => { if (!act) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
                      onMouseLeave={e => { if (!act) { e.currentTarget.style.color = "#7a8898"; e.currentTarget.style.background = "transparent"; } }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: act ? "#7fe0c9" : "#4a5568", flexShrink: 0 }} />
                      {s.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom items */}
          {BOTTOM_MENU.map(renderNavItem)}

        </nav>

        {/* Sign out */}
        <div style={{ borderTop: "1px solid rgba(72,117,115,0.15)", flexShrink: 0 }}>
          <button
            onClick={() => { logout(); nav("/"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", background: "transparent", border: "none", color: "#6b7a99", cursor: "pointer", fontSize: 13, textAlign: "left" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#f6465d"; e.currentTarget.style.background = "rgba(246,70,93,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#6b7a99"; e.currentTarget.style.background = "transparent"; }}>
            <Ico d={I.out} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ marginLeft: SW, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <header style={{ height: HH, background: "#172524", borderBottom: "1px solid rgba(72,117,115,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{title}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {account ? (
              <button onClick={disconnect} title="Click để ngắt kết nối"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(72,117,115,0.12)", border: "1px solid #487573", color: "#7fe0c9", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🦊 {account.slice(0, 6)}…{account.slice(-4)}
              </button>
            ) : (
              <button onClick={connect}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#487573", border: "none", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                🦊 Kết nối ví
              </button>
            )}

            <div
              onClick={() => nav("/trader/profile")}
              style={{ display: "flex", alignItems: "center", gap: 10, borderLeft: "1px solid rgba(72,117,115,0.15)", paddingLeft: 16, cursor: "pointer" }}
              title="Xem hồ sơ cá nhân">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{user?.full_name || user?.email || "Trader"}</div>
                <span style={{ fontSize: 10, color: "#6b7a99" }}>{user?.email}</span>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#203433,#487573)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
