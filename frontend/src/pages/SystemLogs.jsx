import { useEffect, useState, Fragment } from "react";
import DashboardLayout from "../components/layout/DashboardLayout";
import axios from "../utils/axiosClient";

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
    let className = "caro-badge ";
    let icon = "";

    if (action.includes("login")) {
      className += "caro-badge-info";
      icon = "🔑";
    } else if (action.includes("mint")) {
      className += "caro-badge-success";
      icon = "🪙";
    } else if (action.includes("reject")) {
      className += "caro-badge-danger";
      icon = "❌";
    } else if (action.includes("approve") || action.includes("accept")) {
      className += "caro-badge-success";
      icon = "✅";
    } else if (action.includes("create") || action.includes("submit")) {
      className += "caro-badge-warning";
      icon = "➕";
    } else {
      className += "caro-badge-muted";
      icon = "⚡";
    }

    return (
      <span className={className} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "4px 8px" }}>
        <span style={{ marginRight: 4 }}>{icon}</span>
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
        .json-box {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 12px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #a7f3d0;
          overflow-x: auto;
          white-space: pre-wrap;
          max-height: 250px;
        }
      `}</style>
      <div className="caro-page">

        {/* ── Header ── */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">Nhật ký hệ thống (Audit Logs)</h2>
            <div className="caro-page-subtitle">
              Ghi nhận toàn bộ thao tác quan trọng bao gồm Đăng nhập, KYC, Lô hàng, Giao dịch và Phát hành token.
            </div>
          </div>
          <div className="caro-badge caro-badge-muted" style={{ fontSize: 13, padding: "8px 16px" }}>
            📊 Tổng số log: {total}
          </div>
        </div>

        {/* ── Filter panel ── */}
        <form className="caro-card" style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }} onSubmit={handleSearch}>
          <div className="caro-field" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
            <label className="caro-label">Thao tác (Action)</label>
            <input
              type="text"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              placeholder="VD: user:login, batch:mint..."
              className="caro-input"
            />
          </div>

          <div className="caro-field" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
            <label className="caro-label">Loại thực thể (Entity)</label>
            <div style={{ position: "relative" }}>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="caro-input caro-select"
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
          </div>

          <div className="caro-field" style={{ width: 130, marginBottom: 0 }}>
            <label className="caro-label">Mã người dùng (ID)</label>
            <input
              type="number"
              value={actorIdInput}
              onChange={(e) => setActorIdInput(e.target.value)}
              placeholder="VD: 1, 2"
              className="caro-input"
            />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 0 }}>
            <button type="submit" className="caro-btn caro-btn-primary">
              Tìm kiếm
            </button>
            <button type="button" onClick={handleClear} className="caro-btn caro-btn-ghost">
              Đặt lại
            </button>
          </div>
        </form>

        {/* ── Table ── */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-table-wrap">
            <table className="caro-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Thao tác (Action)</th>
                  <th>Đối tượng thực thể</th>
                  <th>Địa chỉ IP</th>
                  <th style={{ textAlign: "right" }}>Chi tiết</th>
                </tr>
              </thead>

              {loading ? (
                <tbody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <td key={j}>
                          <div className="caro-skeleton" style={{ height: 16, width: "100%" }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ) : logs.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7}>
                      <div className="caro-empty" style={{ padding: "50px 20px" }}>
                        <div className="caro-empty-icon">📭</div>
                        <div className="caro-empty-title">Không tìm thấy nhật ký hệ thống nào</div>
                      </div>
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
                        <tr style={{ borderBottom: isExpanded ? "none" : "1px solid rgba(255,255,255,0.04)", background: isExpanded ? "rgba(255,255,255,0.02)" : "transparent" }}>
                          
                          <td style={{ color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>#{log.id}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{dateStr}</td>
                          <td>
                            {log.actor_name || log.actor_email ? (
                              <div>
                                <div style={{ fontWeight: 600, color: "#f8fafc" }}>{log.actor_name || "—"}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{log.actor_email || `ID: ${log.actor_id}`}</div>
                              </div>
                            ) : (
                              <span className="caro-badge caro-badge-muted">Hệ thống / Khách</span>
                            )}
                          </td>
                          <td>{getActionBadge(log.action)}</td>
                          <td>
                            {log.entity_type ? (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{log.entity_type}</span>
                                {log.entity_id && <span className="caro-badge caro-badge-info" style={{ padding: "2px 6px", fontSize: 10 }}>#{log.entity_id}</span>}
                              </div>
                            ) : (
                              <span style={{ color: "#64748b" }}>—</span>
                            )}
                          </td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" }}>{log.ip_address || "127.0.0.1"}</td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="caro-btn caro-btn-ghost caro-btn-sm"
                            >
                              {isExpanded ? "Thu gọn ▲" : "Chi tiết ▼"}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.2)" }}>
                            <td colSpan={7} style={{ padding: "16px 20px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                  <div className="caro-label">Dữ liệu cũ (Old Data)</div>
                                  <pre className="json-box">{formatJson(log.old_data)}</pre>
                                </div>
                                <div>
                                  <div className="caro-label">Dữ liệu mới (New Data)</div>
                                  <pre className="json-box">{formatJson(log.new_data)}</pre>
                                </div>
                              </div>
                              {log.user_agent && (
                                <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)", padding: "8px 12px", borderRadius: 8 }}>
                                  <span style={{ fontWeight: 600, color: "#e2e8f0" }}>Thiết bị (User Agent):</span> {log.user_agent}
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
        </div>

        {/* ── Pagination ── */}
        {total > limit && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 8 }}>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Trước</button>
            <span style={{ padding: "0 14px", color: "#64748b", fontSize: 13, fontWeight: 500 }}>
              Trang {page} / {Math.ceil(total / limit)}
            </span>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => setPage(p => p + 1)} disabled={logs.length < limit}>Sau →</button>
            <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => setPage(Math.ceil(total / limit))} disabled={logs.length < limit}>»</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
