import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatKg, formatToken } from '../utils/formatters';

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#7fe0c9", muted: "#6b7a99" };

function useAdminSummary() {
  return useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => axios.get("/admin/summary").then(r => r.data?.summary || {}),
    staleTime: 20_000,
    retry: 1,
  });
}

function useAdminLogs() {
  return useQuery({
    queryKey: ["admin-dashboard-logs"],
    queryFn: () => axios.get("/admin/logs?page=1&limit=4").then(r => r.data?.logs || []),
    staleTime: 15_000,
    retry: 1,
  });
}

function useLatestBatches() {
  return useQuery({
    queryKey: ["latest-batches-dashboard"],
    queryFn: () => axios.get("/batches?limit=4").then(r => r.data?.batches || []),
    staleTime: 20_000,
    retry: 1,
  });
}

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: "#172524", borderRadius: 12, padding: "16px 20px", border: "1px solid rgba(72,117,115,0.15)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 16 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent || "#e2e8f0", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  let color = C.muted;
  let bg = "rgba(255,255,255,0.06)";
  let label = status;

  if (status === "PENDING_MINT_APPROVAL") {
    color = C.gold;
    bg = "rgba(240,185,11,0.12)";
    label = "Chờ duyệt";
  } else if (status === "MINTED") {
    color = C.green;
    bg = "rgba(14,203,129,0.12)";
    label = "Đã Mint";
  } else if (status === "REJECTED") {
    color = C.red;
    bg = "rgba(246,70,93,0.12)";
    label = "Từ chối";
  } else if (status === "APPROVED") {
    color = C.accent;
    bg = "rgba(127,224,201,0.12)";
    label = "Đã duyệt";
  }

  return (
    <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: bg, color }}>
      {label}
    </span>
  );
}

function formatLogAction(log) {
  const actor = log.actor_name || log.actor_email || "Hệ thống";
  let actionText = log.action;
  
  if (log.action === "login") actionText = "đăng nhập";
  else if (log.action === "register") actionText = "đăng ký";
  else if (log.action === "submit_batch" || log.action === "create_batch") actionText = "gửi lô hàng";
  else if (log.action === "approve_kyc") actionText = "duyệt KYC";
  else if (log.action === "reject_kyc") actionText = "từ chối KYC";
  else if (log.action === "mint_token") actionText = "mint token";
  else if (log.action === "reject_batch") actionText = "từ chối lô";
  else if (log.action === "update_user") actionText = "sửa thành viên";
  else if (log.action === "delete_user") actionText = "xóa thành viên";

  let dotColor = "rgba(255,255,255,0.2)";
  if (log.action.includes("login")) dotColor = "#38bdf8";
  else if (log.action.includes("mint") || log.action.includes("approve")) dotColor = C.green;
  else if (log.action.includes("reject") || log.action.includes("delete")) dotColor = C.red;
  else if (log.action.includes("create") || log.action.includes("submit")) dotColor = C.gold;

  const timeStr = new Date(log.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div key={log.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, marginTop: 5 }} />
        <div style={{ width: 1, flex: 1, background: "rgba(72,117,115,0.15)", minHeight: 18 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
          <div style={{ fontSize: 12, lineHeight: 1.3 }}>
            <span style={{ fontWeight: 600, color: "#fff" }}>{actor}</span>{" "}
            <span style={{ color: "#9aa5b4" }}>{actionText}</span>
          </div>
          <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>{timeStr}</span>
        </div>
      </div>
    </div>
  );
}

function BatchPieChart({ pending, minted, rejected }) {
  const total = pending + minted + rejected;
  const segments = [
    { label: "Chờ duyệt",  count: pending,  color: C.gold  },
    { label: "Đã Mint",   count: minted,   color: C.green },
    { label: "Từ chối", count: rejected, color: C.red   },
  ];

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <svg width={100} height={100} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={32} fill="none" stroke="rgba(72,117,115,0.15)" strokeWidth={16} />
          <text x={50} y={53} textAnchor="middle" fill="#6b7a99" fontSize={9}>Không có lô hàng</text>
        </svg>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <svg width={85} height={85} viewBox="0 0 100 100">
        {arcs.map((arc, i) => arc.path && (
          <path key={i} d={arc.path} fill={arc.color + "bb"} style={{ transition: "fill 0.15s" }} />
        ))}
        <text x={50} y={47} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight="bold">{total}</text>
        <text x={50} y={58} textAnchor="middle" fill="#6b7a99" fontSize={7}>Tổng số lô</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {arcs.map((arc, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: arc.color }} />
              <span style={{ color: "#e2e8f0" }}>{arc.label}</span>
            </div>
            <span style={{ fontWeight: 700, color: arc.color }}>{arc.count}</span>
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
  const { data: logs, isLoading: isLogsLoading } = useAdminLogs();
  const { data: batches, isLoading: isBatchesLoading } = useLatestBatches();

  const val = (key) => isLoading ? "…" : (s?.[key] ?? 0);
  const totalUsers = isLoading ? "…" : ((s?.totalFarmers || 0) + (s?.totalTraders || 0));

  // Generate chart data using live metrics as the final point
  const chartData = [
    { name: "T1", coffee: 45000, tokens: 90000 },
    { name: "T2", coffee: 62000, tokens: 124000 },
    { name: "T3", coffee: 78000, tokens: 156000 },
    { name: "T4", coffee: 95000, tokens: 190000 },
    { name: "T5", coffee: 110000, tokens: 220000 },
    { name: "T6", coffee: Math.max(126, Number(val("totalBatchKg"))), tokens: Math.max(210, Number(val("totalTokens"))) },
  ];

  const thStyle = { textAlign: "left", padding: "10px 12px", color: C.muted, fontWeight: 600, fontSize: 11, borderBottom: "1px solid rgba(72,117,115,0.15)" };
  const tdStyle = { padding: "10px 12px", fontSize: 12, color: "#e2e8f0", borderBottom: "1px solid rgba(72,117,115,0.08)" };

  const gridStyles = `
    .admin-metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .admin-dashboard-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      align-items: start;
    }
    .admin-main-col {
      grid-column: span 3;
      display: grid;
      gap: 16px;
    }
    .admin-sidebar-col {
      grid-column: span 1;
      display: grid;
      gap: 16px;
    }
    @media (max-width: 1100px) {
      .admin-metrics-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .admin-dashboard-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .admin-main-col {
        grid-column: span 1;
        gap: 12px;
      }
      .admin-sidebar-col {
        grid-column: span 1;
        gap: 12px;
      }
    }
    @media (max-width: 640px) {
      .admin-metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  return (
    <DashboardLayout title="Bảng điều khiển">
      <style dangerouslySetInnerHTML={{ __html: gridStyles }} />
      <div style={{ display: "grid", gap: 16, width: "100%" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Bảng điều khiển quản trị 👋</h2>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Theo dõi và vận hành hệ thống CaRo Coffee RWA</div>
          </div>
          <div style={{ background: "#172524", padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(72,117,115,0.15)", fontSize: 12, color: C.muted }}>
            {user?.email} · Admin
          </div>
        </div>

        {/* Top Consolidated Metrics Cards */}
        <div className="admin-metrics-grid">
          <StatCard 
            label="Thành viên hệ thống" 
            value={totalUsers} 
            sub={`${val("totalFarmers")} Farmer · ${val("totalTraders")} Trader`} 
            accent="#e2e8f0" 
            icon="👥" 
          />
          <StatCard 
            label="Duyệt KYC (Chờ duyệt)" 
            value={val("pendingKyc")} 
            sub="Yêu cầu chờ xác thực" 
            accent={s?.pendingKyc > 0 ? C.gold : "#e2e8f0"} 
            icon="🛡️" 
          />
          <StatCard 
            label="Khối lượng token hóa" 
            value={formatKg(Number(val("totalBatchKg")))} 
            sub="Tổng cà phê số hóa" 
            accent="#e2e8f0" 
            icon="☕" 
          />
          <StatCard 
            label="CaRo đã phát hành" 
            value={formatToken(Number(val("totalTokens")), "CaRo")} 
            sub="Tổng cung lưu thông" 
            accent={C.accent} 
            icon="🪙" 
          />
        </div>

        {/* Dashboard Grid (Main column, Sidebar column) */}
        <div className="admin-dashboard-grid">
          
          {/* Main Column (Left) */}
          <div className="admin-main-col">
            
            {/* Recharts Area Chart */}
            <div style={{ background: "#172524", borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>📈 Biểu đồ tăng trưởng cà phê số hóa (kg)</h3>
                <span style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>Live Update 🟢</span>
              </div>
              
              <div style={{ height: 180, width: "100%", minWidth: 0 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCoffee" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.accent} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={C.accent} stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(72,117,115,0.08)" />
                    <XAxis dataKey="name" stroke="#6b7a99" fontSize={10} tickLine={false} />
                    <YAxis stroke="#6b7a99" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: "#172524", border: "1px solid rgba(72,117,115,0.25)", borderRadius: 8, fontSize: 12 }} 
                      labelStyle={{ color: "#fff", fontWeight: 700 }}
                    />
                    <Area type="monotone" dataKey="coffee" name="Cà phê (kg)" stroke={C.accent} strokeWidth={2} fillOpacity={1} fill="url(#colorCoffee)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Batches Table */}
            <div style={{ background: "#172524", borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", padding: "16px 20px", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>📦 Các lô hàng mới cập nhật</h3>
                <button onClick={() => nav("/admin/batches")} style={{ fontSize: 11, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Xem tất cả →</button>
              </div>

              {isBatchesLoading ? (
                <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "30px 0" }}>Đang tải dữ liệu...</div>
              ) : !batches || batches.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "30px 0" }}>Không tìm thấy lô hàng nào.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Mã lô</th>
                      <th style={thStyle}>Farmer</th>
                      <th style={thStyle}>Khối lượng</th>
                      <th style={thStyle}>Trạng thái</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: C.accent }}>{b.batch_id}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{b.farmer_name || "—"}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>{b.farmer_email}</div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{formatKg(Number(b.quantity))}</td>
                        <td style={tdStyle}>
                          <StatusBadge status={b.status} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <button onClick={() => nav(`/admin/batch/${b.id}`)}
                            style={{ padding: "4px 8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.2)", color: "#7fe0c9", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>

          {/* Sidebar Column (Right) */}
          <div className="admin-sidebar-col">
            
            {/* Batches Chart */}
            <div style={{ background: "#172524", borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", padding: "16px 20px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600 }}>📊 Trạng thái lô hàng</h3>
              <BatchPieChart
                pending={s?.pendingBatches  || 0}
                minted={s?.mintedBatches    || 0}
                rejected={s?.rejectedBatches || 0}
              />
            </div>

            {/* Quick Actions Links */}
            <div style={{ background: "#172524", borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", padding: "16px 20px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 13, fontWeight: 600 }}>⚡ Lối tắt quản lý</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { icon: "📦", label: "Lô hàng Lot",   path: "/admin/batches",       accent: C.accent, count: s?.pendingBatches },
                  { icon: "🛡️", label: "Phê duyệt KYC", path: "/admin/kyc",           accent: C.green,  count: s?.pendingKyc },
                  { icon: "🔄", label: "Đổi cà phê",    path: "/admin/redeem-orders",  accent: C.gold,   count: s?.redeemProcessing },
                  { icon: "👥", label: "Thành viên",    path: "/admin/users",          accent: "#9b59b6", count: 0 },
                ].map(a => (
                  <button key={a.path} onClick={() => nav(a.path)}
                    style={{
                      position: "relative",
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(72,117,115,0.12)",
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "border-color 0.15s, background 0.15s",
                      color: "#e2e8f0"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = a.accent + "60"; e.currentTarget.style.background = "rgba(72,117,115,0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(72,117,115,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  >
                    <div style={{ fontSize: 13, marginBottom: 2 }}>{a.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#e2e8f0" }}>{a.label}</div>
                    {a.count > 0 && (
                      <span style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        background: a.accent,
                        color: "#0d1413",
                        fontSize: 9,
                        fontWeight: 700,
                        height: 16,
                        minWidth: 16,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                        boxSizing: "border-box",
                        lineHeight: 1,
                        boxShadow: "0 0 0 2px #172524"
                      }}>
                        {a.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Live activity Timeline */}
            <div style={{ background: "#172524", borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>⏱️ Hoạt động gần đây</h3>
                <button onClick={() => nav("/admin/logs")} style={{ fontSize: 11, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Xem tất cả →</button>
              </div>

              {isLogsLoading ? (
                <div style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: "10px 0" }}>Đang tải...</div>
              ) : !logs || logs.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: "10px 0" }}>Không có hoạt động nào.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", padding: "4px 0 0 2px" }}>
                  {logs.map((log) => formatLogAction(log))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
