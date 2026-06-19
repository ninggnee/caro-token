import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#00d4aa", muted: "#6b7a99" };

function useAdminSummary() {
  return useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => axios.get("/admin/summary").then(r => r.data?.summary || {}),
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
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  );
}

function TaskItem({ label, count, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 13, color: "#e2e8f0" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color || (count > 0 ? C.gold : C.muted) }}>
        {count}
      </span>
    </div>
  );
}

function BatchPieChart({ pending, minted, rejected }) {
  const total = pending + minted + rejected;
  const segments = [
    { label: "Pending",  count: pending,  color: C.gold  },
    { label: "Minted",   count: minted,   color: C.green },
    { label: "Rejected", count: rejected, color: C.red   },
  ];

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <svg width={110} height={110} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={32} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
          <text x={50} y={53} textAnchor="middle" fill="#6b7a99" fontSize={9}>No batches</text>
        </svg>
        {segments.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
              <span style={{ fontSize: 12, color: "#e2e8f0" }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 12, color: C.muted }}>0</span>
          </div>
        ))}
      </div>
    );
  }

  const cx = 50, cy = 50, r = 36, innerR = 20;
  let angle = -Math.PI / 2;

  const arcs = segments.map((seg) => {
    if (seg.count === 0) return { ...seg, path: null, percent: "0.0" };
    const sweep = (seg.count / total) * 2 * Math.PI;
    const s = angle, e = angle + sweep;
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg width={110} height={110} viewBox="0 0 100 100">
        {arcs.map((arc, i) => arc.path && (
          <path key={i} d={arc.path} fill={arc.color + "bb"} style={{ transition: "fill 0.15s" }} />
        ))}
        <text x={50} y={47} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="bold">{total}</text>
        <text x={50} y={58} textAnchor="middle" fill="#6b7a99" fontSize={7}>Total Batches</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        {arcs.map((arc, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 7 }}>
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

export default function AdminHome() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: s, isLoading } = useAdminSummary();

  const val = (key) => isLoading ? "…" : (s?.[key] ?? 0);

  return (
    <DashboardLayout title="Dashboard">
      <div style={{ display: "grid", gap: 20, maxWidth: 1100 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Admin Dashboard 👋</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>CaRo Coffee RWA — Administration Portal</div>
          </div>
          <div style={{ background: "#141f2e", padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: C.muted }}>
            {user?.email} · Admin
          </div>
        </div>

        {/* Top stat cards — users */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <StatCard label="Total Farmers" value={val("totalFarmers")} sub="Registered farmers" accent="#e2e8f0" icon="🌱" />
          <StatCard label="Total Traders" value={val("totalTraders")} sub="Registered traders" accent="#e2e8f0" icon="💼" />
          <StatCard label="Total KYC"    value={val("totalKyc")}     sub="KYC submissions"   accent="#e2e8f0" icon="✅" />
          <StatCard label="Tokens Minted" value={Number(val("totalTokens")).toLocaleString()} sub="Total CaRo issued" accent={C.accent} icon="🪙" />
        </div>

        {/* Batch stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <StatCard label="Pending Batches"  value={val("pendingBatches")}  sub="Awaiting review"  accent={C.gold}  icon="⏳" />
          <StatCard label="Minted Batches"   value={val("mintedBatches")}   sub="Approved & minted" accent={C.green} icon="🏅" />
          <StatCard label="Rejected Batches" value={val("rejectedBatches")} sub="Rejected by admin" accent={C.red}   icon="❌" />
          <StatCard label="Total Coffee Minted" value={`${Number(val("totalBatchKg")).toLocaleString()} kg`} sub="Tokenized weight" accent={C.accent} icon="☕" />
        </div>

        {/* Pie chart + Tasks */}
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>

          {/* Batch status pie */}
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Batch Status</div>
              <button onClick={() => nav("/admin/batches")} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>View All →</button>
            </div>
            <BatchPieChart
              pending={s?.pendingBatches  || 0}
              minted={s?.mintedBatches    || 0}
              rejected={s?.rejectedBatches || 0}
            />
          </div>

          {/* Tasks panel */}
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>⚠️ Pending Tasks</div>
            <TaskItem label="Pending Batches" count={s?.pendingBatches || 0} color={C.gold} />
            <TaskItem label="KYC Pending"     count={s?.pendingKyc    || 0} color={C.gold} />
            <TaskItem label="Redeem Orders"   count={s?.redeemProcessing || 0} color={C.gold} />
            <TaskItem label="KYC Rejected"    count={s?.rejectedKyc   || 0} color={C.red}  />

            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { icon: "📦", label: "Asset Batches", path: "/admin/batches",      accent: C.accent },
                { icon: "✅", label: "KYC Approval",  path: "/admin/kyc",          accent: C.green  },
                { icon: "🔄", label: "Redeem Orders", path: "/admin/redeem-orders", accent: C.gold   },
                { icon: "👥", label: "Users",         path: "/admin/users",         accent: "#9b59b6"},
              ].map(a => (
                <button key={a.path} onClick={() => nav(a.path)}
                  style={{ padding: "12px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "border-color 0.15s, background 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = a.accent + "60"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                >
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{a.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Platform stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>Total Tokenized Weight</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#e2e8f0" }}>
              {isLoading ? "…" : `${Number(s?.totalBatchKg || 0).toLocaleString()} kg`}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Coffee successfully tokenized</div>
          </div>
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>Total Trading Volume</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#e2e8f0" }}>
              {isLoading ? "…" : `${Number(s?.totalVolumeVnd || 0).toLocaleString()} VNĐ`}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Cumulative exchange volume</div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
