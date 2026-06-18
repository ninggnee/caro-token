import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useMyBatches } from "../hooks/useBatches";
import axios from "../utils/axiosClient";

const PRICE = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };
const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#00d4aa", muted: "#6b7a99" };

function useBalances() {
  return useQuery({
    queryKey: ["token-balances"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 30_000,
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

function TokenRow({ type, avail, locked }) {
  const val = avail * PRICE[type];
  return (
    <tr>
      <td style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#1a5c54,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{type}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>CaRo {type}</div>
            <div style={{ fontSize: 10, color: C.muted }}>Robusta Coffee</div>
          </div>
        </div>
      </td>
      <td style={{ padding: "10px 16px", fontSize: 14, fontWeight: 600, color: "#e2e8f0", textAlign: "right" }}>
        {avail > 0 ? Number(avail).toLocaleString("vi-VN") : "0"} kg
      </td>
      <td style={{ padding: "10px 16px", textAlign: "right" }}>
        <div style={{ fontSize: 13, color: "#e2e8f0" }}>{val > 0 ? val.toLocaleString("vi-VN") + " ₫" : "—"}</div>
        {locked > 0 && <div style={{ fontSize: 10, color: C.gold }}>{Number(locked).toLocaleString()} locked</div>}
      </td>
      <td style={{ padding: "10px 16px", textAlign: "right" }}>
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: avail > 0 ? "rgba(14,203,129,0.1)" : "rgba(255,255,255,0.05)", color: avail > 0 ? C.green : C.muted, fontWeight: 600 }}>
          {avail > 0 ? "Active" : "Empty"}
        </span>
      </td>
    </tr>
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
        <div style={{ fontSize: 11, color: C.muted }}>{Number(batch.quantity).toLocaleString()} kg · {batch.quality_grade} · {new Date(batch.created_at).toLocaleDateString("en-GB")}</div>
      </div>
      <div style={{ fontSize: 12, color: m.color, fontWeight: 600, flexShrink: 0 }}>{m.label}</div>
    </div>
  );
}

function MiniChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, background: i === data.length - 1 ? "#00d4aa" : "rgba(0,212,170,0.3)", borderRadius: "3px 3px 0 0", height: `${Math.max((v / max) * 100, 8)}%`, transition: "height 0.3s" }} />
      ))}
    </div>
  );
}

export default function FarmerDashboard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const balQ = useBalances();
  const pendQ = useMyBatches({ status: "PENDING_MINT_APPROVAL", limit: 1 });
  const mintQ = useMyBatches({ status: "MINTED", limit: 1 });
  const rejectQ = useMyBatches({ status: "REJECTED", limit: 1 });
  const recentQ = useMyBatches({ limit: 8 });

  const bals = balQ.data?.balances || {};
  const tokens = ["CR1", "CR2", "CR3"];

  const totalVnd = tokens.reduce((s, t) => s + Number(bals[t]?.available_balance || 0) * PRICE[t], 0);
  const totalKg  = tokens.reduce((s, t) => s + Number(bals[t]?.available_balance || 0), 0);
  const pending  = pendQ.data?.total ?? 0;
  const minted   = mintQ.data?.total ?? 0;
  const rejected = rejectQ.data?.total ?? 0;
  const recent   = recentQ.data?.batches || [];

  const mockChart = [40, 65, 50, 80, 70, 90, totalKg > 0 ? 100 : 85];

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

        {/* 5 stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          <StatCard label="Total Portfolio" value={totalVnd > 0 ? (totalVnd / 1_000_000).toFixed(1) + "M ₫" : "—"} sub="Estimated value" accent="#e2e8f0" icon="💼" />
          <StatCard label="CR1 Balance"  value={Number(bals.CR1?.available_balance || 0).toLocaleString()} sub="Grade CR1 · 100K₫/kg" accent={C.green}  icon="🥇" />
          <StatCard label="CR2 Balance"  value={Number(bals.CR2?.available_balance || 0).toLocaleString()} sub="Grade CR2 · 85K₫/kg"  accent={C.accent} icon="🥈" />
          <StatCard label="CR3 Balance"  value={Number(bals.CR3?.available_balance || 0).toLocaleString()} sub="Grade CR3 · 70K₫/kg"  accent={C.gold}   icon="🥉" />
          <StatCard label="Pending Mint" value={pending}               sub={`${minted} minted · ${rejected} rejected`} accent={C.gold}   icon="⏳" />
        </div>

        {/* Token Holdings + Batch Status */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

          {/* Token Holdings */}
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Token Holdings</div>
              <button onClick={() => nav("/farmer/wallet")} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>View Wallet →</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <th style={{ padding: "8px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>Token</th>
                  <th style={{ padding: "8px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "right", textTransform: "uppercase", letterSpacing: "0.5px" }}>Balance</th>
                  <th style={{ padding: "8px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "right", textTransform: "uppercase", letterSpacing: "0.5px" }}>Value</th>
                  <th style={{ padding: "8px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "right", textTransform: "uppercase", letterSpacing: "0.5px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map(t => (
                  <TokenRow key={t} type={t}
                    avail={Number(bals[t]?.available_balance || 0)}
                    locked={Number(bals[t]?.locked_balance || 0)}
                  />
                ))}
              </tbody>
            </table>
            {balQ.isLoading && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.muted }}>Loading balances…</div>}
          </div>

          {/* Batch Status + Chart */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Batch status */}
            <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: 16, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                Batch Status
                <button onClick={() => nav("/farmer/assets")} style={{ fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>All →</button>
              </div>
              {[
                { label: "Pending Approval", count: pending, color: C.gold,   path: "/farmer/assets/pending",  bg: "rgba(240,185,11,0.08)"  },
                { label: "Minted",           count: minted,  color: C.green,  path: "/farmer/assets/minted",   bg: "rgba(14,203,129,0.08)"  },
                { label: "Rejected",         count: rejected,color: C.red,    path: "/farmer/assets/rejected", bg: "rgba(246,70,93,0.08)"   },
              ].map(it => (
                <button key={it.label} onClick={() => nav(it.path)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: it.bg, border: `1px solid ${it.color}20`, borderRadius: 8, cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
                  <div style={{ fontSize: 13, color: "#e2e8f0" }}>{it.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: it.color }}>{it.count}</div>
                </button>
              ))}
              <button onClick={() => nav("/farmer/assets/submit")} style={{ width: "100%", padding: "10px 12px", background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 8, color: C.accent, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                + Submit New Batch
              </button>
            </div>

            {/* Mini chart */}
            <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Portfolio (7d)</div>
              <MiniChart data={mockChart} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Total: {totalKg.toLocaleString()} kg</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
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

        {/* Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { icon: "📦", label: "Submit Batch",  sub: "New tokenization request", path: "/farmer/assets/submit",  accent: "#00d4aa" },
            { icon: "📁", label: "My Documents",  sub: "View uploaded files",       path: "/farmer/documents",      accent: "#0095ff" },
            { icon: "💹", label: "Trade Tokens",  sub: "Buy & sell on exchange",    path: "/farmer/marketplace",    accent: "#f0b90b" },
            { icon: "👛", label: "Wallet",        sub: "Manage balances",           path: "/farmer/wallet",         accent: "#9b59b6" },
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
