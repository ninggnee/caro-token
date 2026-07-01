import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useWallet } from "../context/WalletContext";
import { useAuth } from "../context/AuthContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import axios from "../utils/axiosClient";
import { formatVND, formatKg } from '../utils/formatters';

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
const STATUS_COLOR = { pending: "caro-badge-warning", approved: "caro-badge-success", rejected: "caro-badge-danger" };

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
      <div className="caro-page">
        <div className="caro-page-header">
          <div>
            <h2 className="caro-page-title">👛 Ví Tài Khoản</h2>
            <p className="caro-page-subtitle">Quản lý số dư, MetaMask và lịch sử giao dịch</p>
          </div>
        </div>

        {/* MetaMask connection card */}
        <div className="caro-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24, padding: "20px 24px" }}>
          <div>
            <div style={{ fontSize: 14, color: "#f8fafc", marginBottom: 8, fontWeight: 600 }}>
              Trạng thái kết nối: <span style={{ color: account ? "#B0E4CC" : "#ef4444" }}>{account ? "Đã kết nối" : "Chưa kết nối"}</span>
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>
              Địa chỉ ví: <strong style={{ color: account ? "#408A71" : "#f8fafc", fontFamily: "monospace", fontSize: 14 }}>{account || "—"}</strong>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Kết nối gần nhất: {lastConnected ? new Date(lastConnected).toLocaleString("vi-VN") : "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {!account ? (
              <button onClick={handleConnect} className="caro-btn caro-btn-primary" style={{ padding: "10px 20px" }}>
                🦊 Kết nối ví
              </button>
            ) : (
              <>
                <button onClick={handleCopy} className="caro-btn caro-btn-ghost">
                  Sao chép địa chỉ
                </button>
                <button onClick={handleDisconnect} className="caro-btn caro-btn-danger">
                  Ngắt kết nối
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 24 }}>

          {/* Asset table */}
          <div className="caro-card">
            <div className="caro-section-header">
              <h3 className="caro-section-title">🫘 Danh mục tài sản</h3>
              <span className="caro-badge caro-badge-info" style={{ fontSize: 11 }}>{tokenSource}</span>
            </div>
            
            <div className="caro-table-container">
              <table className="caro-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th style={{ textAlign: "right" }}>Số lượng</th>
                    <th style={{ textAlign: "right" }}>Đơn giá</th>
                    <th style={{ textAlign: "right" }}>Giá trị</th>
                  </tr>
                </thead>
                <tbody>
                  {/* VND balance — from wallets table (real) */}
                  <tr>
                    <td>VND</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>—</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>1 VND</td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "#408A71" }}>
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
                      <tr key={label}>
                        <td>{label}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: qty > 0 ? "#B0E4CC" : "#64748b" }}>
                          {(onChain.loading && account) ? "…" : formatKg(qty)}
                        </td>
                        <td style={{ textAlign: "right", color: "#94a3b8" }}>
                          {formatVND(price)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800, color: "#408A71" }}>
                          {formatVND(qty * price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VND breakdown */}
            {vndLocked > 0 && (
              <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(240,185,11,0.06)", border: "1px solid rgba(240,185,11,0.15)", borderRadius: 8, fontSize: 13, color: "#94a3b8" }}>
                Số dư VND: <strong style={{ color: "#f8fafc" }}>{formatVND(vndTotal)}</strong>
                {" "}· Đang khoá: <strong style={{ color: "#f0b90b" }}>{formatVND(vndLocked)}</strong>
                {" "}· Khả dụng: <strong style={{ color: "#B0E4CC" }}>{formatVND(vndAvailable)}</strong>
              </div>
            )}
          </div>

          {/* Transaction history — real deposit/withdraw records */}
          <div className="caro-card">
            <h3 className="caro-section-title" style={{ marginBottom: 20 }}>📈 Lịch sử giao dịch</h3>

            {historyQ.isLoading && (
              <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "30px 0" }}>Đang tải…</div>
            )}

            {!historyQ.isLoading && txHistory.length === 0 && (
              <div className="caro-empty" style={{ padding: "30px 0" }}>
                <div className="caro-empty-icon" style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
                <div className="caro-empty-title" style={{ fontSize: 14 }}>Chưa có giao dịch nào.</div>
              </div>
            )}

            {!historyQ.isLoading && txHistory.length > 0 && (
              <ul style={{ paddingLeft: 0, margin: 0, display: "grid", gap: 12, listStyle: "none" }}>
                {txHistory.map(tx => {
                  const isDeposit = tx.txType === "deposit";
                  const sign      = isDeposit ? "+" : "−";
                  const color     = isDeposit ? "#B0E4CC" : "#ef4444";
                  const label     = isDeposit ? "Nạp VND" : "Rút VND";
                  const status    = tx.status || "pending";
                  return (
                    <li key={`${tx.txType}-${tx.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: 14, color: "#f8fafc", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 8 }}>
                          {new Date(tx.created_at).toLocaleDateString("vi-VN")}
                          <span className={`caro-badge ${STATUS_COLOR[status] || "caro-badge-muted"}`} style={{ padding: "2px 6px", fontSize: 10 }}>
                            {STATUS_LABEL[status] || status}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "monospace" }}>
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
