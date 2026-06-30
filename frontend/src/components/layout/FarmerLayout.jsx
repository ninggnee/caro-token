import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";

const SW = 220;
const HH = 56;

function Ico({ d, size = 15, style: sx }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...sx }}>
      <path d={d} />
    </svg>
  );
}

const I = {
  home:    "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  box:     "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  file:    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  wallet:  "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a1 1 0 0 0 0 2 1 1 0 0 0 0-2z",
  bar:     "M18 20V10 M12 20V4 M6 20v-6",
  list:    "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  user:    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  shop:    "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0",
  cog:     "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  out:     "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  chev:    "M9 18l6-6-6-6",
};

const MENU = [
  { id: "dash",   label: "Trang chủ",               icon: "home",   path: "/farmer/dashboard"        },
  { id: "status", label: "Trạng thái lô hàng",       icon: "box",    path: "/farmer/status"           },
  { id: "wallet", label: "Ví tài khoản",            icon: "wallet", path: "/farmer/wallet"           },
  { id: "market", label: "Thị trường",              icon: "shop",
    children: [
      { label: "Tổng quan", path: "/farmer/market/overview" },
      { label: "Giao dịch",  path: "/farmer/market/trading"  },
    ]
  },
  { id: "wdocs",  label: "Giấy tờ",                  icon: "file",   path: "/farmer/warehouse-docs"   },
  { id: "prof",   label: "Hồ sơ cá nhân",           icon: "user",   path: "/farmer/profile"          },
];

const A = "#487573";
const ABG = "rgba(72, 117, 115, 0.08)";

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

  const navItemStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 16px",
    background: active ? ABG : "transparent",
    borderWidth: "0 0 0 2px",
    borderStyle: "solid",
    borderColor: active ? A : "transparent",
    color: active ? "#7fe0c9" : "#9aa5b4",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    transition: "background 0.15s, color 0.15s",
    boxSizing: "border-box",
  });

  const childStyle = (active) => ({
    display: "block",
    padding: "7px 16px 7px 42px",
    color: active ? "#7fe0c9" : "#6b7a99",
    background: active ? "rgba(72,117,115,0.05)" : "transparent",
    borderWidth: "0 0 0 2px",
    borderStyle: "solid",
    borderColor: active ? A : "transparent",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    transition: "background 0.15s, color 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0d1413", color: "#e2e8f0", fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ─── Sidebar ─── */}
      <aside style={{ width: SW, flexShrink: 0, background: "#172524", borderRight: "1px solid rgba(72,117,115,0.15)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 100, overflow: "hidden" }}>

        {/* Brand */}
        <div style={{ height: HH, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(72,117,115,0.15)", flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#487573,#2d4d4b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10 }}>🫘</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", fontFamily: "Inter, sans-serif" }}>CaRo Exchange</span>
        </div>


        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
          {MENU.map(m => {
            if (m.children) {
              const parentAct = isParentActive(m);
              const isOpen = open[m.id] || parentAct;
              return (
                <div key={m.id}>
                  <button onClick={() => toggle(m.id)} style={{ ...navItemStyle(parentAct), justifyContent: "space-between", border: "none", borderLeft: `2px solid ${parentAct ? A : "transparent"}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Ico d={I[m.icon]} />
                      <span>{m.label}</span>
                    </div>
                    <div style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "flex" }}>
                      <Ico d={I.chev} size={12} />
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ background: "rgba(0,0,0,0.15)" }}>
                      {m.children.map(c => {
                        const a = isLeafActive(c.path);
                        return (
                          <Link key={c.path} to={c.path} style={childStyle(a)}
                            onMouseEnter={e => { if (!a) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; } }}
                            onMouseLeave={e => { if (!a) { e.currentTarget.style.color = "#6b7a99"; e.currentTarget.style.background = "transparent"; } }}
                          >{c.label}</Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const act = loc.pathname === m.path;
            return (
              <Link key={m.id} to={m.path} style={navItemStyle(act)}
                onMouseEnter={e => { if (!act) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
                onMouseLeave={e => { if (!act) { e.currentTarget.style.color = "#9aa5b4"; e.currentTarget.style.background = "transparent"; } }}
              >
                <Ico d={I[m.icon]} />
                <span style={{ flex: 1 }}>{m.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ borderTop: "1px solid rgba(72,117,115,0.15)", flexShrink: 0 }}>
          <button onClick={() => { logout(); nav("/"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", background: "transparent", border: "none", color: "#6b7a99", cursor: "pointer", fontSize: 13, textAlign: "left" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#f6465d"; e.currentTarget.style.background = "rgba(246,70,93,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#6b7a99"; e.currentTarget.style.background = "transparent"; }}
          >
            <Ico d={I.out} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div style={{ flex: 1, marginLeft: SW, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <header style={{ height: HH, background: "#172524", borderBottom: "1px solid rgba(72,117,115,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{title}</div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* MetaMask button */}
            {walletAddress ? (
              <button
                onClick={disconnectWallet}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "rgba(72,117,115,0.12)",
                  border: "1px solid #487573",
                  color: "#7fe0c9",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Click để ngắt kết nối"
              >
                🦊 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "#487573",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 0.9}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
              >
                🦊 Kết nối ví
              </button>
            )}

            {/* Account Info Block */}
            <div 
              onClick={() => nav("/farmer/profile")}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 10, 
                borderLeft: "1px solid rgba(72,117,115,0.15)", 
                paddingLeft: 16,
                cursor: "pointer"
              }}
              title="Xem hồ sơ cá nhân"
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{user?.full_name || user?.email || "Farmer"}</div>
                </div>
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
