import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches, useBatch } from "../hooks/useBatches";
import { formatKg } from '../utils/formatters';

const DOC_LABELS = {
  harvest_certificate: { label: "Giấy chứng nhận thu hoạch", icon: "📜" },
  quality_inspection:  { label: "Báo cáo kiểm tra chất lượng", icon: "🔬" },
  coffee_photos:       { label: "Ảnh sản phẩm",               icon: "📷" },
  additional_docs:     { label: "Tài liệu bổ sung",           icon: "📄" },
};

const STATUS_MAP = {
  PENDING_MINT_APPROVAL: { label: "Chờ duyệt",  cls: "caro-badge-warning" },
  APPROVED:              { label: "Đã duyệt",   cls: "caro-badge-success" },
  MINTED:                { label: "Đã Mint",    cls: "caro-badge-success" },
  REJECTED:              { label: "Bị từ chối", cls: "caro-badge-danger" },
};

function DocItem({ doc }) {
  const ext = doc.file_name?.split(".").pop()?.toLowerCase();
  const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  const meta = DOC_LABELS[doc.document_type] || { label: doc.document_type, icon: "📄" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", marginBottom: 8 }}>
      <div style={{ fontSize: 24, flexShrink: 0 }}>{isImg ? "🖼️" : isPdf ? "📄" : "📎"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          {meta.icon} {meta.label}
          {doc.uploaded_at && ` · ${new Date(doc.uploaded_at).toLocaleDateString("vi-VN")}`}
        </div>
        {doc.ipfs_cid && (
          <div style={{ fontSize: 11, color: "#408A71", marginTop: 4, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            IPFS: {doc.ipfs_cid}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {doc.file_path && (
          <a href={`/uploads/${doc.file_path.replace(/\\/g, "/").split("uploads/")[1]}`}
            target="_blank" rel="noreferrer"
            className="caro-btn caro-btn-sm caro-btn-primary" style={{ textDecoration: "none", padding: "6px 12px" }}>
            Xem
          </a>
        )}
        {doc.ipfs_cid && (
          <a href={`https://ipfs.io/ipfs/${doc.ipfs_cid}`} target="_blank" rel="noreferrer"
            className="caro-btn caro-btn-sm caro-btn-ghost" style={{ textDecoration: "none", padding: "6px 12px" }}>
            IPFS
          </a>
        )}
      </div>
    </div>
  );
}

// Fetches and renders documents for the selected batch
function BatchDocsPanel({ batch, nav }) {
  const { data, isLoading } = useBatch(batch.id);
  const docs = data?.batch?.documents || [];
  const rejectionReason = data?.batch?.rejection_reason || batch.rejection_reason;

  const grouped = docs.reduce((acc, d) => {
    if (!acc[d.document_type]) acc[d.document_type] = [];
    acc[d.document_type].push(d);
    return acc;
  }, {});

  return (
    <div>
      {/* Rejection notice + supplement button — only for REJECTED batches */}
      {batch.status === "REJECTED" && (
        <div style={{ padding: "16px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#ef4444", marginBottom: rejectionReason ? 8 : 12 }}>
            ⚠️ Lô hàng bị từ chối — cần bổ sung giấy tờ
          </div>
          {rejectionReason && (
            <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 16 }}>
              <b>Lý do:</b> {rejectionReason}
            </div>
          )}
          <button
            onClick={() => nav(`/farmer/batch/${batch.id}/supplement`)}
            className="caro-btn caro-btn-danger">
            📎 Bổ sung giấy tờ
          </button>
        </div>
      )}

      {isLoading && <div style={{ padding: "20px 0", color: "#64748b", fontSize: 14 }}>Đang tải giấy tờ…</div>}
      {!isLoading && docs.length === 0 && (
        <div style={{ padding: "20px 0", color: "#64748b", fontSize: 14 }}>Lô hàng này chưa có giấy tờ nào.</div>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const meta = DOC_LABELS[type] || { label: type, icon: "📄" };
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
              {meta.icon} {meta.label} ({items.length})
            </div>
            {items.map(d => <DocItem key={d.id} doc={d} />)}
          </div>
        );
      })}
    </div>
  );
}

export default function FarmerDocuments() {
  const nav = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useMyBatches({ limit: 50 });
  const batches = (data?.batches || []).filter(b =>
    !filter || b.batch_id?.toLowerCase().includes(filter.toLowerCase())
  );

  const selected = batches.find(b => b.id === selectedId);

  return (
    <FarmerLayout title="Giấy tờ">
      <div className="caro-page">
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">📂 Giấy tờ lưu kho</h2>
            <p className="caro-page-subtitle">Quản lý các tài liệu liên kết với từng lô hàng</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24, width: "100%", alignItems: "start" }}>

          {/* ── Left panel: batch list ── */}
          <div className="caro-card" style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>Danh sách lô hàng</h3>

            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Tìm theo Mã lô (Batch ID)…"
              className="caro-input"
              style={{ marginBottom: 16 }}
            />

            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>
              Hiển thị {batches.length} lô hàng
            </div>

            {isLoading && (
              <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>
                <div style={{ animation: "caro-spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⏳</div>
                Đang tải…
              </div>
            )}

            {!isLoading && batches.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748b", fontSize: 14, background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed var(--border)" }}>
                Chưa có lô hàng nào.
                <br />
                <button
                  onClick={() => nav("/farmer/status/submit")}
                  className="caro-btn caro-btn-ghost" style={{ marginTop: 12 }}>
                  Gửi lô hàng đầu tiên →
                </button>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {batches.map(b => {
                const sel = selectedId === b.id;
                const sm = STATUS_MAP[b.status] || { label: b.status, cls: "caro-badge-muted" };
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedId(sel ? null : b.id)}
                    style={{ 
                      width: "100%", display: "block", padding: "14px 16px", borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                      background: sel ? "rgba(176, 228, 204,0.05)" : "rgba(255,255,255,0.02)", 
                      border: `1px solid ${sel ? "#B0E4CC" : "var(--border)"}`
                    }}
                    onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = "rgba(176, 228, 204,0.5)"; e.currentTarget.style.background = "rgba(176, 228, 204,0.02)"; } }}
                    onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; } }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: sel ? "#B0E4CC" : "#f8fafc", fontFamily: "monospace" }}>
                        {b.batch_id}
                      </div>
                      <span className={`caro-badge ${sm.cls}`} style={{ flexShrink: 0, padding: "2px 6px", fontSize: 10 }}>
                        {sm.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {formatKg(b.quantity)} · {b.coffee_type || "ROBUSTA"}
                      {b.doc_count !== undefined && ` · ${b.doc_count} tệp`}
                    </div>
                    {b.status === "REJECTED" && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444", fontWeight: 700 }}>
                        ⚠️ Cần bổ sung giấy tờ
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right panel: documents for selected batch ── */}
          <div>
            {/* Empty state */}
            {!selectedId && !isLoading && batches.length > 0 && (
              <div className="caro-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border)", color: "#64748b", fontSize: 15, padding: 80, textAlign: "center", minHeight: 300 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
                <div style={{ fontWeight: 600 }}>Chọn một lô hàng để xem giấy tờ</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>Giấy tờ được liên kết và lưu trữ trên IPFS khi lô hàng được tạo</div>
              </div>
            )}

            {/* Selected batch documents */}
            {selectedId && selected && (
              <div className="caro-card">
                {/* Batch header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Mã Lô Hàng</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#408A71", fontFamily: "monospace", marginBottom: 6 }}>
                      {selected.batch_id}
                    </div>
                    <div style={{ fontSize: 13, color: "#f8fafc" }}>
                      {formatKg(selected.quantity)} · {selected.coffee_type || "ROBUSTA"}
                      {selected.created_at && ` · ${new Date(selected.created_at).toLocaleDateString("vi-VN")}`}
                    </div>
                    {selected.doc_count !== undefined && (
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{selected.doc_count} tệp đã tải lên</div>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 4, flexShrink: 0, transition: "color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                    ×
                  </button>
                </div>

                <BatchDocsPanel batch={selected} nav={nav} />
              </div>
            )}

            {isLoading && (
              <div className="caro-card" style={{ padding: 60, textAlign: "center", color: "#64748b", fontSize: 14 }}>
                <div style={{ animation: "caro-spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⏳</div>
                Đang tải…
              </div>
            )}
          </div>
        </div>

        {/* Doc type legend */}
        <div style={{ marginTop: 24, display: "flex", gap: 24, flexWrap: "wrap", padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
          {Object.entries(DOC_LABELS).map(([, m]) => (
            <div key={m.label} style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <span>{m.icon}</span> {m.label}
            </div>
          ))}
        </div>
      </div>
    </FarmerLayout>
  );
}
