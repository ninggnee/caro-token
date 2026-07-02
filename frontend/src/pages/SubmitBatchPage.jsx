import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useSubmitBatch } from "../hooks/useBatches";
import { useAuth } from "../context/AuthContext";

function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

const C = { green: "#B0E4CC", red: "#f6465d", gold: "#f0b90b", accent: "#408A71", muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#B0E4CC" };

const DOC_CATEGORIES = [
  { key: "harvest_certificate", label: "① Phiếu thu hoạch", required: true,  multiple: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "coffee_photos",       label: "② Ảnh lô cà phê",    required: true,  multiple: true,  accept: ".jpg,.jpeg,.png,.webp" },
  { key: "cert_docs",           label: "③ Giấy chứng nhận (Nếu có)", required: false, multiple: true, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "additional_docs",     label: "④ Tài liệu bổ sung",         required: false, multiple: true, accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx" },
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
  const { user, refreshUser } = useAuth();
  const ownerName = user?.full_name || "Nông hộ / Hợp tác xã";

  useEffect(() => {
    refreshUser();
  }, []);

  let coords = [];
  try {
    coords = JSON.parse(user?.farm_coords || "[]");
  } catch (e) {}
  const hasGPS = Array.isArray(coords) && coords.length >= 3;

  let certs = [];
  try {
    if (user?.certifications) {
      certs = JSON.parse(user.certifications);
      if (!Array.isArray(certs)) certs = [];
    }
  } catch (e) {
    if (typeof user?.certifications === 'string' && user.certifications.trim() !== '') {
      certs = [{ name: user.certifications }];
    }
  }
  const hasCerts = certs.length > 0;

  const renderMapEmbed = () => {
    if (!hasGPS) return null;
    let lat = coords[0][0];
    let lng = coords[0][1];
    let zoom = 15;
    const center = [lat, lng];

    return (
      <div style={{ position: "relative", width: "100%", height: "260px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(72,117,115,0.3)", zIndex: 0, marginTop: 14 }}>
        <MapContainer center={center} zoom={zoom} style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={true}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
            maxZoom={18}
          />
          <Polygon positions={coords} pathOptions={{ color: '#B0E4CC', fillColor: '#B0E4CC', fillOpacity: 0.3, weight: 2 }} />
          <MapUpdater center={center} zoom={zoom} />
        </MapContainer>
      </div>
    );
  };

  const [form, setForm] = useState({
    quantity:          "",
    crop_year:         "2025 - 2026",
    harvest_date:      "",
    storage_location:  "",
    farming_method:    "Traditional",
    production_diary:  "",
    traceability_info: "",
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
    if (!form.crop_year?.trim()) e.crop_year = "Niên vụ là bắt buộc";
    if (!form.harvest_date) e.harvest_date = "Ngày thu hoạch là bắt buộc";
    if (!form.storage_location || !form.storage_location.trim()) e.storage_location = "Kho lưu trữ dự kiến là bắt buộc";
    
    // Check required files
    if (!fileMap.harvest_certificate || fileMap.harvest_certificate.length === 0) {
      e.harvest_certificate = "Phiếu thu hoạch là bắt buộc";
    }
    if (!fileMap.coffee_photos || fileMap.coffee_photos.length === 0) {
      e.coffee_photos = "Ảnh lô cà phê là bắt buộc";
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
    
    // Combine Owner & Certs into batch_description column for backend storage
    let descParts = [];
    descParts.push(`Chủ sở hữu: ${ownerName}`);
    if (user?.certifications) descParts.push(`Chứng nhận: ${user.certifications}`);
    if (form.batch_description) descParts.push(form.batch_description);
    const finalDesc = descParts.join("\n");
    fd.append("batch_description", finalDesc);

    if (!hasGPS) {
      alert("Bạn chưa cập nhật tọa độ GPS vùng trồng. Vui lòng cập nhật trong Trang cá nhân.");
      return;
    }
    fd.append("farm_coords",       user.farm_coords);
    fd.append("crop_year",         form.crop_year);
    fd.append("farming_method",    form.farming_method);
    fd.append("production_diary",  form.production_diary);
    fd.append("traceability_info", form.traceability_info);

    // Map files for backend upload
    // harvest_certificate
    if (fileMap.harvest_certificate) {
      for (const file of fileMap.harvest_certificate) {
        fd.append("harvest_certificate", file);
      }
    }

    // coffee_photos
    if (fileMap.coffee_photos) {
      for (const file of fileMap.coffee_photos) {
        fd.append("coffee_photos", file);
      }
    }

    // cert_docs (save under additional_docs key)
    if (fileMap.cert_docs) {
      for (const file of fileMap.cert_docs) {
        fd.append("additional_docs", file);
      }
    }

    // additional_docs
    if (fileMap.additional_docs) {
      for (const file of fileMap.additional_docs) {
        fd.append("additional_docs", file);
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
    <FarmerLayout title="Tạo yêu cầu tạo hồ sơ số">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📦 Khởi tạo hồ sơ số lô hàng</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 6, fontSize: 14 }}>
            Khai báo thông tin ban đầu và tải lên tài liệu gốc để thiết lập thực thể số (Digital Asset Profile).
          </p>
        </div>

        {/* Batch Info */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, color: C.tealLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            📋 1. THÔNG TIN LÔ HÀNG
          </h3>

          {/* 1. Loại cà phê — hardcoded, not editable */}
          <div style={{ ...S.group, background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🫘</span>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loại cà phê</div>
              <div style={{ fontWeight: 700, color: C.tealLight }}>ROBUSTA COFFEE</div>
            </div>
          </div>

          {/* 2. Chủ sở hữu */}
          <div style={{ ...S.group, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Chủ sở hữu</div>
              <div style={{ fontWeight: 700, color: "#fff" }}>{ownerName}</div>
            </div>
          </div>

          {/* 3. Khối lượng thực tế */}
          <div style={S.group}>
            <label style={S.label}>Khối lượng thực tế (kg) *</label>
            <input
              style={{ ...S.input, borderColor: errors.quantity ? C.red : undefined }}
              type="number" min="0.1" step="0.1"
              value={form.quantity} onChange={setField("quantity")}
              placeholder="VD: 1000"
            />
            {errors.quantity && <div style={S.errMsg}>{errors.quantity}</div>}
          </div>

          {/* 5 & 6. Niên vụ & Ngày thu hoạch */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.group}>
              <label style={S.label}>Niên vụ *</label>
              <input
                style={{ ...S.input, borderColor: errors.crop_year ? C.red : undefined }}
                value={form.crop_year} onChange={setField("crop_year")}
                placeholder="VD: 2025 - 2026"
              />
              {errors.crop_year && <div style={S.errMsg}>{errors.crop_year}</div>}
            </div>

            <div style={S.group}>
              <label style={S.label}>Ngày thu hoạch *</label>
              <input
                style={{ ...S.input, borderColor: errors.harvest_date ? C.red : undefined }}
                type="date"
                value={form.harvest_date} onChange={setField("harvest_date")}
              />
              {errors.harvest_date && <div style={S.errMsg}>{errors.harvest_date}</div>}
            </div>
          </div>

          {/* 7. Hồ sơ vùng trồng (Read-only từ Hồ sơ cá nhân) */}
          <div style={{ ...S.group, background: "rgba(255,255,255,0.01)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.tealLight }}>🌾 HỒ SƠ VÙNG TRỒNG ĐÃ LƯU</span>
              <button 
                onClick={() => navigate("/farmer/profile")}
                style={{ background: "none", border: "none", color: "#B0E4CC", cursor: "pointer", fontSize: 12, fontWeight: 600, textDecoration: "underline" }}
              >
                Chỉnh sửa hồ sơ cá nhân ⚙️
              </button>
            </div>

            {hasGPS ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Mã vùng trồng</span>
                  <span style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>{user?.farm_code || "[Chưa thiết lập]"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Diện tích</span>
                  <span style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>{user.farm_area} Ha</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Địa phương</span>
                  <span style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>{user.farm_location}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Loại đất</span>
                  <span style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>{user.farm_soil_type}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Tọa độ GPS Polygon</span>
                  <span style={{ fontWeight: 600, color: "#fff", fontSize: 13, fontFamily: "monospace", wordBreak: "break-all", marginLeft: 16, textAlign: "right" }}>{user.farm_coords}</span>
                </div>
                {renderMapEmbed()}
              </div>
            ) : (
              <div style={{ padding: "16px", background: "rgba(240,185,11,0.04)", border: "1px solid rgba(240,185,11,0.15)", borderRadius: 8, color: C.gold, fontSize: 13 }}>
                ⚠️ Dữ liệu tọa độ GPS vùng trồng chưa được cập nhật trong Trang Cá Nhân. Vui lòng cập nhật ranh giới vùng trồng trên bản đồ để tiếp tục.
                <button 
                  onClick={() => navigate("/farmer/profile")}
                  style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "#B0E4CC", cursor: "pointer", fontSize: 12, fontWeight: 700, textDecoration: "underline", padding: 0 }}
                >
                  Đi tới trang cập nhật hồ sơ cá nhân ngay →
                </button>
              </div>
            )}
          </div>

          {/* Chứng nhận (Chỉ hiển thị nếu có) */}
          {hasCerts && (
            <div style={{ ...S.group, background: "rgba(255,255,255,0.01)", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.tealLight }}>🏅 CHỨNG NHẬN CANH TÁC ĐÃ LƯU</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {certs.map((cert, idx) => (
                  <div key={idx} style={{ padding: "6px 12px", background: "rgba(176, 228, 204,0.1)", border: "1px solid rgba(176, 228, 204,0.4)", borderRadius: 20, color: C.green, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    ✓ {cert.name}
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* 8 & 9. Kho lưu trữ dự kiến & Phương thức canh tác */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={S.group}>
              <label style={S.label}>Kho lưu trữ dự kiến *</label>
              <select
                style={{ ...S.input, borderColor: errors.storage_location ? C.red : undefined }}
                value={form.storage_location} onChange={setField("storage_location")}
              >
                <option value="">-- Chọn kho lưu trữ --</option>
                <option value="Kho Trung tâm CaRo (Buôn Ma Thuột, Đắk Lắk)">Kho Trung tâm CaRo (Buôn Ma Thuột, Đắk Lắk)</option>
                <option value="Kho CaRo Lâm Hà (Lâm Đồng)">Kho CaRo Lâm Hà (Lâm Đồng)</option>
                <option value="Kho CaRo Chư Sê (Gia Lai)">Kho CaRo Chư Sê (Gia Lai)</option>
                <option value="Kho Cảng Cát Lái (TP.HCM)">Kho Cảng Cát Lái (TP.HCM)</option>
              </select>
              {errors.storage_location && <div style={S.errMsg}>{errors.storage_location}</div>}
            </div>

            <div style={S.group}>
              <label style={S.label}>Phương thức canh tác *</label>
              <select style={S.input} value={form.farming_method} onChange={setField("farming_method")}>
                <option value="Traditional">Truyền thống</option>
                <option value="Sustainable">Canh tác bền vững</option>
                <option value="Organic">Canh tác hữu cơ</option>
              </select>
            </div>
          </div>

          {/* 11. Nhật ký sản xuất */}
          <div style={S.group}>
            <label style={S.label}>Nhật ký sản xuất</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: "vertical" }}
              value={form.production_diary} onChange={setField("production_diary")}
              placeholder="Bón phân, tưới nước, chăm sóc, phòng trừ sâu bệnh..."
            />
          </div>

          {/* 12. Thông tin truy xuất nguồn gốc */}
          <div style={S.group}>
            <label style={S.label}>Thông tin truy xuất nguồn gốc</label>
            <textarea
              style={{ ...S.input, minHeight: 72, resize: "vertical" }}
              value={form.traceability_info} onChange={setField("traceability_info")}
              placeholder="Mã vùng trồng, lịch sử kiểm tra chất lượng, thông tin truy xuất..."
            />
          </div>

          {/* 13. Mô tả bổ sung */}
          <div style={S.group}>
            <label style={S.label}>Mô tả bổ sung</label>
            <textarea
              style={{ ...S.input, minHeight: 60, resize: "vertical" }}
              value={form.batch_description} onChange={setField("batch_description")}
              placeholder="Mô tả thêm về lô cà phê..."
            />
          </div>
        </div>

        {/* Document Uploads */}
        <div style={{ background: C.card, borderRadius: 12, padding: 24, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: C.tealLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📂 TÀI LIỆU BAN ĐẦU
            </h3>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4, margin: "4px 0 0" }}>
              Các tài liệu này được sử dụng để tạo hồ sơ số ban đầu của lô cà phê trước khi tiếp nhận tại kho.
            </p>
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
            Hồ sơ sau khi gửi sẽ được tạo thành Hồ sơ số (Digital Asset Profile). Các tài liệu sẽ được lưu trên IPFS và chờ kho tiếp nhận để chuyển sang bước kiểm định.
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleSubmit}
            disabled={uploading || submit.isPending || !hasGPS}
            style={{
              padding: "11px 32px",
              background: uploading || submit.isPending || !hasGPS ? "#555" : C.accent,
              color: "#fff", border: "none", borderRadius: 9, fontWeight: 700,
              cursor: uploading || submit.isPending || !hasGPS ? "not-allowed" : "pointer",
              fontSize: 15, display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {uploading || submit.isPending
              ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span> Đang lưu hồ sơ...</>
              : "📤 Gửi yêu cầu tạo hồ sơ số"}
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
          <div style={{ color: C.tealLight, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📋 Lộ trình các Giai đoạn của Lô Cà Phê</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { step: "Gđ 1", icon: "📝", text: "Khởi tạo hồ sơ số",      sub: "Khai báo & Tải tài liệu gốc" },
              { step: "Gđ 2", icon: "🚚", text: "Tiếp nhận & Chế biến",  sub: "Chuẩn hóa & Ghi nhận hao hụt" },
              { step: "Gđ 3", icon: "🔍", text: "Lưu kho & Kiểm định",   sub: "Cập nhật dữ liệu từ Oracle" },
              { step: "Gđ 4", icon: "🪙", text: "Đúc Token bảo chứng",   sub: "Phát hành token CaRo nội bộ" },
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
