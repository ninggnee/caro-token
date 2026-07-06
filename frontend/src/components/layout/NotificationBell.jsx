import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useWallet } from "../../context/WalletContext";
import { useMyBatches, useAllBatches } from "../../hooks/useBatches";
import axios from "../../utils/axiosClient";

export default function NotificationBell() {
  const { user } = useAuth();
  const { account } = useWallet();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [kycCount, setKycCount] = useState(0);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("caro_read_notifs") || "[]");
    } catch {
      return [];
    }
  });
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Admin KYC pending count
  useEffect(() => {
    if (user?.role !== "admin") return;
    axios.get("/admin/kyc/pending")
      .then((res) => {
        setKycCount(res.data?.requests?.length || 0);
      })
      .catch((err) => console.warn("Failed to fetch pending KYC count", err));
  }, [user]);

  // Load batches based on role
  const isFarmer = user?.role === "farmer";
  const isAdmin = user?.role === "admin";
  const isTrader = user?.role === "trader";

  const { data: farmerData } = useMyBatches({ limit: 15 }, { enabled: isFarmer });
  const { data: adminData } = useAllBatches({ limit: 15 }, { enabled: isAdmin });

  const farmerBatches = farmerData?.batches || [];
  const adminBatches = adminData?.batches || [];

  // Collateral loan / token discounting notifications — same technique as
  // the batch-status notifs above (derived from live data already backing
  // FarmerFinancing.jsx), no separate notification backend involved.
  const { data: farmerLoansData } = useQuery({
    queryKey: ["farmer-collateral-loans-notif"],
    queryFn: () => axios.get("/finance/collateral-loans").then((r) => r.data),
    enabled: isFarmer,
    staleTime: 15_000,
  });
  const { data: farmerDiscountsData } = useQuery({
    queryKey: ["farmer-token-discounting-notif"],
    queryFn: () => axios.get("/finance/token-discounting").then((r) => r.data),
    enabled: isFarmer,
    staleTime: 15_000,
  });
  const farmerLoans = farmerLoansData?.data || [];
  const farmerDiscounts = farmerDiscountsData?.data || [];

  // Generate dynamic notifications list
  const notifs = [];

  if (isFarmer) {
    // 1. Wallet connection alert (General)
    if (!user?.wallet_address || !account) {
      notifs.push({
        id: "farmer-wallet-missing-notif",
        title: "🦊 Yêu cầu kết nối ví",
        body: "Bạn chưa liên kết hoặc kết nối ví Web3. Vui lòng kết nối ví để nhận token CaRo.",
        type: "danger",
        icon: "🦊",
        color: "#ef4444",
        link: "/farmer/wallet",
        date: user?.created_at || new Date().toISOString(),
      });
    }

    // 2. Batches notifications
    for (const b of farmerBatches) {
      if (b.status === "PENDING_MINT_APPROVAL") {
        if (!b.farmer_wallet) {
          notifs.push({
            id: `farmer-batch-wallet-${b.id}`,
            title: "⚠️ Cần kết nối ví khẩn cấp",
            body: `Lô hàng ${b.batch_id} đã sẵn sàng duyệt, nhưng tài khoản chưa liên kết ví. Kết nối ví ngay để đúc token.`,
            type: "danger",
            icon: "⚠️",
            color: "#ef4444",
            link: "/farmer/wallet",
            date: b.updated_at || b.created_at,
          });
        } else {
          notifs.push({
            id: `farmer-batch-pending-${b.id}`,
            title: "⏳ Lô hàng đang kiểm định",
            body: `Lô hàng ${b.batch_id} đang chờ phê duyệt và đúc token CaRo.`,
            type: "warning",
            icon: "⏳",
            color: "#f59e0b",
            link: `/farmer/batch/${b.id}`,
            date: b.created_at,
          });
        }
      } else if (b.status === "MINTED") {
        notifs.push({
          id: `farmer-batch-minted-${b.id}`,
          title: "🪙 Mint token thành công",
          body: `Đã phát hành token CaRo cho lô hàng ${b.batch_id} vào ví của bạn.`,
          type: "success",
          icon: "🪙",
          color: "#B0E4CC",
          link: `/farmer/batch/${b.id}`,
          date: b.minted_at || b.updated_at,
        });
      } else if (b.status === "REJECTED") {
        notifs.push({
          id: `farmer-batch-rejected-${b.id}`,
          title: "❌ Lô hàng bị từ chối",
          body: `Lô hàng ${b.batch_id} bị từ chối: ${b.rejection_reason || "Tài liệu chưa chuẩn xác"}`,
          type: "danger",
          icon: "❌",
          color: "#ef4444",
          link: `/farmer/batch/${b.id}`,
          date: b.rejected_at || b.updated_at,
        });
      }
    }

    // 3. Collateral loan notifications
    for (const l of farmerLoans) {
      if (l.status === "pending") {
        notifs.push({
          id: `farmer-loan-pending-${l.id}`,
          title: "⏳ Hồ sơ vay thế chấp đang chờ duyệt",
          body: `Khoản vay #${l.id} (${l.token_type}) đã gửi thành công, đang chờ Ngân hàng xét duyệt.`,
          type: "warning", icon: "⏳", color: "#f0b90b",
          link: "/farmer/wallet/financing",
          date: l.created_at,
        });
      } else if (l.status === "approved") {
        notifs.push({
          id: `farmer-loan-approved-${l.id}`,
          title: "✅ Khoản vay đã được phê duyệt",
          body: `Khoản vay #${l.id} đã được Ngân hàng phê duyệt, đang chờ giải ngân vào ví của bạn.`,
          type: "success", icon: "✅", color: "#B0E4CC",
          link: "/farmer/wallet/financing",
          date: l.approved_at || l.updated_at || l.created_at,
        });
      } else if (l.status === "active") {
        notifs.push({
          id: `farmer-loan-active-${l.id}`,
          title: "💰 Khoản vay đã được giải ngân",
          body: `Khoản vay #${l.id} đã được giải ngân ${Number(l.max_loan_amount).toLocaleString("vi-VN")} VND vào ví CaRo của bạn. Khoản vay đang trong thời hạn.`,
          type: "success", icon: "💰", color: "#B0E4CC",
          link: "/farmer/wallet/financing",
          date: l.disbursed_at || l.updated_at || l.created_at,
        });
      } else if (l.status === "rejected") {
        notifs.push({
          id: `farmer-loan-rejected-${l.id}`,
          title: "❌ Khoản vay bị từ chối",
          body: `Khoản vay #${l.id} đã bị Ngân hàng từ chối. Token đã được mở khóa về trạng thái khả dụng.`,
          type: "danger", icon: "❌", color: "#ef4444",
          link: "/farmer/wallet/financing",
          date: l.updated_at || l.created_at,
        });
      } else if (l.status === "repaid") {
        notifs.push({
          id: `farmer-loan-repaid-${l.id}`,
          title: "🏁 Đã tất toán khoản vay",
          body: `Khoản vay #${l.id} (${l.token_type}) đã được tất toán đầy đủ. Token đã mở khóa về trạng thái khả dụng.`,
          type: "success", icon: "🏁", color: "#B0E4CC",
          link: "/farmer/wallet/financing",
          date: l.repaid_at || l.updated_at || l.created_at,
        });
      }
    }

    // 4. Token discounting notifications
    for (const d of farmerDiscounts) {
      if (d.status === "pending") {
        notifs.push({
          id: `farmer-discount-pending-${d.id}`,
          title: "⏳ Yêu cầu chiết khấu đang chờ duyệt",
          body: `Yêu cầu chiết khấu #${d.id} (${d.token_type}) gửi tới ${d.bank_name} đang chờ xét duyệt.`,
          type: "warning", icon: "⏳", color: "#f0b90b",
          link: "/farmer/wallet/financing",
          date: d.created_at,
        });
      } else if (d.status === "approved" || d.status === "completed") {
        notifs.push({
          id: `farmer-discount-approved-${d.id}`,
          title: "✅ Chiết khấu đã được duyệt",
          body: `Yêu cầu chiết khấu #${d.id} đã được ${d.bank_name} duyệt, bạn đã nhận ${Number(d.payment_amount).toLocaleString("vi-VN")} VND.`,
          type: "success", icon: "✅", color: "#B0E4CC",
          link: "/farmer/wallet/financing",
          date: d.updated_at || d.created_at,
        });
      } else if (d.status === "rejected") {
        notifs.push({
          id: `farmer-discount-rejected-${d.id}`,
          title: "❌ Chiết khấu bị từ chối",
          body: `Yêu cầu chiết khấu #${d.id} bị Ngân hàng từ chối. Token đã được mở khóa về trạng thái khả dụng.`,
          type: "danger", icon: "❌", color: "#ef4444",
          link: "/farmer/wallet/financing",
          date: d.updated_at || d.created_at,
        });
      }
    }
  }

  if (isAdmin) {
    // 1. KYC Pending Notification
    if (kycCount > 0) {
      notifs.push({
        id: "admin-kyc-pending-notif",
        title: "👤 KYC chờ xét duyệt",
        body: `Có ${kycCount} yêu cầu xác minh danh tính đang chờ phê duyệt.`,
        type: "warning",
        icon: "🔍",
        color: "#f59e0b",
        link: "/admin/kyc",
        date: new Date().toISOString(),
      });
    }

    // 2. Batches notifications
    for (const b of adminBatches) {
      if (b.status === "PENDING_MINT_APPROVAL") {
        if (!b.farmer_wallet) {
          notifs.push({
            id: `admin-batch-wallet-missing-${b.id}`,
            title: "⚠️ Nông dân chưa liên kết ví",
            body: `Lô hàng ${b.batch_id} đã sẵn sàng duyệt nhưng nông dân ${b.farmer_name} chưa liên kết ví.`,
            type: "danger",
            icon: "⚠️",
            color: "#ef4444",
            link: "/admin/batches",
            date: b.updated_at || b.created_at,
          });
        } else {
          notifs.push({
            id: `admin-batch-pending-${b.id}`,
            title: "📦 Yêu cầu đúc Token mới",
            body: `Lô hàng ${b.batch_id} (${b.quantity} kg) từ ${b.farmer_name} đang chờ duyệt & đúc.`,
            type: "info",
            icon: "📦",
            color: "#408A71",
            link: "/admin/batches",
            date: b.created_at,
          });
        }
      }
    }
  }

  if (isTrader) {
    if (!account) {
      notifs.push({
        id: "trader-wallet-missing-notif",
        title: "🦊 Kết nối ví giao dịch",
        body: "Vui lòng kết nối ví MetaMask để bắt đầu giao dịch token RWA CaRo trên sàn.",
        type: "warning",
        icon: "🦊",
        color: "#f59e0b",
        link: "/trader/wallet",
        date: new Date().toISOString(),
      });
    } else {
      notifs.push({
        id: "trader-wallet-connected-notif",
        title: "🛡️ Ví đã kết nối thành công",
        body: `Ví ${account.slice(0, 6)}...${account.slice(-4)} sẵn sàng thực hiện các giao dịch RWA.`,
        type: "success",
        icon: "🛡️",
        color: "#B0E4CC",
        link: "/trader/wallet",
        date: new Date().toISOString(),
      });
    }
  }

  // Sort by date desc
  notifs.sort((a, b) => new Date(b.date) - new Date(a.date));

  const unreadCount = notifs.filter((n) => !readIds.includes(n.id)).length;

  const handleMarkAllRead = () => {
    const allIds = notifs.map((n) => n.id);
    const newRead = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(newRead);
    localStorage.setItem("caro_read_notifs", JSON.stringify(newRead));
  };

  const handleNotifClick = (n) => {
    // Add to read
    if (!readIds.includes(n.id)) {
      const newRead = [...readIds, n.id];
      setReadIds(newRead);
      localStorage.setItem("caro_read_notifs", JSON.stringify(newRead));
    }
    setOpen(false);
    navigate(n.link);
  };

  // Render time difference helper
  const formatTimeAgo = (dateStr) => {
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now - past;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Vừa xong";
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return past.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
  };

  const getViewAllLink = () => {
    if (isFarmer) return "/farmer/notifications";
    if (isAdmin) return "/admin/logs";
    return "/trader/trades";
  };

  return (
    <div className="caro-notif-container" ref={containerRef}>
      <button className="caro-notif-btn" onClick={() => setOpen((o) => !o)} title="Thông báo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && <span className="caro-notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="caro-notif-dropdown">
          <div className="caro-notif-header">
            <span className="caro-notif-title">Thông báo</span>
            {unreadCount > 0 && (
              <button className="caro-notif-clear-btn" onClick={handleMarkAllRead}>
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="caro-notif-list">
            {notifs.length === 0 ? (
              <div className="caro-notif-empty">
                <span style={{ fontSize: 24 }}>🔕</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Không có thông báo nào mới</span>
              </div>
            ) : (
              notifs.map((n) => {
                const isUnread = !readIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    className={`caro-notif-item ${isUnread ? "unread" : ""}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="caro-notif-item-icon" style={{ background: `${n.color}15`, border: `1px solid ${n.color}25`, color: n.color }}>
                      {n.icon}
                    </div>
                    <div className="caro-notif-item-content">
                      <div className="caro-notif-item-title">
                        <span>{n.title}</span>
                        {isUnread && <span className="caro-notif-item-unread-dot" />}
                      </div>
                      <div className="caro-notif-item-body">{n.body}</div>
                      <div className="caro-notif-item-time">{formatTimeAgo(n.date)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="caro-notif-footer">
            <Link to={getViewAllLink()} className="caro-notif-view-all" onClick={() => setOpen(false)}>
              Xem tất cả
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
