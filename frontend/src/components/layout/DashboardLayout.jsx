import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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
  home:  "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  check: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  box:   "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  medal: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  list:  "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  out:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  chev:  "M9 18l6-6-6-6",
};

const MENU = [
  { id: "dash",    label: "Dashboard",    icon: "home",  path: "/admin"          },
  { id: "kyc",     label: "KYC Approval", icon: "check", path: "/admin/kyc"      },
  { id: "users",   label: "Users",        icon: "users", path: "/admin/users"    },
  { id: "batches", label: "Asset Batches",icon: "box",   path: "/admin/batches"  },
  { id: "minted",  label: "Minted",       icon: "medal", path: "/admin/minted"   },
  { id: "logs",    label: "Audit Logs",   icon: "list",  path: "/admin/logs"     },
];

const A   = "#00d4aa";
const ABG = "rgba(0,212,170,0.08)";

export default function DashboardLayout({ title = "Admin", children }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();

  const isActive = (path) => {
    if (path === "/admin") {
      return loc.pathname === "/admin" || loc.pathname === "/admin/dashboard";
    }
    return loc.pathname === path || loc.pathname.startsWith(path + "/");
  };

  const initials = (user?.full_name || user?.email || "A")[0].toUpperCase();

  const navItemStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 16px",
    background: active ? ABG : "transparent",
    borderWidth: "0 0 0 2px",
    borderStyle: "solid",
    borderColor: active ? A : "transparent",
    color: active ? A : "#9aa5b4",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    transition: "background 0.15s, color 0.15s",
    boxSizing: "border-box",
  });

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#0b1117",
      color: "#e2e8f0",
      fontFamily: "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>

      {/* ─── Sidebar (fixed) ─── */}
      <aside style={{
        width: SW,
        flexShrink: 0,
        background: "#0d1421",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        overflow: "hidden",
      }}>

        {/* Brand */}
        <div style={{ height: HH, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#00d4aa,#0095ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 10 }}>☕</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "0.3px", color: "#fff", lineHeight: 1.1 }}>CaRo</div>
            <div style={{ fontSize: 9, color: "#6b7a99", letterSpacing: "2px", fontWeight: 600 }}>ADMIN</div>
          </div>
        </div>

        {/* User mini */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0095ff,#7b2ff7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#fff", flexShrink: 0 }}>{initials}</div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.full_name || "Admin"}</div>
              <div style={{ fontSize: 10, color: "#6b7a99", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
          {MENU.map(m => {
            const act = isActive(m.path);
            return (
              <Link key={m.id} to={m.path} style={navItemStyle(act)}
                onMouseEnter={e => { if (!act) { e.currentTarget.style.color = "#c0ccd8"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
                onMouseLeave={e => { if (!act) { e.currentTarget.style.color = "#9aa5b4"; e.currentTarget.style.background = "transparent"; } }}>
                <Ico d={I[m.icon]} />
                <span style={{ flex: 1 }}>{m.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button onClick={() => { logout(); nav("/"); }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", background: "transparent", border: "none", color: "#6b7a99", cursor: "pointer", fontSize: 13, textAlign: "left" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#f6465d"; e.currentTarget.style.background = "rgba(246,70,93,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#6b7a99"; e.currentTarget.style.background = "transparent"; }}>
            <Ico d={I.out} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─── Main (offset by sidebar) ─── */}
      <div style={{ flex: 1, marginLeft: SW, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header (sticky) */}
        <header style={{
          height: HH,
          background: "#0d1421",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 50,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 5, background: "rgba(0,212,170,0.1)", color: "#00d4aa", fontWeight: 700, letterSpacing: "0.5px" }}>
              ADMIN
            </span>
            <span style={{ fontSize: 12, color: "#6b7a99" }}>{user?.email}</span>
          </div>
        </header>

        {/* Content (scrollable) */}
        <main style={{ flex: 1, padding: 24, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
