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

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};
const TOKEN_COLORS = { CR1: "#f0b90b", CR2: "#00d4aa", CR3: "#9b87f5" };
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
  const vndBalance = Number(walletData?.vnd_available ?? walletData?.vnd_balance ?? 0);

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
  const openOrders   = openData?.data || [];
  const openCount    = openOrders.length;
  const buyCount     = openOrders.filter(o => o.side === 'buy').length;
  const sellCount    = openOrders.filter(o => o.side === 'sell').length;
  const lockedVND    = openOrders.filter(o => o.side === 'buy').reduce((s, o) => s + Number(o.remaining ?? o.amount) * Number(o.price), 0);
  const lockedTokens = openOrders.filter(o => o.side === 'sell').reduce((s, o) => s + Number(o.remaining ?? o.amount), 0);

  const { data: dbBalsData } = useQuery({
    queryKey: TRADER_KEYS.tokens,
    queryFn:  () => axios.get('/orders/my-balances').then(r => r.data),
    staleTime: 15_000, refetchInterval: 30_000,
  });

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

  const effectiveBals = {
    CR1: account ? Number(tokenBals.CR1 || 0) : Number(dbBalsData?.data?.CR1?.available ?? 0),
    CR2: account ? Number(tokenBals.CR2 || 0) : Number(dbBalsData?.data?.CR2?.available ?? 0),
    CR3: account ? Number(tokenBals.CR3 || 0) : Number(dbBalsData?.data?.CR3?.available ?? 0),
  };

  const tokenValue = ["CR1", "CR2", "CR3"].reduce((sum, key) => {
    const qty   = effectiveBals[key];
    const price = Number(stats.find(s => s.token === key)?.last_price || 0);
    return sum + qty * price;
  }, 0);
  const totalAssets = vndBalance + tokenValue;

  return (
    <TraderLayout title="Dashboard">
      <div style={{ display: "grid", gap: 20, width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              Xin chào, {user?.full_name || user?.email} 👋
            </h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Tổng quan tài khoản CaRo Trader
            </div>
          </div>
          <button onClick={() => nav("/trader/trading")}
            style={{ padding: "9px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            📈 Giao dịch ngay →
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { label: "Số dư VND",     value: formatVND(vndBalance),                              sub: "Có thể giao dịch",      color: C.tealLight, icon: "💵" },
            { label: "Giá trị Token", value: tokenValue > 0 ? formatVND(tokenValue) : "0 VND",  sub: "CaRo1 + CaRo2 + CaRo3", color: "#f0b90b",   icon: "🪙" },
            { label: "Tổng tài sản",  value: totalAssets > 0 ? formatVND(totalAssets) : "0 VND", sub: "VND + Token Assets",    color: "#e2e8f0",   icon: "📊" },
          ].map(c => (
            <div key={c.label} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{c.label}</div>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: c.color, marginBottom: 4, lineHeight: 1.25 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{c.sub}</div>
            </div>
          ))}

          {/* Open orders — enhanced card with buy/sell breakdown */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Lệnh đang mở</div>
              <span style={{ fontSize: 18 }}>⏳</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#9b87f5", marginBottom: 4, lineHeight: 1.25 }}>{openCount} lệnh</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{buyCount} mua · {sellCount} bán</div>
            {lockedVND > 0 && (
              <div style={{ fontSize: 11, color: C.muted }}>
                Khoá VND: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{formatVND(lockedVND)}</span>
              </div>
            )}
            {lockedTokens > 0 && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Khoá Token: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{formatNumber(lockedTokens, 4)} CaRo</span>
              </div>
            )}
            {openCount === 0 && <div style={{ fontSize: 11, color: C.muted }}>Chờ khớp lệnh</div>}
          </div>
        </div>

        {/* Token holdings + recent trades */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* Token overview */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>🪙 Danh mục Token</span>
              <button onClick={() => nav("/trader/portfolio")}
                style={{ fontSize: 11, color: C.tealLight, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                Xem chi tiết →
              </button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Token", "Số dư", "Giá hiện tại", "Giá trị"].map(h => (
                    <th key={h} style={{ padding: "8px 14px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["CR1", "CR2", "CR3"].map(key => {
                  const qty   = effectiveBals[key];
                  const price = Number(stats.find(s => s.token === key)?.last_price || 0);
                  const value = qty * price;
                  return (
                    <tr key={key} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN_COLORS[key] }}>{TOKEN_LABELS[key]}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 13, color: qty > 0 ? C.green : C.muted, fontFamily: "monospace" }}>
                        {qty > 0 ? formatNumber(qty, 2) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {price ? formatVND(price) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: value > 0 ? "#e2e8f0" : C.muted }}>
                        {value > 0 ? formatVND(value) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: "10px 16px", fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border}` }}>
              {account
                ? `✅ Số dư on-chain · Ví: ${account.slice(0, 6)}...${account.slice(-4)}`
                : "ℹ Hiển thị số dư sàn · Kết nối MetaMask để xem số dư on-chain"}
            </div>
          </div>

          {/* Recent trades */}
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>🔄 Giao dịch gần đây</span>
              <button onClick={() => nav("/trader/trades")}
                style={{ fontSize: 11, color: C.tealLight, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                Xem tất cả →
              </button>
            </div>
            {recentTrades.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                Chưa có giao dịch nào
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => nav("/trader/trading")}
                    style={{ padding: "7px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    Bắt đầu giao dịch →
                  </button>
                </div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["Cặp", "Giá", "SL", "Thời gian"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.slice(0, 5).map((t, i) => (
                    <tr key={t.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "#e2e8f0", fontWeight: 600 }}>{t.pair || "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: t.side === "buy" ? C.green : C.red, fontFamily: "monospace", fontWeight: 700 }}>
                        {formatVND(t.price)}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {formatNumber(Math.round(Number(t.amount || t.quantity || 0)))}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: C.muted }}>
                        {t.created_at ? new Date(t.created_at).toLocaleString("vi-VN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { icon: "🏪", label: "Thị trường",       sub: "Xem giá & biểu đồ",       path: "/trader/marketplace" },
            { icon: "📈", label: "Giao dịch",         sub: "Đặt lệnh mua / bán",       path: "/trader/trading"     },
            { icon: "💵", label: "Ví tài khoản",      sub: "Nạp / rút VND",            path: "/trader/wallet"      },
            { icon: "📊", label: "Danh mục đầu tư",   sub: "Xem hiệu suất token",      path: "/trader/portfolio"   },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{ padding: "14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(72,117,115,0.07)"; e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = C.border; }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{a.label}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </TraderLayout>
  );
}
