import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import axios from "../utils/axiosClient";
import { formatNumber, formatVND, formatKg, formatToken } from '../utils/formatters';

const C = { accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d", gold: "#f0b90b", card: "#172524", border: "rgba(72, 117, 115, 0.15)", tealLight: "#7fe0c9" };
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
      setErr(e?.response?.data?.message || "Rút tiền thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <FarmerLayout title="Rút tiền">
        <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Yêu cầu rút tiền đã được gửi</h2>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
            Yêu cầu rút <strong style={{ color: C.tealLight }}>{formatToken(amt, token)}</strong> của bạn đã được đưa vào hàng đợi.<br />
            Bạn sẽ nhận được token tại địa chỉ ví <strong style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{dest}</strong> sau khi hoàn thành.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => nav("/farmer/wallet/history")} style={{ padding: "10px 22px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, cursor: "pointer" }}>Lịch sử giao dịch</button>
            <button onClick={() => { setDone(false); setAmount(""); setDest(""); }} style={{ padding: "10px 18px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)", color: "#e2e8f0", borderRadius: 7, cursor: "pointer" }}>Rút tiền mới</button>
          </div>
        </div>
      </FarmerLayout>
    );
  }

  return (
    <FarmerLayout title="Rút tiền">
      <div style={{ width: "100%", display: "grid", gap: 16 }}>

        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Rút tiền</h2>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Chuyển đổi token từ ví sàn CaRo về ví MetaMask cá nhân</div>
        </div>

        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 24, display: "grid", gap: 18 }}>

          {/* Token select */}
          <div>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Chọn Token</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["CR1", "CR2", "CR3"].map(t => {
                const av = Number(bals[t]?.available_balance || 0);
                return (
                  <button key={t} onClick={() => { setToken(t); setAmount(""); }}
                    style={{ flex: 1, padding: "10px 8px", background: token === t ? "rgba(72,117,115,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${token === t ? C.tealLight : C.border}`, borderRadius: 7, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: token === t ? C.tealLight : "#e2e8f0" }}>{t}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{av > 0 ? formatKg(av) : "Chưa có"}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Số lượng (kg)</label>
              <div style={{ fontSize: 12, color: C.muted }}>Khả dụng: <span style={{ color: C.tealLight, fontWeight: 600 }}>{formatKg(avail)}</span></div>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                min="0" max={avail} step="0.01"
                placeholder="0.00"
                style={{ width: "100%", padding: "12px 70px 12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${amt > avail ? "rgba(246,70,93,0.4)" : C.border}`, borderRadius: 8, color: "#e2e8f0", fontSize: 16, outline: "none", boxSizing: "border-box", fontWeight: 600 }}
              />
              <button onClick={() => setAmount(String(avail))}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(72,117,115,0.15)", border: "none", color: C.tealLight, padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                TỐI ĐA
              </button>
            </div>
            {amt > avail && avail > 0 && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Số dư khả dụng không đủ</div>}
          </div>

          {/* Destination */}
          <div>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Địa chỉ ví nhận (MetaMask)</label>
            <input
              value={dest} onChange={e => setDest(e.target.value)}
              placeholder="0x..."
              style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${dest && !isValidAddr ? "rgba(246,70,93,0.4)" : C.border}`, borderRadius: 8, color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
            />
            {dest && !isValidAddr && <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Địa chỉ ví Ethereum không hợp lệ</div>}
            {dest && isValidAddr && <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>✓ Địa chỉ ví hợp lệ</div>}
          </div>

          {/* Fee summary */}
          {amt > 0 && (
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              {[
                { label: "Số lượng rút",        value: formatToken(amt, token) },
                { label: "Phí rút (0.1%)",      value: `-${formatToken(Math.round(fee), token)}`, color: C.red },
                { label: "Thực nhận",           value: formatToken(netAmt, token), color: C.green, bold: true },
                { label: "Giá trị ước tính",    value: `≈ ${formatVND(estVnd)}`, color: C.muted },
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
            style={{ width: "100%", padding: "13px 20px", background: canSubmit ? C.accent : "rgba(255,255,255,0.05)", color: canSubmit ? "#fff" : C.muted, border: "none", borderRadius: 8, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 15, transition: "all 0.15s" }}>
            {submitting ? "Đang xử lý..." : `Rút ${amt > 0 ? formatToken(amt, token) : ""}`}
          </button>
        </div>

        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, padding: "0 4px" }}>
          ⚠️ Giao dịch rút tiền được xử lý trên mạng thử nghiệm Sepolia. Hãy đảm bảo ví MetaMask của bạn được kết nối đúng mạng. Giao dịch blockchain không thể hoàn tác.
        </div>

        <button onClick={() => nav("/farmer/wallet")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, textAlign: "left" }}>← Quay lại ví</button>

      </div>
    </FarmerLayout>
  );
}
