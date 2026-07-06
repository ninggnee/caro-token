import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useMyBatches } from "../hooks/useBatches";
import { useQuery } from "@tanstack/react-query";
import axios from "../utils/axiosClient";
import { formatVND, formatToken } from '../utils/formatters';

function useTokenBalances() {
  return useQuery({
    queryKey: ["token-balances"],
    queryFn: () => axios.get("/token/balances").then((r) => r.data),
    staleTime: 30_000,
  });
}

/* ── Batch status count widget ── */
function BatchStatusWidget({ navigate }) {
  const pending  = useMyBatches({ status: "PENDING_MINT_APPROVAL", limit: 1 });
  const minted   = useMyBatches({ status: "MINTED",                limit: 1 });
  const rejected = useMyBatches({ status: "REJECTED",              limit: 1 });

  const items = [
    { label: "Chờ duyệt", count: pending.data?.total  ?? "—", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: "⏳", status: "PENDING_MINT_APPROVAL" },
    { label: "Đã Mint",   count: minted.data?.total   ?? "—", color: "#B0E4CC", bg: "rgba(176, 228, 204,0.08)",  icon: "🪙", status: "MINTED" },
    { label: "Từ chối",   count: rejected.data?.total ?? "—", color: "#ef4444", bg: "rgba(239,68,68,0.08)",  icon: "❌", status: "REJECTED" },
  ];

  return (
    <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="caro-section-header">
        <div className="caro-section-title">📦 Trạng thái Lô hàng</div>
        <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => navigate("/farmer/status")}>
          Xem tất cả →
        </button>
      </div>
      <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {items.map(it => (
          <button key={it.status} onClick={() => navigate("/farmer/status")}
            style={{
              background: it.bg,
              border: `1px solid ${it.color}30`,
              borderRadius: 12,
              padding: "16px 12px",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = `${it.color}60`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = `${it.color}30`; }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{it.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: it.color, fontFamily: "'Manrope',sans-serif" }}>{it.count}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>{it.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Internal wallet widget ── */
function InternalWalletWidget({ balances }) {
  const tokenTypes = ["CR1", "CR2", "CR3"];
  const data = balances?.data?.balances || {};

  const priceMap  = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };
  const accentMap = { CR1: "#B0E4CC", CR2: "#408A71", CR3: "#f59e0b" };
  const totalVnd  = tokenTypes.reduce((sum, t) => sum + (Number(data[t]?.available_balance || 0) * (priceMap[t] || 0)), 0);

  return (
    <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="caro-section-header">
        <div className="caro-section-title">🏦 Ví nội bộ CaRo</div>
        <span className="caro-badge caro-badge-success" style={{ fontSize: 10 }}>Sẵn sàng giao dịch</span>
      </div>
      <div style={{ padding: 16 }}>
        {/* Total Value */}
        <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(176, 228, 204,0.06)", borderRadius: 10, border: "1px solid rgba(176, 228, 204,0.12)" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Tổng giá trị ước tính</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#B0E4CC", fontFamily: "'Manrope',sans-serif" }}>
            {totalVnd > 0 ? formatVND(totalVnd) : "—"}
          </div>
        </div>

        {/* Token breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {tokenTypes.map(t => {
            const avail  = Number(data[t]?.available_balance || 0);
            const locked = Number(data[t]?.locked_balance   || 0);
            const accent = accentMap[t];
            return (
              <div key={t} style={{ background: `${accent}08`, borderRadius: 10, padding: "12px 10px", border: `1px solid ${accent}18` }}>
                <div style={{ fontSize: 11, color: accent, fontWeight: 800, marginBottom: 6, letterSpacing: "0.05em" }}>{t}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc", fontFamily: "'Manrope',sans-serif" }}>{avail > 0 ? formatToken(avail) : "0"}</div>
                {locked > 0 && (
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 3 }}>🔒 {formatToken(locked)} khoá</div>
                )}
                <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>≈ {formatVND(avail * (priceMap[t] || 0))}</div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 11, color: "#475569", borderLeft: "2px solid rgba(176, 228, 204,0.3)", lineHeight: 1.5 }}>
          Token mint thẳng vào ví nội bộ khi Admin duyệt lô hàng. Giao dịch trên sàn không tốn phí gas.
        </div>
      </div>
    </div>
  );
}

export default function FarmerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const balances = useTokenBalances();

  const gridCss = `
    .fh-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .fh-six { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .fh-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    @media (max-width: 900px)  { .fh-two { grid-template-columns: 1fr; } .fh-six { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 640px)  { .fh-six { grid-template-columns: 1fr; } .fh-three { grid-template-columns: 1fr; } }
  `;

  return (
    <FarmerLayout title="Bảng điều khiển Farmer">
      <style dangerouslySetInnerHTML={{ __html: gridCss }} />
      <div className="caro-page">

        {/* ── Hero Banner ── */}
        <div style={{
          background: "linear-gradient(135deg, #18332d 0%, rgba(176, 228, 204,0.08) 50%, #122622 100%)",
          borderRadius: 20,
          padding: "28px 32px",
          border: "1px solid rgba(176, 228, 204,0.15)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circle */}
          <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(176, 228, 204,0.08), transparent 70%)", pointerEvents: "none" }} />

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>🫘</span>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: "'Manrope',sans-serif", color: "#fff" }}>
                Xin chào, {user?.full_name || "Farmer"} 👋
              </h2>
            </div>
            <div style={{ fontSize: 14, color: "#B0E4CC", fontWeight: 500, marginBottom: 4 }}>
              🫘 Nền tảng token hóa cà phê Robusta — Sàn giao dịch nội bộ CaRo Exchange
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>{user?.email}</div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="caro-btn caro-btn-primary" onClick={() => navigate("/farmer/status/submit")}>
              📦 Gửi Lô Hàng Mới
            </button>
            <button className="caro-btn caro-btn-ghost" onClick={() => navigate("/farmer/status")}>
              📋 Danh Sách Lô Hàng
            </button>
            <button className="caro-btn caro-btn-ghost" onClick={() => navigate("/farmer/trading")}>
              📈 Sàn Giao Dịch
            </button>
          </div>
        </div>

        {/* ── 2 columns: Batch Status + Wallet ── */}
        <div className="fh-two">
          <BatchStatusWidget navigate={navigate} />
          <InternalWalletWidget balances={balances} />
        </div>

        {/* ── Quick Actions ── */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-section-header">
            <div className="caro-section-title">⚡ Thao tác nhanh</div>
          </div>
          <div style={{ padding: "16px" }}>
            <div className="fh-six">
              {[
                { icon: "📦", label: "Gửi lô hàng mới",   sub: "Yêu cầu token hóa cà phê", path: "/farmer/status/submit",   accent: "#B0E4CC" },
                { icon: "📂", label: "Danh sách lô hàng",  sub: "Theo dõi tiến độ duyệt",   path: "/farmer/status",           accent: "#408A71" },
                { icon: "📈", label: "Sàn giao dịch",      sub: "Mua bán token Robusta",     path: "/farmer/trading",          accent: "#408A71" },
                { icon: "💸", label: "Rút cà phê vật lý",  sub: "Quy đổi token lấy cà phê", path: "/farmer/redeem",           accent: "#8b5cf6" },
                { icon: "💳", label: "Nạp / Rút VND",      sub: "Quản lý số dư tiền mặt",   path: "/farmer/wallet",           accent: "#f59e0b" },
                { icon: "👤", label: "Hồ sơ cá nhân",      sub: "Xác thực danh tính & KYC", path: "/farmer/profile",          accent: "#94a3b8" },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 12,
                    padding: "16px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.25s",
                    color: "#f8fafc",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${a.accent}0d`; e.currentTarget.style.borderColor = `${a.accent}35`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{a.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 3, fontFamily: "'Manrope',sans-serif" }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{a.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Platform Info ── */}
        <div className="fh-three">
          {[
            { icon: "🫘", label: "Loại cà phê", value: "Robusta",   sub: "Cà phê Robusta Việt Nam",         accent: "#B0E4CC" },
            { icon: "🏦", label: "Mô hình",     value: "Sàn CEX",   sub: "Ví nội bộ — không cần MetaMask",  accent: "#408A71" },
            { icon: "🔗", label: "Blockchain",  value: "Sepolia",    sub: "Mint on-chain khi được duyệt",    accent: "#8b5cf6" },
          ].map((c, i) => (
            <div key={i} style={{
              background: `linear-gradient(135deg, #18332d, ${c.accent}0a)`,
              borderRadius: 14,
              padding: "18px 20px",
              border: `1px solid ${c.accent}20`,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.accent, fontFamily: "'Manrope',sans-serif", marginBottom: 4 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: "#475569" }}>{c.sub}</div>
            </div>
          ))}
        </div>

      </div>
    </FarmerLayout>
  );
}
