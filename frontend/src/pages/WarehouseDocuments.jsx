import { useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";

const C = { green: "#B0E4CC", red: "#f6465d", gold: "#f0b90b", accent: "#408A71", muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#B0E4CC" };

const DOCUMENT_TYPES = [
  { value: "warehouse_license",       label: "Giấy phép kho bãi",         compliance: true  },
  { value: "inspection_report",       label: "Báo cáo kiểm định",         compliance: true  },
  { value: "warehouse_certificate",   label: "Chứng nhận kho bãi",        compliance: true  },
  { value: "warehouse_insurance",     label: "Bảo hiểm kho bãi",       compliance: false },
  { value: "warehouse_ownership_proof",label: "Bằng chứng sở hữu kho", compliance: false },
  { value: "warehouse_photos",        label: "Ảnh kho bãi",          compliance: false },
  { value: "coffee_storage_report",   label: "Báo cáo lưu trữ cà phê",     compliance: false },
  { value: "warehouse_receipt",       label: "Biên lai lưu kho",         compliance: false },
  { value: "other",                   label: "Khác",                     compliance: false },
];

const STATUS_COLORS = {
  active:  { color: C.green, bg: "rgba(14,203,129,0.1)" },
  deleted: { color: C.red,   bg: "rgba(246,70,93,0.1)"  },
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function formatDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CidBadge({ cid }) {
  const [copied, setCopied] = useState(false);
  if (!cid) return <span style={{ color: C.muted, fontSize: 11 }}>Không có CID (nội bộ)</span>;
  const short = `${cid.slice(0, 10)}…${cid.slice(-6)}`;
  const copy = () => {
    navigator.clipboard.writeText(cid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <code style={{ fontSize: 11, color: C.tealLight, background: "rgba(72,117,115,0.08)", padding: "2px 6px", borderRadius: 4 }}>{short}</code>
      <button onClick={copy} title="Sao chép CID" style={{ background: "none", border: "none", cursor: "pointer", color: copied ? C.green : C.muted, fontSize: 12, padding: 0 }}>
        {copied ? "✓" : "⎘"}
      </button>
    </div>
  );
}

// ── Upload Form ───────────────────────────────────────────────────────────────

function UploadForm({ warehouses, onSuccess }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({ warehouse_id: "", document_type: "", description: "" });
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (fd) => {
      const res = await axios.post("/warehouse-documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setFile(null);
      setForm({ warehouse_id: "", document_type: "", description: "" });
      setProgress(0);
      setErrors({});
      onSuccess?.(data);
    },
    onError: (err) => {
      setProgress(0);
      setErrors({ submit: err.response?.data?.message || err.message });
    },
  });

  const validate = () => {
    const e = {};
    if (!form.document_type) e.document_type = "Vui lòng chọn loại chứng từ";
    if (!file) e.file = "Vui lòng chọn file";
    else if (file.size > 20 * 1024 * 1024) e.file = "File phải có dung lượng dưới 20 MB";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("document_type", form.document_type);
    if (form.warehouse_id) fd.append("warehouse_id", form.warehouse_id);
    if (form.description)  fd.append("description",  form.description);
    mutation.mutate(fd);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setErrors(v => ({ ...v, file: "" })); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setErrors(v => ({ ...v, file: "" })); }
    e.target.value = "";
  };

  const isBusy = mutation.isPending;
  const inp = { width: "100%", padding: "9px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}` }}>
      <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: C.tealLight, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        📤 Tải lên chứng từ kho
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Warehouse */}
        <div>
          <label style={{ display: "block", marginBottom: 5, fontSize: 12, color: C.muted, fontWeight: 600 }}>Kho bãi</label>
          <select style={inp} value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
            <option value="">— Không liên kết với kho bãi —</option>
            {(warehouses || []).map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.warehouse_code})</option>
            ))}
          </select>
        </div>

        {/* Document type */}
        <div>
          <label style={{ display: "block", marginBottom: 5, fontSize: 12, color: C.muted, fontWeight: 600 }}>Loại chứng từ *</label>
          <select
            style={{ ...inp, borderColor: errors.document_type ? C.red : undefined }}
            value={form.document_type}
            onChange={e => { setForm(f => ({ ...f, document_type: e.target.value })); setErrors(v => ({ ...v, document_type: "" })); }}
          >
            <option value="">Chọn loại chứng từ…</option>
            {DOCUMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}{t.compliance ? " ⛓️" : ""}</option>
            ))}
          </select>
          {errors.document_type && <div style={{ color: C.red, fontSize: 11, marginTop: 3 }}>{errors.document_type}</div>}
          {form.document_type && DOCUMENT_TYPES.find(t => t.value === form.document_type)?.compliance && (
            <div style={{ marginTop: 4, fontSize: 11, color: C.gold }}>⛓️ Chứng từ hợp chuẩn — CID sẽ được lưu trên blockchain</div>
          )}
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 5, fontSize: 12, color: C.muted, fontWeight: 600 }}>Mô tả</label>
        <textarea
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ghi chú tùy chọn về tài liệu này..."
        />
      </div>

      {/* File drop zone */}
      <div
        onClick={() => !isBusy && fileRef.current?.click()}
        onDrop={handleFileDrop}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          border: `2px dashed ${errors.file ? C.red : file ? C.green : dragOver ? C.tealLight : C.border}`,
          borderRadius: 9,
          padding: "24px 16px",
          textAlign: "center",
          cursor: isBusy ? "default" : "pointer",
          background: dragOver ? "rgba(72,117,115,0.08)" : file ? "rgba(14,203,129,0.04)" : "rgba(255,255,255,0.01)",
          transition: "all 0.15s",
          marginBottom: 6,
        }}
      >
        {file ? (
          <div>
            <div style={{ fontSize: 22, marginBottom: 4 }}>📄</div>
            <div style={{ fontWeight: 600, color: C.green, fontSize: 13 }}>{file.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{formatBytes(file.size)}</div>
            {!isBusy && (
              <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ marginTop: 6, background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 11 }}>Xóa</button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 6 }}>☁️</div>
            <div style={{ color: "#e2e8f0", fontSize: 13 }}>Kéo thả file hoặc <span style={{ color: C.tealLight }}>chọn file</span></div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>PDF, JPG, PNG · Tối đa 20 MB</div>
          </div>
        )}
      </div>
      {errors.file && <div style={{ color: C.red, fontSize: 11, marginBottom: 8 }}>{errors.file}</div>}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleFileChange} />

      {/* Progress bar */}
      {isBusy && progress > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
            <span>Đang tải lên IPFS…</span><span>{progress}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: C.tealLight, borderRadius: 4, transition: "width 0.2s" }} />
          </div>
        </div>
      )}

      {errors.submit && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 7, color: C.red, fontSize: 13 }}>
          {errors.submit}
        </div>
      )}

      {mutation.isSuccess && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(14,203,129,0.08)", border: "1px solid rgba(14,203,129,0.2)", borderRadius: 7, color: C.green, fontSize: 13 }}>
          ✓ Tải lên thành công{mutation.data?.on_chain ? " và ghi nhận on-chain ⛓️" : ""}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isBusy}
        style={{ padding: "10px 28px", background: isBusy ? "#2a3a2a" : C.accent, color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: isBusy ? "not-allowed" : "pointer", fontSize: 14 }}
      >
        {isBusy ? "Đang tải lên…" : "📤 Tải lên tài liệu"}
      </button>
    </div>
  );
}

// ── Document Row ──────────────────────────────────────────────────────────────

function DocRow({ doc, isAdmin, onDelete }) {
  const typeInfo = DOCUMENT_TYPES.find(t => t.value === doc.document_type) || { label: doc.document_type, compliance: false };
  const sc = STATUS_COLORS[doc.status] || STATUS_COLORS.active;

  return (
    <tr style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Name */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.document_name}</div>
        {doc.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.description}</div>}
      </td>

      {/* Type */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 12, color: typeInfo.compliance ? C.gold : "#e2e8f0" }}>
          {typeInfo.compliance ? "⛓️ " : ""}{typeInfo.label}
        </div>
        {doc.warehouse_name && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{doc.warehouse_name}</div>}
      </td>

      {/* Upload date */}
      <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>
        {formatDate(doc.created_at)}
      </td>

      {/* Uploaded by */}
      <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>
        {doc.uploader_name || doc.uploader_email || "—"}
      </td>

      {/* CID */}
      <td style={{ padding: "12px 16px" }}>
        <CidBadge cid={doc.cid} />
        {doc.blockchain_tx && (
          <a href={`https://sepolia.etherscan.io/tx/${doc.blockchain_tx}`} target="_blank" rel="noreferrer"
            style={{ display: "block", marginTop: 3, fontSize: 10, color: C.tealLight }}>⛓️ on-chain</a>
        )}
      </td>

      {/* Size */}
      <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{formatBytes(doc.file_size)}</td>

      {/* Status */}
      <td style={{ padding: "12px 16px" }}>
        <span style={{ padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
          {doc.status === "active" ? "Hoạt động" : doc.status === "deleted" ? "Đã xóa" : doc.status}
        </span>
      </td>

      {/* Actions */}
      <td style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          {doc.cid && (
            <>
              <a href={`https://ipfs.io/ipfs/${doc.cid}`} target="_blank" rel="noreferrer"
                title="Xem trên IPFS"
                style={{ padding: "4px 10px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 5, fontSize: 11, textDecoration: "none", fontWeight: 600 }}>
                Xem ↗
              </a>
              <a href={`https://ipfs.io/ipfs/${doc.cid}`} download={doc.document_name}
                title="Tải xuống"
                style={{ padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 5, fontSize: 11, textDecoration: "none" }}>
                ↓
              </a>
            </>
          )}
          {isAdmin && (
            <button onClick={() => onDelete(doc)}
              title="Xóa bản ghi"
              style={{ padding: "4px 10px", background: "rgba(246,70,93,0.1)", border: "1px solid rgba(246,70,93,0.2)", color: C.red, borderRadius: 5, fontSize: 11, cursor: "pointer" }}>
              Xóa
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WarehouseDocuments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();

  const [filter, setFilter] = useState({ document_type: "", warehouse_id: "" });
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const params = new URLSearchParams({ page, limit: 20 });
  if (filter.document_type) params.set("document_type", filter.document_type);
  if (filter.warehouse_id)  params.set("warehouse_id",  filter.warehouse_id);

  const docsQ = useQuery({
    queryKey: ["warehouse-docs", filter, page],
    queryFn:  () => axios.get(`/warehouse-documents?${params}`).then(r => r.data),
    staleTime: 15_000,
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses-list"],
    queryFn:  () => axios.get("/custodian/warehouses").then(r => r.data),
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => axios.delete(`/warehouse-documents/${id}`).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries(["warehouse-docs"]); setConfirmDelete(null); },
  });

  const warehouses = warehousesQ.data?.data || [];
  const docs       = docsQ.data?.documents || [];
  const total      = docsQ.data?.total || 0;
  const pages      = docsQ.data?.pages || 1;

  const onUploadSuccess = useCallback(() => {
    qc.invalidateQueries(["warehouse-docs"]);
    setShowUpload(false);
  }, [qc]);

  const inp = { padding: "7px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: "#e2e8f0", fontSize: 12, outline: "none" };

  return (
    <FarmerLayout title="Chứng từ kho">
      <div style={{ display: "grid", gap: 20, width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🏭 Chứng Từ Kho Bãi</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              Tập tin lưu trữ không thể sửa đổi trên IPFS · Tổng cộng {total} tài liệu
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => docsQ.refetch()}
              style={{ ...inp, cursor: "pointer" }}>↺ Tải lại</button>
            <button onClick={() => setShowUpload(v => !v)}
              style={{ padding: "7px 18px", background: showUpload ? "rgba(72,117,115,0.12)" : C.accent, color: showUpload ? C.tealLight : "#fff", border: showUpload ? `1px solid ${C.border}` : "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              {showUpload ? "✕ Đóng" : "+ Tải lên tài liệu"}
            </button>
          </div>
        </div>

        {/* Upload panel */}
        {showUpload && (
          <UploadForm warehouses={warehouses} onSuccess={onUploadSuccess} />
        )}

        {/* Info banner */}
        <div style={{ padding: "12px 16px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.muted, display: "flex", gap: 20, flexWrap: "wrap" }}>
          <span>☁️ <strong style={{ color: "#e2e8f0" }}>Lưu trữ IPFS</strong> — các file được lưu trữ vĩnh viễn trên Infura IPFS</span>
          <span>⛓️ <strong style={{ color: C.gold }}>On-chain</strong> — Giấy phép, Chứng nhận & Kiểm định được lưu trên blockchain</span>
          {!isAdmin && <span>🔒 Chỉ hiển thị các tài liệu do bạn tải lên</span>}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select style={inp} value={filter.document_type}
            onChange={e => { setFilter(f => ({ ...f, document_type: e.target.value })); setPage(1); }}>
            <option value="">Tất cả các loại</option>
            {DOCUMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {isAdmin && (
            <select style={inp} value={filter.warehouse_id}
              onChange={e => { setFilter(f => ({ ...f, warehouse_id: e.target.value })); setPage(1); }}>
              <option value="">Tất cả kho bãi</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}

          {(filter.document_type || filter.warehouse_id) && (
            <button onClick={() => { setFilter({ document_type: "", warehouse_id: "" }); setPage(1); }}
              style={{ ...inp, cursor: "pointer", color: C.red }}>✕ Xóa bộ lọc</button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${C.border}` }}>
                {["Tên tài liệu", "Loại / Kho bãi", "Ngày tải lên", "Người tải", "CID", "Kích thước", "Trạng thái", "Thao tác"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docsQ.isLoading && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: C.muted }}>Đang tải danh sách tài liệu…</td></tr>
              )}
              {docsQ.isError && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: C.red }}>
                  Lỗi khi tải dữ liệu. <button onClick={() => docsQ.refetch()} style={{ color: C.tealLight, background: "none", border: "none", cursor: "pointer" }}>Thử lại</button>
                </td></tr>
              )}
              {!docsQ.isLoading && !docsQ.isError && docs.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 60, textAlign: "center", color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div style={{ fontSize: 14, marginBottom: 12 }}>Chưa có tài liệu nào</div>
                  <button onClick={() => setShowUpload(true)}
                    style={{ padding: "8px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    Tải lên tài liệu đầu tiên
                  </button>
                </td></tr>
              )}
              {docs.map(doc => (
                <DocRow key={doc.id} doc={doc} isAdmin={isAdmin} onDelete={setConfirmDelete} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              style={{ padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: page <= 1 ? C.muted : "#e2e8f0", borderRadius: 5, cursor: page <= 1 ? "default" : "pointer", fontSize: 12 }}>
              ← Trước
            </button>
            <span style={{ fontSize: 12, color: C.muted, padding: "0 8px" }}>Trang {page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
              style={{ padding: "6px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: page >= pages ? C.muted : "#e2e8f0", borderRadius: 5, cursor: page >= pages ? "default" : "pointer", fontSize: 12 }}>
              Sau →
            </button>
          </div>
        )}

      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: C.card, borderRadius: 12, padding: 28, border: `1px solid rgba(246,70,93,0.3)`, maxWidth: 420, width: "90%" }}>
            <h3 style={{ margin: "0 0 12px", color: C.red }}>Xóa tài liệu?</h3>
            <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}>
              <strong>{confirmDelete.document_name}</strong> sẽ bị xóa mềm khỏi cơ sở dữ liệu.
            </p>
            <p style={{ color: C.muted, fontSize: 12, margin: "0 0 20px" }}>
              ⚠ Nội dung trên IPFS không thể sửa đổi — file vẫn có thể truy cập vĩnh viễn qua CID.
            </p>
            {deleteMut.isError && (
              <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{deleteMut.error?.response?.data?.message || "Xóa thất bại"}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setConfirmDelete(null); deleteMut.reset(); }}
                style={{ padding: "8px 18px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                Hủy
              </button>
              <button onClick={() => deleteMut.mutate(confirmDelete.id)} disabled={deleteMut.isPending}
                style={{ padding: "8px 18px", background: C.red, border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                {deleteMut.isPending ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FarmerLayout>
  );
}
