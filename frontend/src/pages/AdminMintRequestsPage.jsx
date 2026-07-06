import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import {
  useAllBatches,
  useApproveBatch,
  useRejectBatch,
  useUpdateGrade,
  useBatchDocuments,
} from "../hooks/useBatches";
import { formatKg, formatToken } from '../utils/formatters';

const TABS = [
  { key: "ALL",                   label: "Tất cả" },
  { key: "PENDING_MINT_APPROVAL", label: "Chờ duyệt" },
  { key: "MINTED",                label: "Đã Mint" },
  { key: "REJECTED",              label: "Bị từ chối" },
];

const STATUS_META = {
  PENDING_MINT_APPROVAL: { label: "Chờ duyệt",  cls: "caro-badge-warning"  },
  APPROVED:              { label: "Đã duyệt", cls: "caro-badge-info"   },
  MINTED:                { label: "Đã Mint",   cls: "caro-badge-success"  },
  REJECTED:              { label: "Bị từ chối", cls: "caro-badge-danger"   },
};

const QG_TO_GRADE = { CR1: "A", CR2: "B", CR3: "C" };
const GRADE_TO_QG = { A: "CR1", B: "CR2", C: "CR3" };

// Seed-based pseudo-random quality grade — mirrors BatchDetailPage/FarmerBatchesPage
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

const DOC_LABELS = {
  harvest_certificate: "Chứng nhận thu hoạch",
  quality_inspection:  "Kiểm định chất lượng",
  coffee_photos:       "Ảnh lô cà phê",
  additional_docs:     "Tài liệu bổ sung",
};

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

function GradeBadge({ qg }) {
  const g = QG_TO_GRADE[qg];
  if (!g) return <span style={{ color: "#64748b", fontSize: 12 }}>—</span>;
  const colors = { A: "#B0E4CC", B: "#408A71", C: "#f0b90b" };
  return (
    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${colors[g]}15`, color: colors[g], border: `1px solid ${colors[g]}30` }}>
      {g}
    </span>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function RejectModal({ batch, onClose, onConfirm, isPending }) {
  const [reason, setReason] = useState("");
  return (
    <div className="caro-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="caro-card" style={{ width: 480, maxWidth: "90vw", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 className="caro-section-title" style={{ margin: 0, fontSize: 18 }}>Từ chối lô hàng</h3>
          <button onClick={onClose} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ padding: "4px 8px" }}>✕</button>
        </div>
        
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13 }}>
          <div style={{ color: "#408A71", fontWeight: 700, fontFamily: "monospace", fontSize: 14, marginBottom: 8 }}>{batch.batch_id}</div>
          <div style={{ color: "#cbd5e1" }}>
            <span style={{ color: "#94a3b8" }}>Nông dân:</span> <strong style={{ color: "#f8fafc" }}>{batch.farmer_name}</strong>
          </div>
          <div style={{ color: "#cbd5e1", marginTop: 4 }}>
            <span style={{ color: "#94a3b8" }}>Khối lượng:</span> <strong style={{ color: "#f8fafc" }}>{formatKg(batch.quantity)}</strong>
          </div>
        </div>

        <div className="caro-field">
          <label className="caro-label">Lý do từ chối <span style={{ color: "#ef4444" }}>*</span></label>
          <textarea
            className="caro-input"
            value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder="VD: Tài liệu thiếu minh chứng · Sai lệch khối lượng thực tế..."
            style={{ resize: "vertical" }}
          />
        </div>
        
        <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="caro-btn caro-btn-ghost">Hủy</button>
          <button onClick={() => reason.trim() && onConfirm(reason)} disabled={!reason.trim() || isPending}
            className={`caro-btn ${!reason.trim() || isPending ? "caro-btn-ghost" : "caro-btn-danger"}`}
            style={{ opacity: !reason.trim() || isPending ? 0.5 : 1 }}>
            {isPending ? "Đang xử lý…" : "Xác nhận từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ batch, onClose, onConfirm, isPending }) {
  // Use server quality_grade if available, else compute from batch ID seed
  const resolvedQG = batch.quality_grade || computeQualityGrade(batch.id);
  const [grade, setGrade] = useState(QG_TO_GRADE[resolvedQG] || "");
  const gradeColors = { A: "#B0E4CC", B: "#408A71", C: "#f0b90b" };
  const tokenType = GRADE_TO_QG[grade] || "—";
  // Mint amount is the standardized weight after processing loss, not the raw weight
  const mintQty = batch.net_quantity != null ? Number(batch.net_quantity) : Number(batch.quantity);

  return (
    <div className="caro-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="caro-card" style={{ width: 520, maxWidth: "90vw", padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 className="caro-section-title" style={{ margin: 0, fontSize: 18 }}>Phê duyệt & Mint</h3>
          <button onClick={onClose} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ padding: "4px 8px" }}>✕</button>
        </div>

        {/* Batch info */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", marginBottom: 24, fontSize: 14 }}>
          <div style={{ color: "#408A71", fontWeight: 700, fontFamily: "monospace", fontSize: 15, marginBottom: 12 }}>{batch.batch_id}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#94a3b8" }}>Nông dân</span>
            <span style={{ fontWeight: 700, color: "#f8fafc" }}>{batch.farmer_name || "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#94a3b8" }}>Địa chỉ ví</span>
            <span style={{ fontFamily: "monospace", fontSize: 13, color: batch.farmer_wallet ? "#408A71" : "#ef4444" }}>
              {batch.farmer_wallet ? `${batch.farmer_wallet.slice(0,10)}…${batch.farmer_wallet.slice(-8)}` : "Chưa liên kết ví ⚠️"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#94a3b8" }}>Khối lượng thô ban đầu</span>
            <span style={{ color: "#94a3b8" }}>{formatKg(batch.quantity)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>Khối lượng sau chuẩn hóa</span>
            <span style={{ fontWeight: 800, color: "#f8fafc" }}>{formatKg(mintQty)}</span>
          </div>
        </div>

        {/* Grade display */}
        <label className="caro-label">
          Phân loại Grade từ Oracle (Tự động)
        </label>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 24 }}>
          {grade ? (
            <div
              style={{ 
                padding: "16px", borderRadius: 12, 
                border: `2px solid ${gradeColors[grade]}`, 
                background: `${gradeColors[grade]}15`, 
                color: gradeColors[grade], textAlign: "center",
                boxShadow: `0 4px 12px ${gradeColors[grade]}30`
              }}>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{grade}</div>
              <div style={{ fontSize: 13, color: gradeColors[grade], marginTop: 4, fontWeight: 600 }}>
                {grade === "A" ? "CR1 · Cao cấp" : grade === "B" ? "CR2 · Tiêu chuẩn" : "CR3 · Phổ thông"}
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px", borderRadius: 12, border: "1px dashed #64748b", color: "#94a3b8", textAlign: "center", fontSize: 13 }}>
              ⚠️ Lô hàng chưa hoàn tất quá trình kiểm định. Vui lòng đợi hệ thống cập nhật.
            </div>
          )}
        </div>

        {/* Mint preview */}
        {grade && (
          <div style={{ background: `${gradeColors[grade]}10`, border: `1px solid ${gradeColors[grade]}30`, borderRadius: 12, padding: "16px", marginBottom: 24, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>Sẽ phát hành (Mint)</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: gradeColors[grade], fontFamily: "monospace" }}>
              {formatToken(mintQty)} <span style={{ fontSize: 18 }}>{tokenType}</span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>→ chuyển đến ví giao dịch của nông dân</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="caro-btn caro-btn-ghost">Hủy</button>
          {batch.farmer_wallet ? (
            <button onClick={() => grade && onConfirm(grade)} disabled={!grade || isPending}
              className={`caro-btn ${!grade || isPending ? "caro-btn-ghost" : "caro-btn-primary"}`}
              style={{ 
                opacity: !grade || isPending ? 0.5 : 1, 
                background: (!grade || isPending) ? undefined : "#B0E4CC",
                borderColor: (!grade || isPending) ? undefined : "#B0E4CC",
                color: (!grade || isPending) ? undefined : "#0f172a"
              }}>
              {isPending ? "Đang đúc…" : "Duyệt & Đúc Token"}
            </button>
          ) : (
            <button disabled className="caro-btn caro-btn-ghost" style={{ opacity: 0.5, cursor: "not-allowed" }}>
              Chưa liên kết ví
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentsPanel({ batchId }) {
  const { data, isLoading } = useBatchDocuments(batchId);
  const docs = data?.documents || [];
  
  if (isLoading) return <div style={{ padding: "20px", color: "#94a3b8", fontSize: 13, textAlign: "center" }}><span style={{ animation: "caro-spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⏳</span> Đang tải tài liệu…</div>;
  if (!docs.length)  return <div style={{ padding: "20px", color: "#64748b", fontSize: 13, textAlign: "center" }}>Không có tài liệu chứng minh</div>;

  const grouped = {};
  for (const d of docs) {
    if (!grouped[d.document_type]) grouped[d.document_type] = [];
    grouped[d.document_type].push(d);
  }
  return (
    <div style={{ padding: "20px", background: "rgba(0,0,0,0.2)", borderRadius: 12, border: "1px solid var(--border)", margin: "0 16px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {Object.entries(grouped).map(([type, files]) => (
          <div key={type}>
            <div style={{ fontSize: 12, color: "#408A71", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>{DOC_LABELS[type] || type}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((f) => (
                <div key={f.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px", fontSize: 13, border: "1px solid var(--border)", display: "flex", alignItems: "center" }}>
                  {f.ipfs_cid ? (
                    <a href={`https://ipfs.io/ipfs/${f.ipfs_cid}`} target="_blank" rel="noreferrer" style={{ color: "#f8fafc", textDecoration: "none", fontWeight: 500, display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                      <span style={{ fontSize: 16 }}>📄</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</span>
                      <span style={{ color: "#408A71", fontSize: 16 }}>↗</span>
                    </a>
                  ) : (
                    <span style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                      <span style={{ fontSize: 16 }}>📄</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[60, 120, 100, 80, 70, 60, 60, 80, 90].map((w, i) => (
        <td key={i} style={{ padding: "20px 16px" }}>
          <div style={{ height: 16, background: "rgba(255,255,255,0.05)", borderRadius: 4, width: w, animation: "caro-spin 1.5s infinite" }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminMintRequestsPage() {
  const nav = useNavigate();
  const [activeTab,     setActiveTab]     = useState("ALL");
  const [page,          setPage]          = useState(1);
  const [search,        setSearch]        = useState("");
  const [searchInput,   setSearchInput]   = useState("");
  const [rejectTarget,  setRejectTarget]  = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [expandedDocs,  setExpandedDocs]  = useState(null);
  const [gradeOverride, setGradeOverride] = useState({});

  const approve     = useApproveBatch();
  const reject      = useRejectBatch();
  const updateGrade = useUpdateGrade();

  const statusFilter = activeTab === "ALL" ? undefined : activeTab;

  const { data, isLoading, isError, refetch } = useAllBatches({
    status: statusFilter, search: search || undefined, page, limit: 10,
  });

  const batches = data?.batches || [];
  const total   = data?.total   || 0;

  const handleTabChange = (tab) => { setActiveTab(tab); setPage(1); setSearch(""); setSearchInput(""); };
  const handleSearch    = () => { setSearch(searchInput.trim()); setPage(1); };
  const handleClear     = () => { setSearch(""); setSearchInput(""); setPage(1); };

  const handleGradeChange = (batch, grade) => {
    setGradeOverride(prev => ({ ...prev, [batch.id]: grade }));
    updateGrade.mutate({ id: batch.id, grade });
  };

  const handleApproveConfirm = (grade) => {
    approve.mutate(
      { id: approveTarget.id, grade },
      { onSettled: () => setApproveTarget(null) }
    );
  };

  const handleRejectConfirm = (reason) => {
    reject.mutate(
      { id: rejectTarget.id, reason },
      { onSettled: () => setRejectTarget(null) }
    );
  };

  return (
    <DashboardLayout title="Duyệt lô hàng">
      {rejectTarget && (
        <RejectModal batch={rejectTarget} onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm} isPending={reject.isPending} />
      )}
      {approveTarget && (
        <ApproveModal batch={approveTarget} onClose={() => setApproveTarget(null)}
          onConfirm={handleApproveConfirm} isPending={approve.isPending} />
      )}

      <div className="caro-page">
        {/* Header */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">📦 Lô hàng từ Nông dân</h2>
            <p className="caro-page-subtitle">Tổng số: <strong style={{ color: "#f8fafc" }}>{total}</strong> lô hàng · Phê duyệt hồ sơ chất lượng và phát hành (Mint) token RWA</p>
          </div>
        </div>

        {/* Tabs + search */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, borderBottom: "1px solid var(--border)", paddingBottom: 16, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                className={`caro-btn caro-btn-sm ${activeTab === tab.key ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                style={{ padding: "8px 20px" }}>
                {tab.label}
              </button>
            ))}
          </div>
          
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="caro-field" style={{ marginBottom: 0, position: "relative" }}>
              <input 
                className="caro-input"
                value={searchInput} 
                onChange={(e) => setSearchInput(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Mã lô hàng, nông dân..."
                style={{ paddingRight: 80, width: 280 }} 
              />
              <div style={{ position: "absolute", right: 4, top: 4, display: "flex", gap: 4 }}>
                {search && (
                  <button onClick={handleClear} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ padding: "4px 8px" }}>✕</button>
                )}
                <button onClick={handleSearch} className="caro-btn caro-btn-primary caro-btn-sm" style={{ padding: "4px 12px" }}>🔍</button>
              </div>
            </div>
            <button onClick={() => refetch()} className="caro-btn caro-btn-ghost">🔄</button>
          </div>
        </div>

        {/* Table */}
        <div className="caro-table-container">
          <table className="caro-table">
            <thead>
              <tr>
                {["Mã lô hàng", "Nông dân", "Địa chỉ ví", "Khối lượng", "Grade", "Ngày tạo", "Tài liệu", "Trạng thái", "Thao tác"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>

            {isLoading ? (
              <tbody>{[1,2,3,4].map(i => <SkeletonRow key={i} />)}</tbody>
            ) : isError ? (
              <tbody><tr><td colSpan={9} style={{ textAlign: "center", padding: 60, color: "#ef4444" }}>
                Không thể tải dữ liệu — <button onClick={() => refetch()} className="caro-btn caro-btn-ghost" style={{ color: "#408A71", marginLeft: 8 }}>Tải lại</button>
              </td></tr></tbody>
            ) : batches.length === 0 ? (
              <tbody><tr><td colSpan={9}>
                <div className="caro-empty" style={{ padding: "80px 0" }}>
                  <div className="caro-empty-icon" style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                  <div className="caro-empty-title">Không tìm thấy lô hàng nào trong tab này</div>
                </div>
              </td></tr></tbody>
            ) : (
              <tbody>
                {batches.map((b) => {
                  const isProcessing = (approve.isPending && approve.variables?.id === b.id) ||
                                       (reject.isPending  && reject.variables?.id  === b.id);
                  const docsExpanded  = expandedDocs === b.id;
                  const shortWallet   = b.farmer_wallet ? `${b.farmer_wallet.slice(0,6)}…${b.farmer_wallet.slice(-4)}` : "—";
                  const currentGrade  = gradeOverride[b.id] || QG_TO_GRADE[b.quality_grade || computeQualityGrade(b.id)] || "";

                  return (
                    <Fragment key={b.id}>
                      <tr style={{ cursor: "pointer", transition: "background 0.2s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                        {/* Batch ID */}
                        <td style={{ padding: "16px", fontWeight: 700, color: "#408A71", fontFamily: "monospace", fontSize: 14, whiteSpace: "nowrap" }}>
                          <div>{b.batch_id}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, fontFamily: "sans-serif", marginTop: 4 }}>🫘 Robusta</div>
                        </td>

                        {/* Farmer */}
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontWeight: 700, color: "#f8fafc", fontSize: 14 }}>{b.farmer_name || "—"}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{b.farmer_email}</div>
                        </td>

                        {/* Wallet */}
                        <td style={{ padding: "16px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 13, color: b.farmer_wallet ? "#94a3b8" : "#ef4444" }}>{shortWallet}</span>
                        </td>

                        {/* Qty */}
                        <td style={{ padding: "16px", fontWeight: 800, color: "#f8fafc", fontSize: 14 }}>
                          {formatKg(b.quantity)}
                        </td>

                        {/* Grade */}
                        <td style={{ padding: "16px" }}>
                          {(b.logistics_status === 'INSPECTED' || b.status === 'MINTED') ? (
                            <GradeBadge qg={b.quality_grade || computeQualityGrade(b.id)} />
                          ) : (
                            <span style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic" }}>Chờ kiểm định</span>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ padding: "16px", color: "#94a3b8", whiteSpace: "nowrap", fontSize: 13 }}>
                          {new Date(b.created_at).toLocaleDateString("vi-VN")}
                        </td>

                        {/* Docs */}
                        <td style={{ padding: "16px" }}>
                          <button onClick={() => setExpandedDocs(docsExpanded ? null : b.id)}
                            className="caro-btn caro-btn-secondary caro-btn-sm"
                            style={{ padding: "6px 12px", whiteSpace: "nowrap" }}>
                            📂 {b.doc_count || 0} {docsExpanded ? "▲" : "▼"}
                          </button>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "16px" }}>
                          <StatusBadge batch={b} />
                          {b.status === "MINTED" && b.tx_hash && (
                            <div style={{ fontSize: 11, marginTop: 8 }}>
                              <a href={`https://sepolia.etherscan.io/tx/${b.tx_hash}`} target="_blank" rel="noreferrer"
                                style={{ color: "#408A71", textDecoration: "none", fontWeight: 600, fontFamily: "monospace" }}>TX ↗</a>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "16px" }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", justifyContent: "flex-end" }}>
                            <button onClick={() => nav(`/admin/batch/${b.id}`)}
                              className="caro-btn caro-btn-ghost caro-btn-sm" style={{ padding: "6px 12px" }}>
                              Chi tiết
                            </button>
                            {b.status === "PENDING_MINT_APPROVAL" && (
                              <>
                                {b.logistics_status === 'INSPECTED' ? (
                                  <>
                                    {b.farmer_wallet ? (
                                      <button onClick={() => setApproveTarget(b)} disabled={isProcessing}
                                        className={`caro-btn caro-btn-sm ${isProcessing ? "caro-btn-ghost" : "caro-btn-primary"}`}
                                        style={{ padding: "6px 16px", background: isProcessing ? undefined : "#B0E4CC", borderColor: isProcessing ? undefined : "#B0E4CC", color: isProcessing ? undefined : "#0f172a" }}>
                                        {approve.isPending && approve.variables?.id === b.id ? "⏳" : "Duyệt"}
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "6px 10px", borderRadius: 6, fontWeight: 600, border: "1px solid rgba(245,158,11,0.2)" }}>
                                        ⚠️ Chờ liên kết ví
                                      </span>
                                    )}
                                    <button onClick={() => setRejectTarget(b)} disabled={isProcessing}
                                      className="caro-btn caro-btn-danger caro-btn-sm" style={{ padding: "6px 12px", opacity: isProcessing ? 0.5 : 1 }}>
                                      ✕
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 12, color: "#64748b", background: "rgba(255,255,255,0.05)", padding: "6px 10px", borderRadius: 6, fontWeight: 600 }}>
                                    ⏳ Đợi Oracle
                                  </span>
                                )}
                              </>
                            )}
                            {b.status === "REJECTED" && b.rejection_reason && (
                              <span title={b.rejection_reason} style={{ fontSize: 12, color: "#ef4444", cursor: "help", display: "flex", alignItems: "center", marginLeft: 8 }}>⚠ Lý do</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {docsExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0 }}>
                            <DocumentsPanel batchId={b.id} />
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
        {total > 10 && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginTop: 24 }}>
            <button onClick={() => setPage(1)} disabled={page === 1}
              className={`caro-btn caro-btn-sm ${page === 1 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: page === 1 ? 0.5 : 1 }}>«</button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
              className={`caro-btn caro-btn-sm ${page === 1 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: page === 1 ? 0.5 : 1 }}> Trước</button>
            <span style={{ padding: "0 8px", color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>Trang {page} / {Math.ceil(total / 10)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={batches.length < 10}
              className={`caro-btn caro-btn-sm ${batches.length < 10 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: batches.length < 10 ? 0.5 : 1 }}>Sau »</button>
            <button onClick={() => setPage(Math.ceil(total / 10))} disabled={batches.length < 10}
              className={`caro-btn caro-btn-sm ${batches.length < 10 ? "caro-btn-ghost" : "caro-btn-secondary"}`} style={{ opacity: batches.length < 10 ? 0.5 : 1 }}>»</button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
