import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DashboardLayout from "../components/layout/DashboardLayout";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useBatch, useApproveBatch, useRejectBatch } from "../hooks/useBatches";
import { formatNumber, formatKg, formatToken } from '../utils/formatters';

const STATUS_META = {
  PENDING_MINT_APPROVAL: { color: "#f39c12", bg: "rgba(243,156,18,0.12)", label: "⏳ Chờ duyệt" },
  APPROVED:              { color: "#3498db", bg: "rgba(52,152,219,0.12)",  label: "✅ Đã duyệt"  },
  MINTED:                { color: "#27ae60", bg: "rgba(39,174,96,0.12)",   label: "🪙 Đã Mint"   },
  REJECTED:              { color: "#e74c3c", bg: "rgba(231,76,60,0.12)",   label: "❌ Từ chối"   },
};

const DOC_LABELS = {
  harvest_certificate: "Chứng nhận thu hoạch",
  quality_inspection:  "Kiểm định chất lượng",
  coffee_photos:       "Ảnh lô cà phê",
  additional_docs:     "Tài liệu bổ sung",
};

const WAREHOUSE_DOC_LABELS = {
  warehouse_license:         "Warehouse License",
  inspection_report:         "Inspection Report",
  warehouse_certificate:     "Warehouse Certificate",
  warehouse_insurance:       "Warehouse Insurance",
  warehouse_ownership_proof: "Ownership Documents",
  warehouse_photos:          "Warehouse Photos",
  coffee_storage_report:     "Coffee Storage Report",
  warehouse_receipt:         "Warehouse Receipt",
  other:                     "Other",
};

function InfoRow({ label, value, accent, mono, borderLine }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "11px 0", borderBottom: `1px solid ${borderLine || "rgba(255,255,255,0.05)"}`, gap: 12 }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent || "#fff", fontSize: 13, textAlign: "right", wordBreak: "break-all", fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

function Section({ title, children, accent, bgColor, border }) {
  return (
    <div style={{ background: bgColor || "#141a1f", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: border || "1px solid rgba(255,255,255,0.08)" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, color: accent || "#9fcfc6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</h3>
      {children}
    </div>
  );
}

function DocumentsSection({ documents, accent, borderLine }) {
  if (!documents || documents.length === 0) {
    return (
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>
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
        <div key={type} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${borderLine || "rgba(255,255,255,0.05)"}` }}>
          <div style={{ fontSize: 12, color: accent || "#9fcfc6", fontWeight: 600, marginBottom: 8 }}>
            {DOC_LABELS[type] || type}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${borderLine || "rgba(255,255,255,0.08)"}`, borderRadius: 8, padding: "7px 12px" }}>
                <span style={{ fontSize: 16 }}>📄</span>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{f.file_name}</div>
                  {f.ipfs_cid ? (
                    <a href={`https://ipfs.io/ipfs/${f.ipfs_cid}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: accent || "#9fcfc6", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                      IPFS: {f.ipfs_cid.slice(0, 12)}... ↗
                    </a>
                  ) : (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>Lưu local (IPFS chưa cấu hình)</div>
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
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>
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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Object.entries(grouped).map(([type, files]) => (
        <div key={type}>
          <div style={{ fontSize: 12, color: "#9fcfc6", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {WAREHOUSE_DOC_LABELS[type] || type}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "12px 14px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📋</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.document_name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                      {WAREHOUSE_DOC_LABELS[doc.document_type] || doc.document_type}
                      {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("vi-VN")}`}
                    </div>
                    {doc.cid && (
                      <div style={{ fontSize: 11, color: "#9fcfc6", fontFamily: "monospace", marginTop: 2 }}>
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
                    style={{ padding: "6px 14px", background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", color: "#00d4aa", borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
                  >
                    View Document ↗
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
      <div style={{ width: "100%" }}>
        {[240, 320, 200].map((h, i) => (
          <div key={i} style={{ height: h, background: isAdmin ? "#141a1f" : "#172524", borderRadius: 12, marginBottom: 16, border: isAdmin ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(72,117,115,0.15)", animation: "pulse 1.5s ease-in-out infinite" }} />
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
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <div style={{ color: "#e74c3c", fontSize: 16 }}>Không tìm thấy lô hàng hoặc bạn không có quyền truy cập</div>
          <button onClick={() => navigate(backPath)} style={{ marginTop: 20, padding: "9px 22px", background: isAdmin ? "#1f6f64" : "#487573", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>← Quay lại</button>
        </div>
      </Layout>
    );
  }

  const sm = STATUS_META[batch.status] || { color: "#aaa", bg: "rgba(255,255,255,0.08)", label: batch.status };
  const isPending = approve.isPending || reject.isPending;
  const warehouseDocs = batch.warehouse_documents || [];

  const accentColor = isAdmin ? "#9fcfc6" : "#7fe0c9";
  const cardBg = isAdmin ? "#141a1f" : "#172524";
  const borderVal = isAdmin ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(72,117,115,0.15)";
  const borderLine = isAdmin ? "rgba(255,255,255,0.05)" : "rgba(72,117,115,0.15)";

  return (
    <Layout title={`Chi tiết lô hàng — ${batch.batch_id}`}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ width: "100%" }}>

        <button onClick={() => navigate(backPath)} style={{ background: "none", border: "none", color: accentColor, cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
          ← Quay lại
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{batch.batch_id}</h2>
            <p style={{ margin: "5px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              Gửi lúc {new Date(batch.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
          <div style={{ background: sm.bg, color: sm.color, padding: "8px 18px", borderRadius: 24, fontWeight: 700, fontSize: 14, border: `1px solid ${sm.color}40` }}>
            {sm.label}
          </div>
        </div>

        {/* Batch info */}
        <Section title="📋 Thông tin lô hàng" accent={accentColor} bgColor={cardBg} border={borderVal}>
          <InfoRow label="Farmer"           value={batch.farmer_name} borderLine={borderLine} />
          <InfoRow label="Email"            value={batch.farmer_email} borderLine={borderLine} />
          <InfoRow label="Loại cà phê"      value={batch.coffee_type || "ROBUSTA COFFEE"} accent={accentColor} borderLine={borderLine} />
          <InfoRow label="Khối lượng"       value={formatKg(Number(batch.quantity))} accent="#fff" borderLine={borderLine} />
          <InfoRow label="Ngày thu hoạch"   value={batch.harvest_date?.slice(0, 10)} borderLine={borderLine} />
          <InfoRow label="Kho lưu trữ"      value={batch.storage_location} borderLine={borderLine} />
          {batch.batch_description && (
            <div style={{ padding: "11px 0", borderBottom: `1px solid ${borderLine}` }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 4 }}>Mô tả</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{batch.batch_description}</div>
            </div>
          )}
        </Section>

        {/* Documents */}
        <Section title={`📂 Tài liệu (${batch.documents?.length || 0} file)`} accent={accentColor} bgColor={cardBg} border={borderVal}>
          <DocumentsSection documents={batch.documents} accent={accentColor} borderLine={borderLine} />
        </Section>

        {/* Warehouse Documents */}
        <Section title={`🏭 Warehouse Docs (${warehouseDocs.length} files)`} accent="#f0b90b">
          <WarehouseDocsSection docs={warehouseDocs} />
        </Section>

        {/* Minted info */}
        {batch.status === "MINTED" && (
          <div style={{ background: isAdmin ? "rgba(39,174,96,0.07)" : "rgba(14,203,129,0.05)", border: isAdmin ? "1px solid rgba(39,174,96,0.25)" : "1px solid rgba(14,203,129,0.15)", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, color: "#27ae60", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>🪙 Token đã Mint</h3>
            <InfoRow label="Số lượng"       value={formatToken(Number(batch.minted_amount), "CaRo")} accent="#22c55e" borderLine={borderLine} />
            <InfoRow label="Ví nhận"        value={batch.farmer_wallet || "Farmer Blockchain Wallet"} accent={accentColor} mono borderLine={borderLine} />
            <InfoRow label="Thời gian Mint" value={batch.minted_at ? new Date(batch.minted_at).toLocaleString("vi-VN") : null} borderLine={borderLine} />
            <InfoRow label="Block Number"   value={formatNumber(batch.block_number)} borderLine={borderLine} />
            <InfoRow label="Người duyệt"    value={batch.reviewer_name} borderLine={borderLine} />
            {batch.tx_hash && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 6 }}>Transaction Hash (Mã giao dịch)</div>
                <a href={`https://sepolia.etherscan.io/tx/${batch.tx_hash}`} target="_blank" rel="noreferrer"
                  style={{ color: accentColor, fontSize: 12, wordBreak: "break-all", fontFamily: "monospace", textDecoration: "none" }}>
                  {batch.tx_hash}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Rejection info */}
        {batch.status === "REJECTED" && (
          <div style={{ background: "rgba(231,76,60,0.07)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, color: "#e74c3c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>❌ Chi tiết từ chối</h3>
            <InfoRow label="Lý do"           value={batch.rejection_reason} accent="#e74c3c" borderLine={borderLine} />
            <InfoRow label="Từ chối lúc"     value={batch.rejected_at ? new Date(batch.rejected_at).toLocaleString("vi-VN") : null} borderLine={borderLine} />
            <InfoRow label="Người xét duyệt" value={batch.reviewer_name} borderLine={borderLine} />
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && batch.status === "PENDING_MINT_APPROVAL" && (
          <Section title="⚙️ Thao tác Admin" accent={accentColor} bgColor={cardBg} border={borderVal}>
            {!showReject ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={handleApprove}
                  disabled={isPending}
                  style={{ padding: "11px 28px", background: isPending ? "#555" : "#27ae60", border: "none", color: "#fff", borderRadius: 9, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", fontSize: 14 }}
                >
                  {approve.isPending ? "⏳ Đang mint..." : "✅ Approve & Mint → Ví Nội Bộ"}
                </button>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={isPending}
                  style={{ padding: "11px 28px", background: "#e74c3c", border: "none", color: "#fff", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  ❌ Reject
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", color: "#e74c3c", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Lý do từ chối *</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="VD: Tài liệu không hợp lệ · Số lượng không khớp · Không qua kiểm định..."
                  style={{ width: "100%", padding: "10px 12px", background: "#0b1113", border: "1px solid rgba(231,76,60,0.4)", borderRadius: 8, color: "#fff", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={handleReject} disabled={!reason.trim() || isPending}
                    style={{ padding: "9px 22px", background: !reason.trim() || isPending ? "#555" : "#e74c3c", border: "none", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: !reason.trim() || isPending ? "not-allowed" : "pointer" }}>
                    {reject.isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
                  </button>
                  <button onClick={() => { setShowReject(false); setReason(""); }}
                    style={{ padding: "9px 18px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>
                    Huỷ
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}
      </div>
    </Layout>
  );
}
