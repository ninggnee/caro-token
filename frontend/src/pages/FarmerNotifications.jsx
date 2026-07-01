import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { formatNumber, formatKg } from '../utils/formatters';

const C = { accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };

function batchToNotifs(batches) {
  return batches.flatMap(b => {
    const out = [];
    if (b.status === "MINTED") {
      out.push({
        type: "mint",
        icon: "🪙",
        color: C.green,
        title: "Đã Mint Lô Hàng Thành Công",
        body: `${b.batch_id} — Đã mint ${formatNumber(Number(b.minted_amount || b.quantity))} token CaRo vào ví của bạn`,
        date: b.minted_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "REJECTED") {
      out.push({
        type: "reject",
        icon: "❌",
        color: C.red,
        title: "Lô Hàng Bị Từ Chối",
        body: `${b.batch_id} đã bị từ chối${b.rejection_reason ? ": " + b.rejection_reason : ""}`,
        date: b.rejected_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "APPROVED") {
      out.push({
        type: "approve",
        icon: "✅",
        color: C.accent,
        title: "Lô Hàng Đã Được Duyệt",
        body: `${b.batch_id} đã được phê duyệt và đang tiến hành mint token`,
        date: b.approved_at || b.updated_at || b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    if (b.status === "PENDING_MINT_APPROVAL") {
      out.push({
        type: "pending",
        icon: "⏳",
        color: C.gold,
        title: "Lô Hàng Đang Được Kiểm Duyệt",
        body: `${b.batch_id} — Đã gửi yêu cầu ${formatKg(Number(b.quantity))}, đang chờ admin phê duyệt`,
        date: b.created_at,
        link: `/farmer/batch/${b.id}`,
      });
    }
    return out;
  });
}

const TYPES = ["All", "Minted", "Rejected", "Pending"];
const TYPE_LABELS = { All: "Tất cả", Minted: "Đã Mint", Rejected: "Từ chối", Pending: "Chờ duyệt" };

export default function FarmerNotifications() {
  const nav = useNavigate();
  const [filter, setFilter] = useState("All");
  const [readAll, setReadAll] = useState(false);

  const { data: allData } = useMyBatches({ limit: 50 });
  const batches = allData?.batches || [];
  const notifs = batchToNotifs(batches).sort((a, b) => new Date(b.date) - new Date(a.date));

  const filtered = notifs.filter(n => {
    if (filter === "All")     return true;
    if (filter === "Minted")  return n.type === "mint";
    if (filter === "Rejected")return n.type === "reject";
    if (filter === "Pending") return n.type === "pending";
    return true;
  });

  return (
    <FarmerLayout title="Thông báo">
      <div style={{ width: "100%", display: "grid", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>🔔 Thông Báo</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{filtered.length} thông báo</div>
          </div>
          {!readAll && filtered.length > 0 && (
            <button onClick={() => setReadAll(true)} style={{ padding: "7px 14px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              Đánh dấu đã đọc tất cả
            </button>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 0, background: C.card, borderRadius: 8, padding: 3, border: `1px solid ${C.border}`, width: "fit-content" }}>
          {TYPES.map(t => {
            const act = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)}
                style={{ padding: "6px 16px", borderRadius: 6, background: act ? C.accent : "transparent", color: act ? "#fff" : C.muted, border: "none", cursor: "pointer", fontSize: 12, fontWeight: act ? 700 : 400, transition: "all 0.15s" }}>
                {TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔕</div>
              <div style={{ fontSize: 14 }}>Không có thông báo nào</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Gửi lô hàng mới để bắt đầu nhận thông báo</div>
            </div>
          ) : (
            filtered.map((n, i) => (
              <div key={i}
                onClick={() => nav(n.link)}
                style={{ display: "flex", gap: 14, padding: "14px 20px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", transition: "background 0.1s", background: (!readAll && i === 0) ? "rgba(72,117,115,0.06)" : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(72,117,115,0.1)"}
                onMouseLeave={e => e.currentTarget.style.background = (!readAll && i === 0) ? "rgba(72,117,115,0.06)" : "transparent"}
              >
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${n.color}15`, border: `1px solid ${n.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{n.title}</div>
                    {!readAll && i === 0 && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.tealLight, flexShrink: 0, marginTop: 5 }} />}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: "#6b7a99", marginTop: 6 }}>
                    {n.date ? new Date(n.date).toLocaleString("vi-VN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div style={{ fontSize: 12, color: C.muted, padding: "0 4px", lineHeight: 1.7 }}>
          Thông báo được tạo tự động từ hoạt động lô hàng của bạn. Tính năng thông báo đẩy thời gian thực sẽ sớm ra mắt.
        </div>

      </div>
    </FarmerLayout>
  );
}
