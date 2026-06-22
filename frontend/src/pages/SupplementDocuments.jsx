import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useBatch } from "../hooks/useBatches";
import axios from "../utils/axiosClient";

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  gold: "#f0b90b", card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};

const DOC_TYPES = [
  { key: "harvest_certificate", label: "Giấy chứng nhận thu hoạch",  icon: "📜", required: true  },
  { key: "quality_inspection",  label: "Báo cáo kiểm tra chất lượng", icon: "🔬", required: true  },
  { key: "coffee_photos",       label: "Ảnh sản phẩm",                icon: "📷", required: true  },
  { key: "additional_docs",     label: "Tài liệu bổ sung",            icon: "📄", required: false },
];

function FileDropZone({ docType, label, icon, selected, onChange }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    onChange(docType, dropped);
  };

  return (
    <div style={{ background: C.card, borderRadius: 9, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 10 }}>
        {icon} {label}
      </div>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ display: "block", cursor: "pointer" }}>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={e => onChange(docType, Array.from(e.target.files || []))}
          style={{ display: "none" }}
        />
        <div style={{
          padding: "14px 16px",
          background: dragging ? "rgba(72,117,115,0.08)" : "rgba(255,255,255,0.02)",
          border: `1px dashed ${selected.length > 0 ? C.tealLight : dragging ? C.accent : C.border}`,
          borderRadius: 7,
          textAlign: "center",
          fontSize: 12,
          color: selected.length > 0 ? C.tealLight : C.muted,
          transition: "all 0.15s",
        }}>
          {selected.length > 0
            ? selected.map(f => f.name).join(" · ")
            : "Nhấp để chọn hoặc kéo thả tệp vào đây (PDF, JPG, PNG · Tối đa 20 MB)"}
        </div>
      </label>
      {selected.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {selected.map((f, i) => (
            <span key={i} style={{ fontSize: 10, color: C.tealLight, background: "rgba(72,117,115,0.1)", padding: "2px 8px", borderRadius: 10 }}>
              {f.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupplementDocuments() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const batchQ = useBatch(id);
  const batch = batchQ.data?.batch;

  const [files, setFiles] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (docType, fileList) => {
    setFiles(prev => ({ ...prev, [docType]: fileList }));
  };

  const totalFiles = Object.values(files).flat().length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalFiles === 0) {
      setError("Vui lòng chọn ít nhất một tệp để bổ sung.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    for (const [docType, fileList] of Object.entries(files)) {
      for (const file of fileList) {
        formData.append(docType, file);
      }
    }

    try {
      await axios.post(`/batches/${id}/supplement`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // Invalidate so Giấy tờ page and batch detail both refresh
      qc.invalidateQueries({ queryKey: ["batches"] });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Bổ sung thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (batchQ.isLoading) {
    return (
      <FarmerLayout title="Bổ sung giấy tờ">
        <div style={{ color: C.muted, fontSize: 13, padding: 40, textAlign: "center" }}>Đang tải thông tin lô hàng…</div>
      </FarmerLayout>
    );
  }

  if (batchQ.isError || !batch) {
    return (
      <FarmerLayout title="Bổ sung giấy tờ">
        <div style={{ color: C.red, fontSize: 13, padding: 40, textAlign: "center" }}>Không tìm thấy lô hàng.</div>
      </FarmerLayout>
    );
  }

  // Block supplement for non-rejected batches (belt-and-suspenders, backend enforces too)
  if (batch.status !== "REJECTED") {
    return (
      <FarmerLayout title="Bổ sung giấy tờ">
        <div style={{ maxWidth: 480, padding: "40px 24px", textAlign: "center", color: C.muted, fontSize: 14 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <div>Lô hàng <b style={{ color: "#e2e8f0" }}>{batch.batch_id}</b> không cần bổ sung giấy tờ.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Chỉ lô hàng bị từ chối mới cần bổ sung.</div>
          <button
            onClick={() => nav("/farmer/warehouse-docs")}
            style={{ marginTop: 20, padding: "8px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            Về Giấy tờ
          </button>
        </div>
      </FarmerLayout>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <FarmerLayout title="Bổ sung giấy tờ">
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginBottom: 8 }}>Bổ sung thành công!</div>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>
            Lô hàng <b style={{ color: "#e2e8f0" }}>{batch.batch_id}</b> đã được gửi lại để xét duyệt.
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 28 }}>
            Admin sẽ xem xét giấy tờ bổ sung và thông báo kết quả.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => nav("/farmer/warehouse-docs")}
              style={{ padding: "10px 24px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Về Giấy tờ
            </button>
            <button
              onClick={() => nav("/farmer/status")}
              style={{ padding: "10px 20px", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              Trạng thái lô hàng
            </button>
          </div>
        </div>
      </FarmerLayout>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <FarmerLayout title="Bổ sung giấy tờ">
      <div style={{ maxWidth: 640, display: "grid", gap: 20 }}>

        {/* Batch info card */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Lô hàng</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.tealLight, fontFamily: "monospace", marginBottom: 4 }}>{batch.batch_id}</div>
          <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: batch.rejection_reason ? 10 : 0 }}>
            {Number(batch.quantity).toLocaleString()} kg · {batch.coffee_type || "ROBUSTA"}
            {batch.created_at && ` · Ngày tạo: ${new Date(batch.created_at).toLocaleDateString("vi-VN")}`}
          </div>
          {batch.rejection_reason && (
            <div style={{ padding: "10px 14px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 8, fontSize: 12, color: "#e2e8f0" }}>
              <b style={{ color: C.red }}>Lý do từ chối:</b> {batch.rejection_reason}
            </div>
          )}
        </div>

        {/* Upload form */}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div style={{ padding: "14px 18px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 9 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>📎 Tải lên giấy tờ bổ sung</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Chọn tệp theo từng loại giấy tờ. Tất cả tệp sẽ được lưu trên IPFS và liên kết với lô hàng <b style={{ color: "#e2e8f0" }}>{batch.batch_id}</b>.
              Sau khi bổ sung, lô hàng sẽ được gửi lại để Admin xét duyệt.
            </div>
          </div>

          {DOC_TYPES.map(dt => (
            <FileDropZone
              key={dt.key}
              docType={dt.key}
              label={dt.label}
              icon={dt.icon}
              selected={files[dt.key] || []}
              onChange={handleFileChange}
            />
          ))}

          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 8, fontSize: 13, color: C.red }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button
              type="button"
              onClick={() => nav(-1)}
              style={{ padding: "10px 20px", background: "rgba(255,255,255,0.06)", color: "#e2e8f0", border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              Quay lại
            </button>
            <button
              type="submit"
              disabled={submitting || totalFiles === 0}
              style={{ flex: 1, padding: "11px 24px", background: (submitting || totalFiles === 0) ? "rgba(72,117,115,0.4)" : C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: (submitting || totalFiles === 0) ? "not-allowed" : "pointer", fontSize: 14, transition: "background 0.15s" }}>
              {submitting
                ? "⏳ Đang tải lên IPFS…"
                : totalFiles > 0
                  ? `📎 Bổ sung ${totalFiles} tệp & Gửi lại duyệt`
                  : "Chọn tệp để bổ sung"}
            </button>
          </div>
        </form>

      </div>
    </FarmerLayout>
  );
}
