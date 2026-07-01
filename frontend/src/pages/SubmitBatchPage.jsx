import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useSubmitBatch } from "../hooks/useBatches";

const C = { green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#487573", muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };

const DOC_CATEGORIES = [
  { key: "harvest_certificate", label: "Giấy chứng nhận thu hoạch cà phê", required: true, multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "quality_inspection",  label: "Báo cáo kiểm định chất lượng",     required: true,  multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "coffee_photos",       label: "Ảnh lô cà phê",                    required: true,  multiple: true,  accept: ".jpg,.jpeg,.png,.webp" },
  { key: "additional_docs",     label: "Tài liệu bổ sung",                 required: false, multiple: true,  accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
];

const S = {
  label:  { display: "block", marginBottom: 6, color: C.tealLight, fontSize: 13, fontWeight: 600 },
  input:  { width: "100%", padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
  group:  { marginBottom: 18 },
  errMsg: { color: C.red, fontSize: 12, marginTop: 4 },
};

function FileUploadCard({ doc, files, onFiles, error }) {
  const ref = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    const filtered = doc.multiple ? dropped : [dropped[0]];
    onFiles(filtered);
  };

  const handleChange = (e) => {
    const selected = Array.from(e.target.files);
    onFiles(selected);
    e.target.value = "";
  };

  const remove = (idx) => onFiles(files.filter((_, i) => i !== idx));

  const hasFiles = files.length > 0;
  const borderColor = error ? C.red : hasFiles ? C.green : C.border;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ ...S.label, marginBottom: 0 }}>
          {doc.label}
        </span>
        {doc.required && <span style={{ color: C.red, fontSize: 12, fontWeight: 700 }}>*</span>}
        {hasFiles && <span style={{ color: C.green, fontSize: 12 }}>✓ {files.length} file</span>}
      </div>

      <div
        onClick={() => ref.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border: `1px dashed ${borderColor}`,
          borderRadius: 8,
          padding: "12px 16px",
          cursor: "pointer",
          background: hasFiles ? "rgba(14,203,129,0.04)" : "rgba(255,255,255,0.01)",
          transition: "all 0.2s",
        }}
      >
        {hasFiles ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
                <span style={{ color: C.tealLight }}>📄</span>
                <span style={{ color: "rgba(255,255,255,0.7)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{(f.size / 1024).toFixed(0)}KB</span>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
            ))}
            {doc.multiple && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.tealLight, fontSize: 12 }}>+ Thêm file</div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>☁️</div>
            <div>Kéo thả hoặc <span style={{ color: C.tealLight }}>chọn file</span></div>
            <div style={{ fontSize: 11, marginTop: 2 }}>PDF, JPG, PNG{doc.multiple ? " — nhiều file" : ""} · Tối đa 20MB</div>
          </div>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        multiple={doc.multiple}
        accept={doc.accept}
        style={{ display: "none" }}
        onChange={handleChange}
      />
      {error && <div style={S.errMsg}>{error}</div>}
    </div>
  );
}

export default function SubmitBatchPage() {
  const navigate = useNavigate();
  const submit   = useSubmitBatch();

  const [form, setForm] = useState({
    quantity:          "",
    harvest_date:      "",
    storage_location:  "",
    batch_description: "",
  });
  const [fileMap, setFileMap]   = useState({});
  const [errors,  setErrors]    = useState({});
  const [uploading, setUploading] = useState(false);

  const setField = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((v) => ({ ...v, [k]: "" }));
  };

  const setFiles = (docKey) => (files) => {
    setFileMap((m) => ({ ...m, [docKey]: files }));
    setErrors((v) => ({ ...v, [docKey]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.quantity || Number(form.quantity) <= 0) e.quantity = "Khối lượng phải lớn hơn 0";
    for (const doc of DOC_CATEGORIES) {
      if (doc.required && (!fileMap[doc.key] || fileMap[doc.key].length === 0)) {
        e[doc.key] = "Tài liệu này là bắt buộc";
      }
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    const fd = new FormData();
    fd.append("quantity",          form.quantity);
    fd.append("harvest_date",      form.harvest_date);
    fd.append("storage_location",  form.storage_location);
    fd.append("batch_description", form.batch_description);

    for (const [docKey, files] of Object.entries(fileMap)) {
      for (const file of files) {
        fd.append(docKey, file);
      }
    }

    setUploading(true);
    try {
      const res = await submit.mutateAsync(fd);
      if (res?.success) navigate("/farmer/status");
    } finally {
      setUploading(false);
    }
  };

  const totalFiles = Object.values(fileMap).reduce((s, arr) => s + (arr?.length || 0), 0);
  const requiredDone = DOC_CATEGORIES.filter(d => d.required).every(d => fileMap[d.key]?.length > 0);

  return (
    <FarmerLayout title="Gửi lô hàng mới">
      <div style={{ width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📦 Tạo Lô Hàng Cà Phê Robusta</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}>
            Điền thông tin lô hàng và tải lên đầy đủ tài liệu để gửi yêu cầu tokenization.
          </p>
        </div>

        {/* Batch Info */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, color: C.tealLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            📋 Thông tin lô hàng
          </h3>

          {/* Loại cà phê — hardcoded, not editable */}
          <div style={{ ...S.group, background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>☕</span>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loại cà phê</div>
              <div style={{ fontWeight: 700, color: C.tealLight }}>ROBUSTA COFFEE</div>
            </div>
          </div>

          <div style={S.group}>
            <label style={S.label}>Khối lượng (kg) *</label>
            <input
              style={{ ...S.input, borderColor: errors.quantity ? C.red : undefined }}
              type="number" min="0.1" step="0.1"
              value={form.quantity} onChange={setField("quantity")}
              placeholder="VD: 1000"
            />
            {errors.quantity && <div style={S.errMsg}>{errors.quantity}</div>}
          </div>

          <div style={S.group}>
            <label style={S.label}>Ngày thu hoạch</label>
            <input style={S.input} type="date" value={form.harvest_date} onChange={setField("harvest_date")} />
          </div>

          <div style={S.group}>
            <label style={S.label}>Kho lưu trữ</label>
            <input style={S.input} value={form.storage_location} onChange={setField("storage_location")} placeholder="Địa chỉ kho hoặc tên kho" />
          </div>

          <div style={S.group}>
            <label style={S.label}>Mô tả lô hàng</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: "vertical" }}
              value={form.batch_description} onChange={setField("batch_description")}
              placeholder="Mô tả thêm về lô cà phê: vùng trồng, điều kiện canh tác, đặc điểm..."
            />
          </div>
        </div>

        {/* Document Uploads */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: C.tealLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📂 Tài liệu chứng minh
            </h3>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {totalFiles} file đã chọn •{" "}
              <span style={{ color: requiredDone ? C.green : C.gold }}>
                {requiredDone ? "✓ Đủ tài liệu bắt buộc" : "⚠ Còn thiếu tài liệu bắt buộc"}
              </span>
            </div>
          </div>

          {DOC_CATEGORIES.map((doc) => (
            <FileUploadCard
              key={doc.key}
              doc={doc}
              files={fileMap[doc.key] || []}
              onFiles={setFiles(doc.key)}
              error={errors[doc.key]}
            />
          ))}

          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(72,117,115,0.05)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.4)", borderLeft: `2px solid ${C.accent}` }}>
            Tất cả tài liệu sẽ được tự động tải lên IPFS để đảm bảo tính minh bạch và không thể thay đổi.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={uploading || submit.isPending}
            style={{
              padding: "11px 32px",
              background: uploading || submit.isPending ? "#555" : C.accent,
              color: "#fff", border: "none", borderRadius: 9, fontWeight: 700,
              cursor: uploading || submit.isPending ? "not-allowed" : "pointer",
              fontSize: 15, display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {uploading || submit.isPending
              ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Đang tải lên & gửi...</>
              : "📤 Gửi yêu cầu Tokenization"}
          </button>
          <button
            onClick={() => navigate("/farmer/status")}
            disabled={uploading || submit.isPending}
            style={{ padding: "11px 20px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 15 }}
          >
            Hủy
          </button>
        </div>

        {/* Workflow guide */}
        <div style={{ marginTop: 24, background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ color: C.tealLight, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📋 Quy trình Tokenization — Sàn giao dịch nội bộ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { step: "1", icon: "📤", text: "Gửi lô hàng & tài liệu",   sub: "CHỜ DUYỆT" },
              { step: "2", icon: "🔍", text: "Kiểm định chất lượng",    sub: "Báo cáo kho IPFS" },
              { step: "3", icon: "⛓️", text: "Mint Token on-chain",     sub: "Token CaRo" },
              { step: "4", icon: "🏦", text: "Nhận vào ví nội bộ",     sub: "Có thể giao dịch" },
            ].map((s) => (
              <div key={s.step} style={{ textAlign: "center", padding: "10px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{s.text}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </FarmerLayout>
  );
}
