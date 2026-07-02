import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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
  home:  "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  check: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  box:   "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  medal: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  list:  "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  out:   "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  chev:  "M9 18l6-6-6-6",
  bell:  "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

const MENU = [
  { id: "dash",    label: "Bảng điều khiển",    icon: "home",  path: "/admin"          },
  { id: "kyc",     label: "Duyệt danh tính KYC", icon: "check", path: "/admin/kyc"      },
  { id: "users",   label: "Quản lý người dùng",  icon: "users", path: "/admin/users"    },
  { id: "batches", label: "Lô hàng Farmer",      icon: "box",   path: "/admin/batches"  },
  { id: "minted",  label: "Lịch sử Mint",        icon: "medal", path: "/admin/minted"   },
  { id: "logs",    label: "Nhật ký hệ thống",    icon: "list",  path: "/admin/logs"     },
];

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

  const css = `
    .admin-sidebar {
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
    .admin-brand {
      height: ${HH}px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
      text-decoration: none;
    }
    .admin-brand-text { line-height: 1.15; }
    .admin-brand-name {
      font-weight: 800;
      font-size: 15px;
      color: #fff;
      font-family: 'Manrope', 'Space Grotesk', sans-serif;
      letter-spacing: -0.01em;
    }
    .admin-brand-sub {
      font-size: 9px;
      color: #64748b;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .admin-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 0;
    }
    .admin-nav-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #475569;
      text-transform: uppercase;
      padding: 10px 22px 4px;
    }
    .admin-nav-item {
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
    .admin-nav-item:hover {
      background: rgba(255,255,255,0.05);
      color: #f1f5f9;
    }
    .admin-nav-item.active {
      background: rgba(176, 228, 204,0.10);
      color: #B0E4CC;
      font-weight: 700;
    }
    .admin-nav-item.active svg {
      color: #B0E4CC;
    }
    .admin-nav-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #B0E4CC;
      margin-left: auto;
      flex-shrink: 0;
      box-shadow: 0 0 6px rgba(176, 228, 204,0.6);
    }
    .admin-footer {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 10px 8px;
      flex-shrink: 0;
    }
    .admin-user-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      margin-bottom: 2px;
      cursor: pointer;
      transition: background 0.18s;
    }
    .admin-user-row:hover { background: rgba(255,255,255,0.04); }
    .admin-user-name {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      line-height: 1.2;
    }
    .admin-user-email {
      font-size: 10px;
      color: #64748b;
      font-weight: 400;
    }
    .admin-logout-btn {
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
    .admin-logout-btn:hover {
      background: rgba(239,68,68,0.08);
      color: #ef4444;
    }
    .admin-main {
      flex: 1;
      margin-left: ${SW}px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .admin-header {
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
    .admin-header-left { display: flex; flex-direction: column; gap: 2px; }
    .admin-header-title {
      font-size: 16px;
      font-weight: 700;
      color: #f8fafc;
      font-family: 'Manrope', sans-serif;
    }
    .admin-header-breadcrumb {
      font-size: 11px;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .admin-header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .admin-header-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: rgba(176, 228, 204,0.08);
      border: 1px solid rgba(176, 228, 204,0.2);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: #B0E4CC;
      letter-spacing: 0.06em;
    }
    .admin-header-avatar {
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
    .admin-header-avatar:hover {
      box-shadow: 0 0 0 2px #091413, 0 0 0 5px rgba(176, 228, 204,0.5);
    }
    .admin-content {
      flex: 1;
      padding: 28px;
      overflow-y: auto;
    }
    @media (max-width: 1024px) {
      .admin-content { padding: 20px; }
    }
    @media (max-width: 768px) {
      .admin-sidebar { transform: translateX(-100%); }
      .admin-main { margin-left: 0; }
      .admin-content { padding: 16px; }
    }
  `;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "#f8fafc", fontFamily: "'Inter', -apple-system, sans-serif", display: "flex" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ─── Sidebar ─── */}
      <aside className="admin-sidebar">

        {/* Brand */}
        <Link to="/admin" className="admin-brand" style={{ textDecoration: "none" }}>
          <div className="caro-brand-icon">🫘</div>
          <div className="admin-brand-text">
            <div className="admin-brand-name">CaRo</div>
            <div className="admin-brand-sub">Admin Console</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="admin-nav">
          <div className="admin-nav-label">Quản trị</div>
          {MENU.map(m => {
            const act = isActive(m.path);
            return (
              <Link key={m.id} to={m.path}
                className={`admin-nav-item${act ? " active" : ""}`}
                onMouseEnter={e => { if (!act) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#f1f5f9"; } }}
                onMouseLeave={e => { if (!act) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; } }}
              >
                <Ico d={I[m.icon]} size={15} />
                <span style={{ flex: 1 }}>{m.label}</span>
                {act && <span className="admin-nav-dot" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="admin-footer">
          {/* User row */}
          <div className="admin-user-row" onClick={() => nav("/admin")}>
            <div className="admin-header-avatar" style={{ width: 32, height: 32, fontSize: 12, cursor: "default" }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="admin-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name || "Administrator"}
              </div>
              <div className="admin-user-email" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button className="admin-logout-btn" onClick={() => { logout(); nav("/"); }}>
            <Ico d={I.out} size={14} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="admin-main">

        {/* Header */}
        <header className="admin-header">
          <div className="admin-header-left">
            <div className="admin-header-title">{title}</div>
            <div className="admin-header-breadcrumb">
              <span>CaRo</span>
              <span style={{ color: "#334155" }}>›</span>
              <span>{title}</span>
            </div>
          </div>

          <div className="admin-header-right">
            {/* Notification Bell */}
            <NotificationBell />

            {/* Divider */}
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />

            {/* Admin badge */}
            <div className="admin-header-badge">
              <Ico d={I.shield} size={11} />
              QUẢN TRỊ VIÊN
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />

            {/* User info + avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => nav("/admin")}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{user?.full_name || "Admin"}</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{user?.email}</div>
              </div>
              <div className="admin-header-avatar">{initials}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
