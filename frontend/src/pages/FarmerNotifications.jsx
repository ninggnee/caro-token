import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { useAuth } from "../context/AuthContext";
import { formatNumber, formatKg } from '../utils/formatters';

function batchToNotifs(batches, user) {
  const out = [];
  
  if (!user?.wallet_address) {
    out.push({
      type: "pending",
      icon: "🦊",
      color: "#f59e0b",
      title: "Chưa liên kết ví Web3",
      body: "Tài khoản của bạn chưa liên kết ví. Vui lòng liên kết địa chỉ ví Web3 tại mục 'Ví tài khoản' để có thể nhận và giao dịch token CaRo.",
      date: user?.created_at || new Date().toISOString(),
      link: "/farmer/wallet",
    });
  }

  const batchNotifs = batches.flatMap(b => {
    const list = [];
    if (b.status === "MINTED") {
      list.push({
        type: "mint",
        icon: "🪙",
        color: "#B0E4CC",
        title: "Đã Mint Lô Hàng Thành Công",
        body: `${b.batch_id} — Đã mint ${formatNumber(Number(b.minted_amount || b.quantity))} token CaRo vào ví của bạn`,
        date: b.minted_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "REJECTED") {
      list.push({
        type: "reject",
        icon: "❌",
        color: "#ef4444",
        title: "Lô Hàng Bị Từ Chối",
        body: `${b.batch_id} đã bị từ chối${b.rejection_reason ? ": " + b.rejection_reason : ""}`,
        date: b.rejected_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "APPROVED") {
      list.push({
        type: "approve",
        icon: "✅",
        color: "#408A71",
        title: "Lô Hàng Đã Được Duyệt",
        body: `${b.batch_id} đã được phê duyệt và đang tiến hành mint token`,
        date: b.approved_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "PENDING_MINT_APPROVAL") {
      if (!b.farmer_wallet) {
        list.push({
          type: "reject",
          icon: "⚠️",
          color: "#ef4444",
          title: "Cần liên kết ví khẩn cấp",
          body: `Lô hàng ${b.batch_id} đang chờ duyệt nhưng tài khoản chưa liên kết ví. Vui lòng kết nối ví ngay.`,
          date: b.updated_at || b.created_at,
          link: "/farmer/wallet",
        });
      } else {
        list.push({
          type: "pending",
          icon: "⏳",
          color: "#f0b90b",
          title: "Lô Hàng Đang Được Kiểm Duyệt",
          body: `${b.batch_id} — Đã gửi yêu cầu ${formatKg(Number(b.quantity))}, đang chờ admin phê duyệt`,
          date: b.created_at,
          link: `/farmer/batch/${b.id}`,
        });
      }
    }
    return list;
  });

  return [...out, ...batchNotifs];
}

const TYPES = ["All", "Minted", "Rejected", "Pending"];
const TYPE_LABELS = { All: "Tất cả", Minted: "Đã Mint", Rejected: "Từ chối", Pending: "Chờ duyệt" };

export default function FarmerNotifications() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");
  const [readAll, setReadAll] = useState(false);

  const { data: allData } = useMyBatches({ limit: 50 });
  const batches = allData?.batches || [];
  const notifs = batchToNotifs(batches, user).sort((a, b) => new Date(b.date) - new Date(a.date));

  const filtered = notifs.filter(n => {
    if (filter === "All")     return true;
    if (filter === "Minted")  return n.type === "mint";
    if (filter === "Rejected")return n.type === "reject";
    if (filter === "Pending") return n.type === "pending";
    return true;
  });

  return (
    <FarmerLayout title="Thông báo">
      <div className="caro-page">

        {/* Header */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">🔔 Thông Báo</h2>
            <p className="caro-page-subtitle">{filtered.length} thông báo</p>
          </div>
          {!readAll && filtered.length > 0 && (
            <button onClick={() => setReadAll(true)} className="caro-btn caro-btn-ghost">
              Đánh dấu đã đọc tất cả
            </button>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 12, background: "var(--card-bg)", borderRadius: 12, padding: 6, border: "1px solid var(--border)", width: "fit-content", marginBottom: 24 }}>
          {TYPES.map(t => {
            const act = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)}
                className={`caro-btn caro-btn-sm ${act ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                style={{ padding: "8px 24px" }}>
                {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div className="caro-empty" style={{ padding: "80px 0" }}>
              <div className="caro-empty-icon" style={{ fontSize: 48, marginBottom: 16 }}>🔕</div>
              <div className="caro-empty-title" style={{ fontSize: 16 }}>Không có thông báo nào</div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 8 }}>Gửi lô hàng mới để bắt đầu nhận thông báo</div>
            </div>
          ) : (
            filtered.map((n, i) => (
              <div key={i}
                onClick={() => nav(n.link)}
                style={{ display: "flex", gap: 16, padding: "20px 24px", borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.2s", background: (!readAll && i === 0) ? "rgba(64, 138, 113,0.05)" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                onMouseLeave={e => e.currentTarget.style.background = (!readAll && i === 0) ? "rgba(64, 138, 113,0.05)" : "transparent"}
              >
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${n.color}15`, border: `1px solid ${n.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f8fafc" }}>{n.title}</div>
                    {!readAll && i === 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#408A71", flexShrink: 0, marginTop: 6 }} />}
                  </div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 6, lineHeight: 1.6 }}>{n.body}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, fontWeight: 600 }}>
                    {n.date ? new Date(n.date).toLocaleString("vi-VN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div style={{ fontSize: 13, color: "#94a3b8", padding: "0 8px", lineHeight: 1.6, marginTop: 24, textAlign: "center" }}>
          Thông báo được tạo tự động từ hoạt động lô hàng của bạn. Tính năng thông báo đẩy thời gian thực sẽ sớm ra mắt.
        </div>

      </div>
    </FarmerLayout>
  );
}
