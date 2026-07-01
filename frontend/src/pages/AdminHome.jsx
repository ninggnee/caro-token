import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatKg, formatToken } from '../utils/formatters';

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
    queryFn: () => axios.get("/admin/logs?page=1&limit=5").then(r => r.data?.logs || []),
    staleTime: 15_000,
    retry: 1,
  });
}

function useLatestBatches() {
  return useQuery({
    queryKey: ["latest-batches-dashboard"],
    queryFn: () => axios.get("/batches?limit=5").then(r => r.data?.batches || []),
    staleTime: 20_000,
    retry: 1,
  });
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, accent, icon, iconBg }) {
  return (
    <div className="caro-stat-card" style={{ position: "relative" }}>
      <div className="caro-stat-icon" style={{ background: iconBg, color: accent }}>{icon}</div>
      <div className="caro-stat-label">{label}</div>
      <div className="caro-stat-value" style={{ color: accent || "#f8fafc" }}>{value}</div>
      {sub && <div className="caro-stat-sub">{sub}</div>}
    </div>
  );
}

/* ── Status Badge ── */
const LOGISTICS_LABELS = {
  PENDING_PICKUP: "Chờ lấy hàng",
  IN_TRANSIT:     "Đang vận chuyển",
  DELIVERED:      "Đã đến nhà máy",
  STANDARDIZED:   "Đã chuẩn hóa",
  STORED:         "Đã nhập kho",
  INSPECTED:      "Đã kiểm định",
  MINTED:         "Đã đúc Token",
};

function StatusBadge({ batch, status }) {
  const b = batch || {};
  const currentStatus = b.status || status;

  let label = "";
  let cls = "caro-badge-muted";

  if (currentStatus === "MINTED") {
    label = "Đã Mint";
    cls = "caro-badge-success";
  } else if (currentStatus === "REJECTED") {
    label = "Từ chối";
    cls = "caro-badge-danger";
  } else if (currentStatus === "APPROVED") {
    label = "Đã duyệt";
    cls = "caro-badge-info";
  } else if (currentStatus === "PENDING_MINT_APPROVAL") {
    if (b.logistics_status === "INSPECTED") {
      label = "Chờ duyệt";
      cls = "caro-badge-warning";
    } else {
      label = LOGISTICS_LABELS[b.logistics_status] || "Chờ lấy hàng";
      cls = "caro-badge-info";
    }
  } else {
    label = currentStatus || "—";
    cls = "caro-badge-muted";
  }

  return (
    <span className={`caro-badge ${cls}`}>
      {label}
    </span>
  );
}

/* ── Log Action Row ── */
function formatLogAction(log) {
  const actor = log.actor_name || log.actor_email || "Hệ thống";
  let actionText = log.action;
  if (log.action === "login")                                            actionText = "đã đăng nhập";
  else if (log.action === "register")                                    actionText = "vừa đăng ký";
  else if (log.action === "submit_batch" || log.action === "create_batch") actionText = "gửi lô hàng mới";
  else if (log.action === "approve_kyc")                                 actionText = "duyệt KYC thành công";
  else if (log.action === "reject_kyc")                                  actionText = "từ chối KYC";
  else if (log.action === "mint_token")                                  actionText = "đã mint token";
  else if (log.action === "reject_batch")                                actionText = "từ chối lô hàng";
  else if (log.action === "update_user")                                 actionText = "cập nhật thành viên";
  else if (log.action === "delete_user")                                 actionText = "xóa thành viên";

  let dotColor = "#94a3b8"; // default muted
  if (log.action.includes("login"))                                    dotColor = "#408A71";
  else if (log.action.includes("mint") || log.action.includes("approve")) dotColor = "#B0E4CC";
  else if (log.action.includes("reject") || log.action.includes("delete")) dotColor = "#ef4444";
  else if (log.action.includes("create") || log.action.includes("submit")) dotColor = "#f0b90b";

  const timeStr = new Date(log.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div key={log.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, marginTop: 4, boxShadow: `0 0 8px ${dotColor}` }} />
        <div style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 24, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          <strong style={{ color: "#f8fafc" }}>{actor}</strong>{" "}
          <span style={{ color: "#94a3b8" }}>{actionText}</span>
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: 600 }}>{timeStr}</div>
      </div>
    </div>
  );
}

/* ── Batch Donut ── */
function BatchPieChart({ pending, minted, rejected }) {
  const total = pending + minted + rejected;
  const segments = [
    { label: "Chờ duyệt", count: pending,  color: "#f0b90b"  },
    { label: "Đã Mint",   count: minted,   color: "#B0E4CC" },
    { label: "Từ chối",   count: rejected, color: "#ef4444"   },
  ];

  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width={80} height={80} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={36} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={16} />
          <text x={50} y={54} textAnchor="middle" fill="#64748b" fontSize={10} fontWeight="600">Trống</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
              <span style={{ color: "#94a3b8" }}>{s.label}</span>
              <span style={{ fontWeight: 800, color: "#64748b", marginLeft: "auto" }}>0</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cx = 50, cy = 50, r = 36, innerR = 20;
  let angle = -Math.PI / 2;
  const arcs = segments.map(seg => {
    if (seg.count === 0) return { ...seg, path: null };
    const sweep = (seg.count / total) * 2 * Math.PI;
    const s = angle, e = angle + sweep;
    angle = e;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const ix1 = cx + innerR * Math.cos(s), iy1 = cy + innerR * Math.sin(s);
    const ix2 = cx + innerR * Math.cos(e), iy2 = cy + innerR * Math.sin(e);
    const la = sweep > Math.PI ? 1 : 0;
    return { ...seg, path: `M ${ix1} ${iy1} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${la} 0 ${ix1} ${iy1} Z` };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={90} height={90} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        {arcs.map((arc, i) => arc.path && (
          <path key={i} d={arc.path} fill={arc.color} opacity={0.9} />
        ))}
        <text x={50} y={46} textAnchor="middle" fill="#f8fafc" fontSize={16} fontWeight="800">{total}</text>
        <text x={50} y={60} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight="600">lô hàng</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {arcs.map((arc, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: arc.color }} />
              <span style={{ color: "#94a3b8", fontWeight: 600 }}>{arc.label}</span>
            </div>
            <span style={{ fontWeight: 800, color: arc.color, fontFamily: "monospace" }}>{arc.count}</span>
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

  const chartData = [
    { name: "T1", coffee: 45000 },
    { name: "T2", coffee: 62000 },
    { name: "T3", coffee: 78000 },
    { name: "T4", coffee: 95000 },
    { name: "T5", coffee: 110000 },
    { name: "T6", coffee: Math.max(126, Number(val("totalBatchKg"))) },
  ];

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Chào buổi sáng" : now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <DashboardLayout title="Bảng điều khiển">
      <div className="caro-page">

        {/* ── Page Header ── */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">
              {greeting}, {user?.full_name?.split(" ").at(-1) || "Admin"} 👋
            </h2>
            <p className="caro-page-subtitle">
              Tổng quan vận hành · CaRo Coffee RWA Platform · {now.toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="caro-btn caro-btn-secondary" onClick={() => nav("/admin/kyc")}>
              🛡️ Xét duyệt KYC
            </button>
            <button className="caro-btn caro-btn-primary" onClick={() => nav("/admin/batches")}>
              📦 Duyệt lô hàng
            </button>
          </div>
        </div>

        {/* ── Top Metrics ── */}
        <div className="caro-grid-4" style={{ marginBottom: 24 }}>
          <StatCard
            label="Tổng thành viên"
            value={totalUsers}
            sub={`${val("totalFarmers")} Farmer · ${val("totalTraders")} Trader`}
            accent="#f8fafc"
            icon="👥"
            iconBg="rgba(139,92,246,0.15)"
          />
          <StatCard
            label="KYC chờ duyệt"
            value={val("pendingKyc")}
            sub="Yêu cầu xác thực danh tính"
            accent={s?.pendingKyc > 0 ? "#f0b90b" : "#f8fafc"}
            icon="🛡️"
            iconBg={s?.pendingKyc > 0 ? "rgba(240,185,11,0.15)" : "rgba(100,116,139,0.15)"}
          />
          <StatCard
            label="Khối lượng số hóa"
            value={formatKg(Number(val("totalBatchKg")))}
            sub="Tổng cà phê đã token hóa"
            accent="#408A71"
            icon="🫘"
            iconBg="rgba(64, 138, 113,0.15)"
          />
          <StatCard
            label="CaRo Token phát hành"
            value={formatToken(Number(val("totalTokens")), "CR")}
            sub="Tổng cung lưu thông hệ thống"
            accent="#B0E4CC"
            icon="🪙"
            iconBg="rgba(176, 228, 204,0.15)"
          />
        </div>

        {/* ── Main Body ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

          {/* Left: Chart + Table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Area Chart */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <div>
                  <h3 className="caro-section-title">📈 Tăng trưởng cà phê số hóa (kg)</h3>
                  <p className="caro-section-subtitle" style={{ margin: 0 }}>6 tháng gần nhất · Live data</p>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#B0E4CC", fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#B0E4CC", boxShadow: "0 0 10px rgba(176, 228, 204,0.8)", display: "inline-block" }} />
                  Đang live
                </span>
              </div>
              <div style={{ padding: "24px 24px 16px", height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#B0E4CC" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#B0E4CC" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, color: "#f8fafc", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}
                      labelStyle={{ color: "#f8fafc", fontWeight: 800, marginBottom: 4 }}
                      cursor={{ stroke: "rgba(176, 228, 204,0.3)", strokeWidth: 2 }}
                    />
                    <Area type="monotone" dataKey="coffee" name="Cà phê (kg)" stroke="#B0E4CC" strokeWidth={3} fillOpacity={1} fill="url(#areaGreen)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Batches Table */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <h3 className="caro-section-title">📦 Lô hàng mới cập nhật</h3>
                <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/admin/batches")}>
                  Xem tất cả →
                </button>
              </div>
              <div className="caro-table-container">
                {isBatchesLoading ? (
                  <div className="caro-empty">
                    <div style={{ width: "100%", height: 160, background: "rgba(255,255,255,0.02)", animation: "caro-spin 1.5s infinite" }} />
                  </div>
                ) : !batches || batches.length === 0 ? (
                  <div className="caro-empty" style={{ padding: "60px 0" }}>
                    <div className="caro-empty-icon">📭</div>
                    <div className="caro-empty-title">Không có lô hàng nào</div>
                  </div>
                ) : (
                  <table className="caro-table">
                    <thead>
                      <tr>
                        <th>Mã lô</th>
                        <th>Farmer</th>
                        <th>Khối lượng</th>
                        <th>Loại cà phê</th>
                        <th>Trạng thái</th>
                        <th style={{ textAlign: "right" }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.id}>
                          <td style={{ fontFamily: "monospace", fontSize: 13, color: "#408A71", fontWeight: 700 }}>{b.batch_id}</td>
                          <td>
                            <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 14 }}>{b.farmer_name || "—"}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{b.farmer_email}</div>
                          </td>
                          <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatKg(Number(b.quantity))}</td>
                          <td style={{ color: "#cbd5e1", fontSize: 13 }}>{b.coffee_type || "Robusta"}</td>
                          <td><StatusBadge batch={b} /></td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="caro-btn caro-btn-ghost caro-btn-sm"
                              onClick={() => nav(`/admin/batch/${b.id}`)}
                            >
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
          </div>

          {/* Right Aside */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Batch Donut */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <h3 className="caro-section-title">📊 Trạng thái lô hàng</h3>
              </div>
              <div style={{ padding: 24 }}>
                <BatchPieChart
                  pending={s?.pendingBatches  || 0}
                  minted={s?.mintedBatches    || 0}
                  rejected={s?.rejectedBatches || 0}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <h3 className="caro-section-title">⚡ Lối tắt nhanh</h3>
              </div>
              <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { icon: "📦", label: "Lô hàng", path: "/admin/batches",       accent: "#408A71",  count: s?.pendingBatches },
                  { icon: "🛡️", label: "KYC",     path: "/admin/kyc",           accent: "#B0E4CC",   count: s?.pendingKyc },
                  { icon: "🔄", label: "Đổi hàng", path: "/admin/redeem-orders", accent: "#f0b90b",    count: s?.redeemProcessing },
                  { icon: "👥", label: "Thành viên", path: "/admin/users",        accent: "#8b5cf6", count: 0 },
                ].map(a => (
                  <button key={a.path} onClick={() => nav(a.path)}
                    style={{
                      position: "relative",
                      padding: "16px 12px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${a.accent}15`; e.currentTarget.style.borderColor = a.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ fontSize: 24 }}>{a.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>{a.label}</div>
                    {a.count > 0 && (
                      <span style={{
                        position: "absolute", top: -6, right: -6,
                        background: a.accent, color: "#0f172a",
                        fontSize: 10, fontWeight: 800,
                        height: 20, minWidth: 20,
                        borderRadius: 10, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        padding: "0 6px",
                        boxShadow: `0 2px 8px ${a.accent}60`,
                      }}>
                        {a.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="caro-section-header">
                <h3 className="caro-section-title">⏱️ Hoạt động gần đây</h3>
                <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/admin/logs")}>
                  Tất cả →
                </button>
              </div>
              <div style={{ padding: "20px 20px 8px" }}>
                {isLogsLoading ? (
                  <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    <div style={{ animation: "caro-spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⏳</div>
                    Đang tải...
                  </div>
                ) : !logs || logs.length === 0 ? (
                  <div className="caro-empty" style={{ padding: "20px 0" }}>
                    <div className="caro-empty-icon" style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                    <div className="caro-empty-title" style={{ fontSize: 13 }}>Không có hoạt động nào.</div>
                  </div>
                ) : (
                  logs.map(log => formatLogAction(log))
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
