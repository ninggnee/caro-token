import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "../utils/axiosClient";
import { formatNumber, formatVND, formatKg, formatToken } from '../utils/formatters';

// Prices shown while market engine is warming up or unavailable
const FALLBACK_PRICE = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };

// Token quantities + VND balance from DB (same source as Dashboard → always in sync)
function useDashboard() {
  return useQuery({
    queryKey: ["farmer-dashboard-wallet"],
    queryFn: () => axios.get("/farmer/dashboard").then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,   // auto-refresh so post-mint values appear immediately
    retry: 2,
  });
}

// Live prices from mock market engine (no auth required)
function useMarketPrices() {
  return useQuery({
    queryKey: ["market-prices"],
    queryFn: () => axios.get("/market/prices").then(r => r.data),
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: 1,
  });
}

function BalCard({ label, value, sub, accent, action, onAction, loading, icon, bgAccent }) {
  return (
    <div className="caro-stat-card">
      <div className="caro-stat-icon" style={{ background: bgAccent, color: accent }}>{icon}</div>
      <div className="caro-stat-label">{label}</div>
      <div className="caro-stat-value" style={{ color: accent || "#f8fafc" }}>
        {loading ? "…" : value}
      </div>
      {sub && <div className="caro-stat-sub">{sub}</div>}
      {action && (
        <button onClick={onAction} className="caro-btn caro-btn-sm caro-btn-secondary" style={{ marginTop: 12 }}>
          {action}
        </button>
      )}
    </div>
  );
}

export default function FarmerWalletOverview() {
  const nav = useNavigate();
  const { account } = useWallet();
  const { user } = useAuth();

  const dashQ  = useDashboard();
  const priceQ = useMarketPrices();

  // ── Token quantities (DB mint records — same source as Dashboard & Token Holdings) ──
  const holdings = dashQ.data?.tokenBalances || {};
  const caro1 = Number(holdings.caro1 ?? 0);
  const caro2 = Number(holdings.caro2 ?? 0);
  const caro3 = Number(holdings.caro3 ?? 0);

  // Token_CaRo = Khối lượng (total tokens = total kg, 1 CaRo ≡ 1 kg Robusta)
  const totalCaRo = caro1 + caro2 + caro3;

  // ── Live market prices (fallback to reference prices if engine not ready) ──
  const mp = priceQ.data?.prices || {};
  const priceMap = {
    CR1: Number(mp.CR1?.price) || FALLBACK_PRICE.CR1,
    CR2: Number(mp.CR2?.price) || FALLBACK_PRICE.CR2,
    CR3: Number(mp.CR3?.price) || FALLBACK_PRICE.CR3,
  };
  const priceSource = priceQ.isSuccess ? "Giá thị trường" : "Giá tham chiếu";

  // ── Giá trị ước tính = Σ (qty × price) ──
  const estimatedValue = caro1 * priceMap.CR1 + caro2 * priceMap.CR2 + caro3 * priceMap.CR3;

  // ── VND wallet (from the same dashboard call) ──
  const vndWallet   = dashQ.data?.vndWallet || {};
  const vndBalance  = Number(vndWallet.balance  ?? 0);
  const vndLocked   = Number(vndWallet.locked   ?? 0);
  const vndAvailable = Number(vndWallet.available ?? 0);

  const displayAddr = user?.wallet_address?.toLowerCase() === "0x0ecbecfdb336a1b56d8f9cfd634844d0efd70cf4" ? null : user?.wallet_address;
  const walletAddr = account || displayAddr;
  const isLoading  = dashQ.isLoading;

  const TOKEN_ROWS = [
    { key: "CR1", label: "CaRo1 (Hạng A)", qty: caro1 },
    { key: "CR2", label: "CaRo2 (Hạng B)", qty: caro2 },
    { key: "CR3", label: "CaRo3 (Hạng C)", qty: caro3 },
  ];

  return (
    <FarmerLayout title="Ví tài khoản">
      <div className="caro-page">

        {/* Header */}
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">👛 Ví Của Tôi</h2>
            <p className="caro-page-subtitle">Quản lý số dư, token và ví MetaMask</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => nav("/farmer/wallet/deposit")} className="caro-btn caro-btn-primary">
              Nạp
            </button>
            <button onClick={() => nav("/farmer/wallet/withdraw")} className="caro-btn caro-btn-ghost">
              Rút
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="caro-grid-2">

          {/* Token_CaRo */}
          <BalCard
            label="Token_CaRo (Tổng số dư)"
            value={formatToken(totalCaRo, "CaRo")}
            sub={`CaRo1: ${formatNumber(caro1)} · CaRo2: ${formatNumber(caro2)} · CaRo3: ${formatNumber(caro3)}`}
            accent="#408A71"
            bgAccent="rgba(64, 138, 113,0.1)"
            icon="🪙"
            loading={isLoading}
          />

          {/* Giá trị ước tính */}
          <BalCard
            label="Giá trị ước tính"
            value={estimatedValue > 0 ? (estimatedValue / 1_000_000).toFixed(2) + " triệu VND" : "0 VND"}
            sub={`${priceSource} · CR1: ${formatNumber(priceMap.CR1)} · CR2: ${formatNumber(priceMap.CR2)} · CR3: ${formatNumber(priceMap.CR3)}`}
            accent="#f8fafc"
            bgAccent="rgba(255,255,255,0.05)"
            icon="💰"
            loading={isLoading || priceQ.isLoading}
          />
        </div>

        {/* ── Blockchain wallet address ── */}
        <div className="caro-card">
          <div className="caro-section-header">
            <h3 className="caro-section-title">Ví MetaMask cá nhân</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "monospace", fontSize: 14, color: walletAddr ? "#f8fafc" : "#64748b", wordBreak: "break-all" }}>
              {walletAddr || "Chưa kết nối ví MetaMask cá nhân"}
            </div>
            {walletAddr && (
              <button onClick={() => navigator.clipboard.writeText(walletAddr)} className="caro-btn caro-btn-secondary" style={{ flexShrink: 0 }}>
                Sao chép
              </button>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: "#94a3b8" }}>
            🦊 Kết nối MetaMask để thực hiện rút hoặc chuyển đổi token. Địa chỉ ví này sẽ nhận token khi rút trực tiếp.
          </div>
        </div>

        {/* ── Token breakdown table ── */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="caro-section-header">
            <h3 className="caro-section-title">Danh mục Token CaRo</h3>
            <span className="caro-badge caro-badge-muted" style={{ fontWeight: 500 }}>
              {priceSource} · Tự động cập nhật
            </span>
          </div>

          <div className="caro-table-wrap">
            <table className="caro-table">
              <thead>
                <tr>
                  {["Token", "Token_CaRo (Số dư)", "Khối lượng", "Đơn giá / kg", "Giá trị ước tính"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 14 }}>
                      <div style={{ animation: "caro-spin 1s linear infinite", display: "inline-block", marginRight: 8 }}>⏳</div>
                      Đang tải số dư…
                    </td>
                  </tr>
                )}

                {!isLoading && TOKEN_ROWS.map(({ key, label, qty }) => {
                  const price = priceMap[key];
                  const val   = qty * price;
                  return (
                    <tr key={key}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, rgba(176, 228, 204,0.1), rgba(64, 138, 113,0.1))", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{key}</div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{label}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Token Cà phê Robusta</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: qty > 0 ? "#B0E4CC" : "#64748b" }}>
                        {qty > 0 ? formatNumber(qty) : "—"}
                      </td>
                      <td style={{ fontSize: 14, fontFamily: "monospace", color: "#f8fafc" }}>
                        {qty > 0 ? formatKg(qty) : "—"}
                      </td>
                      <td style={{ fontSize: 14, fontFamily: "monospace", color: "#94a3b8" }}>
                        {priceQ.isLoading ? "…" : formatVND(price)}
                      </td>
                      <td style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: val > 0 ? "#408A71" : "#64748b" }}>
                        {val > 0 ? formatVND(val) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* Total row */}
                {!isLoading && (
                  <tr style={{ background: "rgba(176, 228, 204,0.02)", borderTop: "2px solid var(--border)" }}>
                    <td style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8" }}>TỔNG CỘNG</td>
                    <td>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", color: "#B0E4CC" }}>
                        {formatNumber(totalCaRo)}
                      </span>
                      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6, fontWeight: 600 }}>CaRo</span>
                    </td>
                    <td style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#f8fafc" }}>
                      {totalCaRo > 0 ? formatKg(totalCaRo) : "—"}
                    </td>
                    <td />
                    <td style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: "#408A71" }}>
                      {estimatedValue > 0 ? formatVND(estimatedValue) : "—"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── VND wallet summary (only when there is a balance) ── */}
        {vndBalance > 0 && (
          <div className="caro-card" style={{ background: "rgba(176, 228, 204,0.03)", borderColor: "rgba(176, 228, 204,0.15)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#B0E4CC", marginBottom: 12 }}>Số dư VND</div>
            <div style={{ display: "flex", gap: 32, fontSize: 14, flexWrap: "wrap", fontFamily: "monospace" }}>
              <span>Tổng: <b style={{ color: "#f8fafc", fontSize: 15 }}>{formatVND(vndBalance)}</b></span>
              {vndLocked > 0 && (
                <span>Đang khoá: <b style={{ color: "#f0b90b", fontSize: 15 }}>{formatVND(vndLocked)}</b></span>
              )}
              <span>Khả dụng: <b style={{ color: "#B0E4CC", fontSize: 15 }}>{formatVND(vndAvailable)}</b></span>
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className="caro-grid-3">
          {[
            { label: "Nạp tiền",          sub: "Nạp thêm số dư vào tài khoản ví",         path: "/farmer/wallet/deposit",  accent: "#B0E4CC" },
            { label: "Rút tiền",          sub: "Chuyển số dư ra tài khoản ngân hàng",      path: "/farmer/wallet/withdraw", accent: "#ef4444" },
            { label: "Lịch sử giao dịch", sub: "Xem tất cả lịch sử nạp rút và giao dịch", path: "/farmer/wallet/history",  accent: "#408A71" },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{
                padding: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 12,
                cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = a.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: a.accent, marginBottom: 6 }}>{a.label}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </FarmerLayout>
  );
}
