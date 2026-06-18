import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAllBatches, useApproveBatch, useRejectBatch, useBatchDocuments } from "../hooks/useBatches";

const STATUS_META = {
  PENDING_MINT_APPROVAL: { color: "#f39c12", bg: "rgba(243,156,18,0.15)", label: "Chờ duyệt" },
  APPROVED:              { color: "#3498db", bg: "rgba(52,152,219,0.15)",  label: "Đã duyệt"  },
  MINTED:                { color: "#27ae60", bg: "rgba(39,174,96,0.15)",   label: "Đã Mint"   },
  REJECTED:              { color: "#e74c3c", bg: "rgba(231,76,60,0.15)",   label: "Từ chối"   },
};

const DOC_LABELS = {
  farmer_identity:     "Danh tính",
  farm_ownership:      "Sở hữu đất",
  harvest_certificate: "Chứng nhận thu hoạch",
  warehouse_receipt:   "Phiếu nhập kho",
  quality_inspection:  "Kiểm định chất lượng",
  coffee_photos:       "Ảnh lô cà phê",
  additional_docs:     "Tài liệu bổ sung",
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color: "#aaa", bg: "rgba(255,255,255,0.08)", label: status };
  return <span style={{ background: m.bg, color: m.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{m.label}</span>;
}

function RejectModal({ batch, onClose, onConfirm, isPending }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#141a1f", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, width: 460, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>❌ Từ chối — {batch.batch_id}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ marginBottom: 10, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
          Robusta · {Number(batch.quantity).toLocaleString()} kg · {batch.quality_grade}
        </div>
        <label style={{ display: "block", fontSize: 13, color: "#9fcfc6", marginBottom: 8, fontWeight: 600 }}>Lý do từ chối *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="VD: Tài liệu không hợp lệ · Số lượng không khớp · Không qua kiểm định..."
          style={{ width: "100%", padding: "10px 12px", background: "#0b1113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>Huỷ</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim() || isPending}
            style={{ padding: "9px 20px", background: !reason.trim() || isPending ? "#555" : "#e74c3c", border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: !reason.trim() || isPending ? "not-allowed" : "pointer" }}
          >
            {isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Document panel shown inline per row when expanded ────────────────────────
function DocumentsPanel({ batchId }) {
  const { data, isLoading } = useBatchDocuments(batchId);
  const docs = data?.documents || [];

  if (isLoading) return (
    <div style={{ padding: "10px 14px", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Đang tải tài liệu...</div>
  );
  if (docs.length === 0) return (
    <div style={{ padding: "10px 14px", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Không có tài liệu</div>
  );

  const grouped = {};
  for (const doc of docs) {
    if (!grouped[doc.document_type]) grouped[doc.document_type] = [];
    grouped[doc.document_type].push(doc);
  }

  return (
    <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.3)", borderRadius: 8 }}>
      {Object.entries(grouped).map(([type, files]) => (
        <div key={type} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#9fcfc6", fontWeight: 600, marginBottom: 4 }}>
            {DOC_LABELS[type] || type}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "4px 8px", fontSize: 11 }}>
                {f.ipfs_cid ? (
                  <a href={`https://ipfs.io/ipfs/${f.ipfs_cid}`} target="_blank" rel="noreferrer"
                    style={{ color: "#9fcfc6", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                    📄 {f.file_name}
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>IPFS ↗</span>
                  </a>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>📄 {f.file_name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <tbody>
      {[1, 2, 3, 4].map((i) => (
        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
            <td key={j} style={{ padding: "14px" }}>
              <div style={{ height: 12, background: "rgba(255,255,255,0.07)", borderRadius: 4, animation: "pulse 1.5s ease-in-out infinite" }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default function AdminMintRequestsPage() {
  const navigate = useNavigate();
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState("PENDING_MINT_APPROVAL");
  const [search,       setSearch]       = useState("");
  const [searchInput,  setSearchInput]  = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [expandedDocs, setExpandedDocs] = useState(null);

  const approve = useApproveBatch();
  const reject  = useRejectBatch();

  const { data, isLoading, isError, refetch } = useAllBatches({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    limit: 10,
  });

  const batches = data?.batches || [];
  const total   = data?.total   || 0;

  const handleSearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const handleClear  = () => { setSearch(""); setSearchInput(""); setPage(1); };

  const handleApprove = (batch) => {
    if (!window.confirm(
      `Approve & Mint batch ${batch.batch_id}?\n\n` +
      `${Number(batch.quantity).toLocaleString()} kg → ${batch.quality_grade} token\n` +
      `Farmer: ${batch.farmer_name}\n\n` +
      `Token sẽ được mint vào ví nội bộ của farmer.`
    )) return;
    approve.mutate({ id: batch.id });
  };

  const handleRejectConfirm = (reason) => {
    reject.mutate(
      { id: rejectTarget.id, reason },
      { onSettled: () => setRejectTarget(null) }
    );
  };

  return (
    <DashboardLayout title="Asset Batch — Mint Approval">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {rejectTarget && (
        <RejectModal
          batch={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={handleRejectConfirm}
          isPending={reject.isPending}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🏭 Robusta Batch — Mint Approval</h2>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{total} batch tổng · Token mint vào ví nội bộ</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 0, background: "#0b1113", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Batch ID, tên farmer..."
              style={{ padding: "8px 12px", background: "none", border: "none", color: "#fff", fontSize: 13, outline: "none", width: 200 }}
            />
            {search && <button onClick={handleClear} style={{ padding: "0 10px", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}>✕</button>}
            <button onClick={handleSearch} style={{ padding: "8px 14px", background: "#1f6f64", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🔍</button>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: "8px 12px", background: "#0b1113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 13 }}
          >
            <option value="">Tất cả</option>
            <option value="PENDING_MINT_APPROVAL">Chờ duyệt</option>
            <option value="MINTED">Đã mint</option>
            <option value="REJECTED">Từ chối</option>
          </select>
          <button onClick={() => refetch()} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>🔄</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              {["Batch ID", "Farmer", "SL (kg) / Grade", "Giá trị", "Ngày gửi", "Tài liệu", "Trạng thái", "Thao tác"].map((h) => (
                <th key={h} style={{ padding: "11px 14px", color: "rgba(255,255,255,0.5)", fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>

          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <tbody>
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 60, color: "#e74c3c" }}>
                Lỗi tải dữ liệu — <button onClick={() => refetch()} style={{ background: "none", border: "none", color: "#9fcfc6", cursor: "pointer", textDecoration: "underline" }}>Thử lại</button>
              </td></tr>
            </tbody>
          ) : batches.length === 0 ? (
            <tbody>
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div>Không có batch nào</div>
              </td></tr>
            </tbody>
          ) : (
            <tbody>
              {batches.map((b) => {
                const isProcessing = (approve.isPending || reject.isPending) &&
                  (approve.variables?.id === b.id || reject.variables?.id === b.id);
                const docsExpanded = expandedDocs === b.id;

                return (
                  <Fragment key={b.id}>
                    <tr style={{ borderBottom: docsExpanded ? "none" : "1px solid rgba(255,255,255,0.05)", transition: "background 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "13px 14px", fontWeight: 700, color: "#9fcfc6", whiteSpace: "nowrap" }}>
                        <div>{b.batch_id}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>☕ Robusta</div>
                      </td>
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ fontWeight: 600 }}>{b.farmer_name || "—"}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{b.farmer_email}</div>
                        <div style={{ fontSize: 10, color: "#9fcfc6", marginTop: 2 }}>🏦 Ví nội bộ</div>
                      </td>
                      <td style={{ padding: "13px 14px" }}>
                        <strong>{Number(b.quantity).toLocaleString()}</strong>
                        <span style={{ color: "#9fcfc6", marginLeft: 4, fontSize: 11 }}>{b.quality_grade}</span>
                      </td>
                      <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.5)" }}>
                        {b.estimated_value ? Number(b.estimated_value).toLocaleString("vi-VN") + "₫" : "—"}
                      </td>
                      <td style={{ padding: "13px 14px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                        {new Date(b.created_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td style={{ padding: "13px 14px" }}>
                        <button
                          onClick={() => setExpandedDocs(docsExpanded ? null : b.id)}
                          style={{ padding: "4px 10px", background: "rgba(159,207,198,0.1)", border: "1px solid rgba(159,207,198,0.2)", color: "#9fcfc6", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
                        >
                          📂 {b.doc_count > 0 ? `${b.doc_count} file` : "Xem"}
                          {docsExpanded ? " ▲" : " ▼"}
                        </button>
                      </td>
                      <td style={{ padding: "13px 14px" }}><StatusBadge status={b.status} /></td>
                      <td style={{ padding: "13px 14px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" }}>
                          <button onClick={() => navigate(`/admin/batch/${b.id}`)}
                            style={{ padding: "5px 10px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                            👁 Xem
                          </button>
                          {b.status === "PENDING_MINT_APPROVAL" && (
                            <>
                              <button
                                onClick={() => handleApprove(b)}
                                disabled={isProcessing}
                                style={{ padding: "5px 10px", background: isProcessing ? "#555" : "#27ae60", border: "none", color: "#fff", borderRadius: 6, cursor: isProcessing ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}
                              >
                                {isProcessing && approve.variables?.id === b.id ? "⏳" : "✅ Mint"}
                              </button>
                              <button
                                onClick={() => setRejectTarget(b)}
                                disabled={isProcessing}
                                style={{ padding: "5px 10px", background: "#e74c3c", border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                              >
                                ❌
                              </button>
                            </>
                          )}
                          {b.status === "MINTED" && (
                            <div style={{ fontSize: 11, color: "#27ae60", display: "flex", alignItems: "center", gap: 4 }}>
                              🏦 Ví nội bộ
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    {docsExpanded && (
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <td colSpan={8} style={{ padding: "0 14px 14px" }}>
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
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", marginTop: 20 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 12px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: page === 1 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: page === 1 ? "default" : "pointer" }}>«</button>
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} style={{ padding: "6px 14px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: page === 1 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: page === 1 ? "default" : "pointer" }}>← Trước</button>
          <span style={{ padding: "6px 14px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Trang {page} / {Math.ceil(total / 10)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={batches.length < 10} style={{ padding: "6px 14px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: batches.length < 10 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer" }}>Sau →</button>
          <button onClick={() => setPage(Math.ceil(total / 10))} disabled={batches.length < 10} style={{ padding: "6px 12px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: batches.length < 10 ? "rgba(255,255,255,0.3)" : "#fff", borderRadius: 6, cursor: batches.length < 10 ? "default" : "pointer" }}>»</button>
        </div>
      )}
    </DashboardLayout>
  );
}
