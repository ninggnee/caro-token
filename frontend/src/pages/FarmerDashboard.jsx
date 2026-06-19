import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useMyBatches } from "../hooks/useBatches";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#00d4aa", muted: "#6b7a99" };

function useBalances() {
  return useQuery({
    queryKey: ["token-balances-onchain"],
    queryFn: () => axios.get("/token/balances/onchain").then(r => r.data),
    staleTime: 30_000,
    retry: 1,
  });
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: "#141f2e", borderRadius: 10, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: 6 }}>
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
    { label: "Pending Approval", count: pending,  color: "#f0b90b" },
    { label: "Minted",           count: minted,   color: "#0ecb81" },
    { label: "Rejected",         count: rejected, color: "#f6465d" },
  ];

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0" }}>
        <svg width={130} height={130} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={32} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
          <text x={50} y={48} textAnchor="middle" fill="#6b7a99" fontSize={9}>No batches</text>
          <text x={50} y={59} textAnchor="middle" fill="#6b7a99" fontSize={8}>yet</text>
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
          <div style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", background: "#1a2332", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#e2e8f0", whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none" }}>
            {arcs[hovered].label}: {arcs[hovered].count} batches ({arcs[hovered].percent}%)
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
          <text x={50} y={58} textAnchor="middle" fill="#6b7a99" fontSize={7}>Total Batches</text>
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
    PENDING_MINT_APPROVAL: { label: "Pending Review", color: C.gold,   dot: "#f0b90b" },
    MINTED:                { label: "Minted",         color: C.green,  dot: "#0ecb81" },
    REJECTED:              { label: "Rejected",       color: C.red,    dot: "#f6465d" },
    APPROVED:              { label: "Approved",       color: C.accent, dot: "#00d4aa" },
  };
  const m = meta[batch.status] || { label: batch.status, color: C.muted, dot: C.muted };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{batch.batch_id}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{Number(batch.quantity).toLocaleString()} kg · {batch.coffee_type || "ROBUSTA"} · {new Date(batch.created_at).toLocaleDateString("en-GB")}</div>
      </div>
      <div style={{ fontSize: 12, color: m.color, fontWeight: 600, flexShrink: 0 }}>{m.label}</div>
    </div>
  );
}

export default function FarmerDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const balQ    = useBalances();
  const pendQ   = useMyBatches({ status: "PENDING_MINT_APPROVAL", limit: 1 });
  const mintQ   = useMyBatches({ status: "MINTED",                limit: 1 });
  const rejectQ = useMyBatches({ status: "REJECTED",              limit: 1 });
  const recentQ = useMyBatches({ limit: 8 });

  const bals = balQ.data?.balances || {};
  // on-chain response: { CR1: "150.0", CR2: "0.0", CR3: "0.0" } — plain string per token

  const pending  = pendQ.data?.total   ?? 0;
  const minted   = mintQ.data?.total   ?? 0;
  const rejected = rejectQ.data?.total ?? 0;
  const recent   = recentQ.data?.batches || [];

  return (
    <FarmerLayout title="Dashboard">
      <div style={{ display: "grid", gap: 20, maxWidth: 1100 }}>

        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Welcome back, {user?.full_name?.split(" ").at(-1) || "Farmer"} 👋</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>CaRo Coffee RWA Exchange — Farmer Portal</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/farmer/assets/submit")}
              style={{ padding: "8px 18px", background: "#00d4aa", color: "#000", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              + Submit Batch
            </button>
            <button onClick={() => nav("/farmer/marketplace")}
              style={{ padding: "8px 16px", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, cursor: "pointer", fontSize: 13 }}>
              Trade
            </button>
          </div>
        </div>

        {/* CaRo1 / CaRo2 / CaRo3 live on-chain cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <StatCard
            label="CaRo1 (Grade A)"
            value={balQ.isLoading ? "…" : Number(bals.CR1 || 0).toLocaleString("vi-VN")}
            sub="CR1 · Premium Robusta · live on-chain"
            accent={C.green}
            icon="🥇"
          />
          <StatCard
            label="CaRo2 (Grade B)"
            value={balQ.isLoading ? "…" : Number(bals.CR2 || 0).toLocaleString("vi-VN")}
            sub="CR2 · Standard Robusta · live on-chain"
            accent={C.accent}
            icon="🥈"
          />
          <StatCard
            label="CaRo3 (Grade C)"
            value={balQ.isLoading ? "…" : Number(bals.CR3 || 0).toLocaleString("vi-VN")}
            sub="CR3 · Basic Robusta · live on-chain"
            accent={C.gold}
            icon="🥉"
          />
        </div>

        {/* Pie Chart + Recent Batches */}
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>

          {/* Batch Status Pie Chart */}
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Batch Status</div>
              <button onClick={() => nav("/farmer/assets")} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>All →</button>
            </div>
            <PieChart pending={pending} minted={minted} rejected={rejected} />
          </div>

          {/* Recent Batches */}
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Recent Batches</div>
              <button onClick={() => nav("/farmer/assets")} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>View All →</button>
            </div>
            <div style={{ padding: "4px 20px 8px" }}>
              {recentQ.isLoading && <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>Loading…</div>}
              {!recentQ.isLoading && recent.length === 0 && (
                <div style={{ padding: "24px 0", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  No batches yet.{" "}
                  <button onClick={() => nav("/farmer/assets/submit")} style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Submit your first batch →</button>
                </div>
              )}
              {recent.map(b => <ActivityRow key={b.id} batch={b} />)}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { icon: "📁", label: "My Documents",  sub: "View uploaded files",       path: "/farmer/warehouse-docs", accent: "#0095ff" },
            { icon: "💹", label: "Marketplace",   sub: "Buy & sell on exchange",    path: "/farmer/marketplace", accent: "#f0b90b" },
            { icon: "👛", label: "Wallet",        sub: "Manage balances",           path: "/farmer/wallet",      accent: "#9b59b6" },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{ padding: "16px 14px", background: "#141f2e", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = a.accent + "50"; e.currentTarget.style.background = "#18283e"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "#141f2e"; }}
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
