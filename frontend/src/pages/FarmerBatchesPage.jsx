import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { formatKg, formatToken, formatDate } from '../utils/formatters';

const STATUS_META = {
  PENDING_MINT_APPROVAL: { cls: "caro-badge-warning", color: "#f0b90b", label: "Chờ duyệt", dot: "#f0b90b"  },
  MINTED:                { cls: "caro-badge-success", color: "#B0E4CC", label: "Đã Mint",   dot: "#B0E4CC"  },
  REJECTED:              { cls: "caro-badge-danger",  color: "#ef4444", label: "Từ chối",   dot: "#ef4444"  },
};

const TABS = [
  { key: "PENDING_MINT_APPROVAL", label: "⏳ Chờ Duyệt",  icon: "⏳" },
  { key: "MINTED",                label: "🪙 Đã Mint",    icon: "🪙" },
  { key: "REJECTED",              label: "❌ Từ Chối",    icon: "❌" },
];

const LOGISTICS_LABELS = {
  PENDING_PICKUP: "Chờ lấy hàng",
  IN_TRANSIT:     "Đang vận chuyển",
  DELIVERED:      "Đã đến nhà máy",
  STANDARDIZED:   "Đã chuẩn hóa",
  STORED:         "Đã nhập kho",
  INSPECTED:      "Đã kiểm định (Oracle)",
  MINTED:         "Đã đúc Token",
};

// Seed-based pseudo-random quality grade — mirrors BatchDetailPage logic
function computeQualityGrade(batchId) {
  if (!batchId) return null;
  const seed = parseInt(String(batchId).replace(/[^\d]/g, ''), 10)
    || String(batchId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const x = Math.sin(seed * 2.1) * 10000;
  const gradeRand = (x - Math.floor(x)) * 100;
  if (gradeRand < 40) return 'CR1';
  if (gradeRand < 75) return 'CR2';
  return 'CR3';
}

function StatusBadge({ batch, status }) {
  const b = batch || {};
  const currentStatus = b.status || status;

  let label = "";
  let dot = "#64748b";
  let cls = "caro-badge-muted";

  if (currentStatus === "MINTED") {
    label = "Đã Mint";
    dot = "#B0E4CC";
    cls = "caro-badge-success";
  } else if (currentStatus === "REJECTED") {
    label = "Từ chối";
    dot = "#ef4444";
    cls = "caro-badge-danger";
  } else if (currentStatus === "APPROVED") {
    label = "Đã duyệt";
    dot = "#408A71";
    cls = "caro-badge-info";
  } else if (currentStatus === "PENDING_MINT_APPROVAL") {
    if (b.logistics_status === "INSPECTED") {
      label = "Chờ duyệt";
      dot = "#f0b90b";
      cls = "caro-badge-warning";
    } else {
      label = LOGISTICS_LABELS[b.logistics_status] || "Chờ lấy hàng";
      dot = "#408A71";
      cls = "caro-badge-info";
    }
  } else {
    label = currentStatus || "—";
    cls = "caro-badge-muted";
  }

  return (
    <span className={`caro-badge ${cls}`} style={{ fontSize: 11, padding: "2px 8px" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, display: "inline-block", marginRight: 6, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="caro-card" style={{ padding: 24, marginBottom: 16 }}>
      {[100, 65, 40].map((w, i) => (
        <div key={i} style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8, marginBottom: 12, width: `${w}%`, animation: "caro-spin 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

function BatchCard({ batch, navigate }) {
  const isMinted   = batch.status === "MINTED";
  const isRejected = batch.status === "REJECTED";
  const meta = STATUS_META[batch.status] || {};

  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "24px",
        transition: "all 0.2s",
        marginBottom: 16,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color || "#408A71"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${meta.color ? meta.color + "20" : "rgba(64, 138, 113,0.15)"}`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Row 1: ID + Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#408A71", fontFamily: "monospace", marginBottom: 4 }}>
            {batch.batch_id}
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            🫘 Cà phê {batch.coffee_type || "Robusta"} · {new Date(batch.created_at).toLocaleDateString("vi-VN")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <StatusBadge batch={batch} />
          {batch.doc_count > 0 && (
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>📂 {batch.doc_count} tài liệu</div>
          )}
        </div>
      </div>

      {/* Row 2: Details pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "⚖️", label: formatKg(Number(batch.quantity)) },
          batch.harvest_date && { icon: "📅", label: formatDate(batch.harvest_date) },
          batch.storage_location && { icon: "📍", label: batch.storage_location },
          batch.logistics_status && { icon: "🚚", label: LOGISTICS_LABELS[batch.logistics_status] || batch.logistics_status, green: true },
        ].filter(Boolean).map((pill, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 20,
            background: pill.green ? "rgba(176, 228, 204,0.08)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${pill.green ? "rgba(176, 228, 204,0.2)" : "rgba(255,255,255,0.08)"}`,
            fontSize: 13, color: pill.green ? "#B0E4CC" : "#cbd5e1", fontWeight: pill.green ? 700 : 500,
          }}>
            {pill.icon} {pill.label}
          </span>
        ))}
      </div>

      {/* Classification Result */}
      {['INSPECTED', 'MINTED'].includes(batch.logistics_status) && (() => {
        const qg = batch.quality_grade || computeQualityGrade(batch.id);
        if (!qg) return null;
        const gradeLabel = qg === 'CR1' ? 'CaRo1 (Hạng A)' : qg === 'CR2' ? 'CaRo2 (Hạng B)' : 'CaRo3 (Hạng C)';
        return (
          <div style={{ padding: "12px 16px", background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.2)", borderRadius: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#B0E4CC", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Kết quả phân loại (TCVN 4193:20)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#f8fafc" }}>{gradeLabel}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Token: <strong style={{ color: "#408A71" }}>{qg}</strong></div>
            </div>
            <div style={{ fontSize: 28 }}>🏅</div>
          </div>
        );
      })()}

      {/* Mint details */}
      {isMinted && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <div style={{ background: "rgba(176, 228, 204,0.05)", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(176, 228, 204,0.15)" }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Token đã Mint</div>
            <div style={{ fontWeight: 800, color: "#B0E4CC", fontSize: 16, fontFamily: "monospace" }}>
              {formatToken(Number(batch.minted_amount), "CR")}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)" }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Ví lưu trữ</div>
            <div style={{ fontWeight: 800, color: "#408A71", fontSize: 14 }}>🏦 Ví Sàn Giao Dịch</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 16px", border: "1px solid var(--border)" }}>
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Thời gian Mint</div>
            <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 500 }}>
              {batch.minted_at ? new Date(batch.minted_at).toLocaleString("vi-VN") : "—"}
            </div>
          </div>
          {batch.tx_hash && (
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "12px 16px", gridColumn: "1/-1", border: "1px solid var(--border)" }}>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Transaction Hash</div>
              <a href={`https://sepolia.etherscan.io/tx/${batch.tx_hash}`} target="_blank" rel="noreferrer"
                style={{ color: "#408A71", fontSize: 13, wordBreak: "break-all", textDecoration: "none", fontFamily: "monospace", fontWeight: 600 }}>
                {batch.tx_hash}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Rejection reason */}
      {isRejected && batch.rejection_reason && (
        <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239,68,68,0.05)", borderRadius: 8, fontSize: 14, color: "#ef4444", borderLeft: "4px solid #ef4444" }}>
          <strong>Lý do từ chối:</strong> {batch.rejection_reason}
        </div>
      )}

      {/* Footer action */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
        <button
          className="caro-btn caro-btn-secondary caro-btn-sm"
          onClick={() => navigate(`/farmer/batch/${batch.id}`)}
        >
          Xem chi tiết →
        </button>
      </div>
    </div>
  );
}

export default function FarmerBatchesPage() {
  const navigate = useNavigate();
  const [tab,  setTab]  = useState("PENDING_MINT_APPROVAL");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useMyBatches({ status: tab, page, limit: 10 });
  const batches = data?.batches || [];
  const total   = data?.total   || 0;

  return (
    <FarmerLayout title="Lô hàng của tôi">
      <div className="caro-page">

        {/* ── Page Header ── */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">📦 Lô Hàng Cà Phê Robusta</h2>
            <p className="caro-page-subtitle">{total} lô hàng — theo dõi trạng thái token hóa</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="caro-btn caro-btn-ghost" onClick={() => refetch()} title="Làm mới">🔄</button>
            <button className="caro-btn caro-btn-primary" onClick={() => navigate("/farmer/status/submit")}>
              ➕ Tạo Lô Hàng Mới
            </button>
          </div>
        </div>

        {/* ── Tab Filter ── */}
        <div className="caro-grid-3" style={{ marginBottom: 24 }}>
          {TABS.map(t => {
            const m = STATUS_META[t.key];
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                style={{
                  background: active ? `rgba(${active && m.color === '#B0E4CC' ? '176, 228, 204' : active && m.color === '#ef4444' ? '239,68,68' : '240,185,11'}, 0.1)` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? m.color : "var(--border)"}`,
                  borderRadius: 16,
                  padding: "20px 24px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s",
                  color: active ? m.color : "#94a3b8",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.color = m.color; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "#94a3b8"; } }}
              >
                <div style={{ fontSize: 24 }}>{t.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{t.label.split(" ").slice(1).join(" ")}</div>
              </button>
            );
          })}
        </div>

        {/* ── Batch List ── */}
        <div>
          {isLoading ? (
            [1, 2, 3].map(i => <SkeletonCard key={i} />)
          ) : isError ? (
            <div className="caro-empty">
              <div className="caro-empty-icon">⚠️</div>
              <div className="caro-empty-title" style={{ color: "#ef4444" }}>Lỗi tải dữ liệu</div>
              <button className="caro-btn caro-btn-secondary" style={{ marginTop: 12 }} onClick={() => refetch()}>Thử lại</button>
            </div>
          ) : batches.length === 0 ? (
            <div className="caro-empty">
              <div className="caro-empty-icon">📭</div>
              <div className="caro-empty-title">Chưa có lô hàng nào</div>
              {tab === "PENDING_MINT_APPROVAL" && (
                <button className="caro-btn caro-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/farmer/status/submit")}>
                  Tạo Lô Hàng Đầu Tiên →
                </button>
              )}
            </div>
          ) : (
            <>
              {batches.map(b => <BatchCard key={b.id} batch={b} navigate={navigate} />)}
              {total > 10 && (
                <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
                  {page > 1 && <button className="caro-btn caro-btn-ghost" onClick={() => setPage(p => p - 1)}>← Trước</button>}
                  <span style={{ display: "flex", alignItems: "center", padding: "0 16px", fontSize: 14, color: "#94a3b8", fontWeight: 700 }}>Trang {page}</span>
                  {batches.length === 10 && <button className="caro-btn caro-btn-ghost" onClick={() => setPage(p => p + 1)}>Sau →</button>}
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </FarmerLayout>
  );
}
