import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { formatKg, formatToken } from '../utils/formatters';

const STATUS = {
  PENDING_MINT_APPROVAL: { label: "Chờ duyệt",  cls: "caro-badge-warning"  },
  MINTED:                { label: "Đã Mint",   cls: "caro-badge-success"  },
  REJECTED:              { label: "Từ chối", cls: "caro-badge-danger"   },
  APPROVED:              { label: "Đã duyệt", cls: "caro-badge-info"   },
};

const TABS = [
  { label: "Tất cả lô hàng",     status: null,                    path: "/farmer/status"           },
  { label: "Chờ phê duyệt", status: "PENDING_MINT_APPROVAL", path: "/farmer/status/pending"   },
  { label: "Lô hàng đã Mint",  status: "MINTED",                path: "/farmer/status/minted"    },
  { label: "Bị từ chối",        status: "REJECTED",              path: "/farmer/status/rejected"  },
];

const LOGISTICS_LABELS = {
  PENDING_PICKUP: "Chờ lấy hàng",
  IN_TRANSIT:     "Đang vận chuyển",
  DELIVERED:      "Đã đến nhà máy",
  STANDARDIZED:   "Đã chuẩn hóa",
  STORED:         "Đã nhập kho",
  INSPECTED:      "Đã kiểm định",
  MINTED:         "Đã đúc Token",
};

function Badge({ batch, status }) {
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
    <span className={`caro-badge ${cls}`} style={{ padding: "4px 10px", fontSize: 11 }}>
      {label}
    </span>
  );
}

function SkRow() {
  return (
    <tr>
      {[40, 120, 80, 80, 90, 60].map((w, i) => (
        <td key={i} style={{ padding: "16px" }}>
          <div style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: w, animation: "caro-spin 1.5s infinite" }} />
        </td>
      ))}
    </tr>
  );
}

function pathToStatus(p) {
  if (p.includes("/pending"))  return "PENDING_MINT_APPROVAL";
  if (p.includes("/minted"))   return "MINTED";
  if (p.includes("/rejected")) return "REJECTED";
  return null;
}

export default function FarmerAssets() {
  const nav = useNavigate();
  const loc = useLocation();

  const [activeStatus, setActiveStatus] = useState(() => pathToStatus(loc.pathname));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setActiveStatus(pathToStatus(loc.pathname));
    setPage(1);
  }, [loc.pathname]);

  const params = { page, limit: 15 };
  if (activeStatus) params.status = activeStatus;

  const { data, isLoading, isError, refetch } = useMyBatches(params);
  const batches = data?.batches || [];
  const total   = data?.total   || 0;
  const pages   = data?.pages   || 1;

  const filtered = search
    ? batches.filter(b => b.batch_id?.toLowerCase().includes(search.toLowerCase()) || b.storage_location?.toLowerCase().includes(search.toLowerCase()))
    : batches;

  const PAGE_TITLE = {
    null:                    "Tất cả lô hàng",
    PENDING_MINT_APPROVAL:   "Lô hàng chờ phê duyệt",
    MINTED:                  "Lô hàng đã Mint",
    REJECTED:                "Lô hàng bị từ chối",
  };

  return (
    <FarmerLayout title={PAGE_TITLE[activeStatus] ?? "Trạng thái lô hàng"}>
      <div className="caro-page">

        {/* Header */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">📦 {PAGE_TITLE[activeStatus] ?? "Trạng thái lô hàng"}</h2>
            <p className="caro-page-subtitle">Tổng cộng {total} lô hàng</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => refetch()} className="caro-btn caro-btn-ghost">🔄</button>
            <button onClick={() => nav("/farmer/status/submit")} className="caro-btn caro-btn-primary">+ Gửi lô hàng mới</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, background: "var(--card-bg)", borderRadius: 12, padding: 6, width: "fit-content", border: "1px solid var(--border)", marginBottom: 16 }}>
          {TABS.map(t => {
            const act = activeStatus === t.status;
            return (
              <button key={t.label} onClick={() => nav(t.path)}
                className={`caro-btn caro-btn-sm ${act ? 'caro-btn-secondary' : 'caro-btn-ghost'}`}
                style={{ padding: "8px 20px" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="caro-field" style={{ marginBottom: 24, maxWidth: 400 }}>
          <input
            className="caro-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo mã lô hoặc kho lưu trữ..."
          />
        </div>

        {/* Table */}
        <div className="caro-table-container">
          <table className="caro-table">
            <thead>
              <tr>
                {["Mã lô", "Loại cà phê", "Khối lượng", "Ngày tạo", "Trạng thái", ""].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && [1, 2, 3, 4, 5].map(i => <SkRow key={i} />)}
              {isError && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
                  Lỗi khi tải dữ liệu. <button onClick={() => refetch()} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ color: "#408A71", marginLeft: 8 }}>Thử lại</button>
                </td></tr>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="caro-empty" style={{ padding: "60px 0" }}>
                    <div className="caro-empty-icon">📭</div>
                    <div className="caro-empty-title">Không tìm thấy lô hàng nào</div>
                    <button onClick={() => nav("/farmer/status/submit")} className="caro-btn caro-btn-primary" style={{ marginTop: 16 }}>Gửi lô hàng đầu tiên</button>
                  </div>
                </td></tr>
              )}
              {filtered.map(b => (
                <tr key={b.id}
                  style={{ cursor: "pointer", transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => nav(`/farmer/batch/${b.id}`)}
                >
                  <td style={{ padding: "16px" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#408A71", fontFamily: "monospace" }}>{b.batch_id}</div>
                    {b.storage_location && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{b.storage_location}</div>}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(64, 138, 113,0.1)", color: "#408A71", fontWeight: 600 }}>{b.coffee_type || "ROBUSTA"}</span>
                  </td>
                  <td style={{ padding: "16px", fontSize: 14, color: "#f8fafc", whiteSpace: "nowrap", fontWeight: 500 }}>
                    {formatKg(b.quantity)}
                  </td>
                  <td style={{ padding: "16px", fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(b.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <Badge batch={b} />
                  </td>
                  <td style={{ padding: "16px", textAlign: "right" }}>
                    <span style={{ fontSize: 13, color: "#408A71", fontWeight: 600 }}>Chi tiết →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Rejected note */}
        {activeStatus === "REJECTED" && filtered.some(b => b.rejection_reason) && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "16px 20px", marginTop: 24 }}>
            {filtered.filter(b => b.rejection_reason).map(b => (
              <div key={b.id} style={{ marginBottom: 12, "&:last-child": { marginBottom: 0 } }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{b.batch_id}</div>
                <div style={{ fontSize: 13, color: "#f8fafc", marginTop: 4 }}>Lý do từ chối: {b.rejection_reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* Minted details */}
        {activeStatus === "MINTED" && filtered.filter(b => b.minted_amount).length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
            {filtered.filter(b => b.minted_amount).map(b => (
              <div key={b.id} style={{ background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.15)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ fontSize: 13, color: "#94a3b8", fontFamily: "monospace", fontWeight: 600 }}>{b.batch_id}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#B0E4CC" }}>{formatToken(b.minted_amount, "CaRo")} đã được mint</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{b.minted_at ? new Date(b.minted_at).toLocaleString("vi-VN") : "—"}</div>
                {b.tx_hash && (
                  <a href={`https://sepolia.etherscan.io/tx/${b.tx_hash}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, color: "#408A71", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240, whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600, textDecoration: "none" }}>
                    {b.tx_hash.slice(0, 16)}…
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginTop: 24 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className={`caro-btn caro-btn-sm ${page <= 1 ? "caro-btn-ghost" : "caro-btn-secondary"}`}
              style={{ opacity: page <= 1 ? 0.5 : 1 }}>
              ← Trước
            </button>
            <span style={{ fontSize: 14, color: "#94a3b8", padding: "0 8px", fontWeight: 600 }}>Trang {page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
              className={`caro-btn caro-btn-sm ${page >= pages ? "caro-btn-ghost" : "caro-btn-secondary"}`}
              style={{ opacity: page >= pages ? 0.5 : 1 }}>
              Sau →
            </button>
          </div>
        )}

      </div>
    </FarmerLayout>
  );
}
