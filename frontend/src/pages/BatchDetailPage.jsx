import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DashboardLayout from "../components/layout/DashboardLayout";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useBatch, useApproveBatch, useRejectBatch } from "../hooks/useBatches";
import { formatNumber, formatKg, formatToken, formatDate } from '../utils/formatters';
import axios from "../utils/axiosClient";

/**
 * Compute display stats (area in hectares, vertex count) for the farmer's own
 * REAL registered GPS polygon (batch.farm_coords, snapshotted from the
 * farmer's profile at batch-creation time). Never fabricates coordinates —
 * only measures the points that were actually passed in.
 * Returns { points: [[lat,lng],...], areaHa: number, numVertices: number } or null.
 */
function computePolygonStats(points, centerLat) {
  if (!Array.isArray(points) || points.length < 3) return null;

  let shoelace = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    shoelace += points[i][1] * points[j][0];
    shoelace -= points[j][1] * points[i][0];
  }
  const areaDeg = Math.abs(shoelace) / 2;
  // Convert deg² → m² → ha (approximate at this latitude)
  const degSqToSqM = 111_000 * 111_000 * Math.cos(centerLat * Math.PI / 180);
  const areaHa = parseFloat(((areaDeg * degSqToSqM) / 10_000).toFixed(2));

  return { points, areaHa, numVertices: points.length };
}

// Keeps the Leaflet canvas in sync whenever its container is resized for any
// reason (logistics status changing the height of the sibling tracker column,
// accordion/section toggles, data reloads, or window resize) and re-fits the
// polygon bounds whenever they change.
function MapBoundsUpdater({ bounds }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [map]);

  useEffect(() => {
    if (bounds) {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [bounds, map]);

  return null;
}

const farmIcon = new L.divIcon({
  html: '<div style="width:14px;height:14px;background:#B0E4CC;border-radius:50%;box-shadow:0 0 12px #B0E4CC;border:2px solid #fff;"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});
const whIcon = new L.divIcon({
  html: '<div style="width:14px;height:14px;background:#f0b90b;border-radius:50%;box-shadow:0 0 12px #f0b90b;border:2px solid #fff;"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});
const truckIcon = new L.divIcon({
  html: '<div style="font-size:24px; filter: drop-shadow(0 0 8px rgba(64, 138, 113,1));">🚚</div>',
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const LOGISTICS_LABELS = {
  PENDING_PICKUP: "Chờ lấy hàng",
  IN_TRANSIT:     "Đang vận chuyển",
  DELIVERED:      "Đã đến nhà máy",
  STANDARDIZED:   "Đã chuẩn hóa chất lượng",
  STORED:         "Đã nhập kho lưu ký",
  INSPECTED:      "Đã kiểm định (Oracle)",
  MINTED:         "Đã đúc Token",
};

const STATUS_META = {
  PENDING_MINT_APPROVAL: { cls: "caro-badge-warning", label: "⏳ Chờ duyệt" },
  APPROVED:              { cls: "caro-badge-info",  label: "✅ Đã duyệt"  },
  MINTED:                { cls: "caro-badge-success",   label: "🪙 Đã Mint"   },
  REJECTED:              { cls: "caro-badge-danger",   label: "❌ Từ chối"   },
};

const FARMING_METHOD_LABELS = {
  Traditional: "Truyền thống",
  Sustainable: "Canh tác bền vững",
  Organic: "Canh tác hữu cơ",
};

const DOC_LABELS = {
  harvest_certificate: "Chứng nhận thu hoạch",
  quality_inspection:  "Kiểm định chất lượng",
  coffee_photos:       "Ảnh lô cà phê",
  additional_docs:     "Tài liệu bổ sung",
};

const WAREHOUSE_DOC_LABELS = {
  warehouse_license:         "Giấy phép kho",
  inspection_report:         "Báo cáo thanh tra",
  warehouse_certificate:     "Giấy chứng nhận kho",
  warehouse_insurance:       "Bảo hiểm kho",
  warehouse_ownership_proof: "Chứng nhận quyền sở hữu",
  warehouse_photos:          "Ảnh chụp kho",
  coffee_storage_report:     "Báo cáo lưu trữ cà phê",
  warehouse_receipt:         "Biên bản bàn giao và nhập kho",
  quality_inspection:        "Kiểm định chất lượng",
  other:                     "Tài liệu khác",
};

function InfoRow({ label, value, mono, color }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--border)", gap: 16 }}>
      <span style={{ color: "#94a3b8", fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || "#f8fafc", fontSize: 14, textAlign: "right", wordBreak: "break-word", fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

function DocumentsSection({ documents }) {
  if (!documents || documents.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
        Chưa có tài liệu nào được upload
      </div>
    );
  }

  const grouped = {};
  for (const doc of documents) {
    if (!grouped[doc.document_type]) grouped[doc.document_type] = [];
    grouped[doc.document_type].push(doc);
  }

  return (
    <div>
      {Object.entries(grouped).map(([type, files]) => (
        <div key={type} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 700, marginBottom: 12 }}>
            {DOC_LABELS[type] || type}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", flex: "1 1 200px" }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.file_name}</div>
                  {f.ipfs_cid ? (
                    <a href={`https://ipfs.io/ipfs/${f.ipfs_cid}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: "#408A71", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontWeight: 600 }}>
                      IPFS: {f.ipfs_cid.slice(0, 8)}... ↗
                    </a>
                  ) : (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Lưu local (IPFS chưa cấu hình)</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WarehouseDocsSection({ docs }) {
  if (!docs || docs.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
        Chưa có tài liệu kho nào
      </div>
    );
  }

  const grouped = {};
  for (const doc of docs) {
    const key = doc.document_type || "other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(doc);
  }

  const orderedKeys = ["warehouse_receipt", "quality_inspection", "quality_audit", "other"];
  const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
    let idxA = orderedKeys.indexOf(a);
    let idxB = orderedKeys.indexOf(b);
    if (idxA === -1) idxA = 999;
    if (idxB === -1) idxB = 999;
    return idxA - idxB;
  });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {sortedEntries.map(([type, files]) => (
        <div key={type}>
          <div style={{ fontSize: 12, color: "#f0b90b", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {WAREHOUSE_DOC_LABELS[type] || type}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {files.map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "rgba(240,185,11,0.03)", border: "1px solid rgba(240,185,11,0.15)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>📋</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.document_name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                      {WAREHOUSE_DOC_LABELS[doc.document_type] || doc.document_type}
                      {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("vi-VN")}`}
                    </div>
                    {doc.cid && (
                      <div style={{ fontSize: 12, color: "#f0b90b", fontFamily: "monospace", marginTop: 4, fontWeight: 600 }}>
                        CID: {doc.cid.slice(0, 16)}…
                      </div>
                    )}
                  </div>
                </div>
                {doc.cid && (
                  <a
                    href={`https://ipfs.io/ipfs/${doc.cid}`}
                    target="_blank"
                    rel="noreferrer"
                    className="caro-btn caro-btn-secondary caro-btn-sm"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Xem tài liệu ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonDetail({ isAdmin }) {
  const Layout = isAdmin ? DashboardLayout : FarmerLayout;
  return (
    <Layout title="Chi tiết lô hàng">
      <div className="caro-page">
        {[240, 320, 200].map((h, i) => (
          <div key={i} className="caro-card" style={{ height: h, marginBottom: 24, animation: "caro-spin 1.5s infinite", background: "rgba(255,255,255,0.02)" }} />
        ))}
      </div>
    </Layout>
  );
}

export default function BatchDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  const { data, isLoading, isError } = useBatch(id);
  const batch = data?.batch;

  const approve = useApproveBatch();
  const reject  = useRejectBatch();

  const [showReject, setShowReject] = useState(false);
  const [reason,     setReason]     = useState("");

  // Farm polygon: the farmer's REAL registered GPS boundary, snapshotted onto
  // the batch at creation time (batch.farm_coords) — never fabricated here.
  const [farmPolygon, setFarmPolygon] = useState(null);

  const qc = useQueryClient();
  const [progress, setProgress] = useState(0);

  // Parse the batch's own snapshotted farm_coords whenever the batch loads/changes.
  useEffect(() => {
    if (!batch) return;
    try {
      const coords = JSON.parse(batch.farm_coords || '[]');
      if (Array.isArray(coords) && coords.length > 0) {
        setFarmPolygon(computePolygonStats(coords, coords[0][0]));
        return;
      }
    } catch (_) {}
    setFarmPolygon(null);
  }, [batch?.id, batch?.farm_coords]);

  useEffect(() => {
    if (batch?.logistics_status !== 'IN_TRANSIT') return;
    const interval = setInterval(() => {
      setProgress(p => (p >= 1 ? 0 : p + 0.05));
    }, 200);
    return () => clearInterval(interval);
  }, [batch?.logistics_status]);

  // Auto refresh data every 5 seconds to catch daemon or admin approval updates
  useEffect(() => {
    if (!batch || batch.status === 'MINTED' || batch.status === 'REJECTED') return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["batches", "detail", id] });
    }, 5000);
    return () => clearInterval(interval);
  }, [batch, id, qc]);

  const Layout   = isAdmin ? DashboardLayout : FarmerLayout;
  const backPath = isAdmin ? "/admin/mint-requests" : "/farmer/status";

  const handleApprove = () => {
    if (!window.confirm(
      `Approve & Mint batch ${batch.batch_id}?\n` +
      `${formatKg(Number(batch.quantity))} → CaRo\n` +
      `Token sẽ được mint trực tiếp vào ví blockchain của farmer.`
    )) return;
    approve.mutate({ id }, { onSuccess: () => setShowReject(false) });
  };

  const handleReject = () => {
    if (!reason.trim()) { toast.warning("Nhập lý do từ chối"); return; }
    reject.mutate({ id, reason }, {
      onSuccess: () => { setShowReject(false); setReason(""); },
    });
  };

  if (isLoading) return <SkeletonDetail isAdmin={isAdmin} />;

  if (isError || !batch) {
    return (
      <Layout title="Chi tiết lô hàng">
        <div className="caro-page" style={{ textAlign: "center" }}>
          <div className="caro-empty" style={{ padding: "80px 0" }}>
            <div className="caro-empty-icon" style={{ fontSize: 64, marginBottom: 20 }}>❌</div>
            <div className="caro-empty-title" style={{ color: "#ef4444", fontSize: 18, marginBottom: 12 }}>Không tìm thấy lô hàng hoặc bạn không có quyền truy cập</div>
            <button onClick={() => navigate(backPath)} className="caro-btn caro-btn-primary" style={{ marginTop: 24 }}>← Quay lại danh sách</button>
          </div>
        </div>
      </Layout>
    );
  }

  let badgeLabel = "";
  let badgeCls = "caro-badge-warning";

  if (batch.status === "MINTED") {
    badgeLabel = "🪙 Đã Mint";
    badgeCls = "caro-badge-success";
  } else if (batch.status === "REJECTED") {
    badgeLabel = "❌ Từ chối";
    badgeCls = "caro-badge-danger";
  } else if (batch.status === "APPROVED") {
    badgeLabel = "✅ Đã duyệt";
    badgeCls = "caro-badge-info";
  } else {
    // status is PENDING_MINT_APPROVAL
    if (batch.logistics_status === "INSPECTED") {
      badgeLabel = "⏳ Chờ duyệt";
      badgeCls = "caro-badge-warning";
    } else {
      badgeLabel = LOGISTICS_LABELS[batch.logistics_status] || "Đang xử lý";
      badgeCls = "caro-badge-info";
    }
  }

  const isPending = approve.isPending || reject.isPending;
  const warehouseDocs = batch.warehouse_documents || [];
  const receiptDocs = warehouseDocs.filter(d => d.document_type === 'warehouse_receipt');
  const inspectionDocs = warehouseDocs.filter(d => d.document_type === 'quality_inspection' || d.document_type === 'quality_audit');

  // Generate consistent pseudo-random values based on batch ID
  const generateRandomFromSeed = (seed, min, max) => {
    const x = Math.sin(seed) * 10000;
    return min + ((x - Math.floor(x)) * (max - min));
  };

  // Use batch ID as seed for consistent random values across page reloads
  const seed = batch?.id ? parseInt(String(batch.id).replace(/[^\d]/g, ''), 10) || batch.id.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0) : 0;
  
  // Use server processing_loss_pct if available; fall back to seeded random (0-2%)
  const lossPercentage = batch.processing_loss_pct != null
    ? parseFloat(batch.processing_loss_pct)
    : parseFloat(generateRandomFromSeed(seed * 1.1, 0, 2).toFixed(1));

  // Use server net_quantity if available; fall back to client-side calculation
  const netQuantity = batch.net_quantity != null
    ? Number(batch.net_quantity)
    : Number((Number(batch.quantity) * (1 - lossPercentage / 100)).toFixed(2));

  // Quality grade: always use server value (batch.quality_grade) as the source of truth.
  // Fall back to seeded-random only when the server has not yet assigned a grade.
  const gradeRand = generateRandomFromSeed(seed * 2.1, 0, 100);
  const serverGrade = batch.quality_grade; // 'CR1' | 'CR2' | 'CR3' | null
  // Derive a fallback grade from the random seed when server value is absent
  const fallbackGrade = gradeRand < 40 ? 'CR1' : gradeRand < 75 ? 'CR2' : 'CR3';
  const qualityGrade = serverGrade || fallbackGrade;
  let moistureContent, defectRate, grainSize;

  // Generate mock inspection parameters consistent with the resolved grade.
  // NOTE: defectRate is used ONLY for quality classification (phân hạng).
  // It is NOT deducted from the token quantity — only the processing loss
  // (tỷ lệ hao hụt chế biến) in the STANDARDIZED step is deducted.
  if (qualityGrade === 'CR1') {
    moistureContent = parseFloat(generateRandomFromSeed(seed * 3.1, 11, 12).toFixed(2));
    defectRate = parseFloat(generateRandomFromSeed(seed * 3.2, 0, 1.5).toFixed(2));
    grainSize = "Sàng 18 (Trên sàng ≥ 90%)";
  } else if (qualityGrade === 'CR2') {
    moistureContent = parseFloat(generateRandomFromSeed(seed * 3.1, 12, 12.5).toFixed(2));
    defectRate = parseFloat(generateRandomFromSeed(seed * 3.2, 1.5, 3).toFixed(2));
    grainSize = "Sàng 17-18 (Trên sàng ≥ 85%)";
  } else {
    // CR3
    moistureContent = parseFloat(generateRandomFromSeed(seed * 3.1, 12.5, 13).toFixed(2));
    defectRate = parseFloat(generateRandomFromSeed(seed * 3.2, 3, 5).toFixed(2));
    grainSize = "Sàng 16-17 (Trên sàng ≥ 80%)";
  }

  // Generate seeded mock CIDs (deterministic based on batch id)
  const makeMockCid = (suffix) => `Qm${String(seed).padStart(6,'0')}${suffix}`;

  // Generate mock inspection documents if not present — format mirrors warehouse receipt docs
  const today = new Date().toISOString();
  const mockInspectionDocs = [
    { id: `mock-insp-1`, document_name: `Báo cáo kiểm định chất lượng TCVN 4193:20 — ${batch.batch_id}`, document_type: "quality_inspection", cid: makeMockCid("A1B2C3D4E5F6"), created_at: today },
    { id: `mock-insp-2`, document_name: `Giấy chứng nhận kiểm định độc lập — Lô ${batch.batch_id}`, document_type: "quality_inspection", cid: makeMockCid("G7H8I9J0K1L2"), created_at: today },
    { id: `mock-insp-3`, document_name: `Kết quả phân tích thí nghiệm (Moisture ${moistureContent}%, Defect ${defectRate}%)`, document_type: "quality_audit", cid: makeMockCid("M3N4O5P6Q7R8"), created_at: today },
  ];
  
  const allInspectionDocs = inspectionDocs.length > 0 ? inspectionDocs : mockInspectionDocs;

  let farmLat = 12.6842, farmLng = 108.0539;
  try {
    const coords = JSON.parse(batch.farm_coords || "[]");
    if (Array.isArray(coords) && coords.length > 0) {
      farmLat = coords[0][0];
      farmLng = coords[0][1];
    }
  } catch (e) {}

  let whLat = 12.6565, whLng = 108.0125;
  if (batch.storage_location?.includes("Buôn Ma Thuột") || batch.storage_location?.includes("Đắk Lắk")) {
    whLat = 12.6667; whLng = 108.0383;
  } else if (batch.storage_location?.includes("Lâm Hà") || batch.storage_location?.includes("Lâm Đồng")) {
    whLat = 11.8333; whLng = 108.1833;
  } else if (batch.storage_location?.includes("Chư Sê") || batch.storage_location?.includes("Gia Lai")) {
    whLat = 13.6500; whLng = 108.0500;
  } else if (batch.storage_location?.includes("Cát Lái") || batch.storage_location?.includes("TP.HCM")) {
    whLat = 10.7500; whLng = 106.7667;
  }

  const currentLat = batch.logistics_status === 'IN_TRANSIT' ? farmLat + (whLat - farmLat) * progress : 
                     batch.logistics_status === 'PENDING_PICKUP' ? farmLat : whLat;
  const currentLng = batch.logistics_status === 'IN_TRANSIT' ? farmLng + (whLng - farmLng) * progress :
                     batch.logistics_status === 'PENDING_PICKUP' ? farmLng : whLng;

  const steps = [];

  // Step 1: PENDING_PICKUP
  steps.push({
    key: "PENDING_PICKUP",
    label: "Chờ lấy hàng",
    desc: "Lô hàng sẵn sàng tại vùng nguyên liệu",
    content: (
      <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.2)", borderRadius: 8, fontSize: 13, color: "#cbd5e1" }}>
        📍 <span style={{ color: "#94a3b8" }}>Tọa độ trung tâm (GPS):</span>{" "}
        <strong style={{ color: "#f8fafc", fontFamily: "monospace" }}>{farmLat.toFixed(4)}° N, {farmLng.toFixed(4)}° E</strong>
        {farmPolygon && (
          <span style={{ marginLeft: 10, color: "#B0E4CC", fontWeight: 700 }}>
            · Đa giác {farmPolygon.numVertices} đỉnh · ~{farmPolygon.areaHa} ha
          </span>
        )}
      </div>
    )
  });

  // Step 2: IN_TRANSIT
  if (Object.keys(LOGISTICS_LABELS).indexOf(batch.logistics_status) >= Object.keys(LOGISTICS_LABELS).indexOf('IN_TRANSIT')) {
    steps.push({
      key: "IN_TRANSIT",
      label: "Đang vận chuyển",
      desc: "Đang chuyển hàng từ nông hộ đến nhà máy",
      content: (
        <div style={{ marginTop: 8, padding: "12px 16px", background: "rgba(64, 138, 113,0.05)", border: "1px solid rgba(64, 138, 113,0.2)", borderRadius: 10, fontSize: 13, color: "#cbd5e1" }}>
          <div style={{ fontWeight: 700, color: "#408A71", marginBottom: 6 }}>📡 Dữ liệu Cảm biến IoT (Oracle Node):</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div>Nhiệt độ container: <strong style={{ color: "#f0b90b" }}>{batch.temperature_sensor ? `${batch.temperature_sensor}°C` : "24.5°C"}</strong></div>
            <div>Độ ẩm không khí: <strong style={{ color: "#408A71" }}>{batch.humidity_sensor ? `${batch.humidity_sensor}%` : "62.0%"}</strong></div>
          </div>
          <div style={{ marginTop: 8, color: "#B0E4CC", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔒</span> Trạng thái khóa thùng: Đóng kín (An toàn)
          </div>
        </div>
      )
    });
  }

  // Step 3: DELIVERED
  if (Object.keys(LOGISTICS_LABELS).indexOf(batch.logistics_status) >= Object.keys(LOGISTICS_LABELS).indexOf('DELIVERED')) {
    const factory = batch.storage_location?.includes("Lâm Đồng") ? "Cơ sở chế biến Lâm Hà, Lâm Đồng" : "Nhà máy Chế biến Cà phê CaRo Buôn Ma Thuột, Đắk Lắk";
    steps.push({
      key: "DELIVERED",
      label: "Đến nhà máy",
      desc: "Cà phê nhân xô đã được giao đến cơ sở chế biến",
      content: (
        <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "#cbd5e1" }}>
          🏢 <span style={{ color: "#94a3b8" }}>Nhà máy tiếp nhận:</span> <strong style={{ color: "#f8fafc" }}>{factory}</strong>
        </div>
      )
    });
  }

  // Step 4: STANDARDIZED
  if (Object.keys(LOGISTICS_LABELS).indexOf(batch.logistics_status) >= Object.keys(LOGISTICS_LABELS).indexOf('STANDARDIZED')) {
    steps.push({
      key: "STANDARDIZED",
      label: "Đã chuẩn hóa",
      desc: "Làm sạch, phân loại chất lượng & ghi nhận hao hụt",
      content: (
        <div style={{ marginTop: 8, padding: "12px 16px", background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.2)", borderRadius: 10, fontSize: 13, color: "#cbd5e1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Trạng thái chế biến:</span>
            <strong style={{ color: "#B0E4CC" }}>Đã làm sạch & sấy lọc</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Khối lượng đầu vào (thô):</span>
            <strong style={{ color: "#f8fafc" }}>{formatKg(Number(batch.quantity))}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Tỷ lệ hao hụt (random Oracle):</span>
            <strong style={{ color: "#ef4444" }}>−{lossPercentage}%</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(176,228,204,0.15)" }}>
            <span style={{ fontWeight: 700, color: "#B0E4CC" }}>Khối lượng tịnh sau chuẩn hóa:</span>
            <strong style={{ color: "#B0E4CC", fontSize: 15 }}>{formatKg(netQuantity)}</strong>
          </div>
        </div>
      )
    });
  }

  // Step 5: STORED
  if (Object.keys(LOGISTICS_LABELS).indexOf(batch.logistics_status) >= Object.keys(LOGISTICS_LABELS).indexOf('STORED')) {
    const defaultAddress = batch.storage_location || "Kho số 4, Cảng Cát Lái, TP. Hồ Chí Minh";
    steps.push({
      key: "STORED",
      label: "Đã nhập kho",
      desc: "Nhập kho lưu ký bảo chứng tài sản số",
      content: (
        <div style={{ marginTop: 8, padding: "12px 16px", background: "rgba(240,185,11,0.05)", border: "1px solid rgba(240,185,11,0.2)", borderRadius: 10, fontSize: 13, color: "#cbd5e1" }}>
          <div style={{ marginBottom: 6 }}><span style={{ color: "#94a3b8" }}>Địa chỉ kho:</span> <strong style={{ color: "#f8fafc" }}>{defaultAddress}</strong></div>
          <div style={{ marginBottom: 6 }}><span style={{ color: "#94a3b8" }}>Khối lượng nhập kho (tịnh sau chuẩn hóa):</span> <strong style={{ color: "#B0E4CC" }}>{formatKg(netQuantity)}</strong></div>
          <div style={{ marginBottom: 6 }}><span style={{ color: "#94a3b8" }}>Quy cách đóng gói:</span> <strong style={{ color: "#f8fafc" }}>{Math.ceil(netQuantity / 60)} bao (60kg/bao)</strong></div>
          <div style={{ marginBottom: 8 }}><span style={{ color: "#94a3b8" }}>Vị trí lưu kho:</span> <strong style={{ color: "#f8fafc" }}>Khu A - Lô A3 - Kệ số 2</strong></div>
          {receiptDocs.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px solid rgba(240,185,11,0.15)", paddingTop: 8 }}>
              <div style={{ color: "#f0b90b", fontWeight: 700, fontSize: 12, marginBottom: 6 }}>TÀI LIỆU NHẬP KHO LIÊN QUAN:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {receiptDocs.map(doc => (
                  <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                    <span style={{ color: "#cbd5e1" }}>📄 {doc.document_name}</span>
                    {doc.cid && (
                      <a href={`https://ipfs.io/ipfs/${doc.cid}`} target="_blank" rel="noreferrer" style={{ color: "#408A71", textDecoration: "none", fontWeight: 600 }}>
                        Chi tiết ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    });
  }

  // Step 6: INSPECTED
  if (Object.keys(LOGISTICS_LABELS).indexOf(batch.logistics_status) >= Object.keys(LOGISTICS_LABELS).indexOf('INSPECTED')) {
    steps.push({
      key: "INSPECTED",
      label: "Đã kiểm định",
      desc: "Kiểm định độc lập, thông tin kéo qua Oracle",
      content: (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, color: "#cbd5e1" }}>
            <div style={{ fontWeight: 700, color: "#cbd5e1", marginBottom: 8 }}>🧪 Thông số lý hóa kiểm định (TCVN 4193:20):</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>Độ ẩm (Thủy phần): <strong style={{ color: "#B0E4CC" }}>{moistureContent}%</strong> (Yêu cầu ≤ 12.5%)</div>
              <div>Tỷ lệ nhân lỗi: <strong style={{ color: "#f0b90b" }}>{defectRate}%</strong></div>
              <div>Kích cỡ hạt: <strong style={{ color: "#cbd5e1" }}>{grainSize}</strong></div>
              <div>Độc tố Ochratoxin A: <strong style={{ color: "#B0E4CC" }}>Đạt tiêu chuẩn QCVN 8-1</strong></div>
              <div style={{ gridColumn: "1/-1" }}>Kim loại nặng (Pb, As, Cd, Hg): <strong style={{ color: "#B0E4CC" }}>Đạt tiêu chuẩn QCVN 8-2</strong></div>
            </div>

            {allInspectionDocs.length > 0 && (
              <div style={{ marginTop: 12, borderTop: "1px solid rgba(64,138,113,0.2)", paddingTop: 12 }}>
                <div style={{ color: "#408A71", fontWeight: 700, fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>📋 Tài liệu kiểm định liên quan:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {allInspectionDocs.map(doc => (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "rgba(64,138,113,0.04)", border: "1px solid rgba(64,138,113,0.2)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>📋</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.document_name}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                            {WAREHOUSE_DOC_LABELS[doc.document_type] || doc.document_type}
                            {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("vi-VN")}`}
                          </div>
                          {doc.cid && (
                            <div style={{ fontSize: 11, color: "#408A71", fontFamily: "monospace", marginTop: 3, fontWeight: 600 }}>
                              CID: {doc.cid.slice(0, 16)}…
                            </div>
                          )}
                        </div>
                      </div>
                      {doc.cid && (
                        <a
                          href={`https://ipfs.io/ipfs/${doc.cid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="caro-btn caro-btn-secondary caro-btn-sm"
                          style={{ whiteSpace: "nowrap", fontSize: 12 }}
                        >
                          Xem tài liệu ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {qualityGrade && (
            <div style={{ padding: "20px", background: "rgba(176, 228, 204,0.1)", border: "2px solid rgba(176, 228, 204,0.3)", borderRadius: 12, textAlign: "center", boxShadow: "0 4px 20px rgba(176, 228, 204,0.15)" }}>
              <div style={{ color: "#B0E4CC", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>
                Phân Loại Chất Lượng & Đúc Token (TCVN 4193:20)
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#ffffff", textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>
                {qualityGrade === 'CR1' ? 'CaRo1 (Hạng A)' : qualityGrade === 'CR2' ? 'CaRo2 (Hạng B)' : 'CaRo3 (Hạng C)'}
              </div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>
                Định dạng tài sản số bảo chứng: Token <strong style={{ color: "#408A71" }}>{qualityGrade}</strong>
              </div>
            </div>
          )}
        </div>
      )
    });
  }

  // Step 7: PENDING_MINT_APPROVAL
  if (batch.logistics_status === 'INSPECTED' && batch.status === 'PENDING_MINT_APPROVAL') {
    steps.push({
      key: "PENDING_MINT_APPROVAL",
      label: "Chờ phê duyệt từ Admin",
      desc: "Hồ sơ kiểm định đã đầy đủ, đang chờ Admin duyệt để phát hành (Mint) token",
      content: (
        <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(240,185,11,0.05)", border: "1px solid rgba(240,185,11,0.2)", borderRadius: 8, fontSize: 13, color: "#f0b90b", fontWeight: 600 }}>
          ⏳ Đang trong hàng đợi phê duyệt. Admin sẽ thực hiện mint token trực tiếp vào ví blockchain của nông dân sau khi xác thực.
        </div>
      )
    });
  }

  // Step 8: MINTED
  if (batch.status === 'MINTED') {
    steps.push({
      key: "MINTED",
      label: "Đã phát hành token",
      desc: "Token đã được đúc thành công và gửi vào ví nông dân",
      content: (
        <div style={{ marginTop: 8, padding: "14px 18px", background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.2)", borderRadius: 12, fontSize: 13, color: "#cbd5e1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Số lượng phát hành:</span>
            <strong style={{ color: "#B0E4CC", fontFamily: "monospace" }}>{formatToken(Number(batch.minted_amount), "CaRo")}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Loại token:</span>
            <strong style={{ color: "#f0b90b", fontFamily: "monospace" }}>
              {batch.quality_grade === 'CR1'
                ? 'CaRo1 (Hạng A) — Token CR1'
                : batch.quality_grade === 'CR2'
                ? 'CaRo2 (Hạng B) — Token CR2'
                : batch.quality_grade === 'CR3'
                ? 'CaRo3 (Hạng C) — Token CR3'
                : `${qualityGrade} — Token ${qualityGrade}`}
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Ví nhận:</span>
            <strong style={{ color: "#408A71", fontFamily: "monospace", fontSize: 12 }}>{batch.farmer_wallet || "Farmer Blockchain Wallet"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Số hiệu Block:</span>
            <strong style={{ color: "#cbd5e1" }}>{formatNumber(batch.block_number)}</strong>
          </div>
          {batch.tx_hash && (
            <div style={{ marginTop: 8, borderTop: "1px solid rgba(176, 228, 204,0.15)", paddingTop: 8 }}>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>Transaction Hash (Mã giao dịch)</div>
              <a href={`https://sepolia.etherscan.io/tx/${batch.tx_hash}`} target="_blank" rel="noreferrer"
                style={{ color: "#408A71", fontSize: 13, wordBreak: "break-all", fontFamily: "monospace", textDecoration: "none", fontWeight: 700 }}>
                {batch.tx_hash} ↗
              </a>
            </div>
          )}
        </div>
      )
    });
  }

  const mapBounds = [
    [farmLat, farmLng],
    [whLat, whLng]
  ];

  return (
    <Layout title={`Chi tiết lô hàng — ${batch.batch_id}`}>
      <div className="caro-page">

        <button onClick={() => navigate(backPath)} className="caro-btn caro-btn-ghost" style={{ marginBottom: 24, padding: "8px 16px" }}>
          ← Quay lại
        </button>

        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title" style={{ fontFamily: "monospace", fontSize: 24, color: "#408A71" }}>{batch.batch_id}</h2>
            <p className="caro-page-subtitle">
              Gửi lúc {new Date(batch.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
          <div>
            <span className={`caro-badge ${badgeCls}`} style={{ fontSize: 14, padding: "6px 16px" }}>
              {badgeLabel}
            </span>
          </div>
        </div>

        {/* Batch info */}
        <div className="caro-card">
          <h3 className="caro-section-title">📋 Thông tin lô hàng</h3>
          <InfoRow label="Nông dân"         value={batch.farmer_name} />
          <InfoRow label="Email"            value={batch.farmer_email} />
          <InfoRow label="Loại cà phê"      value={batch.coffee_type || "ROBUSTA COFFEE"} color="#408A71" />
          <InfoRow label="Khối lượng"       value={formatKg(Number(batch.quantity))} />
          <InfoRow label="Ngày thu hoạch"   value={formatDate(batch.harvest_date)} />
          <InfoRow label="Kho lưu trữ"      value={batch.storage_location} />
          {batch.batch_description && (() => {
            // Sanitize description: remove JSON arrays and system-appended tags
            const cleaned = batch.batch_description
              .replace(/\[\{.*?\}\]/gs, '')          // strip JSON arrays e.g. [{"name":...}]
              .replace(/\[Mass Balance\][^\n]*/g, '') // strip Mass Balance notes
              .replace(/\[Ki\u1ec3m \u0111\u1ecbnh[^\]]*\][^\n]*/g, '') // strip Kiểm định tags
              .replace(/\n{2,}/g, '\n')              // collapse multiple blank lines
              .trim();
            if (!cleaned) return null;
            return (
              <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Mô tả</div>
                <div style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-line" }}>{cleaned}</div>
              </div>
            );
          })()}
        </div>

        {/* RWA Source Info */}
        <div className="caro-card">
          <h3 className="caro-section-title">🌱 Dữ Liệu Nguồn & Thực Thể Số (RWA Stage 1)</h3>
          <InfoRow label="Vùng trồng (GPS)"   value={
            farmPolygon
              ? `Đa giác ${farmPolygon.numVertices} đỉnh · ~${farmPolygon.areaHa} ha · Tâm: ${farmLat.toFixed(4)}°N, ${farmLng.toFixed(4)}°E`
              : null
          } mono color="#408A71" />
          <InfoRow label="Sản lượng dự kiến" value={batch.estimated_yield ? `${formatNumber(batch.estimated_yield)} kg` : null} />
          <InfoRow label="Niên vụ"            value={batch.crop_year} />
          <InfoRow label="Phương thức canh tác" value={FARMING_METHOD_LABELS[batch.farming_method] || batch.farming_method} />
          {batch.production_diary && (
            <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Nhật ký sản xuất</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>{batch.production_diary}</div>
            </div>
          )}
          {batch.traceability_info && (
            <div style={{ padding: "16px 0" }}>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>Thông tin truy xuất</div>
              <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, background: "rgba(255,255,255,0.02)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>{batch.traceability_info}</div>
            </div>
          )}
        </div>

        {/* Logistics Shipping Tracker */}
        <div className="caro-card">
          <h3 className="caro-section-title">🚚 Trạng Thái Vận Chuyển & Logistics</h3>
          <div style={{ display: "grid", gridTemplateColumns: isAdmin ? "1fr" : "1.2fr 1fr", gap: 32, alignItems: "stretch" }}>
            {/* Tracking progress bar */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", marginBottom: 20 }}>
                Lộ trình hàng hóa: <span style={{ color: "#f8fafc" }}>{LOGISTICS_LABELS[batch.logistics_status || 'INITIALIZED']}</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative", paddingLeft: 24 }}>
                {/* Dotted line indicator */}
                <div style={{ position: "absolute", left: 7, top: 10, bottom: 10, width: 2, borderLeft: "2px dashed var(--border)" }} />

                {steps.map((step, idx) => {
                  const isLast = idx === steps.length - 1;
                  const isMintedDone = batch.status === 'MINTED';
                  const isActive = isLast && !isMintedDone;
                  
                  return (
                    <div key={step.key} style={{ display: "flex", gap: 16, alignItems: "flex-start", position: "relative" }}>
                      <div style={{
                        position: "absolute", left: -22, width: 12, height: 12, borderRadius: "50%",
                        background: isActive ? "#B0E4CC" : "#408A71",
                        border: isActive ? "3px solid #0f172a" : "none",
                        boxShadow: isActive ? `0 0 12px #B0E4CC` : "none",
                        zIndex: 2,
                        marginTop: 2
                      }} />
                      <div style={{ width: "100%" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? "#B0E4CC" : "#f8fafc" }}>{step.label}</div>
                        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{step.desc}</div>
                        {step.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Leaflet RWA Map */}
            {!isAdmin && (
              <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, position: "relative", display: "flex", flexDirection: "column", flex: 1, minHeight: 320 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 700, marginBottom: 12 }}>Bản đồ giám sát RWA (Live)</div>
                
                <div style={{ flex: 1, position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(72,117,115,0.3)", zIndex: 0 }}>
                  <MapContainer style={{ width: '100%', height: '100%', zIndex: 1 }} zoomControl={false} scrollWheelZoom={true}>
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                      maxZoom={18}
                    />
                    <MapBoundsUpdater bounds={mapBounds} />

                    {/* Farm boundary polygon */}
                    {farmPolygon && (
                      <Polygon
                        positions={farmPolygon.points}
                        pathOptions={{
                          color: '#B0E4CC',
                          weight: 2,
                          fillColor: 'rgba(176,228,204,0.15)',
                          fillOpacity: 1,
                          dashArray: '4 3',
                        }}
                      >
                        <Popup>
                          Vùng trồng · {farmPolygon.areaHa} ha
                        </Popup>
                      </Polygon>
                    )}

                    <Polyline positions={mapBounds} pathOptions={{ color: 'rgba(255,255,255,0.6)', dashArray: '6 6', weight: 2 }} />

                    <Marker position={[farmLat, farmLng]} icon={farmIcon}>
                      <Popup>Tâm vùng trồng {farmPolygon ? `· ~${farmPolygon.areaHa} ha` : ''}</Popup>
                    </Marker>
                    
                    <Marker position={[whLat, whLng]} icon={whIcon}>
                      <Popup>Kho lưu ký</Popup>
                    </Marker>

                    {batch.logistics_status === 'IN_TRANSIT' && (
                      <Marker position={[currentLat, currentLng]} icon={truckIcon} zIndexOffset={1000} />
                    )}
                    {batch.logistics_status !== 'IN_TRANSIT' && (
                      <Marker position={[currentLat, currentLng]} icon={new L.divIcon({
                        html: '<div style="width:16px;height:16px;background:#408A71;border-radius:50%;box-shadow:0 0 10px #408A71;border:2px solid #fff;"></div>',
                        className: '', iconSize: [16,16], iconAnchor: [8,8]
                      })} zIndexOffset={1000} />
                    )}
                  </MapContainer>
                </div>

                <div style={{ fontFamily: "monospace", fontSize: 12, color: "#B0E4CC", background: "rgba(176, 228, 204,0.1)", border: "1px solid rgba(176, 228, 204,0.2)", padding: "10px 14px", borderRadius: 8, marginTop: 16 }}>
                  <div style={{ marginBottom: 4 }}>GPS: {
                    batch.logistics_status === 'IN_TRANSIT'
                      ? `${currentLat.toFixed(4)}° N, ${currentLng.toFixed(4)}° E`
                      : batch.logistics_status === 'PENDING_PICKUP'
                        ? `${farmLat.toFixed(4)}° N, ${farmLng.toFixed(4)}° E (Tại Vùng Trồng)`
                        : `${whLat.toFixed(4)}° N, ${whLng.toFixed(4)}° E (Đã Vào Kho)`
                  }</div>
                  {farmPolygon && (
                    <div style={{ marginBottom: 4 }}>
                      Diện tích vùng trồng: <strong style={{ color: '#B0E4CC' }}>{farmPolygon.areaHa} ha</strong>
                      <span style={{ color: '#64748b', marginLeft: 8 }}>({farmPolygon.numVertices} đỉnh)</span>
                    </div>
                  )}
                  <div>Tốc độ: {batch.logistics_status === 'IN_TRANSIT' ? '45 km/h' : '0 km/h'}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="caro-card">
          <h3 className="caro-section-title">📂 Tài liệu ({batch.documents?.length || 0} file)</h3>
          <DocumentsSection documents={batch.documents} />
        </div>

        {/* Warehouse Documents */}
        <div className="caro-card" style={{ borderTop: "4px solid #f0b90b" }}>
          <h3 className="caro-section-title" style={{ color: "#f0b90b" }}>🏭 Tài liệu liên quan ({warehouseDocs.length + allInspectionDocs.length} tài liệu)</h3>
          {allInspectionDocs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#408A71", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>📋 Tài liệu kiểm định chất lượng</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allInspectionDocs.map(doc => (
                  <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "rgba(64,138,113,0.04)", border: "1px solid rgba(64,138,113,0.2)", borderRadius: 10, padding: "12px 16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>📋</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.document_name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                          {WAREHOUSE_DOC_LABELS[doc.document_type] || doc.document_type}
                          {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("vi-VN")}`}
                        </div>
                        {doc.cid && (
                          <div style={{ fontSize: 11, color: "#408A71", fontFamily: "monospace", marginTop: 3, fontWeight: 600 }}>CID: {doc.cid.slice(0, 16)}…</div>
                        )}
                      </div>
                    </div>
                    {doc.cid && (
                      <a href={`https://ipfs.io/ipfs/${doc.cid}`} target="_blank" rel="noreferrer"
                        className="caro-btn caro-btn-secondary caro-btn-sm" style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                        Xem tài liệu ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <WarehouseDocsSection docs={warehouseDocs} />
        </div>

        {/* Rejection info */}
        {batch.status === "REJECTED" && (
          <div className="caro-card" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <h3 className="caro-section-title" style={{ color: "#ef4444" }}>❌ Chi tiết từ chối</h3>
            <InfoRow label="Lý do"           value={batch.rejection_reason} color="#ef4444" />
            <InfoRow label="Từ chối lúc"     value={batch.rejected_at ? new Date(batch.rejected_at).toLocaleString("vi-VN") : null} />
            <InfoRow label="Người xét duyệt" value={batch.reviewer_name} />
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && batch.status === "PENDING_MINT_APPROVAL" && batch.logistics_status === "INSPECTED" && (
          <div className="caro-card" style={{ borderTop: "4px solid #408A71" }}>
            <h3 className="caro-section-title" style={{ color: "#408A71" }}>⚙️ Thao tác Admin</h3>
            {!showReject ? (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 24, alignItems: "center" }}>
                {batch.farmer_wallet ? (
                  <button
                    onClick={handleApprove}
                    disabled={isPending}
                    className={`caro-btn ${isPending ? "caro-btn-ghost" : "caro-btn-primary"}`}
                    style={{ padding: "14px 32px", fontSize: 15, background: isPending ? undefined : "#B0E4CC", borderColor: isPending ? undefined : "#B0E4CC", color: isPending ? undefined : "#0f172a" }}
                  >
                    {approve.isPending ? "⏳ Đang đúc..." : "✅ Duyệt & Đúc → Ví Nông Dân"}
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: 10, color: "#f59e0b", fontSize: 14, fontWeight: 600 }}>
                    <span>⚠️ Nông dân chưa kết nối ví. Không thể phê duyệt lô hàng.</span>
                  </div>
                )}
                <button
                  onClick={() => setShowReject(true)}
                  disabled={isPending}
                  className="caro-btn caro-btn-danger"
                  style={{ padding: "14px 32px", fontSize: 15 }}
                >
                  ❌ Từ chối
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 24, background: "rgba(239,68,68,0.05)", padding: 20, borderRadius: 12, border: "1px solid rgba(239,68,68,0.2)" }}>
                <div className="caro-field">
                  <label className="caro-label" style={{ color: "#ef4444" }}>Lý do từ chối <span style={{ color: "#ef4444" }}>*</span></label>
                  <textarea
                    className="caro-input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    placeholder="VD: Tài liệu không hợp lệ · Số lượng không khớp · Không qua kiểm định..."
                    style={{ resize: "vertical", borderColor: "rgba(239,68,68,0.4)" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button onClick={handleReject} disabled={!reason.trim() || isPending}
                    className={`caro-btn ${!reason.trim() || isPending ? "caro-btn-ghost" : "caro-btn-danger"}`}
                    style={{ opacity: !reason.trim() || isPending ? 0.5 : 1 }}>
                    {reject.isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
                  </button>
                  <button onClick={() => { setShowReject(false); setReason(""); }} className="caro-btn caro-btn-ghost">
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
