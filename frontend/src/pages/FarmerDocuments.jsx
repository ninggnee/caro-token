import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches, useBatch } from "../hooks/useBatches";

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  gold: "#f0b90b", card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};

const DOC_LABELS = {
  harvest_certificate: { label: "Giấy chứng nhận thu hoạch", icon: "📜" },
  quality_inspection:  { label: "Báo cáo kiểm tra chất lượng", icon: "🔬" },
  coffee_photos:       { label: "Ảnh sản phẩm",               icon: "📷" },
  additional_docs:     { label: "Tài liệu bổ sung",           icon: "📄" },
};

const STATUS_MAP = {
  PENDING_MINT_APPROVAL: { label: "Chờ duyệt",  color: "#f0b90b" },
  APPROVED:              { label: "Đã duyệt",   color: "#487573" },
  MINTED:                { label: "Đã Mint",    color: "#0ecb81" },
  REJECTED:              { label: "Bị từ chối", color: "#f6465d" },
};

function DocItem({ doc }) {
  const ext = doc.file_name?.split(".").pop()?.toLowerCase();
  const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  const meta = DOC_LABELS[doc.document_type] || { label: doc.document_type, icon: "📄" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 7, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>{isImg ? "🖼️" : isPdf ? "📄" : "📎"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {meta.icon} {meta.label}
          {doc.uploaded_at && ` · ${new Date(doc.uploaded_at).toLocaleDateString("vi-VN")}`}
        </div>
        {doc.ipfs_cid && (
          <div style={{ fontSize: 10, color: C.tealLight, marginTop: 2, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            IPFS: {doc.ipfs_cid}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {doc.file_path && (
          <a href={`/uploads/${doc.file_path.replace(/\\/g, "/").split("uploads/")[1]}`}
            target="_blank" rel="noreferrer"
            style={{ padding: "4px 10px", background: "rgba(72,117,115,0.1)", color: C.tealLight, border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
            Xem
          </a>
        )}
        {doc.ipfs_cid && (
          <a href={`https://ipfs.io/ipfs/${doc.ipfs_cid}`} target="_blank" rel="noreferrer"
            style={{ padding: "4px 10px", background: "rgba(255,255,255,0.04)", color: C.muted, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
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
        <div style={{ padding: "12px 16px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.25)", borderRadius: 9, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: rejectionReason ? 6 : 10 }}>
            ⚠ Lô hàng bị từ chối — cần bổ sung giấy tờ
          </div>
          {rejectionReason && (
            <div style={{ fontSize: 12, color: "#e2e8f0", marginBottom: 12 }}>
              <b>Lý do:</b> {rejectionReason}
            </div>
          )}
          <button
            onClick={() => nav(`/farmer/batch/${batch.id}/supplement`)}
            style={{ padding: "8px 16px", background: C.red, color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            📎 Bổ sung giấy tờ
          </button>
        </div>
      )}

      {isLoading && <div style={{ padding: "16px 0", color: C.muted, fontSize: 13 }}>Đang tải giấy tờ…</div>}
      {!isLoading && docs.length === 0 && (
        <div style={{ padding: "16px 0", color: C.muted, fontSize: 13 }}>Lô hàng này chưa có giấy tờ nào.</div>
      )}

      {Object.entries(grouped).map(([type, items]) => {
        const meta = DOC_LABELS[type] || { label: type, icon: "📄" };
        return (
          <div key={type} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, width: "100%", alignItems: "start" }}>

        {/* ── Left panel: batch list ── */}
        <div>
          <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>📂 Giấy tờ theo lô hàng</h2>

          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Tìm theo Batch ID…"
            style={{ width: "100%", padding: "8px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, color: "#e2e8f0", fontSize: 13, outline: "none", marginBottom: 12, boxSizing: "border-box" }}
          />

          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            {batches.length} lô hàng
          </div>

          {isLoading && (
            <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>Đang tải…</div>
          )}

          {!isLoading && batches.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: C.muted, fontSize: 13, background: C.card, borderRadius: 9, border: `1px solid ${C.border}` }}>
              Chưa có lô hàng nào.
              <br />
              <button
                onClick={() => nav("/farmer/status/submit")}
                style={{ marginTop: 10, color: C.tealLight, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                Gửi lô hàng đầu tiên →
              </button>
            </div>
          )}

          {batches.map(b => {
            const sel = selectedId === b.id;
            const sm = STATUS_MAP[b.status] || { label: b.status, color: C.muted };
            return (
              <button
                key={b.id}
                onClick={() => setSelectedId(sel ? null : b.id)}
                style={{ width: "100%", display: "block", padding: "12px 14px", background: sel ? "rgba(72,117,115,0.1)" : C.card, border: `1px solid ${sel ? C.accent : C.border}`, borderRadius: 9, cursor: "pointer", textAlign: "left", marginBottom: 6, transition: "all 0.15s" }}
                onMouseEnter={e => { if (!sel) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = "rgba(72,117,115,0.05)"; } }}
                onMouseLeave={e => { if (!sel) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; } }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sel ? C.tealLight : "#e2e8f0", fontFamily: "monospace" }}>
                    {b.batch_id}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: sm.color, background: sm.color + "18", padding: "2px 7px", borderRadius: 10, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {sm.label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {Number(b.quantity).toLocaleString()} kg · {b.coffee_type || "ROBUSTA"}
                  {b.doc_count !== undefined && ` · ${b.doc_count} tệp`}
                </div>
                {b.status === "REJECTED" && (
                  <div style={{ marginTop: 5, fontSize: 10, color: C.red, fontWeight: 600 }}>
                    ⚠ Cần bổ sung giấy tờ
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Right panel: documents for selected batch ── */}
        <div>
          {/* Empty state */}
          {!selectedId && !isLoading && batches.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.card, borderRadius: 10, border: `1px dashed ${C.border}`, color: C.muted, fontSize: 14, padding: 60, textAlign: "center", minHeight: 240 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <div>Chọn một lô hàng để xem giấy tờ</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Giấy tờ được liên kết và lưu trữ trên IPFS khi lô hàng được tạo</div>
            </div>
          )}

          {/* Selected batch documents */}
          {selectedId && selected && (
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
              {/* Batch header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Lô hàng</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.tealLight, fontFamily: "monospace", marginBottom: 4 }}>
                    {selected.batch_id}
                  </div>
                  <div style={{ fontSize: 12, color: "#e2e8f0" }}>
                    {Number(selected.quantity).toLocaleString()} kg · {selected.coffee_type || "ROBUSTA"}
                    {selected.created_at && ` · ${new Date(selected.created_at).toLocaleDateString("vi-VN")}`}
                  </div>
                  {selected.doc_count !== undefined && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{selected.doc_count} tệp đã tải lên</div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0, flexShrink: 0 }}>
                  ×
                </button>
              </div>

              <BatchDocsPanel batch={selected} nav={nav} />
            </div>
          )}

          {isLoading && (
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
              Đang tải…
            </div>
          )}
        </div>
      </div>

      {/* Doc type legend */}
      <div style={{ marginTop: 20, display: "flex", gap: 20, flexWrap: "wrap" }}>
        {Object.entries(DOC_LABELS).map(([, m]) => (
          <div key={m.label} style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{m.icon}</span> {m.label}
          </div>
        ))}
      </div>
    </FarmerLayout>
  );
}
