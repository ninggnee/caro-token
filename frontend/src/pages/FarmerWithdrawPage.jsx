import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import axios from "../utils/axiosClient";

const C = { accent: "#00d4aa", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b" };
const PRICE = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };
const FEE_RATE = 0.001; // 0.1%

function useBalances() {
  return useQuery({
    queryKey: ["token-balances"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 30_000,
  });
}

export default function FarmerWithdrawPage() {
  const nav = useNavigate();
  const balQ = useBalances();

  const [token, setToken] = useState("CR1");
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const bals = balQ.data?.balances || {};
  const avail = Number(bals[token]?.available_balance || 0);
  const amt = Number(amount) || 0;
  const fee = amt * FEE_RATE;
  const netAmt = amt - fee;
  const estVnd = netAmt * PRICE[token];

  const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(dest);
  const canSubmit = amt > 0 && amt <= avail && isValidAddr && !submitting;

  const handleSubmit = async () => {
    setErr("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await axios.post("/wallet/withdraw", { token_type: token, amount: amt, destination_address: dest });
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.message || "Withdraw failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <FarmerLayout title="Withdraw">
        <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Withdrawal Submitted</h2>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
            Your withdrawal of <strong style={{ color: C.accent }}>{amt.toLocaleString()} {token}</strong> has been queued.<br />
            You'll receive it at <strong style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{dest}</strong>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => nav("/farmer/wallet/history")} style={{ padding: "10px 22px", background: C.accent, color: "#000", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer" }}>View History</button>
            <button onClick={() => { setDone(false); setAmount(""); setDest(""); }} style={{ padding: "10px 18px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 7, cursor: "pointer" }}>New Withdraw</button>
          </div>
        </div>
      </FarmerLayout>
    );
  }

  return (
    <FarmerLayout title="Withdraw">
      <div style={{ maxWidth: 560, display: "grid", gap: 16 }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Withdraw</h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Transfer tokens from your CaRo wallet to MetaMask</div>
        </div>

        <div style={{ background: "#141f2e", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: 24, display: "grid", gap: 18 }}>

          {/* Token select */}
          <div>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Select Token</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["CR1", "CR2", "CR3"].map(t => {
                const av = Number(bals[t]?.available_balance || 0);
                return (
                  <button key={t} onClick={() => { setToken(t); setAmount(""); }}
                    style={{ flex: 1, padding: "10px 8px", background: token === t ? "rgba(0,212,170,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${token === t ? "rgba(0,212,170,0.4)" : "rgba(255,255,255,0.06)"}`, borderRadius: 7, cursor: "pointer", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: token === t ? C.accent : "#e2e8f0" }}>{t}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{av > 0 ? av.toLocaleString() + " kg" : "Empty"}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Amount (kg)</label>
              <div style={{ fontSize: 12, color: C.muted }}>Available: <span style={{ color: C.accent, fontWeight: 600 }}>{avail.toLocaleString()} kg</span></div>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                min="0" max={avail} step="0.01"
                placeholder="0.00"
                style={{ width: "100%", padding: "12px 70px 12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${amt > avail ? "rgba(246,70,93,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, color: "#e2e8f0", fontSize: 16, outline: "none", boxSizing: "border-box", fontWeight: 600 }}
              />
              <button onClick={() => setAmount(String(avail))}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,212,170,0.12)", border: "none", color: C.accent, padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                MAX
              </button>
            </div>
            {amt > avail && avail > 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Insufficient balance</div>}
          </div>

          {/* Destination */}
          <div>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Destination Address (MetaMask)</label>
            <input
              value={dest} onChange={e => setDest(e.target.value)}
              placeholder="0x..."
              style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${dest && !isValidAddr ? "rgba(246,70,93,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 8, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
            />
            {dest && !isValidAddr && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Invalid Ethereum address</div>}
            {dest && isValidAddr && <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>✓ Valid address</div>}
          </div>

          {/* Fee summary */}
          {amt > 0 && (
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { label: "Amount",        value: `${amt.toLocaleString("vi-VN")} ${token}` },
                { label: "Fee (0.1%)",    value: `-${fee.toFixed(4)} ${token}`, color: C.red },
                { label: "You'll receive",value: `${netAmt.toLocaleString("vi-VN")} ${token}`, color: C.green, bold: true },
                { label: "Est. value",    value: `≈ ${estVnd.toLocaleString("vi-VN")} ₫`, color: C.muted },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: r.bold ? 700 : 400, color: r.color || "#e2e8f0" }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {err && <div style={{ padding: "10px 14px", background: "rgba(246,70,93,0.08)", border: "1px solid rgba(246,70,93,0.2)", borderRadius: 7, fontSize: 13, color: C.red }}>{err}</div>}

          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ width: "100%", padding: "13px 20px", background: canSubmit ? C.accent : "rgba(255,255,255,0.05)", color: canSubmit ? "#000" : C.muted, border: "none", borderRadius: 8, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 15, transition: "all 0.15s" }}>
            {submitting ? "Processing…" : `Withdraw ${amt > 0 ? amt.toLocaleString() + " " + token : ""}`}
          </button>
        </div>

        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, padding: "0 4px" }}>
          ⚠️ Withdrawals are processed on the Sepolia testnet. Ensure your MetaMask is connected to the correct network. Transactions are irreversible.
        </div>

        <button onClick={() => nav("/farmer/wallet")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, textAlign: "left" }}>← Back to Wallet</button>

      </div>
    </FarmerLayout>
  );
}
