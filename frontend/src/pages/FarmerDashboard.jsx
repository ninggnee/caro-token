import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useMyBatches } from "../hooks/useBatches";
import axios from "../utils/axiosClient";
import { formatNumber, formatKg, formatPct } from '../utils/formatters';

function useDashboard() {
  return useQuery({
    queryKey: ["farmer-dashboard"],
    queryFn: () => axios.get("/farmer/dashboard").then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

/* ── Token Stat Card ── */
function TokenCard({ label, value, sub, accent, bgAccent, icon, rank }) {
  return (
    <div className="caro-stat-card" style={{ position: "relative" }}>
      <div className="caro-stat-icon" style={{ background: bgAccent, color: accent }}>{icon}</div>
      <div className="caro-stat-label">{label}</div>
      <div className="caro-stat-value" style={{ color: accent || "#f8fafc" }}>{value}</div>
      <div className="caro-stat-sub">{sub}</div>

      {rank && (
        <div style={{ position: "absolute", bottom: 20, right: 20, fontSize: 10, fontWeight: 800, color: accent, opacity: 0.5, letterSpacing: "0.1em" }}>
          {rank}
        </div>
      )}
    </div>
  );
}

/* ── Batch Status Donut ── */
function PieChart({ pending, minted, rejected }) {
  const [hovered, setHovered] = useState(null);
  const total = pending + minted + rejected;

  const segments = [
    { label: "Chờ duyệt", count: pending,  color: "#f0b90b"  },
    { label: "Đã Mint",   count: minted,   color: "#B0E4CC" },
    { label: "Từ chối",   count: rejected, color: "#ef4444"   },
  ];

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <svg width={140} height={140} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={36} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={16} />
          <text x={50} y={48} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="600">Chưa có</text>
          <text x={50} y={60} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="600">lô hàng</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                <span style={{ color: "#94a3b8", fontWeight: 600 }}>{s.label}</span>
              </div>
              <span style={{ fontWeight: 700, color: "#64748b" }}>0</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cx = 50, cy = 50, r = 40, innerR = 24;
  let angle = -Math.PI / 2;

  const arcs = segments.map(seg => {
    if (seg.count === 0) return { ...seg, path: null, percentNum: 0 };
    const sweep = (seg.count / total) * 2 * Math.PI;
    const s = angle, e = angle + sweep;
    angle = e;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const ix1 = cx + innerR * Math.cos(s), iy1 = cy + innerR * Math.sin(s);
    const ix2 = cx + innerR * Math.cos(e), iy2 = cy + innerR * Math.sin(e);
    const la = sweep > Math.PI ? 1 : 0;
    return { ...seg, path: `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${la} 0 ${ix1} ${iy1} Z`, percentNum: seg.count / total * 100 };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      <div style={{ position: "relative" }}>
        {hovered !== null && arcs[hovered] && (
          <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", background: "#0f172a", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
            {arcs[hovered].label}: {arcs[hovered].count} ({formatPct(arcs[hovered].percentNum)})
          </div>
        )}
        <svg width={140} height={140} viewBox="0 0 100 100">
          {arcs.map((arc, i) => arc.path && (
            <path key={i} d={arc.path}
              fill={arc.color + (hovered === i ? "ff" : "dd")}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer", transition: "fill 0.2s", filter: hovered === i ? `drop-shadow(0 0 6px ${arc.color})` : "none" }}
            />
          ))}
          <text x={50} y={46} textAnchor="middle" fill="#f8fafc" fontSize={16} fontWeight="800">{total}</text>
          <text x={50} y={60} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight="600">Tổng lô</text>
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        {arcs.map((arc, i) => (
          <div key={i}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: hovered === i ? `${arc.color}15` : "transparent", borderRadius: 8, transition: "background 0.2s", cursor: "default" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: arc.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{arc.label}</span>
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800, color: arc.color, fontFamily: "monospace" }}>{arc.count}</span>
              <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6, fontWeight: 600 }}>({formatPct(arc.percentNum)})</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Activity Row ── */
function ActivityRow({ batch }) {
  const LOGISTICS_LABELS = {
    PENDING_PICKUP: "Chờ lấy hàng",
    IN_TRANSIT:     "Đang vận chuyển",
    DELIVERED:      "Đã đến nhà máy",
    STANDARDIZED:   "Đã chuẩn hóa",
    STORED:         "Đã nhập kho",
    INSPECTED:      "Đã kiểm định",
    MINTED:         "Đã đúc Token",
  };

  let label = "";
  let color = "#94a3b8";
  let bg = "transparent";
  let cls = "caro-badge-muted";
  let icon = "⚙️";

  if (batch.status === "MINTED") {
    label = "Đã Mint";
    color = "#B0E4CC";
    bg = "rgba(176, 228, 204,0.1)";
    cls = "caro-badge-success";
    icon = "🪙";
  } else if (batch.status === "REJECTED") {
    label = "Từ chối";
    color = "#ef4444";
    bg = "rgba(239,68,68,0.1)";
    cls = "caro-badge-danger";
    icon = "❌";
  } else if (batch.status === "APPROVED") {
    label = "Đã duyệt";
    color = "#408A71";
    bg = "rgba(64, 138, 113,0.1)";
    cls = "caro-badge-info";
    icon = "✅";
  } else if (batch.status === "PENDING_MINT_APPROVAL") {
    if (batch.logistics_status === "INSPECTED") {
      label = "Chờ duyệt";
      color = "#f0b90b";
      bg = "rgba(240,185,11,0.1)";
      cls = "caro-badge-warning";
      icon = "⏳";
    } else {
      label = LOGISTICS_LABELS[batch.logistics_status] || "Chờ lấy hàng";
      color = "#408A71";
      bg = "rgba(64, 138, 113,0.1)";
      cls = "caro-badge-info";
      icon = "🚚";
    }
  } else {
    label = batch.status || "—";
    cls = "caro-badge-muted";
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: "1px solid var(--border)", transition: "background 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace", marginBottom: 4 }}>
          {batch.batch_id}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {formatKg(Number(batch.quantity))} · {batch.coffee_type || "ROBUSTA"} · {new Date(batch.created_at).toLocaleDateString("vi-VN")}
        </div>
      </div>
      <span className={`caro-badge ${cls}`} style={{ flexShrink: 0 }}>
        {label}
      </span>
    </div>
  );
}

export default function FarmerDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();

  const dashQ   = useDashboard();
  const recentQ = useMyBatches({ limit: 8 });

  const tokenBals  = dashQ.data?.tokenBalances || {};
  const batchStats = dashQ.data?.batchStats    || {};

  const pending  = batchStats.PENDING_MINT_APPROVAL ?? 0;
  const minted   = batchStats.MINTED               ?? 0;
  const rejected = batchStats.REJECTED              ?? 0;
  const recent   = recentQ.data?.batches            || [];

  const isLoading = dashQ.isLoading;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Chào buổi sáng" : now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <FarmerLayout title="Trang chủ">
      <div className="caro-page">

        {/* ── Page Header ── */}
        <div className="caro-page-header">
          <div>
            <div className="caro-page-title">
              {greeting}, {user?.full_name?.split(" ").at(-1) || "Farmer"} 👋
            </div>
            <div className="caro-page-subtitle">
              Sàn giao dịch cà phê CaRo Robusta — Cổng Farmer · {now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="caro-btn caro-btn-ghost"
              onClick={() => nav("/farmer/marketplace")}
            >
              💹 Giao dịch
            </button>
            <button
              className="caro-btn caro-btn-primary"
              onClick={() => nav("/farmer/status/submit")}
            >
              + Gửi lô hàng
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {dashQ.isError && (
          <div style={{ padding: "16px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, fontSize: 14, color: "#ef4444", display: "flex", gap: 12, alignItems: "center", marginBottom: 24, fontWeight: 600 }}>
            ⚠️ Không thể tải dữ liệu dashboard. Kiểm tra kết nối và thử lại.
          </div>
        )}

        {/* ── Token Balances ── */}
        <div className="caro-grid-3" style={{ marginBottom: 24 }}>
          <TokenCard
            label="CaRo1 (Hạng A)"
            value={isLoading ? "…" : formatNumber(Number(tokenBals.caro1 || 0))}
            sub="CR1 · Robusta Cao cấp"
            accent="#B0E4CC"
            bgAccent="rgba(176, 228, 204,0.15)"
            icon="🥇"
            rank="GRADE A"
          />
          <TokenCard
            label="CaRo2 (Hạng B)"
            value={isLoading ? "…" : formatNumber(Number(tokenBals.caro2 || 0))}
            sub="CR2 · Robusta Tiêu chuẩn"
            accent="#408A71"
            bgAccent="rgba(64, 138, 113,0.15)"
            icon="🥈"
            rank="GRADE B"
          />
          <TokenCard
            label="CaRo3 (Hạng C)"
            value={isLoading ? "…" : formatNumber(Number(tokenBals.caro3 || 0))}
            sub="CR3 · Robusta Phổ thông"
            accent="#f0b90b"
            bgAccent="rgba(240,185,11,0.15)"
            icon="🥉"
            rank="GRADE C"
          />
        </div>

        {/* ── Dashboard Body ── */}
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, alignItems: "start", marginBottom: 24 }}>

          {/* Batch Status Donut */}
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header">
              <h3 className="caro-section-title">📊 Trạng thái lô hàng</h3>
              <button className="caro-btn caro-btn-sm caro-btn-ghost" onClick={() => nav("/farmer/status")}>
                Tất cả →
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <PieChart pending={pending} minted={minted} rejected={rejected} />
            </div>
          </div>

          {/* Recent Batches */}
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header">
              <h3 className="caro-section-title">📋 Lô hàng gần đây</h3>
              <button className="caro-btn caro-btn-sm caro-btn-ghost" onClick={() => nav("/farmer/status")}>
                Xem tất cả →
              </button>
            </div>
            <div>
              {recentQ.isLoading && (
                <div style={{ padding: "40px 0", color: "#64748b", fontSize: 14, textAlign: "center" }}>
                  <div style={{ animation: "caro-spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⏳</div>
                  Đang tải…
                </div>
              )}
              {!recentQ.isLoading && recent.length === 0 && (
                <div className="caro-empty">
                  <div className="caro-empty-icon">📭</div>
                  <div className="caro-empty-title">Chưa có lô hàng nào</div>
                  <button
                    className="caro-btn caro-btn-primary" style={{ marginTop: 16 }}
                    onClick={() => nav("/farmer/status/submit")}
                  >
                    + Gửi lô hàng đầu tiên
                  </button>
                </div>
              )}
              {recent.map(b => <ActivityRow key={b.id} batch={b} />)}
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="caro-grid-3">
          {[
            { icon: "📄", label: "Giấy tờ",       sub: "Liên kết với lô hàng",         path: "/farmer/warehouse-docs", accent: "#408A71"  },
            { icon: "💹", label: "Thị trường",     sub: "Mua & bán trên sàn giao dịch", path: "/farmer/marketplace",    accent: "#f0b90b"    },
            { icon: "👛", label: "Ví tài khoản",   sub: "Quản lý nạp rút số dư",        path: "/farmer/wallet",         accent: "#8b5cf6" },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{
                padding: "24px",
                background: "var(--card-bg)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                gap: 12
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = a.accent; e.currentTarget.style.boxShadow = `0 4px 12px ${a.accent}20`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ fontSize: 32 }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>{a.label}</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{a.sub}</div>
              </div>
            </button>
          ))}
        </div>

      </div>
    </FarmerLayout>
  );
}
