import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { useMyBatches } from "../hooks/useBatches";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#487573", muted: "#6b7a99" };

function useBalances(walletAddress) {
  return useQuery({
    queryKey: ["token-balances-onchain", walletAddress],
    queryFn: () => axios.get("/token/balances/onchain").then(r => r.data),
    staleTime: 30_000,
    retry: 1,
  });
}

function extractBal(bals, key) {
  const v = bals[key];
  return Number(v?.total ?? v ?? 0);
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: "#172524", borderRadius: 10, padding: "18px 20px", border: "1px solid rgba(72,117,115,0.15)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 18 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || "#e2e8f0", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#6b7a99" }}>{sub}</div>}
    </div>
  );
}

function PieChart({ pending, minted, rejected }) {
  const [hovered, setHovered] = useState(null);
  const total = pending + minted + rejected;

  const segments = [
    { label: "Đang chờ duyệt",   count: pending,  color: "#f0b90b" },
    { label: "Đã Mint",          count: minted,   color: "#0ecb81" },
    { label: "Bị từ chối",       count: rejected, color: "#f6465d" },
  ];

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0" }}>
        <svg width={130} height={130} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={32} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
          <text x={50} y={48} textAnchor="middle" fill="#6b7a99" fontSize={9}>Chưa có</text>
          <text x={50} y={59} textAnchor="middle" fill="#6b7a99" fontSize={8}>lô hàng</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span style={{ fontSize: 12, color: "#e2e8f0" }}>{s.label}</span>
              </div>
              <span style={{ fontSize: 12, color: C.muted }}>0</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cx = 50, cy = 50, r = 36, innerR = 20;
  let angle = -Math.PI / 2;

  const arcs = segments.map((seg) => {
    if (seg.count === 0) return { ...seg, path: null, percent: "0.0" };
    const sweep = (seg.count / total) * 2 * Math.PI;
    const s = angle;
    const e = angle + sweep;
    angle = e;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const ix1 = cx + innerR * Math.cos(s), iy1 = cy + innerR * Math.sin(s);
    const ix2 = cx + innerR * Math.cos(e), iy2 = cy + innerR * Math.sin(e);
    const la = sweep > Math.PI ? 1 : 0;
    return {
      ...seg,
      path: `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${la} 0 ${ix1} ${iy1} Z`,
      percent: (seg.count / total * 100).toFixed(1),
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative" }}>
        {hovered !== null && arcs[hovered] && (
          <div style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", background: "#1e3130", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#e2e8f0", whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none" }}>
            {arcs[hovered].label}: {arcs[hovered].count} lô hàng ({arcs[hovered].percent}%)
          </div>
        )}
        <svg width={130} height={130} viewBox="0 0 100 100">
          {arcs.map((arc, i) => arc.path && (
            <path key={i} d={arc.path}
              fill={arc.color + (hovered === i ? "ff" : "bb")}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer", transition: "fill 0.15s" }} />
          ))}
          <text x={50} y={47} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="bold">{total}</text>
          <text x={50} y={58} textAnchor="middle" fill="#6b7a99" fontSize={7}>Tổng số lô</text>
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        {arcs.map((arc, i) => (
          <div key={i}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: hovered === i ? `${arc.color}18` : "transparent", borderRadius: 7, transition: "background 0.15s", cursor: "default" }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: arc.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#e2e8f0" }}>{arc.label}</span>
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: arc.color }}>{arc.count}</span>
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 5 }}>({arc.percent}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ batch }) {
  const meta = {
    PENDING_MINT_APPROVAL: { label: "Đang duyệt", color: C.gold,   dot: "#f0b90b" },
    MINTED:                { label: "Đã Mint",    color: C.green,  dot: "#0ecb81" },
    REJECTED:              { label: "Từ chối",    color: C.red,    dot: "#f6465d" },
    APPROVED:              { label: "Đã duyệt",   color: C.accent, dot: "#487573" },
  };
  const m = meta[batch.status] || { label: batch.status, color: C.muted, dot: C.muted };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{batch.batch_id}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{Number(batch.quantity).toLocaleString()} kg · {batch.coffee_type || "ROBUSTA"} · {new Date(batch.created_at).toLocaleDateString("vi-VN")}</div>
      </div>
      <div style={{ fontSize: 12, color: m.color, fontWeight: 600, flexShrink: 0 }}>{m.label}</div>
    </div>
  );
}

export default function FarmerDashboard() {
  const nav = useNavigate();
  const { account } = useWallet();
  const { user } = useAuth();
  const balQ    = useBalances(account || user?.wallet_address);
  const pendQ   = useMyBatches({ status: "PENDING_MINT_APPROVAL", limit: 1 });
  const mintQ   = useMyBatches({ status: "MINTED",                limit: 1 });
  const rejectQ = useMyBatches({ status: "REJECTED",              limit: 1 });
  const recentQ = useMyBatches({ limit: 8 });

  const bals = balQ.data?.balances || {};

  const pending  = pendQ.data?.total   ?? 0;
  const minted   = mintQ.data?.total   ?? 0;
  const rejected = rejectQ.data?.total ?? 0;
  const recent   = recentQ.data?.batches || [];

  const gridStyles = `
    .farmer-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .farmer-dashboard-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .farmer-sidebar-col {
      grid-column: span 1;
      display: flex;
      flex-direction: column;
    }
    .farmer-main-col {
      grid-column: span 2;
      display: flex;
      flex-direction: column;
    }
    @media (max-width: 1024px) {
      .farmer-grid-3 {
        grid-template-columns: repeat(2, 1fr);
      }
      .farmer-dashboard-row {
        grid-template-columns: 1fr;
      }
      .farmer-sidebar-col, .farmer-main-col {
        grid-column: span 1;
      }
    }
    @media (max-width: 640px) {
      .farmer-grid-3 {
        grid-template-columns: 1fr;
      }
    }
  `;

  return (
    <FarmerLayout title="Bảng điều khiển">
      <style dangerouslySetInnerHTML={{ __html: gridStyles }} />
      <div style={{ display: "grid", gap: 20, width: "100%" }}>

        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Chào mừng trở lại, {user?.full_name?.split(" ").at(-1) || "Farmer"} 👋</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Sàn giao dịch cà phê CaRo Robusta — Cổng Farmer</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/farmer/status/submit")}
              style={{ padding: "8px 18px", background: "#487573", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              + Gửi lô hàng
            </button>
            <button onClick={() => nav("/farmer/marketplace")}
              style={{ padding: "8px 16px", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", border: "1px solid rgba(72,117,115,0.15)", borderRadius: 7, cursor: "pointer", fontSize: 13 }}>
              Giao dịch
            </button>
          </div>
        </div>

        {/* CaRo1 / CaRo2 / CaRo3 live on-chain cards */}
        <div className="farmer-grid-3">
          <StatCard
            label="CaRo1 (Hạng A)"
            value={balQ.isLoading ? "…" : Number(bals.CR1 || 0).toLocaleString("vi-VN")}
            sub="CR1 · Robusta Cao cấp · on-chain"
            accent={C.green}
            icon="🥇"
          />
          <StatCard
            label="CaRo2 (Hạng B)"
            value={balQ.isLoading ? "…" : Number(bals.CR2 || 0).toLocaleString("vi-VN")}
            sub="CR2 · Robusta Tiêu chuẩn · on-chain"
            accent={C.accent}
            icon="🥈"
          />
          <StatCard
            label="CaRo3 (Hạng C)"
            value={balQ.isLoading ? "…" : Number(bals.CR3 || 0).toLocaleString("vi-VN")}
            sub="CR3 · Robusta Phổ thông · on-chain"
            accent={C.gold}
            icon="🥉"
          />
        </div>

        {/* Pie Chart + Recent Batches */}
        <div className="farmer-dashboard-row">

          {/* Batch Status Pie Chart */}
          <div className="farmer-sidebar-col" style={{ background: "#172524", borderRadius: 10, border: "1px solid rgba(72,117,115,0.15)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(72,117,115,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Trạng thái lô hàng</div>
              <button onClick={() => nav("/farmer/status")} style={{ fontSize: 12, color: "#7fe0c9", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Tất cả →</button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
              <PieChart pending={pending} minted={minted} rejected={rejected} />
            </div>
          </div>

          {/* Recent Batches */}
          <div className="farmer-main-col" style={{ background: "#172524", borderRadius: 10, border: "1px solid rgba(72,117,115,0.15)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(72,117,115,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Lô hàng gần đây</div>
              <button onClick={() => nav("/farmer/status")} style={{ fontSize: 12, color: "#7fe0c9", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Xem tất cả →</button>
            </div>
            <div style={{ padding: "4px 20px 8px" }}>
              {recentQ.isLoading && <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>Đang tải…</div>}
              {!recentQ.isLoading && recent.length === 0 && (
                <div style={{ padding: "24px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  Chưa có lô hàng nào.{" "}
                  <button onClick={() => nav("/farmer/status/submit")} style={{ color: "#7fe0c9", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Gửi lô hàng đầu tiên của bạn →</button>
                </div>
              )}
              {recent.map(b => <ActivityRow key={b.id} batch={b} />)}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="farmer-grid-3">
          {[
            { icon: "📁", label: "Chứng từ kho",   sub: "Xem các tệp tài liệu đã tải lên",   path: "/farmer/warehouse-docs", accent: "#0095ff" },
            { icon: "💹", label: "Chợ giao dịch",   sub: "Mua & bán trên sàn giao dịch",    path: "/farmer/marketplace", accent: "#f0b90b" },
            { icon: "👛", label: "Ví tài khoản",    sub: "Quản lý nạp rút số dư",           path: "/farmer/wallet",      accent: "#9b59b6" },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{ padding: "16px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#487573"; e.currentTarget.style.background = "rgba(72,117,115,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(72,117,115,0.15)"; e.currentTarget.style.background = "#172524"; }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{a.label}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </FarmerLayout>
  );
}
