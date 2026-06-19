import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches, useBatch } from "../hooks/useBatches";

const C = { accent: "#00d4aa", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b" };

const DOC_LABELS = {
  harvest_certificate: { label: "Harvest Certificate",   icon: "📜" },
  quality_inspection:  { label: "Quality Inspection",    icon: "🔬" },
  coffee_photos:       { label: "Coffee Photos",         icon: "📷" },
  additional_docs:     { label: "Additional Documents",  icon: "📄" },
};

function DocItem({ doc }) {
  const ext = doc.file_name?.split(".").pop()?.toLowerCase();
  const isImg = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  const fmeta = DOC_LABELS[doc.document_type] || { label: doc.document_type, icon: "📄" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 7, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: 6 }}>
      <div style={{ fontSize: 20, flexShrink: 0 }}>{isImg ? "🖼️" : isPdf ? "📄" : "📎"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.file_name}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {fmeta.icon} {fmeta.label}
          {doc.uploaded_at && ` · ${new Date(doc.uploaded_at).toLocaleDateString("en-GB")}`}
        </div>
        {doc.ipfs_cid && (
          <div style={{ fontSize: 10, color: C.accent, marginTop: 2, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            IPFS: {doc.ipfs_cid}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {doc.file_path && (
          <a href={`/uploads/${doc.file_path.replace(/\\/g, "/").split("uploads/")[1]}`} target="_blank" rel="noreferrer"
            style={{ padding: "4px 10px", background: "rgba(0,212,170,0.1)", color: C.accent, border: "1px solid rgba(0,212,170,0.2)", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            View
          </a>
        )}
        {doc.ipfs_cid && (
          <a href={`https://ipfs.io/ipfs/${doc.ipfs_cid}`} target="_blank" rel="noreferrer"
            style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", color: C.muted, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>
            IPFS
          </a>
        )}
      </div>
    </div>
  );
}

function BatchDocs({ batchId }) {
  const { data, isLoading } = useBatch(batchId);
  const docs = data?.batch?.documents || [];

  const grouped = docs.reduce((acc, d) => {
    if (!acc[d.document_type]) acc[d.document_type] = [];
    acc[d.document_type].push(d);
    return acc;
  }, {});

  if (isLoading) return <div style={{ padding: "12px 0", color: C.muted, fontSize: 13 }}>Loading documents…</div>;
  if (docs.length === 0) return <div style={{ padding: "12px 0", color: C.muted, fontSize: 13 }}>No documents for this batch.</div>;

  return (
    <div>
      {Object.entries(grouped).map(([type, items]) => {
        const meta = DOC_LABELS[type] || { label: type, icon: "📄" };
        return (
          <div key={type} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
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
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [filter, setFilter] = useState("");

  const { data, isLoading } = useMyBatches({ limit: 50 });
  const batches = (data?.batches || []).filter(b =>
    !filter || b.batch_id?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <FarmerLayout title="Documents">
      <div style={{ display: "grid", gridTemplateColumns: selectedBatch ? "340px 1fr" : "1fr", gap: 16, width: "100%" }}>

        {/* Left panel - batch list */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📁 Documents</h2>
            <button onClick={() => nav("/farmer/assets/submit")} style={{ padding: "6px 12px", background: "#00d4aa", color: "#000", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+ Upload</button>
          </div>

          <input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Search batches…"
            style={{ width: "100%", padding: "8px 12px", background: "#141f2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#e2e8f0", fontSize: 13, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
            {batches.length} Batches
          </div>

          {isLoading && <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading…</div>}
          {!isLoading && batches.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>
              No batches found.
            </div>
          )}

          {batches.map(b => {
            const sel = selectedBatch === b.id;
            const sm = {
              PENDING_MINT_APPROVAL: { color: C.gold },
              MINTED: { color: C.green },
              REJECTED: { color: C.red },
            };
            const sc = sm[b.status]?.color || C.muted;
            return (
              <button key={b.id} onClick={() => setSelectedBatch(sel ? null : b.id)}
                style={{ width: "100%", display: "block", padding: "12px 14px", background: sel ? "rgba(0,212,170,0.08)" : "#141f2e", border: `1px solid ${sel ? "rgba(0,212,170,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, cursor: "pointer", textAlign: "left", marginBottom: 6, transition: "all 0.15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: sel ? C.accent : "#e2e8f0", fontFamily: "monospace" }}>{b.batch_id}</div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc, flexShrink: 0, marginTop: 4 }} />
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {Number(b.quantity).toLocaleString()} kg · {b.coffee_type || "ROBUSTA"}
                  {b.doc_count !== undefined && ` · ${b.doc_count} files`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right panel - documents */}
        {selectedBatch && (
          <div style={{ background: "#141f2e", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Batch Documents</div>
              <button onClick={() => setSelectedBatch(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <BatchDocs batchId={selectedBatch} />
          </div>
        )}

        {/* Empty state */}
        {!selectedBatch && !isLoading && batches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#141f2e", borderRadius: 10, border: "1px dashed rgba(255,255,255,0.1)", color: C.muted, fontSize: 14, padding: 40, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
              <div>Select a batch to view its documents</div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        {Object.entries(DOC_LABELS).map(([, m]) => (
          <div key={m.label} style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
            <span>{m.icon}</span> {m.label}
          </div>
        ))}
      </div>
    </FarmerLayout>
  );
}
