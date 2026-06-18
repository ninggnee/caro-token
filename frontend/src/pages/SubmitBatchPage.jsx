import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useSubmitBatch } from "../hooks/useBatches";

const GRADES = [
  { value: "CR1", label: "CR1 — Xuất sắc" },
  { value: "CR2", label: "CR2 — Tốt" },
  { value: "CR3", label: "CR3 — Trung bình" },
];

const DOC_CATEGORIES = [
  { key: "farmer_identity",     label: "Xác minh danh tính nông dân",     required: true,  multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "farm_ownership",      label: "Giấy chứng nhận quyền sở hữu đất", required: true, multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "harvest_certificate", label: "Giấy chứng nhận thu hoạch cà phê", required: true, multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "warehouse_receipt",   label: "Phiếu nhập kho",                   required: true,  multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "quality_inspection",  label: "Báo cáo kiểm định chất lượng",     required: true,  multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "coffee_photos",       label: "Ảnh lô cà phê",                    required: true,  multiple: true,  accept: ".jpg,.jpeg,.png,.webp" },
  { key: "additional_docs",     label: "Tài liệu bổ sung",                 required: false, multiple: true,  accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
];

const S = {
  label:  { display: "block", marginBottom: 6, color: "#9fcfc6", fontSize: 13, fontWeight: 600 },
  input:  { width: "100%", padding: "10px 14px", background: "#0b1113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
  group:  { marginBottom: 18 },
  errMsg: { color: "#e74c3c", fontSize: 12, marginTop: 4 },
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
  const borderColor = error ? "#e74c3c" : hasFiles ? "#27ae60" : "rgba(255,255,255,0.12)";

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ ...S.label, marginBottom: 0 }}>
          {doc.label}
        </span>
        {doc.required && <span style={{ color: "#e74c3c", fontSize: 12, fontWeight: 700 }}>*</span>}
        {hasFiles && <span style={{ color: "#27ae60", fontSize: 12 }}>✓ {files.length} file</span>}
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
          background: hasFiles ? "rgba(39,174,96,0.04)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s",
        }}
      >
        {hasFiles ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 8px", fontSize: 12 }}>
                <span style={{ color: "#9fcfc6" }}>📄</span>
                <span style={{ color: "rgba(255,255,255,0.7)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{(f.size / 1024).toFixed(0)}KB</span>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
            ))}
            {doc.multiple && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#9fcfc6", fontSize: 12 }}>+ Thêm file</div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>☁️</div>
            <div>Kéo thả hoặc <span style={{ color: "#9fcfc6" }}>chọn file</span></div>
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
    quantity:         "",
    quality_grade:    "CR1",
    harvest_date:     "",
    storage_location: "",
    estimated_value:  "",
    batch_description:"",
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
    fd.append("quality_grade",     form.quality_grade);
    fd.append("harvest_date",      form.harvest_date);
    fd.append("storage_location",  form.storage_location);
    fd.append("estimated_value",   form.estimated_value);
    fd.append("batch_description", form.batch_description);

    for (const [docKey, files] of Object.entries(fileMap)) {
      for (const file of files) {
        fd.append(docKey, file);
      }
    }

    setUploading(true);
    try {
      const res = await submit.mutateAsync(fd);
      if (res?.success) navigate("/farmer/assets");
    } finally {
      setUploading(false);
    }
  };

  const totalFiles = Object.values(fileMap).reduce((s, arr) => s + (arr?.length || 0), 0);
  const requiredDone = DOC_CATEGORIES.filter(d => d.required).every(d => fileMap[d.key]?.length > 0);

  return (
    <FarmerLayout title="Submit Batch">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📦 Tạo Batch Cà Phê Robusta</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}>
            Điền thông tin lô hàng và tải lên đầy đủ tài liệu để gửi yêu cầu tokenization.
          </p>
        </div>

        {/* Batch Info */}
        <div style={{ background: "#141a1f", borderRadius: 12, padding: 24, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, color: "#9fcfc6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            📋 Thông tin lô hàng
          </h3>

          {/* Loại cà phê — hardcoded, not editable */}
          <div style={{ ...S.group, background: "rgba(159,207,198,0.06)", border: "1px solid rgba(159,207,198,0.15)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>☕</span>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loại cà phê</div>
              <div style={{ fontWeight: 700, color: "#9fcfc6" }}>ROBUSTA COFFEE</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.group}>
              <label style={S.label}>Khối lượng (kg) *</label>
              <input
                style={{ ...S.input, borderColor: errors.quantity ? "#e74c3c" : undefined }}
                type="number" min="0.1" step="0.1"
                value={form.quantity} onChange={setField("quantity")}
                placeholder="VD: 1000"
              />
              {errors.quantity && <div style={S.errMsg}>{errors.quantity}</div>}
            </div>
            <div style={S.group}>
              <label style={S.label}>Chất lượng (Grade) *</label>
              <select style={S.input} value={form.quality_grade} onChange={setField("quality_grade")}>
                {GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.group}>
              <label style={S.label}>Ngày thu hoạch</label>
              <input style={S.input} type="date" value={form.harvest_date} onChange={setField("harvest_date")} />
            </div>
            <div style={S.group}>
              <label style={S.label}>Giá trị ước tính (VNĐ)</label>
              <input style={S.input} type="number" min="0" value={form.estimated_value} onChange={setField("estimated_value")} placeholder="VD: 50000000" />
            </div>
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
        <div style={{ background: "#141a1f", borderRadius: 12, padding: 24, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#9fcfc6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📂 Tài liệu chứng minh
            </h3>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {totalFiles} file đã chọn •{" "}
              <span style={{ color: requiredDone ? "#27ae60" : "#f39c12" }}>
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

          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(159,207,198,0.05)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.4)", borderLeft: "2px solid rgba(159,207,198,0.3)" }}>
            Tất cả tài liệu sẽ được tự động upload lên IPFS để đảm bảo tính minh bạch và không thể thay đổi.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={uploading || submit.isPending}
            style={{
              padding: "11px 32px",
              background: uploading || submit.isPending ? "#555" : "#1f6f64",
              color: "#fff", border: "none", borderRadius: 9, fontWeight: 700,
              cursor: uploading || submit.isPending ? "not-allowed" : "pointer",
              fontSize: 15, display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {uploading || submit.isPending
              ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Đang upload & gửi...</>
              : "📤 Gửi Yêu Cầu Tokenization"}
          </button>
          <button
            onClick={() => navigate("/farmer/assets")}
            disabled={uploading || submit.isPending}
            style={{ padding: "11px 20px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 15 }}
          >
            Huỷ
          </button>
        </div>

        {/* Workflow guide */}
        <div style={{ marginTop: 24, background: "rgba(31,111,100,0.08)", border: "1px solid rgba(31,111,100,0.25)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ color: "#9fcfc6", fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📋 Quy trình Tokenization — Sàn giao dịch nội bộ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { step: "1", icon: "📤", text: "Gửi batch & tài liệu",   sub: "PENDING_MINT_APPROVAL" },
              { step: "2", icon: "🔍", text: "Admin xem xét hồ sơ",    sub: "Kiểm tra tài liệu IPFS" },
              { step: "3", icon: "⛓️", text: "Mint Token on-chain",     sub: "CR1/CR2/CR3 Token" },
              { step: "4", icon: "🏦", text: "Nhận vào ví nội bộ",     sub: "Sẵn sàng giao dịch" },
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
