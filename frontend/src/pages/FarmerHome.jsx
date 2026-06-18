import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useMyBatches } from "../hooks/useBatches";
import { useQuery } from "@tanstack/react-query";
import axios from "../utils/axiosClient";

function useTokenBalances() {
  return useQuery({
    queryKey: ["token-balances"],
    queryFn: () => axios.get("/token/balances").then((r) => r.data),
    staleTime: 30_000,
  });
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: "#141a1f", borderRadius: 12, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#fff" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BatchStatusWidget({ navigate }) {
  const pending = useMyBatches({ status: "PENDING_MINT_APPROVAL", limit: 1 });
  const minted  = useMyBatches({ status: "MINTED",                limit: 1 });
  const rejected= useMyBatches({ status: "REJECTED",              limit: 1 });

  const items = [
    { label: "Chờ duyệt", count: pending.data?.total ?? "—", color: "#f39c12", bg: "rgba(243,156,18,0.1)",  icon: "⏳", status: "PENDING_MINT_APPROVAL" },
    { label: "Đã Mint",   count: minted.data?.total  ?? "—", color: "#27ae60", bg: "rgba(39,174,96,0.1)",   icon: "🪙", status: "MINTED" },
    { label: "Từ chối",   count: rejected.data?.total ?? "—",color: "#e74c3c", bg: "rgba(231,76,60,0.1)",   icon: "❌", status: "REJECTED" },
  ];

  return (
    <div style={{ background: "#141a1f", borderRadius: 12, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📦 Trạng thái Batch</h3>
        <button
          onClick={() => navigate("/farmer/batches")}
          style={{ fontSize: 12, color: "#9fcfc6", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Xem tất cả →
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {items.map((it) => (
          <button
            key={it.status}
            onClick={() => navigate("/farmer/batches")}
            style={{ background: it.bg, border: `1px solid ${it.color}30`, borderRadius: 10, padding: "14px 12px", cursor: "pointer", textAlign: "center" }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{it.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: it.color }}>{it.count}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{it.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InternalWalletWidget({ balances }) {
  const tokenTypes = ["CR1", "CR2", "CR3"];
  const data = balances?.data?.balances || {};

  const priceMap = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };
  const totalVnd = tokenTypes.reduce((sum, t) => {
    return sum + (Number(data[t]?.available_balance || 0) * (priceMap[t] || 0));
  }, 0);

  return (
    <div style={{ background: "#141a1f", borderRadius: 12, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>🏦 Ví Nội Bộ Exchange</h3>
        <span style={{ fontSize: 11, color: "#27ae60", background: "rgba(39,174,96,0.1)", padding: "3px 8px", borderRadius: 12 }}>Sẵn sàng giao dịch</span>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Tổng giá trị ước tính</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#9fcfc6" }}>
          {totalVnd > 0 ? totalVnd.toLocaleString("vi-VN") + " ₫" : "—"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {tokenTypes.map((t) => {
          const avail = Number(data[t]?.available_balance || 0);
          const locked = Number(data[t]?.locked_balance || 0);
          return (
            <div key={t} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: "#9fcfc6", fontWeight: 700, marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{avail > 0 ? avail.toLocaleString() : "0"}</div>
              {locked > 0 && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
                  {locked.toLocaleString()} locked
                </div>
              )}
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                ≈ {(avail * (priceMap[t] || 0)).toLocaleString("vi-VN")}₫
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(159,207,198,0.05)", borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.4)", borderLeft: "2px solid rgba(159,207,198,0.2)" }}>
        Token được mint thẳng vào ví nội bộ khi Admin duyệt batch. Giao dịch trực tiếp trên sàn, không cần MetaMask.
      </div>
    </div>
  );
}

export default function FarmerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const balances = useTokenBalances();

  return (
    <DashboardLayout title="Farmer Dashboard">
      <div style={{ display: "grid", gap: 20 }}>

        {/* Hero */}
        <div style={{ background: "linear-gradient(135deg,#162028,#22313d)", borderRadius: 16, padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(255,255,255,0.08)", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Xin chào, {user?.full_name || "Farmer"} 👋</h2>
            <div style={{ marginTop: 8, color: "#9fcfc6", fontSize: 14 }}>
              ☕ Nền tảng tokenization cà phê Robusta — Sàn giao dịch nội bộ
            </div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              {user?.email}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => navigate("/farmer/batch/new")}
              style={{ padding: "10px 18px", background: "#1f6f64", border: "none", color: "#fff", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
              📦 Gửi Batch Mới
            </button>
            <button onClick={() => navigate("/farmer/batches")}
              style={{ padding: "10px 18px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              📋 Batch Của Tôi
            </button>
            <button onClick={() => navigate("/farmer/trading")}
              style={{ padding: "10px 18px", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
              📈 Giao Dịch
            </button>
          </div>
        </div>

        {/* 2-column: batch status + wallet */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <BatchStatusWidget navigate={navigate} />
          <InternalWalletWidget balances={balances} />
        </div>

        {/* Quick actions */}
        <div style={{ background: "#141a1f", borderRadius: 12, padding: "20px 24px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>⚡ Thao tác nhanh</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            {[
              { icon: "📦", label: "Gửi batch mới",       sub: "Tokenization cà phê Robusta", path: "/farmer/batch/new",     color: "#1f6f64" },
              { icon: "📂", label: "Xem batch của tôi",   sub: "Theo dõi trạng thái",         path: "/farmer/batches",        color: "#27ae60" },
              { icon: "💱", label: "Giao dịch",           sub: "Mua / bán token trên sàn",    path: "/farmer/trading",        color: "#3498db" },
              { icon: "💸", label: "Quy đổi token",       sub: "Đổi token lấy cà phê thực",   path: "/farmer/redeem",         color: "#9b59b6" },
              { icon: "💳", label: "Nạp / Rút VND",      sub: "Quản lý số dư VND",           path: "/farmer/wallet",         color: "#e67e22" },
              { icon: "👤", label: "Hồ sơ",              sub: "KYC & thông tin cá nhân",      path: "/farmer/profile",        color: "#7f8c8d" },
            ].map((a) => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = `${a.color}40`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              >
                <div style={{ fontSize: 24, marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{a.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{a.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Platform info */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          <StatCard icon="☕" label="Loại cà phê" value="Robusta" sub="Cà phê Robusta Việt Nam" color="#9fcfc6" />
          <StatCard icon="🏦" label="Mô hình" value="Sàn CEX" sub="Ví nội bộ — không cần MetaMask" color="#9fcfc6" />
          <StatCard icon="🔗" label="Blockchain" value="Sepolia" sub="Mint on-chain khi được duyệt" color="#9fcfc6" />
        </div>

      </div>
    </DashboardLayout>
  );
}
