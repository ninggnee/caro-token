import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import axios from "../utils/axiosClient";
import { formatVND, formatKg } from '../utils/formatters';

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  gold: "#f0b90b", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9",
};

// VND wallet balance from API (wallets table — real, not mocked)
function useVndWallet() {
  return useQuery({
    queryKey: ["vnd-wallet"],
    queryFn: () => axios.get("/wallet/balance").then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

// DB token holdings (user_balances table — same source as Dashboard)
function useTokenHoldings() {
  return useQuery({
    queryKey: ["farmer-token-holdings-wallet"],
    queryFn: () => axios.get("/farmer/token-holdings").then(r => r.data),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

// Deposit + withdraw history merged and sorted
function useTxHistory() {
  return useQuery({
    queryKey: ["wallet-tx-history"],
    queryFn: async () => {
      const [depRes, wdRes] = await Promise.all([
        axios.get("/wallet/deposit").then(r => r.data),
        axios.get("/wallet/withdraw").then(r => r.data),
      ]);
      const deposits  = (depRes.data  || []).map(d => ({ ...d, txType: "deposit"  }));
      const withdraws = (wdRes.data   || []).map(w => ({ ...w, txType: "withdraw" }));
      return [...deposits, ...withdraws]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 20);
    },
    staleTime: 30_000,
    retry: 1,
  });
}

const STATUS_LABEL = { pending: "Đang xử lý", approved: "Hoàn thành", rejected: "Từ chối" };
const STATUS_COLOR = { pending: C.gold, approved: C.green, rejected: C.red };

export default function FarmerWallet() {
  const { account, connect, disconnect, provider, lastConnected } = useWallet();
  const { user, updateUser } = useAuth();

  // On-chain token balances read directly from smart contracts via MetaMask.
  // These are the authoritative on-chain values when the wallet is connected.
  const [onChain, setOnChain] = useState({ cr1: null, cr2: null, cr3: null, loading: false });

  const vndQ     = useVndWallet();
  const tokenQ   = useTokenHoldings();
  const historyQ = useTxHistory();

  // Load on-chain balances whenever MetaMask account changes
  useEffect(() => {
    if (!account || !provider) {
      setOnChain({ cr1: null, cr2: null, cr3: null, loading: false });
      return;
    }
    let cancelled = false;
    setOnChain(prev => ({ ...prev, loading: true }));
    (async () => {
      try {
        const t1 = new ethers.Contract(CA_RO_CONTRACTS.CR1, ABI, provider);
        const t2 = new ethers.Contract(CA_RO_CONTRACTS.CR2, ABI, provider);
        const t3 = new ethers.Contract(CA_RO_CONTRACTS.CR3, ABI, provider);
        const [b1, b2, b3, d1, d2, d3] = await Promise.all([
          t1.balanceOf(account), t2.balanceOf(account), t3.balanceOf(account),
          t1.decimals(),         t2.decimals(),         t3.decimals(),
        ]);
        if (!cancelled) {
          setOnChain({
            cr1: ethers.utils.formatUnits(b1, d1),
            cr2: ethers.utils.formatUnits(b2, d2),
            cr3: ethers.utils.formatUnits(b3, d3),
            loading: false,
          });
        }
      } catch (e) {
        console.error("on-chain balance fetch failed:", e);
        if (!cancelled) setOnChain(prev => ({ ...prev, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [account, provider]);

  // Token display values:
  //   MetaMask connected → on-chain (authoritative)
  //   MetaMask not connected → DB balance (same source as Dashboard)
  const dbHoldings = tokenQ.data?.holdings || {};
  const cr1Display = onChain.cr1 !== null ? onChain.cr1 : String(dbHoldings.caro1 ?? 0);
  const cr2Display = onChain.cr2 !== null ? onChain.cr2 : String(dbHoldings.caro2 ?? 0);
  const cr3Display = onChain.cr3 !== null ? onChain.cr3 : String(dbHoldings.caro3 ?? 0);
  const tokenSource = account ? "On-chain (MetaMask)" : "Hồ sơ mint (DB)";

  // VND wallet — real balance from wallets table
  const vndAvailable = vndQ.data?.vnd_available ?? 0;
  const vndTotal     = vndQ.data?.vnd_balance   ?? 0;
  const vndLocked    = vndQ.data?.vnd_locked     ?? 0;

  const handleCopy = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account);
    alert("Đã sao chép địa chỉ ví thành công!");
  };

  const handleConnect = async () => {
    try {
      const addr = await connect();
      if (addr) updateUser({ ...user, wallet_address: addr });
    } catch (e) { console.error(e); }
  };

  const handleDisconnect = async () => {
    if (window.confirm("Bạn có chắc chắn muốn hủy kết nối ví MetaMask?")) {
      await disconnect();
      updateUser({ ...user, wallet_address: null });
    }
  };

  const txHistory = historyQ.data || [];

  return (
    <FarmerLayout title="Ví tài khoản">
      <div style={{ display: "grid", gap: 16, width: "100%" }}>

        {/* MetaMask connection card */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: "#e2e8f0", marginBottom: 6 }}>
              Trạng thái kết nối: <b style={{ color: account ? C.green : C.red }}>{account ? "Đã kết nối" : "Chưa kết nối"}</b>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
              Địa chỉ ví: <b style={{ color: account ? C.tealLight : "#e2e8f0", fontFamily: "monospace" }}>{account || "—"}</b>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Kết nối gần nhất: {lastConnected ? new Date(lastConnected).toLocaleString("vi-VN") : "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!account ? (
              <button onClick={handleConnect} style={{ padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                🦊 Kết nối ví
              </button>
            ) : (
              <>
                <button onClick={handleCopy} style={{ padding: "8px 16px", background: "rgba(72,117,115,0.12)", border: `1px solid ${C.border}`, color: C.tealLight, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Sao chép địa chỉ
                </button>
                <button onClick={handleDisconnect} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: C.red, borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Ngắt kết nối
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

          {/* Asset table */}
          <div style={{ flex: 1, minWidth: 320, background: C.card, padding: 20, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>☕ Danh mục tài sản</h3>
              <span style={{ fontSize: 11, color: C.muted, background: "rgba(72,117,115,0.1)", padding: "3px 8px", borderRadius: 4 }}>{tokenSource}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: "left",  padding: "8px 0", fontSize: 12, color: C.muted }}>Token</th>
                  <th style={{ textAlign: "right", padding: "8px 0", fontSize: 12, color: C.muted }}>Số lượng</th>
                  <th style={{ textAlign: "right", padding: "8px 0", fontSize: 12, color: C.muted }}>Đơn giá</th>
                  <th style={{ textAlign: "right", padding: "8px 0", fontSize: 12, color: C.muted }}>Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {/* VND balance — from wallets table (real) */}
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 0", fontSize: 13, color: "#e2e8f0" }}>VND</td>
                  <td style={{ textAlign: "right", padding: "12px 0", fontSize: 13, color: C.muted }}>—</td>
                  <td style={{ textAlign: "right", padding: "12px 0", fontSize: 13, color: C.muted }}>1 VND</td>
                  <td style={{ textAlign: "right", padding: "12px 0", fontSize: 13, fontWeight: 600, color: C.tealLight }}>
                    {vndQ.isLoading ? "…" : formatVND(vndAvailable)}
                  </td>
                </tr>

                {[
                  { label: "CaRo1", value: cr1Display, price: 100_000 },
                  { label: "CaRo2", value: cr2Display, price:  85_000 },
                  { label: "CaRo3", value: cr3Display, price:  70_000 },
                ].map(({ label, value, price }) => {
                  const qty = Number(value);
                  return (
                    <tr key={label} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "12px 0", fontSize: 13, color: "#e2e8f0" }}>{label}</td>
                      <td style={{ textAlign: "right", padding: "12px 0", fontSize: 13, fontWeight: 600, color: qty > 0 ? C.green : C.muted }}>
                        {(onChain.loading && account) ? "…" : formatKg(qty)}
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 0", fontSize: 13, color: C.muted }}>
                        {formatVND(price)}
                      </td>
                      <td style={{ textAlign: "right", padding: "12px 0", fontSize: 13, fontWeight: 600, color: C.tealLight }}>
                        {formatVND(qty * price)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* VND breakdown */}
            {vndLocked > 0 && (
              <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(240,185,11,0.06)", border: "1px solid rgba(240,185,11,0.15)", borderRadius: 7, fontSize: 12, color: C.muted }}>
                Số dư VND: <span style={{ color: "#e2e8f0" }}>{formatVND(vndTotal)}</span>
                {" "}· Đang khoá: <span style={{ color: C.gold }}>{formatVND(vndLocked)}</span>
                {" "}· Khả dụng: <span style={{ color: C.green }}>{formatVND(vndAvailable)}</span>
              </div>
            )}
          </div>

          {/* Transaction history — real deposit/withdraw records */}
          <div style={{ width: 360, background: C.card, padding: 20, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>📈 Lịch sử giao dịch</h3>

            {historyQ.isLoading && (
              <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>Đang tải…</div>
            )}

            {!historyQ.isLoading && txHistory.length === 0 && (
              <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0" }}>
                Chưa có giao dịch nào.
              </div>
            )}

            {!historyQ.isLoading && txHistory.length > 0 && (
              <ul style={{ paddingLeft: 0, margin: 0, display: "grid", gap: 10, listStyle: "none" }}>
                {txHistory.map(tx => {
                  const isDeposit = tx.txType === "deposit";
                  const sign      = isDeposit ? "+" : "−";
                  const color     = isDeposit ? C.green : C.red;
                  const label     = isDeposit ? "Nạp VND" : "Rút VND";
                  const status    = tx.status || "pending";
                  return (
                    <li key={`${tx.txType}-${tx.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>
                          {new Date(tx.created_at).toLocaleDateString("vi-VN")}
                          {" · "}
                          <span style={{ color: STATUS_COLOR[status] || C.muted }}>{STATUS_LABEL[status] || status}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>
                        {sign}{formatVND(Number(tx.amount))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

        </div>
      </div>
    </FarmerLayout>
  );
}
