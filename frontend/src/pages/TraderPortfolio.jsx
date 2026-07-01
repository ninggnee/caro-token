import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import TraderLayout from "../components/layout/TraderLayout";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import { getMarketStats } from "../services/marketApi";
import { formatNumber, formatVND } from '../utils/formatters';
import { TRADER_KEYS } from '../hooks/useTraderData';

const TOKENS = [
  { key: "CR1", label: "CaRo1", color: "#f59e0b", desc: "Hạng A · Robusta Cao cấp"    },
  { key: "CR2", label: "CaRo2", color: "#B0E4CC", desc: "Hạng B · Robusta Tiêu chuẩn" },
  { key: "CR3", label: "CaRo3", color: "#408A71", desc: "Hạng C · Robusta Phổ thông"  },
];

export default function TraderPortfolio() {
  const nav = useNavigate();
  const { account, connect, provider } = useWallet();

  const [balances, setBalances] = useState({ CR1: "0", CR2: "0", CR3: "0" });
  const [loading, setLoading] = useState(false);

  const { data: statsData } = useQuery({
    queryKey: TRADER_KEYS.prices,
    queryFn: getMarketStats,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
  const stats = statsData?.stats || [];

  useEffect(() => {
    if (!account || !provider) return;
    setLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          TOKENS.map(async ({ key }) => {
            const contract = new ethers.Contract(CA_RO_CONTRACTS[key], ABI, provider);
            const [bal, dec] = await Promise.all([contract.balanceOf(account), contract.decimals()]);
            return [key, ethers.utils.formatUnits(bal, dec)];
          })
        );
        setBalances(Object.fromEntries(results));
      } catch (e) {
        console.error("Portfolio balance load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [account, provider]);

  const totalValue = TOKENS.reduce((sum, { key }) => {
    const qty   = Number(balances[key] || 0);
    const price = Number(stats.find(s => s.token === key)?.last_price || 0);
    return sum + qty * price;
  }, 0);

  const totalQty = TOKENS.reduce((sum, { key }) => sum + Number(balances[key] || 0), 0);

  return (
    <TraderLayout title="Danh mục đầu tư">
      <div className="caro-page">

        {/* Page header */}
        <div className="caro-page-header">
          <div>
            <h1 className="caro-page-title">📊 Danh mục đầu tư</h1>
            <p className="caro-page-subtitle">Hiệu suất danh mục CaRo Token theo thời gian thực</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/trader/marketplace")} className="caro-btn caro-btn-ghost">
              Thị trường
            </button>
            <button onClick={() => nav("/trader/trading")} className="caro-btn caro-btn-primary">
              Giao dịch →
            </button>
          </div>
        </div>

        {/* Wallet connection prompt */}
        {!account && (
          <div className="caro-card" style={{ background: "rgba(176, 228, 204,0.05)", borderColor: "rgba(176, 228, 204,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
                Kết nối ví để xem số dư token
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Dữ liệu trên blockchain — yêu cầu MetaMask
              </div>
            </div>
            <button onClick={connect} className="caro-btn caro-btn-success">
              🦊 Kết nối ví
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="caro-grid-3">
          <div className="caro-stat-card">
            <div className="caro-stat-icon" style={{ background: "rgba(176, 228, 204,0.1)", color: "#B0E4CC" }}>🪙</div>
            <div className="caro-stat-label">Tổng Token CaRo</div>
            <div className="caro-stat-value" style={{ color: "#B0E4CC" }}>
              {loading ? "…" : formatNumber(totalQty)}
            </div>
            <div className="caro-stat-sub">trên blockchain</div>
          </div>
          <div className="caro-stat-card">
            <div className="caro-stat-icon" style={{ background: "rgba(64, 138, 113,0.1)", color: "#408A71" }}>💵</div>
            <div className="caro-stat-label">Giá trị ước tính</div>
            <div className="caro-stat-value" style={{ color: "#408A71" }}>
              {totalValue > 0
                ? formatNumber(totalValue / 1_000_000, 2) + " triệu"
                : account ? "—" : "—"}
            </div>
            <div className="caro-stat-sub">theo giá thị trường hiện tại</div>
          </div>
          <div className="caro-stat-card">
            <div className="caro-stat-icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>🦊</div>
            <div className="caro-stat-label">Địa chỉ ví</div>
            <div className="caro-stat-value" style={{ fontSize: 16, marginTop: 4, fontFamily: "monospace", wordBreak: "break-all", color: account ? "#f8fafc" : "#64748b" }}>
              {account ? `${account.slice(0, 10)}…${account.slice(-6)}` : "Chưa kết nối"}
            </div>
            <div className="caro-stat-sub">{account ? "Trạng thái: Đã kết nối" : "—"}</div>
          </div>
        </div>

        {/* Holdings table */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-section-header">
            <h3 className="caro-section-title">Token đang nắm giữ</h3>
            <span className="caro-badge caro-badge-muted">Giá cập nhật mỗi 15s</span>
          </div>
          <div className="caro-table-wrap">
            <table className="caro-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Số dư</th>
                  <th>Giá hiện tại</th>
                  <th>Thay đổi 24H</th>
                  <th>Giá trị ước tính</th>
                  <th>Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {TOKENS.map(({ key, label, color, desc }) => {
                  const qty   = Number(balances[key] || 0);
                  const stat  = stats.find(s => s.token === key) || {};
                  const price = Number(stat.last_price || 0);
                  const change = Number(stat.change_24h || 0);
                  const value = qty * price;
                  const pct   = totalValue > 0 && value > 0
                    ? (value / totalValue * 100).toFixed(1) + "%"
                    : "—";
                  return (
                    <tr key={key}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, rgba(255,255,255,0.05), ${color}20)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color, flexShrink: 0, border: `1px solid ${color}40` }}>
                            {key}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{label}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{desc}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 15, fontWeight: 700, color: qty > 0 ? "#B0E4CC" : "#64748b" }}>
                        {loading ? "…" : qty > 0 ? formatNumber(qty) : "—"}
                      </td>
                      <td style={{ fontSize: 14, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {price ? formatVND(price) : "—"}
                      </td>
                      <td>
                        <span className={`caro-badge ${change >= 0 ? "caro-badge-success" : "caro-badge-danger"}`}>
                          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ fontSize: 14, fontWeight: 600, color: value > 0 ? "#408A71" : "#64748b" }}>
                        {value > 0 ? formatVND(value) : "—"}
                      </td>
                      <td style={{ fontSize: 13, color: "#94a3b8" }}>
                        {pct}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: "rgba(176, 228, 204,0.05)", borderTop: `1px solid var(--border)` }}>
                  <td style={{ fontWeight: 800, color: "#94a3b8" }}>TỔNG CỘNG</td>
                  <td style={{ fontSize: 15, fontWeight: 800, color: "#B0E4CC" }}>
                    {totalQty > 0 ? formatNumber(totalQty) : "—"}
                    <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>CaRo</span>
                  </td>
                  <td /><td />
                  <td style={{ fontSize: 15, fontWeight: 800, color: "#408A71" }}>
                    {totalValue > 0 ? formatVND(totalValue) : "—"}
                  </td>
                  <td style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8" }}>
                    {totalValue > 0 ? "100%" : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div className="caro-grid-3">
          {[
            { icon: "🏪", label: "Thị trường",        sub: "Xem giá và biểu đồ thời gian thực", path: "/trader/marketplace" },
            { icon: "📈", label: "Giao dịch",          sub: "Đặt lệnh mua / bán CaRo Token",     path: "/trader/trading"     },
            { icon: "📋", label: "Lịch sử giao dịch", sub: "Xem tất cả giao dịch đã thực hiện", path: "/trader/trades"      },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)} className="caro-card caro-card-sm" style={{ border: "1px solid var(--border)", cursor: "pointer", textAlign: "left", background: "rgba(255,255,255,0.02)", width: "100%" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(176, 228, 204,0.05)"; e.currentTarget.style.borderColor = "rgba(176, 228, 204,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{a.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{a.label}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </TraderLayout>
  );
}
