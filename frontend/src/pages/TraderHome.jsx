import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TraderLayout from "../components/layout/TraderLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import axios from "../utils/axiosClient";
import { getMarketStats } from "../services/marketApi";
import { formatNumber, formatVND } from '../utils/formatters';
import { TRADER_KEYS } from '../hooks/useTraderData';

const TOKEN_COLORS = { CR1: "#f59e0b", CR2: "#B0E4CC", CR3: "#8b5cf6" };
const TOKEN_LABELS = { CR1: "CaRo1", CR2: "CaRo2", CR3: "CaRo3" };

export default function TraderHome() {
  const { user } = useAuth();
  const { account, provider } = useWallet();
  const nav = useNavigate();

  const [tokenBals, setTokenBals] = useState({ CR1: "0", CR2: "0", CR3: "0" });

  const { data: walletData } = useQuery({
    queryKey: TRADER_KEYS.wallet,
    queryFn: () => axios.get("/wallet/balance").then(r => r.data),
    staleTime: 15_000, refetchInterval: 30_000,
  });
  const vndBalance = Number(walletData?.balance || 0);

  const { data: statsData } = useQuery({
    queryKey: TRADER_KEYS.prices,
    queryFn: getMarketStats,
    staleTime: 10_000, refetchInterval: 15_000,
  });
  const stats = statsData?.stats || [];

  const { data: tradesData } = useQuery({
    queryKey: ["trader-recent-trades"],
    queryFn: () => axios.get("/orders/trades?limit=5").then(r => r.data),
    staleTime: 20_000, refetchInterval: 30_000,
  });
  const recentTrades = tradesData?.data || [];

  const { data: openData } = useQuery({
    queryKey: ["trader-open-orders"],
    queryFn: () => axios.get("/orders/open").then(r => r.data),
    staleTime: 15_000, refetchInterval: 20_000,
  });
  const openCount = openData?.data?.length || 0;

  useEffect(() => {
    if (!account || !provider) return;
    (async () => {
      try {
        const results = await Promise.all(
          ["CR1", "CR2", "CR3"].map(async key => {
            const c = new ethers.Contract(CA_RO_CONTRACTS[key], ABI, provider);
            const [b, d] = await Promise.all([c.balanceOf(account), c.decimals()]);
            return [key, ethers.utils.formatUnits(b, d)];
          })
        );
        setTokenBals(Object.fromEntries(results));
      } catch {}
    })();
  }, [account, provider]);

  const tokenValue = ["CR1", "CR2", "CR3"].reduce((sum, key) => {
    const qty   = Number(tokenBals[key] || 0);
    const price = Number(stats.find(s => s.token === key)?.last_price || 0);
    return sum + qty * price;
  }, 0);
  const totalAssets = vndBalance + tokenValue;

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Chào buổi sáng" : now.getHours() < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  const gridCss = `
    .th-metrics { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
    .th-body    { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .th-actions { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
    @media (max-width: 1100px) { .th-metrics { grid-template-columns: repeat(2,1fr); } .th-actions { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 768px)  { .th-body { grid-template-columns: 1fr; } .th-metrics { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px)  { .th-metrics { grid-template-columns: 1fr; } .th-actions { grid-template-columns: 1fr; } }
  `;

  return (
    <TraderLayout title="Bảng điều khiển">
      <style dangerouslySetInnerHTML={{ __html: gridCss }} />
      <div className="caro-page">

        {/* ── Header ── */}
        <div className="caro-page-header">
          <div>
            <div className="caro-page-title">
              {greeting}, {user?.full_name?.split(" ").at(-1) || user?.email} 👋
            </div>
            <div className="caro-page-subtitle">
              Tổng quan tài khoản CaRo Trader · {now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <button className="caro-btn caro-btn-secondary" onClick={() => nav("/trader/trading")}>
            📈 Giao dịch ngay →
          </button>
        </div>

        {/* ── 4 Metrics ── */}
        <div className="th-metrics">
          {[
            { label: "Số dư VND",      value: formatVND(vndBalance),  sub: "Có thể giao dịch ngay",     accent: "#B0E4CC", icon: "💵", iconBg: "rgba(176, 228, 204,0.12)" },
            { label: "Giá trị Token",  value: account ? (tokenValue > 0 ? (tokenValue / 1e6).toFixed(2) + "M VND" : "0") : "Chưa kết nối ví", sub: "CR1 + CR2 + CR3 on-chain", accent: "#f59e0b", icon: "🪙", iconBg: "rgba(245,158,11,0.12)" },
            { label: "Tổng tài sản",   value: totalAssets > 0 ? formatVND(totalAssets) : "—", sub: "VND + Token on-chain",        accent: "#408A71", icon: "📊", iconBg: "rgba(64, 138, 113,0.12)" },
            { label: "Lệnh đang mở",   value: String(openCount),       sub: "Đang chờ khớp lệnh",         accent: "#8b5cf6", icon: "⏳", iconBg: "rgba(139,92,246,0.12)" },
          ].map(c => (
            <div key={c.label} className="caro-stat-card">
              <div style={{ position: "absolute", top: -15, right: -15, width: 70, height: 70, borderRadius: "50%", background: `radial-gradient(circle, ${c.accent}18 0%, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div className="caro-stat-label">{c.label}</div>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{c.icon}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.accent, lineHeight: 1, fontFamily: "'Manrope',sans-serif", marginBottom: 5 }}>{c.value}</div>
              <div className="caro-stat-sub">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Body: Token Holdings + Recent Trades ── */}
        <div className="th-body">

          {/* Token Portfolio */}
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header">
              <div className="caro-section-title">🪙 Danh mục Token</div>
              <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/trader/portfolio")}>
                Chi tiết →
              </button>
            </div>
            <div className="caro-table-wrap">
              <table className="caro-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Số dư</th>
                    <th>Giá hiện tại</th>
                    <th>Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {["CR1", "CR2", "CR3"].map(key => {
                    const qty   = Number(tokenBals[key] || 0);
                    const price = Number(stats.find(s => s.token === key)?.last_price || 0);
                    const value = qty * price;
                    return (
                      <tr key={key}>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 800, color: TOKEN_COLORS[key], fontFamily: "'Space Grotesk',sans-serif" }}>
                            {TOKEN_LABELS[key]}
                          </span>
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", color: qty > 0 ? "#B0E4CC" : "#64748b" }}>
                          {account ? (qty > 0 ? formatNumber(qty, 2) : "—") : "—"}
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", color: "#f8fafc" }}>
                          {price ? formatVND(price) : "—"}
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", color: value > 0 ? "#f8fafc" : "#64748b" }}>
                          {value > 0 ? formatVND(value) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!account && (
              <div style={{ padding: "10px 16px", fontSize: 11, color: "#64748b", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 6 }}>
                <span>ℹ️</span> Kết nối MetaMask để xem số dư on-chain
              </div>
            )}
          </div>

          {/* Recent Trades */}
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header">
              <div className="caro-section-title">🔄 Giao dịch gần đây</div>
              <button className="caro-btn caro-btn-ghost caro-btn-sm" onClick={() => nav("/trader/trades")}>
                Tất cả →
              </button>
            </div>
            {recentTrades.length === 0 ? (
              <div className="caro-empty">
                <div className="caro-empty-icon">📋</div>
                <div className="caro-empty-title">Chưa có giao dịch nào</div>
                <button className="caro-btn caro-btn-secondary caro-btn-sm" onClick={() => nav("/trader/trading")}>
                  Bắt đầu giao dịch →
                </button>
              </div>
            ) : (
              <div className="caro-table-wrap">
                <table className="caro-table">
                  <thead>
                    <tr>
                      <th>Cặp</th>
                      <th>Giá</th>
                      <th>Số lượng</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.slice(0, 5).map((t, i) => (
                      <tr key={t.id || i}>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{t.pair || "—"}</td>
                        <td style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", color: t.side === "buy" ? "#B0E4CC" : "#ef4444", fontWeight: 700 }}>
                          {formatVND(t.price)}
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", color: "#94a3b8" }}>
                          {Number(t.amount || t.quantity || 0).toFixed(4)}
                        </td>
                        <td style={{ color: "#64748b", fontSize: 11 }}>
                          {t.created_at ? new Date(t.created_at).toLocaleString("vi-VN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-section-header">
            <div className="caro-section-title">⚡ Thao tác nhanh</div>
          </div>
          <div style={{ padding: 16 }}>
            <div className="th-actions">
              {[
                { icon: "🏪", label: "Thị trường",      sub: "Xem giá & biểu đồ",       path: "/trader/market/overview", accent: "#408A71" },
                { icon: "📈", label: "Giao dịch",        sub: "Đặt lệnh mua / bán",       path: "/trader/market/trading",  accent: "#B0E4CC" },
                { icon: "💵", label: "Ví tài khoản",     sub: "Nạp / rút VND",            path: "/trader/wallet",      accent: "#f59e0b" },
                { icon: "📊", label: "Danh mục đầu tư",  sub: "Xem hiệu suất token",      path: "/trader/portfolio",   accent: "#8b5cf6" },
              ].map(a => (
                <button key={a.path} onClick={() => nav(a.path)}
                  style={{ padding: "16px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "all 0.25s", color: "#f8fafc" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${a.accent}0d`; e.currentTarget.style.borderColor = `${a.accent}35`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 3, fontFamily: "'Manrope',sans-serif" }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{a.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </TraderLayout>
  );
}
