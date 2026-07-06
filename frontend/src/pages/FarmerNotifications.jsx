import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useMyBatches } from "../hooks/useBatches";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosClient";
import { formatKg, formatToken, formatVND } from '../utils/formatters';

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
        body: `${b.batch_id} — Đã mint ${formatToken(Number(b.minted_amount ?? b.quantity))} token CaRo vào ví của bạn`,
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

// Same derivation technique as batchToNotifs — reads the farmer's own
// collateral-loan / token-discounting rows (already fetched for
// FarmerFinancing.jsx) instead of a separate notifications backend.
function loansToNotifs(loans) {
  return loans.map(l => {
    if (l.status === "approved") {
      return {
        type: "loan-approve",
        icon: "✅",
        color: "#B0E4CC",
        title: "Khoản Vay Đã Được Phê Duyệt",
        body: `Khoản vay #${l.id} (${l.token_type}) đã được Ngân hàng phê duyệt, đang chờ giải ngân.`,
        date: l.approved_at || l.updated_at || l.created_at,
        link: "/farmer/wallet/financing",
      };
    }
    if (l.status === "active") {
      return {
        type: "loan-active",
        icon: "💰",
        color: "#B0E4CC",
        title: "Khoản Vay Đã Được Giải Ngân",
        body: `Khoản vay #${l.id} (${l.token_type}) đã được giải ngân ${formatVND(l.max_loan_amount)} vào ví của bạn.`,
        date: l.disbursed_at || l.updated_at || l.created_at,
        link: "/farmer/wallet/financing",
      };
    }
    if (l.status === "rejected") {
      return {
        type: "loan-reject",
        icon: "❌",
        color: "#ef4444",
        title: "Khoản Vay Bị Từ Chối",
        body: `Khoản vay #${l.id} (${l.token_type}) bị Ngân hàng từ chối. Token đã được mở khóa về trạng thái khả dụng.`,
        date: l.updated_at || l.created_at,
        link: "/farmer/wallet/financing",
      };
    }
    if (l.status === "repaid") {
      return {
        type: "loan-repaid",
        icon: "🏁",
        color: "#B0E4CC",
        title: "Đã Tất Toán Khoản Vay",
        body: `Khoản vay #${l.id} (${l.token_type}) đã được tất toán đầy đủ. Token đã mở khóa về trạng thái khả dụng.`,
        date: l.repaid_at || l.updated_at || l.created_at,
        link: "/farmer/wallet/financing",
      };
    }
    return {
      type: "loan-pending",
      icon: "⏳",
      color: "#f0b90b",
      title: "Hồ Sơ Vay Đang Chờ Duyệt",
      body: `Khoản vay #${l.id} (${l.token_type}) đã gửi thành công, đang chờ Ngân hàng xét duyệt.`,
      date: l.created_at,
      link: "/farmer/wallet/financing",
    };
  });
}

function discountsToNotifs(discounts) {
  return discounts.map(d => {
    if (d.status === "approved" || d.status === "completed") {
      return {
        type: "discount-approve",
        icon: "✅",
        color: "#B0E4CC",
        title: "Chiết Khấu Đã Được Duyệt",
        body: `Yêu cầu chiết khấu #${d.id} (${d.token_type}) đã được ${d.bank_name} duyệt, bạn đã nhận ${formatVND(d.payment_amount)}.`,
        date: d.updated_at || d.created_at,
        link: "/farmer/wallet/financing",
      };
    }
    if (d.status === "rejected") {
      return {
        type: "discount-reject",
        icon: "❌",
        color: "#ef4444",
        title: "Chiết Khấu Bị Từ Chối",
        body: `Yêu cầu chiết khấu #${d.id} (${d.token_type}) bị Ngân hàng từ chối. Token đã được mở khóa về trạng thái khả dụng.`,
        date: d.updated_at || d.created_at,
        link: "/farmer/wallet/financing",
      };
    }
    return {
      type: "discount-pending",
      icon: "⏳",
      color: "#f0b90b",
      title: "Yêu Cầu Chiết Khấu Đang Chờ Duyệt",
      body: `Yêu cầu chiết khấu #${d.id} (${d.token_type}) gửi tới ${d.bank_name} đang chờ xét duyệt.`,
      date: d.created_at,
      link: "/farmer/wallet/financing",
    };
  });
}

const TYPES = ["All", "Minted", "Rejected", "Pending", "Loan", "Discount"];
const TYPE_LABELS = { All: "Tất cả", Minted: "Đã Mint", Rejected: "Từ chối", Pending: "Chờ duyệt", Loan: "Vay thế chấp", Discount: "Chiết khấu" };

export default function FarmerNotifications() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState("All");
  const [readAll, setReadAll] = useState(false);

  const { data: allData } = useMyBatches({ limit: 50 });
  const batches = allData?.batches || [];

  const { data: loansData } = useQuery({
    queryKey: ["farmer-collateral-loans-notif-page"],
    queryFn: () => axios.get("/finance/collateral-loans").then(r => r.data),
  });
  const { data: discountsData } = useQuery({
    queryKey: ["farmer-token-discounting-notif-page"],
    queryFn: () => axios.get("/finance/token-discounting").then(r => r.data),
  });
  const loans = loansData?.data || [];
  const discounts = discountsData?.data || [];

  const notifs = [
    ...batchToNotifs(batches, user),
    ...loansToNotifs(loans),
    ...discountsToNotifs(discounts),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const filtered = notifs.filter(n => {
    if (filter === "All")      return true;
    if (filter === "Minted")   return n.type === "mint";
    if (filter === "Rejected") return n.type === "reject" || n.type === "loan-reject" || n.type === "discount-reject";
    if (filter === "Pending")  return n.type === "pending" || n.type === "loan-pending" || n.type === "discount-pending";
    if (filter === "Loan")     return n.type.startsWith("loan-");
    if (filter === "Discount") return n.type.startsWith("discount-");
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
