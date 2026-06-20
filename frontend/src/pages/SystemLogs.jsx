import { useEffect, useState, Fragment } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from "../utils/axiosClient";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#7fe0c9", muted: "#6b7a99" };

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Filters
  const [actionInput, setActionInput] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorIdInput, setActorIdInput] = useState("");
  const [actorIdFilter, setActorIdFilter] = useState("");
  const [entityType, setEntityType] = useState("all");

  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = `/admin/logs?page=${page}&limit=${limit}`;
      if (actionFilter) url += `&action=${encodeURIComponent(actionFilter)}`;
      if (actorIdFilter) url += `&actor_id=${encodeURIComponent(actorIdFilter)}`;
      if (entityType !== "all") url += `&entity_type=${encodeURIComponent(entityType)}`;

      const res = await axios.get(url);
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      console.error(err);
      // fallback silent error or user alert
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, actorIdFilter, entityType]);

  const handleSearch = (e) => {
    e.preventDefault();
    setActionFilter(actionInput);
    setActorIdFilter(actorIdInput);
    setPage(1);
  };

  const handleClear = () => {
    setActionInput("");
    setActionFilter("");
    setActorIdInput("");
    setActorIdFilter("");
    setEntityType("all");
    setPage(1);
  };

  const getActionBadge = (action) => {
    let bg = "rgba(255,255,255,0.06)";
    let color = "#e2e8f0";

    if (action.includes("login")) {
      bg = "rgba(56,189,248,0.12)";
      color = "#38bdf8";
    } else if (action.includes("mint")) {
      bg = "rgba(14,203,129,0.12)";
      color = "#0ecb81";
    } else if (action.includes("reject")) {
      bg = "rgba(246,70,93,0.12)";
      color = "#f6465d";
    } else if (action.includes("approve") || action.includes("accept")) {
      bg = "rgba(127,224,201,0.12)";
      color = "#7fe0c9";
    } else if (action.includes("create") || action.includes("submit")) {
      bg = "rgba(240,185,11,0.12)";
      color = "#f0b90b";
    }

    return (
      <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: bg, color, fontFamily: "monospace" }}>
        {action}
      </span>
    );
  };

  const formatJson = (data) => {
    if (!data) return "N/A";
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return String(data);
    }
  };

  return (
    <DashboardLayout title="Nhật ký hệ thống">
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
        .json-box {
          background: #0d1413;
          border: 1px solid rgba(72,117,115,0.15);
          border-radius: 8px;
          padding: 12px;
          font-family: monospace;
          font-size: 11px;
          color: #a7f3d0;
          overflow-x: auto;
          white-space: pre-wrap;
          max-height: 250px;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>📋 Nhật ký hệ thống (Audit Logs)</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Ghi nhận toàn bộ thao tác quan trọng bao gồm Đăng nhập, KYC, Lô hàng, Giao dịch và Phát hành token.</p>
      </div>

      {/* Filter panel */}
      <form onSubmit={handleSearch} style={{ background: "#172524", padding: 16, borderRadius: 12, border: "1px solid rgba(72,117,115,0.15)", marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>Thao tác (Action)</label>
          <input
            type="text"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="VD: user:login, batch:mint..."
            style={{ background: "#0d1413", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>Loại thực thể (Entity)</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            style={{ background: "#0d1413", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none", height: 37 }}
          >
            <option value="all">Tất cả thực thể</option>
            <option value="user">User (Thành viên)</option>
            <option value="asset_batch">Asset Batch (Lô hàng)</option>
            <option value="kyc_request">KYC Request (Hồ sơ danh tính)</option>
            <option value="order">Order (Đơn giao dịch)</option>
            <option value="wallet">Wallet / Balance (Ví tiền)</option>
            <option value="redeem_request">Redeem (Đổi cà phê)</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 130 }}>
          <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase" }}>Mã người dùng (ID)</label>
          <input
            type="number"
            value={actorIdInput}
            onChange={(e) => setActorIdInput(e.target.value)}
            placeholder="VD: 1, 2"
            style={{ background: "#0d1413", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" style={{ padding: "9px 20px", background: "#487573", border: "none", color: "#fff", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            Tìm kiếm
          </button>
          <button type="button" onClick={handleClear} style={{ padding: "9px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(72,117,115,0.15)", color: C.muted, borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            Đặt lại
          </button>
        </div>
      </form>

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#172524", borderRadius: 10, border: "1px solid rgba(72,117,115,0.15)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.01)", borderBottom: "1px solid rgba(72,117,115,0.15)" }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Thời gian</th>
              <th style={thStyle}>Người thực hiện</th>
              <th style={thStyle}>Thao tác (Action)</th>
              <th style={thStyle}>Đối tượng thực thể</th>
              <th style={thStyle}>Địa chỉ IP</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Chi tiết</th>
            </tr>
          </thead>

          {loading ? (
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(72,117,115,0.1)" }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                    <td key={j} style={{ padding: "14px" }}>
                      <div style={{ height: 12, background: "rgba(72,117,115,0.08)", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : logs.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 50, color: C.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                  <div>Không tìm thấy nhật ký hệ thống nào</div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const dateStr = new Date(log.created_at).toLocaleString("vi-VN");
                return (
                  <Fragment key={log.id}>
                    <tr style={{ borderBottom: isExpanded ? "none" : "1px solid rgba(72,117,115,0.08)", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(72,117,115,0.03)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      
                      <td style={tdStyle}>{log.id}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{dateStr}</td>
                      <td style={tdStyle}>
                        {log.actor_name || log.actor_email ? (
                          <div>
                            <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{log.actor_name || "—"}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{log.actor_email || `ID: ${log.actor_id}`}</div>
                          </div>
                        ) : (
                          <span style={{ color: C.muted }}>Hệ thống / Khách</span>
                        )}
                      </td>
                      <td style={tdStyle}>{getActionBadge(log.action)}</td>
                      <td style={tdStyle}>
                        {log.entity_type ? (
                          <div>
                            <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{log.entity_type}</span>
                            {log.entity_id && <span style={{ color: C.accent, marginLeft: 6, fontWeight: 600 }}>#{log.entity_id}</span>}
                          </div>
                        ) : (
                          <span style={{ color: C.muted }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace" }}>{log.ip_address || "127.0.0.1"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          style={{
                            padding: "4px 10px",
                            background: isExpanded ? "rgba(72,117,115,0.2)" : "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(72,117,115,0.25)",
                            color: "#7fe0c9",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 11,
                            fontWeight: 600
                          }}
                        >
                          {isExpanded ? "Thu gọn ▲" : "Xem chi tiết ▼"}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ borderBottom: "1px solid rgba(72,117,115,0.08)", background: "rgba(0,0,0,0.15)" }}>
                        <td colSpan={7} style={{ padding: "12px 20px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Dữ liệu cũ (Old Data)</div>
                              <pre className="json-box">{formatJson(log.old_data)}</pre>
                            </div>
                            <div>
                              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Dữ liệu mới (New Data)</div>
                              <pre className="json-box">{formatJson(log.new_data)}</pre>
                            </div>
                          </div>
                          {log.user_agent && (
                            <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
                              <span style={{ fontWeight: 600 }}>Thiết bị (User Agent):</span> {log.user_agent}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 20 }}>
          <button onClick={() => setPage(1)} disabled={page === 1}
            style={{ padding: "6px 12px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: page === 1 ? C.muted : "#e2e8f0", borderRadius: 6, cursor: page === 1 ? "default" : "pointer", fontSize: 12 }}>«</button>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
            style={{ padding: "6px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: page === 1 ? C.muted : "#e2e8f0", borderRadius: 6, cursor: page === 1 ? "default" : "pointer", fontSize: 12 }}>← Trước</button>
          <span style={{ padding: "6px 14px", color: C.muted, fontSize: 13 }}>Trang {page} / {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < limit}
            style={{ padding: "6px 14px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: logs.length < limit ? C.muted : "#e2e8f0", borderRadius: 6, cursor: logs.length < limit ? "default" : "pointer", fontSize: 12 }}>Sau →</button>
          <button onClick={() => setPage(Math.ceil(total / limit))} disabled={logs.length < limit}
            style={{ padding: "6px 12px", background: "#172524", border: "1px solid rgba(72,117,115,0.15)", color: logs.length < limit ? C.muted : "#e2e8f0", borderRadius: 6, cursor: logs.length < limit ? "default" : "pointer", fontSize: 12 }}>»</button>
        </div>
      )}
    </DashboardLayout>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "12px 14px",
  color: "#9ca3af",
  fontWeight: 600,
  fontSize: 12
};

const tdStyle = {
  padding: "12px 14px",
  fontSize: 12,
  color: "#e2e8f0"
};
