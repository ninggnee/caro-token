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

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
};

const TOKENS = [
  { key: "CR1", label: "CaRo1", color: "#f0b90b", desc: "Hạng A · Robusta Cao cấp"    },
  { key: "CR2", label: "CaRo2", color: "#00d4aa", desc: "Hạng B · Robusta Tiêu chuẩn" },
  { key: "CR3", label: "CaRo3", color: "#9b87f5", desc: "Hạng C · Robusta Phổ thông"  },
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
      <div style={{ display: "grid", gap: 20, maxWidth: 960 }}>

        {/* Page header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>📊 Danh mục đầu tư</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Hiệu suất danh mục CaRo Token theo thời gian thực
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/trader/marketplace")}
              style={{ padding: "8px 16px", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", border: `1px solid ${C.border}`, borderRadius: 7, cursor: "pointer", fontSize: 13 }}>
              Thị trường
            </button>
            <button onClick={() => nav("/trader/trading")}
              style={{ padding: "8px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Giao dịch →
            </button>
          </div>
        </div>

        {/* Wallet connection prompt */}
        {!account && (
          <div style={{ padding: "20px 24px", background: "rgba(72,117,115,0.06)", border: "1px solid rgba(72,117,115,0.2)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>
                Kết nối ví để xem số dư token
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Dữ liệu trên blockchain — yêu cầu MetaMask
              </div>
            </div>
            <button onClick={connect}
              style={{ padding: "9px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              🦊 Kết nối ví
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>Tổng Token CaRo</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.tealLight, marginBottom: 4 }}>
              {loading ? "…" : formatNumber(totalQty)}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>trên blockchain</div>
          </div>
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>Giá trị ước tính</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>
              {totalValue > 0
                ? formatNumber(totalValue / 1_000_000, 2) + " triệu VND"
                : account ? "—" : "—"}
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>theo giá thị trường hiện tại</div>
          </div>
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>Địa chỉ ví</div>
            <div style={{ fontSize: 11, fontFamily: "monospace", color: account ? C.tealLight : C.muted, wordBreak: "break-all" }}>
              {account ? `${account.slice(0, 10)}…${account.slice(-6)}` : "Chưa kết nối"}
            </div>
          </div>
        </div>

        {/* Holdings table */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Token đang nắm giữ</div>
            <span style={{ fontSize: 11, color: C.muted }}>Giá cập nhật mỗi 15s</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Token", "Số dư", "Giá hiện tại", "Thay đổi 24H", "Giá trị ước tính", "Tỷ trọng"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
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
                    <tr key={key} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 6, background: "linear-gradient(135deg,#203433,#487573)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
                            {key}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{label}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>{desc}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: qty > 0 ? C.green : C.muted }}>
                        {loading ? "…" : qty > 0 ? formatNumber(qty) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "#e2e8f0", fontFamily: "monospace" }}>
                        {price ? formatVND(price) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: change >= 0 ? C.green : C.red }}>
                          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: value > 0 ? "#e2e8f0" : C.muted }}>
                        {value > 0 ? formatVND(value) : "—"}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: C.muted }}>
                        {pct}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: "rgba(72,117,115,0.05)", borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: C.muted }}>TỔNG CỘNG</td>
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: C.tealLight }}>
                    {totalQty > 0 ? formatNumber(totalQty) : "—"}
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>CaRo</span>
                  </td>
                  <td /><td />
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: C.tealLight }}>
                    {totalValue > 0 ? formatVND(totalValue) : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>
                    {totalValue > 0 ? "100%" : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { icon: "🏪", label: "Thị trường",        sub: "Xem giá và biểu đồ thời gian thực", path: "/trader/marketplace" },
            { icon: "📈", label: "Giao dịch",          sub: "Đặt lệnh mua / bán CaRo Token",     path: "/trader/trading"     },
            { icon: "📋", label: "Lịch sử giao dịch", sub: "Xem tất cả giao dịch đã thực hiện", path: "/trader/trades"      },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{ padding: "16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(72,117,115,0.06)"; e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = C.border; }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{a.label}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </TraderLayout>
  );
}
