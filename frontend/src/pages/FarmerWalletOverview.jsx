import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "../utils/axiosClient";
import { formatNumber, formatVND, formatKg, formatToken } from '../utils/formatters';

const C = {
  green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", accent: "#487573",
  muted: "#6b7a99", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9",
};

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

function BalCard({ label, value, sub, accent, action, onAction, loading }) {
  return (
    <div style={{ background: C.card, borderRadius: 10, padding: "20px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent || "#e2e8f0", marginBottom: 4 }}>
        {loading ? "…" : value}
      </div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
      {action && (
        <button onClick={onAction}
          style={{ marginTop: 12, padding: "6px 14px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
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

  // On-chain from new contracts (authoritative) → DB exchange balance (fallback)
  const onChainBals = dashQ.data?.onChainBalances;
  const dbHoldings  = dashQ.data?.tokenBalances || {};
  const useOnChain  = dashQ.data?.dataSource === 'on-chain' && onChainBals;
  const caro1 = useOnChain ? Number(onChainBals.caro1 ?? 0) : Number(dbHoldings.caro1 ?? 0);
  const caro2 = useOnChain ? Number(onChainBals.caro2 ?? 0) : Number(dbHoldings.caro2 ?? 0);
  const caro3 = useOnChain ? Number(onChainBals.caro3 ?? 0) : Number(dbHoldings.caro3 ?? 0);

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

  const walletAddr = account || user?.wallet_address;
  const isLoading  = dashQ.isLoading;

  const TOKEN_ROWS = [
    { key: "CR1", label: "CaRo1 (Hạng A)", qty: caro1 },
    { key: "CR2", label: "CaRo2 (Hạng B)", qty: caro2 },
    { key: "CR3", label: "CaRo3 (Hạng C)", qty: caro3 },
  ];

  return (
    <FarmerLayout title="Ví tài khoản">
      <div style={{ display: "grid", gap: 20, width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>👛 Ví Của Tôi</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => nav("/farmer/wallet/deposit")}
              style={{ padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Nạp tiền
            </button>
            <button onClick={() => nav("/farmer/wallet/withdraw")}
              style={{ padding: "8px 16px", background: "rgba(255,255,255,0.08)", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
              Rút tiền
            </button>
          </div>
        </div>

        {/* ── 3 summary cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>

          {/* Token_CaRo */}
          <BalCard
            label="Token_CaRo (Tổng số dư)"
            value={formatToken(totalCaRo, "CaRo")}
            sub={`CaRo1: ${formatNumber(caro1)} · CaRo2: ${formatNumber(caro2)} · CaRo3: ${formatNumber(caro3)}`}
            accent={C.tealLight}
            loading={isLoading}
          />

          {/* VND Balance */}
          <BalCard
            label="Số dư VND trong ví"
            value={vndBalance > 0 ? formatVND(vndBalance) : "0 VND"}
            sub={vndLocked > 0 ? `Khả dụng: ${formatVND(vndAvailable)} · Đang khoá: ${formatVND(vndLocked)}` : "Toàn bộ khả dụng"}
            accent={C.green}
            loading={isLoading}
            action="Nạp tiền"
            onAction={() => nav("/farmer/wallet/deposit")}
          />

          {/* Giá trị ước tính */}
          <BalCard
            label="Giá trị ước tính"
            value={estimatedValue > 0 ? (estimatedValue / 1_000_000).toFixed(2) + " triệu VND" : "0 VND"}
            sub={`${priceSource} · CR1: ${formatNumber(priceMap.CR1)} · CR2: ${formatNumber(priceMap.CR2)} · CR3: ${formatNumber(priceMap.CR3)}`}
            accent="#e2e8f0"
            loading={isLoading || priceQ.isLoading}
          />
        </div>

        {/* ── Blockchain wallet address ── */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#e2e8f0" }}>Ví sàn giao dịch nội bộ</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: "monospace", fontSize: 13, color: "#e2e8f0", wordBreak: "break-all" }}>
              {walletAddr || "Chưa kết nối ví bên ngoài"}
            </div>
            {walletAddr && (
              <button onClick={() => navigator.clipboard.writeText(walletAddr)}
                style={{ padding: "8px 14px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                Sao chép
              </button>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
            ☕ Ví giao dịch nội bộ sàn CaRo — không bắt buộc sử dụng MetaMask khi giao dịch. Token được chuyển thẳng vào đây khi lô hàng được mint.
          </div>
        </div>

        {/* ── Token breakdown table ── */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Danh mục Token CaRo</div>
            <span style={{ fontSize: 11, color: C.muted, background: "rgba(72,117,115,0.08)", padding: "3px 8px", borderRadius: 4 }}>
              {priceSource} · Tự động cập nhật
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Token", "Token_CaRo (Số dư)", "Đơn giá / kg", "Giá trị ước tính"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13 }}>Đang tải số dư…</td>
                </tr>
              )}

              {!isLoading && TOKEN_ROWS.map(({ key, label, qty }) => {
                const price = priceMap[key];
                const val   = qty * price;
                return (
                  <tr key={key} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "linear-gradient(135deg,#203433,#487573)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>{key}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{label}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>Token Cà phê Robusta</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, color: qty > 0 ? C.green : C.muted }}>
                      {qty > 0 ? formatNumber(qty) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: C.muted }}>
                      {priceQ.isLoading ? "…" : formatVND(price)}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: val > 0 ? "#e2e8f0" : C.muted }}>
                      {val > 0 ? formatVND(val) : "—"}
                    </td>
                  </tr>
                );
              })}

              {/* Total row */}
              {!isLoading && (
                <tr style={{ background: "rgba(72,117,115,0.05)", borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 700, color: C.muted }}>TỔNG CỘNG</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.tealLight }}>
                      {formatNumber(totalCaRo)}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>CaRo</span>
                  </td>
                  <td />
                  <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 700, color: C.tealLight }}>
                    {estimatedValue > 0 ? formatVND(estimatedValue) : "—"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── VND wallet summary (only when there is a balance) ── */}
        {vndBalance > 0 && (
          <div style={{ padding: "14px 18px", background: "rgba(72,117,115,0.05)", border: `1px solid ${C.border}`, borderRadius: 9 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>Số dư VND</div>
            <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
              <span>Tổng: <b style={{ color: "#e2e8f0" }}>{formatVND(vndBalance)}</b></span>
              {vndLocked > 0 && (
                <span>Đang khoá: <b style={{ color: C.gold }}>{formatVND(vndLocked)}</b></span>
              )}
              <span>Khả dụng: <b style={{ color: C.green }}>{formatVND(vndAvailable)}</b></span>
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Nạp tiền",          sub: "Nạp thêm số dư vào tài khoản ví",         path: "/farmer/wallet/deposit",  accent: C.green },
            { label: "Rút tiền",          sub: "Chuyển số dư ra tài khoản ngân hàng",      path: "/farmer/wallet/withdraw", accent: C.red },
            { label: "Lịch sử giao dịch", sub: "Xem tất cả lịch sử nạp rút và giao dịch", path: "/farmer/wallet/history",  accent: C.tealLight },
          ].map(a => (
            <button key={a.path} onClick={() => nav(a.path)}
              style={{ padding: "16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(72,117,115,0.06)"; e.currentTarget.style.borderColor = "#487573"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = C.border; }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: a.accent, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{a.sub}</div>
            </button>
          ))}
        </div>

      </div>
    </FarmerLayout>
  );
}
