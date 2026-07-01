import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import TraderLayout from "../components/layout/TraderLayout";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import axios from "../utils/axiosClient";
import { formatNumber, formatVND } from '../utils/formatters';
import { TRADER_KEYS } from '../hooks/useTraderData';
import { formatToken } from '../utils/formatters';

const C = {
  accent: "#408A71", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#B0E4CC",
};
const TOKEN_COLORS = { CR1: "#f0b90b", CR2: "#00d4aa", CR3: "#9b87f5" };
const TOKEN_LABELS = { CR1: "CaRo1 (CR1)", CR2: "CaRo2 (CR2)", CR3: "CaRo3 (CR3)" };
const TOKEN_GRADE  = { CR1: "Grade A", CR2: "Grade B", CR3: "Grade C" };


function AmountInput({ label, value, onChange, placeholder, max }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="number" min="0" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "0"}
          style={{ width: "100%", padding: "10px 60px 10px 12px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 8, color: "#e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }}
        />
        {max != null && (
          <button type="button" onClick={() => onChange(String(max))}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.tealLight, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
            MAX
          </button>
        )}
      </div>
    </div>
  );
}

export default function TraderWallet() {
  const { account, provider, connect } = useWallet();
  const nav = useNavigate();
  const qc  = useQueryClient();

  const [tokenBals, setTokenBals] = useState({ CR1: "0", CR2: "0", CR3: "0" });
  const [activeTab, setActiveTab] = useState("overview");
  const [wdType,    setWdType]    = useState("vnd"); // "vnd" | "token"
  const [depType,   setDepType]   = useState("vnd"); // "vnd" | "token"

  const { data: exchangeBalsData } = useQuery({
    queryKey: ["exchange-token-balances"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 10_000,
  });
  const exchangeBals = exchangeBalsData?.balances || {};

  const [depAmount, setDepAmount] = useState("");
  const [wdAmount,  setWdAmount]  = useState("");
  const [depMsg,    setDepMsg]    = useState(null);
  const [wdMsg,     setWdMsg]     = useState(null);

  const { data: walletData, isLoading } = useQuery({
    queryKey: TRADER_KEYS.wallet,
    queryFn:  () => axios.get("/wallet/balance").then(r => r.data),
    staleTime: 10_000, refetchInterval: 20_000,
  });
  const vndBalance = Number(walletData?.balance || 0);

  const { data: txData } = useQuery({
    queryKey: ["trader-wallet-tx"],
    queryFn:  () => axios.get("/wallet/transactions?limit=20").then(r => r.data),
    staleTime: 15_000, refetchInterval: 30_000,
  });
  const txList = txData?.data || txData?.transactions || [];

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

  const depositMutation = useMutation({
    mutationFn: (amount) => axios.post("/wallet/direct-deposit", { amount: Number(amount) }).then(r => r.data),
    onSuccess: () => {
      setDepMsg({ ok: true, text: "Nạp tiền thành công!" });
      setDepAmount("");
      qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
      qc.invalidateQueries({ queryKey: ["trader-wallet-tx"] });
    },
    onError: (e) => setDepMsg({ ok: false, text: e?.response?.data?.message || "Nạp tiền thất bại." }),
  });

  const withdrawMutation = useMutation({
    mutationFn: (amount) => axios.post("/wallet/withdraw", { amount: Number(amount) }).then(r => r.data),
    onSuccess: () => {
      setWdMsg({ ok: true, text: "Rút tiền thành công!" });
      setWdAmount("");
      qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
      qc.invalidateQueries({ queryKey: ["trader-wallet-tx"] });
    },
    onError: (e) => setWdMsg({ ok: false, text: e?.response?.data?.message || "Rút tiền thất bại." }),
  });

  const tabStyle = (t) => ({
    padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: "none", borderRadius: 7, transition: "all 0.15s",
    background: activeTab === t ? C.accent : "rgba(255,255,255,0.04)",
    color: activeTab === t ? "#fff" : C.muted,
  });

  const txTypeLabel = (type) => {
    const map = { deposit: "Nạp tiền", withdraw: "Rút tiền", trade: "Giao dịch", fee: "Phí" };
    return map[type] || type || "—";
  };

  return (
    <TraderLayout title="Ví tài khoản">
      <div style={{ display: "grid", gap: 18, maxWidth: 900 }}>

        {/* VND Balance hero */}
        <div style={{ background: `linear-gradient(135deg, #172524 0%, #1e302f 100%)`, borderRadius: 14, border: `1px solid ${C.border}`, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Số dư VND khả dụng</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.tealLight, letterSpacing: "-0.5px" }}>
              {isLoading ? "..." : formatVND(vndBalance)}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Cập nhật tự động mỗi 20 giây</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setActiveTab("deposit")}
              style={{ padding: "10px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              + Nạp tiền
            </button>
            <button onClick={() => setActiveTab("withdraw")}
              style={{ padding: "10px 20px", background: "rgba(255,255,255,0.07)", color: "#e2e8f0", border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              − Rút tiền
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            ["overview", "📊 Tổng quan"],
            ["deposit",  "💵 Nạp tiền"],
            ["withdraw", "📤 Rút tiền"],
            ["history",  "📋 Lịch sử"],
          ].map(([t, label]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>{label}</button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: 14 }}>
            {/* Exchange Balance */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>🪙 Số dư nội bộ trên sàn CaRo (Sử dụng để giao dịch)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
                {["CR1", "CR2", "CR3"].map((key, idx) => {
                  const qty = Number(exchangeBals[key]?.balance || 0);
                  const avail = Number(exchangeBals[key]?.available_balance || 0);
                  return (
                    <div key={key} style={{ padding: "18px", borderRight: idx < 2 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ fontSize: 11, color: TOKEN_COLORS[key], fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                        {TOKEN_LABELS[key]}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: qty > 0 ? "#fff" : C.muted }}>
                        {formatNumber(qty, 4)}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                        Khả dụng: <span style={{ color: C.green, fontWeight: 600 }}>{formatNumber(avail, 4)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MetaMask Onchain Balance */}
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>🪙 Số dư Token on-chain (MetaMask)</span>
                {!account && (
                  <button onClick={connect}
                    style={{ padding: "6px 14px", background: "#f0b90b", color: "#000", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Kết nối MetaMask
                  </button>
                )}
              </div>
              {!account ? (
                <div style={{ padding: "32px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🦊</div>
                  Kết nối MetaMask để xem số dư CR1, CR2, CR3
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
                  {["CR1", "CR2", "CR3"].map((key, idx) => {
                    const qty = Number(tokenBals[key] || 0);
                    return (
                      <div key={key} style={{ padding: "18px", borderRight: idx < 2 ? `1px solid ${C.border}` : "none" }}>
                        <div style={{ fontSize: 11, color: TOKEN_COLORS[key], fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                          {TOKEN_LABELS[key]}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{TOKEN_GRADE[key]}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: qty > 0 ? C.green : C.muted }}>{formatNumber(qty, 4)}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>token</div>
                        <button onClick={() => nav("/trader/trading")}
                          style={{ marginTop: 12, padding: "6px 12px", fontSize: 11, background: "rgba(72,117,115,0.12)", color: C.tealLight, border: `1px solid rgba(72,117,115,0.3)`, borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                          Giao dịch →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {account && (
                <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                  Ví: {account.slice(0, 6)}...{account.slice(-4)}
                </div>
              )}
            </div>

            <button onClick={() => nav("/trader/portfolio")}
              style={{ padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(72,117,115,0.07)"; e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = C.border; }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>📊 Xem danh mục đầu tư đầy đủ</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Phân tích hiệu suất, phân bổ tài sản theo thời gian thực</div>
              </div>
              <span style={{ color: C.tealLight, fontSize: 18 }}>→</span>
            </button>
          </div>
        )}

        {/* Tab: Deposit */}
        {activeTab === "deposit" && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Sub-tabs inside deposit */}
            <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 8, width: "fit-content" }}>
              <button 
                onClick={() => setDepType("vnd")} 
                style={{
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: depType === "vnd" ? C.accent : "transparent",
                  color: depType === "vnd" ? "#fff" : C.muted
                }}
              >
                💵 Nạp VND
              </button>
              <button 
                onClick={() => setDepType("token")} 
                style={{
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: depType === "token" ? C.accent : "transparent",
                  color: depType === "token" ? "#fff" : C.muted
                }}
              >
                🪙 Nạp Token
              </button>
            </div>

            {depType === "vnd" ? (
              <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "24px" }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>💵 Nạp tiền VND</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Nạp tiền vào tài khoản để đặt lệnh mua token CaRo</div>
                </div>
                <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
                  <AmountInput label="Số tiền nạp (VND)" value={depAmount} onChange={setDepAmount} placeholder="ví dụ: 1.000.000" />
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Nạp nhanh:</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[500000, 1000000, 2000000, 5000000].map(amt => (
                        <button key={amt} onClick={() => setDepAmount(String(amt))}
                          style={{ padding: "6px 14px", fontSize: 12, background: depAmount === String(amt) ? "rgba(72,117,115,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${depAmount === String(amt) ? C.accent : C.border}`, borderRadius: 6, cursor: "pointer", color: "#e2e8f0", fontWeight: 600 }}>
                          {formatVND(amt)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {depMsg && (
                    <div style={{ padding: "10px 14px", background: depMsg.ok ? "rgba(14,203,129,0.1)" : "rgba(246,70,93,0.1)", border: `1px solid ${depMsg.ok ? "rgba(14,203,129,0.3)" : "rgba(246,70,93,0.3)"}`, borderRadius: 8, fontSize: 13, color: depMsg.ok ? C.green : C.red }}>
                      {depMsg.text}
                    </div>
                  )}
                  <button
                    onClick={() => { setDepMsg(null); depositMutation.mutate(depAmount); }}
                    disabled={!depAmount || Number(depAmount) <= 0 || depositMutation.isLoading}
                    style={{ padding: "12px 0", background: depAmount && Number(depAmount) > 0 ? C.accent : "rgba(72,117,115,0.3)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: depAmount && Number(depAmount) > 0 ? "pointer" : "not-allowed" }}>
                    {depositMutation.isLoading ? "Đang xử lý..." : `Nạp ${depAmount ? formatVND(Number(depAmount)) : "tiền"}`}
                  </button>
                </div>
              </div>
            ) : (
              <TraderTokenDepositForm account={account} provider={provider} connect={connect} qc={qc} />
            )}
          </div>
        )}

        {/* Tab: Withdraw */}
        {activeTab === "withdraw" && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Sub-tabs inside withdraw */}
            <div style={{ display: "flex", gap: 8, background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 8, width: "fit-content" }}>
              <button 
                onClick={() => setWdType("vnd")} 
                style={{
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: wdType === "vnd" ? C.accent : "transparent",
                  color: wdType === "vnd" ? "#fff" : C.muted
                }}
              >
                💵 Rút VND
              </button>
              <button 
                onClick={() => setWdType("token")} 
                style={{
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: wdType === "token" ? C.accent : "transparent",
                  color: wdType === "token" ? "#fff" : C.muted
                }}
              >
                🪙 Rút Token
              </button>
            </div>

            {wdType === "vnd" ? (
              <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "24px" }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📤 Rút tiền VND</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Số dư khả dụng: <strong style={{ color: C.tealLight }}>{formatVND(vndBalance)}</strong></div>
                </div>
                <div style={{ display: "grid", gap: 16, maxWidth: 420 }}>
                  <AmountInput label="Số tiền rút (VND)" value={wdAmount} onChange={setWdAmount} placeholder="ví dụ: 500.000" max={vndBalance} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[100000, 500000, 1000000].filter(a => a <= vndBalance).map(amt => (
                      <button key={amt} onClick={() => setWdAmount(String(amt))}
                        style={{ padding: "6px 14px", fontSize: 12, background: wdAmount === String(amt) ? "rgba(246,70,93,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${wdAmount === String(amt) ? C.red : C.border}`, borderRadius: 6, cursor: "pointer", color: "#e2e8f0", fontWeight: 600 }}>
                        {formatVND(amt)}
                      </button>
                    ))}
                  </div>
                  {wdMsg && (
                    <div style={{ padding: "10px 14px", background: wdMsg.ok ? "rgba(14,203,129,0.1)" : "rgba(246,70,93,0.1)", border: `1px solid ${wdMsg.ok ? "rgba(14,203,129,0.3)" : "rgba(246,70,93,0.3)"}`, borderRadius: 8, fontSize: 13, color: wdMsg.ok ? C.green : C.red }}>
                      {wdMsg.text}
                    </div>
                  )}
                  <button
                    onClick={() => { setWdMsg(null); withdrawMutation.mutate(wdAmount); }}
                    disabled={!wdAmount || Number(wdAmount) <= 0 || Number(wdAmount) > vndBalance || withdrawMutation.isLoading}
                    style={{ padding: "12px 0", background: wdAmount && Number(wdAmount) > 0 && Number(wdAmount) <= vndBalance ? C.red : "rgba(246,70,93,0.25)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: wdAmount && Number(wdAmount) > 0 && Number(wdAmount) <= vndBalance ? "pointer" : "not-allowed" }}>
                    {withdrawMutation.isLoading ? "Đang xử lý..." : `Rút ${wdAmount ? formatVND(Number(wdAmount)) : "tiền"}`}
                  </button>
                </div>
              </div>
            ) : (
              <TraderTokenWithdrawForm exchangeBals={exchangeBals} account={account} connect={connect} qc={qc} />
            )}
          </div>
        )}

        {/* Tab: History */}
        {activeTab === "history" && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
              📋 Lịch sử giao dịch ví
            </div>
            {txList.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Chưa có giao dịch nào
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    {["Loại", "Số tiền", "Ghi chú", "Thời gian"].map(h => (
                      <th key={h} style={{ padding: "9px 16px", fontSize: 11, color: C.muted, fontWeight: 600, textAlign: "left", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txList.map((tx, i) => {
                    const isToken = !!tx.token_type;
                    const isIn = tx.type === "deposit" || (Number(tx.amount) > 0 && !isToken);
                    return (
                      <tr key={tx.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: isIn ? C.green : C.red }}>
                            {isToken ? `${tx.type === "deposit" ? "Nạp" : "Rút"} ${tx.token_type}` : txTypeLabel(tx.type)}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, fontFamily: "monospace", fontWeight: 700, color: isIn ? C.green : C.red }}>
                          {isIn ? "+" : "−"}{isToken ? `${Math.abs(Number(tx.amount))} ${tx.token_type}` : formatVND(Math.abs(Number(tx.amount || tx.value || 0)))}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: C.muted }}>
                          {tx.note || tx.description || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 11, color: C.muted }}>
                          {tx.created_at ? new Date(tx.created_at).toLocaleString("vi-VN") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </TraderLayout>
  );
}

function TraderTokenDepositForm({ account, provider, connect, qc }) {
  const [token, setToken] = useState("CR1");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [metaMaskBal, setMetaMaskBal] = useState("0");

  // Load MetaMask balance of the selected token
  useEffect(() => {
    if (!account || !provider) return;
    let cancelled = false;
    (async () => {
      try {
        const c = new ethers.Contract(CA_RO_CONTRACTS[token], ABI, provider);
        const [b, d] = await Promise.all([c.balanceOf(account), c.decimals()]);
        if (!cancelled) {
          setMetaMaskBal(ethers.utils.formatUnits(b, d));
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [account, provider, token]);

  const avail = Number(metaMaskBal || 0);
  const amt = Number(amount) || 0;
  const canSubmit = amt > 0 && amt <= avail && account && !submitting;

  const handleDepositToken = async () => {
    setMsg(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CA_RO_CONTRACTS[token], ABI, signer);
      const decimals = await contract.decimals().catch(() => 18);
      const amountWei = ethers.utils.parseUnits(String(amount), decimals);

      const treasuryAddress = "0x0EcBEcFDb336A1B56D8f9cFD634844d0Efd70Cf4";
      console.log(`[DepositToken] Transferring ${amount} ${token} to Treasury`);
      
      const tx = await contract.transfer(treasuryAddress, amountWei);
      setMsg({ ok: true, text: `Giao dịch đã được gửi lên blockchain. Đang chờ xác nhận... (Tx: ${tx.hash.slice(0,10)}...)` });
      
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Giao dịch blockchain bị đảo ngược (reverted).");
      }

      // Record on backend
      await axios.post("/wallet/deposit-token", {
        token_type: token,
        amount: amt,
        tx_hash: tx.hash
      });

      setMsg({ ok: true, text: `Nạp token thành công! Mã giao dịch: ${tx.hash}` });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["exchange-token-balances"] });
      qc.invalidateQueries({ queryKey: ["trader-wallet-tx"] });
    } catch (e) {
      console.error(e);
      setMsg({ ok: false, text: e?.response?.data?.message || e.message || "Nạp token thất bại." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🪙 Nạp Token từ ví MetaMask</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Chuyển token từ ví MetaMask cá nhân của bạn vào ví sàn giao dịch nội bộ CaRo.
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 450 }}>
        {/* Token Selector */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Chọn loại Token</label>
          <div style={{ display: "flex", gap: 10 }}>
            {["CR1", "CR2", "CR3"].map(t => (
              <button
                key={t}
                onClick={() => setToken(t)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: token === t ? C.accent : "rgba(255,255,255,0.03)",
                  border: `1px solid ${token === t ? C.tealLight : C.border}`,
                  borderRadius: 8,
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13
                }}
              >
                {TOKEN_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Balance Status */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: C.muted }}>Số dư trong ví MetaMask:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{formatNumber(avail, 4)} {token}</span>
        </div>

        {/* Destination Address */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Nạp về tài khoản sàn</label>
          <input
            value={account ? `Ví MetaMask liên kết: ${account.slice(0,10)}...${account.slice(-4)}` : ""}
            readOnly
            disabled
            placeholder="Chưa kết nối ví MetaMask"
            style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, color: "#8892b0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "monospace", cursor: "not-allowed" }}
          />
          {!account && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠️ Vui lòng kết nối ví MetaMask để thực hiện nạp token</div>}
        </div>

        {/* Amount */}
        <AmountInput label="Số lượng nạp (kg)" value={amount} onChange={setAmount} placeholder="0.0" max={avail} />

        {msg && (
          <div style={{ padding: "10px 14px", background: msg.ok ? "rgba(14,203,129,0.1)" : "rgba(246,70,93,0.1)", border: `1px solid ${msg.ok ? "rgba(14,203,129,0.3)" : "rgba(246,70,93,0.3)"}`, borderRadius: 8, fontSize: 13, color: msg.ok ? C.green : C.red, wordBreak: "break-all" }}>
            {msg.text}
          </div>
        )}

        {!account ? (
          <button onClick={connect}
            style={{ padding: "12px 0", background: "#f0b90b", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            🦊 Kết nối ví MetaMask
          </button>
        ) : (
          <button
            onClick={handleDepositToken}
            disabled={!canSubmit}
            style={{ padding: "12px 0", background: canSubmit ? C.accent : "rgba(72,117,115,0.3)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {submitting ? "Đang xử lý..." : `Nạp ${amount ? `${amount} ${token}` : "Token"}`}
          </button>
        )}
      </div>
    </div>
  );
}

function TraderTokenWithdrawForm({ exchangeBals, account, connect, qc }) {
  const [token, setToken] = useState("CR1");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const avail = Number(exchangeBals[token]?.available_balance || 0);
  const amt = Number(amount) || 0;

  const canSubmit = amt > 0 && amt <= avail && account && !submitting;

  const handleWithdrawToken = async () => {
    setMsg(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await axios.post("/wallet/withdraw", {
        token_type: token,
        amount: amt,
        destination_address: account
      });
      setMsg({ ok: true, text: `Rút thành công! Mã giao dịch (Tx Hash): ${res.data.txHash || "Thành công"}` });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["exchange-token-balances"] });
      qc.invalidateQueries({ queryKey: ["trader-wallet-tx"] });
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.message || "Rút token thất bại." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "24px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>🪙 Rút Token về ví MetaMask</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          Rút token khả dụng từ sàn giao dịch nội bộ về ví MetaMask cá nhân của bạn.
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 450 }}>
        {/* Token Selector */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Chọn loại Token</label>
          <div style={{ display: "flex", gap: 10 }}>
            {["CR1", "CR2", "CR3"].map(t => (
              <button
                key={t}
                onClick={() => setToken(t)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: token === t ? C.accent : "rgba(255,255,255,0.03)",
                  border: `1px solid ${token === t ? C.tealLight : C.border}`,
                  borderRadius: 8,
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13
                }}
              >
                {TOKEN_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Balance Status */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: C.muted }}>Số dư nội bộ khả dụng:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.tealLight }}>{formatNumber(avail, 4)} {token}</span>
        </div>

        {/* Destination Address */}
        <div>
          <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>Địa chỉ ví nhận MetaMask</label>
          <input
            value={account || ""}
            readOnly
            disabled
            placeholder="Chưa kết nối ví MetaMask"
            style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 8, color: account ? "#8892b0" : C.red, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "monospace", cursor: "not-allowed" }}
          />
          {!account && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>⚠️ Vui lòng kết nối ví MetaMask để thực hiện rút token</div>}
        </div>

        {/* Amount */}
        <AmountInput label="Số lượng rút (kg)" value={amount} onChange={setAmount} placeholder="0.0" max={avail} />

        {msg && (
          <div style={{ padding: "10px 14px", background: msg.ok ? "rgba(14,203,129,0.1)" : "rgba(246,70,93,0.1)", border: `1px solid ${msg.ok ? "rgba(14,203,129,0.3)" : "rgba(246,70,93,0.3)"}`, borderRadius: 8, fontSize: 13, color: msg.ok ? C.green : C.red, wordBreak: "break-all" }}>
            {msg.text}
          </div>
        )}

        {!account ? (
          <button onClick={connect}
            style={{ padding: "12px 0", background: "#f0b90b", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            🦊 Kết nối ví MetaMask
          </button>
        ) : (
          <button
            onClick={handleWithdrawToken}
            disabled={!canSubmit}
            style={{ padding: "12px 0", background: canSubmit ? C.accent : "rgba(72,117,115,0.3)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: canSubmit ? "pointer" : "not-allowed" }}>
            {submitting ? "Đang xử lý..." : `Rút ${amount ? `${amount} ${token}` : "Token"}`}
          </button>
        )}
      </div>
    </div>
  );
}
