import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useBatch, useApproveBatch, useRejectBatch } from "../hooks/useBatches";

const STATUS_META = {
  PENDING_MINT_APPROVAL: { color: "#f39c12", bg: "rgba(243,156,18,0.12)", label: "⏳ Chờ duyệt" },
  APPROVED:              { color: "#3498db", bg: "rgba(52,152,219,0.12)",  label: "✅ Đã duyệt"  },
  MINTED:                { color: "#27ae60", bg: "rgba(39,174,96,0.12)",   label: "🪙 Đã Mint"   },
  REJECTED:              { color: "#e74c3c", bg: "rgba(231,76,60,0.12)",   label: "❌ Từ chối"   },
};

const DOC_LABELS = {
  farmer_identity:     "Xác minh danh tính",
  farm_ownership:      "Sở hữu đất",
  harvest_certificate: "Chứng nhận thu hoạch",
  warehouse_receipt:   "Phiếu nhập kho",
  quality_inspection:  "Kiểm định chất lượng",
  coffee_photos:       "Ảnh lô cà phê",
  additional_docs:     "Tài liệu bổ sung",
};

function InfoRow({ label, value, accent, mono }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 12 }}>
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent || "#fff", fontSize: 13, textAlign: "right", wordBreak: "break-all", fontFamily: mono ? "monospace" : undefined }}>{value}</span>
    </div>
  );
}

function Section({ title, children, accent, bgColor }) {
  return (
    <div style={{ background: bgColor || "#141a1f", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: 14, color: accent || "#9fcfc6", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</h3>
      {children}
    </div>
  );
}

function DocumentsSection({ documents }) {
  if (!documents || documents.length === 0) {
    return (
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "12px 0" }}>
        Chưa có tài liệu nào được upload
      </div>
    );
  }

  // Group by document_type
  const grouped = {};
  for (const doc of documents) {
    if (!grouped[doc.document_type]) grouped[doc.document_type] = [];
    grouped[doc.document_type].push(doc);
  }

  return (
    <div>
      {Object.entries(grouped).map(([type, files]) => (
        <div key={type} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize: 12, color: "#9fcfc6", fontWeight: 600, marginBottom: 8 }}>
            {DOC_LABELS[type] || type}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {files.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 12px" }}>
                <span style={{ fontSize: 16 }}>📄</span>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{f.file_name}</div>
                  {f.ipfs_cid ? (
                    <a href={`https://ipfs.io/ipfs/${f.ipfs_cid}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "#9fcfc6", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
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

function SkeletonDetail() {
  return (
    <DashboardLayout title="Chi tiết Batch">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {[240, 320, 200].map((h, i) => (
          <div key={i} style={{ height: h, background: "#141a1f", borderRadius: 12, marginBottom: 16, border: "1px solid rgba(255,255,255,0.05)", animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    </DashboardLayout>
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

  const backPath = isAdmin ? "/admin/mint-requests" : "/farmer/batches";

  const handleApprove = () => {
    if (!window.confirm(
      `Approve & Mint batch ${batch.batch_id}?\n` +
      `${Number(batch.quantity).toLocaleString()} kg → ${batch.quality_grade} token\n` +
      `Token sẽ được mint vào ví nội bộ của farmer.`
    )) return;
    approve.mutate({ id }, { onSuccess: () => setShowReject(false) });
  };

  const handleReject = () => {
    if (!reason.trim()) { toast.warning("Nhập lý do từ chối"); return; }
    reject.mutate({ id, reason }, {
      onSuccess: () => { setShowReject(false); setReason(""); },
    });
  };

  if (isLoading) return <SkeletonDetail />;
  if (isError || !batch) {
    return (
      <DashboardLayout title="Chi tiết Batch">
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <div style={{ color: "#e74c3c", fontSize: 16 }}>Không tìm thấy batch hoặc bạn không có quyền truy cập</div>
          <button onClick={() => navigate(backPath)} style={{ marginTop: 20, padding: "9px 22px", background: "#1f6f64", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>← Quay lại</button>
        </div>
      </DashboardLayout>
    );
  }

  const sm = STATUS_META[batch.status] || { color: "#aaa", bg: "rgba(255,255,255,0.08)", label: batch.status };
  const isPending = approve.isPending || reject.isPending;

  return (
    <DashboardLayout title={`Batch — ${batch.batch_id}`}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <button onClick={() => navigate(backPath)} style={{ background: "none", border: "none", color: "#9fcfc6", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
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
        <Section title="📋 Thông tin lô hàng">
          <InfoRow label="Farmer"           value={batch.farmer_name}  />
          <InfoRow label="Email"            value={batch.farmer_email} />
          <InfoRow label="Loại cà phê"      value="Robusta Coffee"     accent="#9fcfc6" />
          <InfoRow label="Khối lượng"       value={`${Number(batch.quantity).toLocaleString()} kg`} accent="#fff" />
          <InfoRow label="Grade"            value={batch.quality_grade} accent="#9fcfc6" />
          <InfoRow label="Ngày thu hoạch"   value={batch.harvest_date?.slice(0, 10)} />
          <InfoRow label="Kho lưu trữ"      value={batch.storage_location} />
          <InfoRow label="Giá trị ước tính" value={batch.estimated_value ? Number(batch.estimated_value).toLocaleString("vi-VN") + " ₫" : null} />
          {batch.batch_description && (
            <div style={{ padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 4 }}>Mô tả</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{batch.batch_description}</div>
            </div>
          )}
        </Section>

        {/* Documents */}
        <Section title={`📂 Tài liệu (${batch.documents?.length || 0} files)`}>
          <DocumentsSection documents={batch.documents} />
        </Section>

        {/* Minted info */}
        {batch.status === "MINTED" && (
          <div style={{ background: "rgba(39,174,96,0.07)", border: "1px solid rgba(39,174,96,0.25)", borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, color: "#27ae60", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>🪙 Token đã Mint</h3>
            <InfoRow label="Số lượng"       value={`${Number(batch.minted_amount).toLocaleString()} ${batch.quality_grade}`} accent="#22c55e" />
            <InfoRow label="Ví nhận"        value="🏦 Ví nội bộ Exchange" accent="#9fcfc6" />
            <InfoRow label="Thời gian Mint" value={batch.minted_at ? new Date(batch.minted_at).toLocaleString("vi-VN") : null} />
            <InfoRow label="Block Number"   value={batch.block_number?.toLocaleString()} />
            <InfoRow label="Người duyệt"    value={batch.reviewer_name} />
            {batch.tx_hash && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 6 }}>Transaction Hash</div>
                <a href={`https://sepolia.etherscan.io/tx/${batch.tx_hash}`} target="_blank" rel="noreferrer"
                  style={{ color: "#9fcfc6", fontSize: 12, wordBreak: "break-all", fontFamily: "monospace" }}>
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
            <InfoRow label="Lý do"           value={batch.rejection_reason} accent="#e74c3c" />
            <InfoRow label="Từ chối lúc"     value={batch.rejected_at ? new Date(batch.rejected_at).toLocaleString("vi-VN") : null} />
            <InfoRow label="Người xét duyệt" value={batch.reviewer_name} />
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && batch.status === "PENDING_MINT_APPROVAL" && (
          <Section title="⚙️ Thao tác Admin">
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
    </DashboardLayout>
  );
}
