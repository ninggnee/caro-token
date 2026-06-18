import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";

const STATUS_META = {
  PENDING_MINT_APPROVAL: { color: "#f39c12", bg: "rgba(243,156,18,0.15)", label: "⏳ Chờ duyệt" },
  MINTED:                { color: "#27ae60", bg: "rgba(39,174,96,0.15)",  label: "🪙 Đã Mint"   },
  REJECTED:              { color: "#e74c3c", bg: "rgba(231,76,60,0.15)",  label: "❌ Từ chối"   },
};

const TABS = [
  { key: "PENDING_MINT_APPROVAL", label: "⏳ Chờ Duyệt" },
  { key: "MINTED",                label: "✅ Đã Mint"   },
  { key: "REJECTED",              label: "❌ Từ Chối"   },
];

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color: "#aaa", bg: "rgba(255,255,255,0.08)", label: status };
  return (
    <span style={{ background: m.bg, color: m.color, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {m.label}
    </span>
  );
}

function Skeleton() {
  return (
    <div style={{ background: "#141a1f", borderRadius: 12, padding: "18px 20px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
      {[100, 60, 40].map((w, i) => (
        <div key={i} style={{ height: 14, background: "rgba(255,255,255,0.07)", borderRadius: 6, marginBottom: 10, width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

function BatchCard({ batch, navigate }) {
  const isRejected = batch.status === "REJECTED";
  const isMinted   = batch.status === "MINTED";

  return (
    <div
      style={{ background: "#141a1f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 20px", marginBottom: 12, transition: "border-color 0.2s" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(159,207,198,0.25)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#9fcfc6" }}>{batch.batch_id}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>☕ Robusta Coffee</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
            <span>⚖️ {Number(batch.quantity).toLocaleString()} kg</span>
            <span>🏷️ {batch.quality_grade}</span>
            {batch.harvest_date && <span>📅 {batch.harvest_date?.slice(0, 10)}</span>}
            {batch.storage_location && <span>📍 {batch.storage_location}</span>}
          </div>
          {batch.estimated_value && (
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              💰 {Number(batch.estimated_value).toLocaleString("vi-VN")} ₫
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatusBadge status={batch.status} />
          {batch.doc_count > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              📂 {batch.doc_count} tài liệu
            </div>
          )}
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4 }}>
            {new Date(batch.created_at).toLocaleDateString("vi-VN")}
          </div>
        </div>
      </div>

      {isMinted && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
          <div style={{ background: "rgba(39,174,96,0.08)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 3 }}>Token đã Mint</div>
            <div style={{ fontWeight: 700, color: "#22c55e", fontSize: 15 }}>
              {Number(batch.minted_amount).toLocaleString()} {batch.quality_grade}
            </div>
          </div>
          <div style={{ background: "rgba(31,111,100,0.08)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 3 }}>Ví nội bộ</div>
            <div style={{ fontWeight: 700, color: "#9fcfc6", fontSize: 13 }}>🏦 Exchange Wallet</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 3 }}>Thời gian Mint</div>
            <div style={{ fontSize: 13, color: "#fff" }}>
              {batch.minted_at ? new Date(batch.minted_at).toLocaleString("vi-VN") : "—"}
            </div>
          </div>
          {batch.tx_hash && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px", gridColumn: "1/-1" }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginBottom: 3 }}>Transaction Hash</div>
              <a href={`https://sepolia.etherscan.io/tx/${batch.tx_hash}`} target="_blank" rel="noreferrer"
                style={{ color: "#9fcfc6", fontSize: 11, wordBreak: "break-all" }}>
                {batch.tx_hash}
              </a>
            </div>
          )}
        </div>
      )}

      {isRejected && batch.rejection_reason && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(231,76,60,0.08)", borderRadius: 8, fontSize: 13, color: "#e74c3c", borderLeft: "3px solid #e74c3c" }}>
          <strong>Lý do từ chối:</strong> {batch.rejection_reason}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button
          onClick={() => navigate(`/farmer/batch/${batch.id}`)}
          style={{ padding: "6px 16px", background: "rgba(159,207,198,0.1)", color: "#9fcfc6", border: "1px solid rgba(159,207,198,0.2)", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          Xem chi tiết →
        </button>
      </div>
    </div>
  );
}

export default function FarmerBatchesPage() {
  const navigate = useNavigate();
  const [tab,  setTab]  = useState("PENDING_MINT_APPROVAL");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useMyBatches({ status: tab, page, limit: 10 });
  const batches = data?.batches || [];
  const total   = data?.total   || 0;

  return (
    <FarmerLayout title="My Batches">
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📦 Batch Cà Phê Robusta</h2>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
              {total} batch — theo dõi trạng thái tokenization
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => refetch()} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🔄</button>
            <button
              onClick={() => navigate("/farmer/assets/submit")}
              style={{ padding: "10px 20px", background: "#1f6f64", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}
            >
              ➕ Tạo Batch Mới
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {TABS.map((t) => {
            const m = STATUS_META[t.key];
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                style={{ background: tab === t.key ? m.bg : "rgba(255,255,255,0.03)", border: `1px solid ${tab === t.key ? m.color : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
              >
                <div style={{ fontSize: 13, color: tab === t.key ? m.color : "rgba(255,255,255,0.5)", fontWeight: 600 }}>{t.label}</div>
              </button>
            );
          })}
        </div>

        {/* List */}
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} />)
        ) : isError ? (
          <div style={{ textAlign: "center", padding: 60, color: "#e74c3c" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div>Lỗi tải dữ liệu</div>
            <button onClick={() => refetch()} style={{ marginTop: 12, padding: "8px 20px", background: "#e74c3c", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer" }}>Thử lại</button>
          </div>
        ) : batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15 }}>Chưa có batch nào</div>
            {tab === "PENDING_MINT_APPROVAL" && (
              <button onClick={() => navigate("/farmer/assets/submit")} style={{ marginTop: 16, padding: "10px 24px", background: "#1f6f64", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                Tạo Batch Đầu Tiên
              </button>
            )}
          </div>
        ) : (
          <>
            {batches.map((b) => <BatchCard key={b.id} batch={b} navigate={navigate} />)}
            {total > 10 && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                {page > 1 && <button onClick={() => setPage((p) => p - 1)} style={{ padding: "7px 18px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, cursor: "pointer" }}>← Trước</button>}
                <span style={{ padding: "7px 14px", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Trang {page}</span>
                {batches.length === 10 && <button onClick={() => setPage((p) => p + 1)} style={{ padding: "7px 18px", background: "#141a1f", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: 6, cursor: "pointer" }}>Sau →</button>}
              </div>
            )}
          </>
        )}
      </div>
    </FarmerLayout>
  );
}
