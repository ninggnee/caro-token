import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import axios from "../utils/axiosClient";
import { formatVND, formatToken, formatNumber } from '../utils/formatters';
import { useWallet } from "../context/WalletContext";

const PRICE = { CR1: 100_000, CR2: 85_000, CR3: 70_000 };
const FEE_RATE = 0; // 0% fee

const STATUS_COLOR = { pending: "caro-badge-warning", approved: "caro-badge-success", rejected: "caro-badge-danger" };
const STATUS_LABEL = { pending: "⏳ Chờ duyệt", approved: "✓ Đã duyệt", rejected: "✗ Từ chối" };

const C = {
  accent: "#408A71", muted: "#6b7a99", green: "#B0E4CC", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#B0E4CC",
  gold: "#f0b90b",
};

function useWithdraws(enabled) {
  return useQuery({
    queryKey: ["my-withdraws"],
    queryFn: () => axios.get("/wallet/withdraw").then(r => r.data),
    enabled,
  });
}

function useBalances() {
  return useQuery({
    queryKey: ["token-balances"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 30_000,
  });
}

function useVndWallet() {
  return useQuery({
    queryKey: ["vnd-wallet"],
    queryFn: () => axios.get("/wallet/balance").then(r => r.data),
    staleTime: 15_000,
  });
}

// ── Processing screen — 30-second auto-countdown ─────────────────────────────
function ProcessingScreen({ amount, bankName, onAutoSubmit, loading, error }) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    if (fired) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setFired(true);
          onAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fired, onAutoSubmit]);

  const pct = Math.min(100, Math.round(((30 - secondsLeft) / 30) * 100));
  const BARS = 24;
  const filled = Math.round((pct / 100) * BARS);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 900, flexShrink: 0 }}>🏦</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>Rút tiền về {bankName}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Số tiền: <strong style={{ color: C.red }}>-{formatVND(amount)}</strong></div>
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
          {loading ? 'Đang gửi yêu cầu rút...' : 'Đang xử lý giao dịch...'}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#e2e8f0', letterSpacing: 0, marginBottom: 8 }}>
            {'█'.repeat(filled) + '░'.repeat(BARS - filled)} {pct}%
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.tealLight})`, borderRadius: 4, transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {secondsLeft > 0 ? `${secondsLeft} giây còn lại...` : 'Hoàn tất — đang xử lý...'}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
          Vui lòng không đóng trang trong khi yêu cầu đang được xử lý
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.3)', borderRadius: 8, fontSize: 13, color: C.red }}>
          {error}
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ result, onDone }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid rgba(14,203,129,0.3)`, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginBottom: 6 }}>Yêu cầu rút thành công!</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#e2e8f0', marginBottom: 4 }}>
          {formatVND(result.amount)}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>đang được xử lý chuyển khoản</div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Chi tiết giao dịch
        </div>
        <div style={{ padding: '0 18px' }}>
          {[
            ['Mã giao dịch', result.transaction_code],
            ['Số tiền rút', formatVND(result.amount)],
            ['Ngân hàng nhận', result.bank_name],
            ['Số tài khoản', result.account_number],
            ['Tên thụ hưởng', result.account_name],
            ['Trạng thái', 'Thành công'],
            ['Thời gian', new Date().toLocaleString('vi-VN')],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.muted }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: k === 'Mã giao dịch' ? C.tealLight : k === 'Trạng thái' ? C.green : '#e2e8f0', fontFamily: k === 'Mã giao dịch' ? 'monospace' : 'inherit' }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onDone} className="caro-btn caro-btn-primary" style={{ width: "100%", padding: '13px 0' }}>
        Quay lại lịch sử
      </button>
    </div>
  );
}

export default function FarmerWithdrawPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const balQ = useBalances();
  const vndQ = useVndWallet();
  const { account, connect } = useWallet();

  const [wdType, setWdType] = useState("token"); // "token" | "vnd"
  const [tab, setTab] = useState("form"); // "form" | "history" | "guide"
  const [historyFilter, setHistoryFilter] = useState("all"); // "all" | "vnd" | "token"
  const [guideFilter, setGuideFilter] = useState("vnd"); // "vnd" | "token"

  // Token fields
  const [token, setToken] = useState("CR1");
  const [amount, setAmount] = useState("");
  const [dest, setDest] = useState("");

  // VND fields
  const [vndAmount, setVndAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accNum, setAccNum] = useState("");
  const [accName, setAccName] = useState("");

  // Simulated VND withdraw states
  const [wdStep, setWdStep] = useState('input');
  const [wdResult, setWdResult] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // Fetch withdraw history
  const { data: wdData, isLoading: wdLoading } = useWithdraws(tab === "history");
  const withdraws = wdData?.data || [];

  useEffect(() => {
    if (account) {
      setDest(account);
    } else {
      setDest("");
    }
  }, [account]);

  const bals = balQ.data?.balances || {};
  const avail = Number(bals[token]?.available || 0);
  const amt = Number(amount) || 0;
  const fee = amt * FEE_RATE;
  const netAmt = amt - fee;
  const estVnd = netAmt * PRICE[token];

  const vndWallet = vndQ.data ?? {};
  const vndAvailable = Number(vndWallet.available ?? vndWallet.vnd_available ?? 0);

  const isValidAddr = /^0x[0-9a-fA-F]{40}$/.test(dest);
  const isVndValid = Number(vndAmount) > 0 && Number(vndAmount) <= vndAvailable && bankName.trim() && accNum.trim() && accName.trim();
  const canSubmit = wdType === "token"
    ? (amt > 0 && amt <= avail && account && isValidAddr && !submitting)
    : (isVndValid && !submitting);

  // Simulated withdraw mutation
  const simulateWithdrawMut = useMutation({
    mutationFn: ({ amount, bank_name, account_number, account_name }) =>
      axios.post('/wallet/simulate-withdraw', { amount: Number(amount), payment_method: 'bank_transfer', bank_name, account_number, account_name }).then(r => r.data),
    onSuccess: (data) => {
      setWdResult(data);
      setWdStep('success');
      qc.invalidateQueries({ queryKey: ["token-balances"] });
      qc.invalidateQueries({ queryKey: ["vnd-wallet"] });
      qc.invalidateQueries({ queryKey: ["farmer-dashboard-wallet"] });
      qc.invalidateQueries({ queryKey: ["my-withdraws"] });
    },
    onError: (e) => {
      setErr(e?.response?.data?.message || "Rút tiền thất bại. Vui lòng thử lại.");
      setWdStep('input');
    }
  });

  const handleSubmit = async () => {
    setErr("");
    if (!canSubmit) return;

    if (wdType === "token") {
      setSubmitting(true);
      try {
        await axios.post("/wallet/withdraw", { token_type: token, amount: amt, destination_address: dest });
        qc.invalidateQueries({ queryKey: ["token-balances"] });
        qc.invalidateQueries({ queryKey: ["vnd-wallet"] });
        qc.invalidateQueries({ queryKey: ["farmer-dashboard-wallet"] });
        setDone(true);
      } catch (e) {
        setErr(e?.response?.data?.message || "Rút tiền thất bại. Vui lòng thử lại.");
      } finally {
        setSubmitting(false);
      }
    } else {
      setWdStep('processing');
    }
  };

  const switchTab = (t) => {
    setTab(t);
    if (t !== 'form') {
      setWdStep('input');
      setVndAmount('');
      setBankName('');
      setAccNum('');
      setAccName('');
      setWdResult(null);
      setDone(false);
    }
  };

  return (
    <FarmerLayout title="Rút">
      <div className="caro-page" style={{ maxWidth: 900 }}>

        <div className="caro-page-header" style={{ marginBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="caro-page-title">💸 Rút</h2>
            <p className="caro-page-subtitle" style={{ margin: 0 }}>Yêu cầu rút tài sản khả dụng về ví MetaMask hoặc tài khoản ngân hàng</p>
          </div>
          <div style={{ display: "flex", gap: 8, background: "var(--card-bg)", borderRadius: 12, padding: 6, border: "1px solid var(--border)" }}>
            {[
              { key: "form",    label: "Rút" },
              { key: "history", label: "Lịch sử" },
              { key: "guide",   label: "Hướng dẫn" },
            ].map(t => (
              <button key={t.key} onClick={() => switchTab(t.key)}
                className={`caro-btn caro-btn-sm ${tab === t.key ? "caro-btn-primary" : "caro-btn-ghost"}`}
                style={{ padding: "8px 20px" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── TAB: Form ────────────────────────────────────────────────────── */}
        {tab === "form" && (
          done ? (
            <div style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }} className="caro-card">
              <div style={{ fontSize: 56, marginBottom: 20 }}>✅</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, color: "#f8fafc" }}>Yêu cầu rút đã được gửi</h2>
              <div style={{ fontSize: 15, color: "#94a3b8", marginBottom: 32, lineHeight: 1.6 }}>
                Yêu cầu rút <strong style={{ color: "#408A71" }}>{formatToken(amt, token)}</strong> của bạn đã hoàn thành.<br />
                Token đã được chuyển đến địa chỉ ví <strong style={{ color: "#f8fafc", wordBreak: "break-all" }}>{dest}</strong>.
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => nav("/farmer/wallet")} className="caro-btn caro-btn-primary">Xem Ví tài khoản</button>
                <button onClick={() => { setDone(false); setAmount(""); setVndAmount(""); setBankName(""); setAccNum(""); setAccName(""); }} className="caro-btn caro-btn-ghost">Rút mới</button>
              </div>
            </div>
          ) : (
            <div className="caro-card" style={{ display: "grid", gap: 24 }}>
              {/* Sub-tabs for selecting Token or VND withdraw */}
              <div style={{ display: "flex", gap: 12, background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 12, width: "fit-content", marginBottom: 12 }}>
                <button 
                  onClick={() => { setWdType("token"); setErr(""); }}
                  className={`caro-btn caro-btn-sm ${wdType === "token" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                  style={{ padding: "10px 24px", fontSize: 13 }}
                >
                  🪙 Rút Token
                </button>
                <button 
                  onClick={() => { setWdType("vnd"); setErr(""); }}
                  className={`caro-btn caro-btn-sm ${wdType === "vnd" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                  style={{ padding: "10px 24px", fontSize: 13 }}
                >
                  💵 Rút VND
                </button>
              </div>

              {wdType === "token" ? (
                <>
                  {/* Token select */}
                  <div className="caro-field">
                    <label className="caro-label">Chọn Token</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      {["CR1", "CR2", "CR3"].map(t => {
                        const av = Number(bals[t]?.available || 0);
                        return (
                          <button key={t} onClick={() => { setToken(t); setAmount(""); }}
                            className={`caro-btn ${token === t ? 'caro-btn-secondary' : 'caro-btn-ghost'}`}
                            style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", height: "auto" }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>{t}</div>
                            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{av > 0 ? formatToken(av, t) : "Chưa có"}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="caro-field">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <label className="caro-label" style={{ marginBottom: 0 }}>Số lượng ({token}) <span style={{ color: "#ef4444" }}>*</span></label>
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>Khả dụng: <span style={{ color: "#408A71", fontWeight: 700 }}>{formatToken(avail, token)}</span></div>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        type="number" className="caro-input" value={amount} onChange={e => setAmount(e.target.value)}
                        min="0" max={avail} step="0.01"
                        placeholder="0.00"
                        style={{ paddingRight: 80, fontSize: 16, fontWeight: 700, borderColor: amt > avail ? "#ef4444" : "var(--border)" }}
                      />
                      <button onClick={() => setAmount(String(avail))}
                        className="caro-btn caro-btn-sm"
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(64, 138, 113,0.15)", color: "#408A71", padding: "4px 8px", fontSize: 11 }}>
                        TỐI ĐA
                      </button>
                    </div>
                    {amt > avail && avail > 0 && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 600 }}>Số dư khả dụng không đủ</div>}
                  </div>

                  {/* Destination */}
                  <div className="caro-field">
                    <label className="caro-label">Địa chỉ ví nhận (MetaMask)</label>
                    <input
                      className="caro-input"
                      value={dest} readOnly disabled placeholder="Vui lòng kết nối ví MetaMask"
                      style={{ opacity: 0.7, fontFamily: "monospace" }}
                    />
                    {!account && <div style={{ fontSize: 12, color: "#f0b90b", marginTop: 8, fontWeight: 600 }}>⚠️ Bạn cần kết nối ví MetaMask để thực hiện rút token</div>}
                    {account && isValidAddr && <div style={{ fontSize: 12, color: "#B0E4CC", marginTop: 8, fontWeight: 600 }}>✓ Ví nhận MetaMask đã kết nối: {account.slice(0, 6)}...{account.slice(-4)}</div>}
                  </div>

                  {/* Fee summary */}
                  {amt > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "16px 20px", border: "1px solid var(--border)" }}>
                      {[
                        { label: "Số lượng rút",        value: formatToken(amt, token) },
                        { label: "Phí rút",             value: "Miễn phí", color: "#B0E4CC" },
                        { label: "Thực nhận",           value: formatToken(netAmt, token), color: "#B0E4CC", bold: true },
                        { label: "Giá trị ước tính",    value: `≈ ${formatVND(estVnd)}`, color: "#94a3b8" },
                      ].map(r => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <span style={{ fontSize: 14, color: "#94a3b8" }}>{r.label}</span>
                          <span style={{ fontSize: 15, fontWeight: r.bold ? 800 : 500, color: r.color || "#f8fafc", fontFamily: "monospace" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {err && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 14, color: "#ef4444" }}>{err}</div>}

                  {!account ? (
                    <button onClick={connect} className="caro-btn" style={{ width: "100%", padding: "14px 20px", background: "#f0b90b", color: "#000", fontSize: 15 }}>
                      🦊 Kết nối ví MetaMask
                    </button>
                  ) : (
                    <button onClick={handleSubmit} disabled={!canSubmit}
                      className={`caro-btn ${canSubmit ? 'caro-btn-primary' : 'caro-btn-ghost'}`}
                      style={{ width: "100%", padding: "14px 20px", fontSize: 15 }}>
                      {submitting ? "Đang xử lý..." : `Rút ${amt > 0 ? formatToken(amt, token) : "Token"}`}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  {/* ── STEP 1: Input ── */}
                  {wdStep === 'input' && (
                    <div style={{ display: 'grid', gap: 20 }}>
                      {/* VND Amount */}
                      <div className="caro-field">
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <label className="caro-label" style={{ marginBottom: 0 }}>Số tiền rút (VND) <span style={{ color: "#ef4444" }}>*</span></label>
                          <div style={{ fontSize: 13, color: "#94a3b8" }}>Khả dụng: <span style={{ color: "#B0E4CC", fontWeight: 700 }}>{formatVND(vndAvailable)}</span></div>
                        </div>
                        <div style={{ position: "relative" }}>
                          <input
                            type="number" className="caro-input" value={vndAmount} onChange={e => setVndAmount(e.target.value)}
                            min="0" max={vndAvailable}
                            placeholder="Nhập số tiền (VND)"
                            style={{ paddingRight: 80, fontSize: 16, fontWeight: 700, borderColor: Number(vndAmount) > vndAvailable ? "#ef4444" : "var(--border)" }}
                          />
                          <button onClick={() => setVndAmount(String(vndAvailable))}
                            className="caro-btn caro-btn-sm"
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(176, 228, 204,0.15)", color: "#B0E4CC", padding: "4px 8px", fontSize: 11 }}>
                            TỐI ĐA
                          </button>
                        </div>
                        {Number(vndAmount) > vndAvailable && vndAvailable > 0 && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6, fontWeight: 600 }}>Số dư khả dụng không đủ</div>}
                      </div>

                      {/* Bank Name */}
                      <div className="caro-field">
                        <label className="caro-label">Tên ngân hàng <span style={{ color: "#ef4444" }}>*</span></label>
                        <input type="text" className="caro-input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ví dụ: Vietcombank" />
                      </div>

                      {/* Account Number */}
                      <div className="caro-field">
                        <label className="caro-label">Số tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                        <input type="text" className="caro-input" value={accNum} onChange={e => setAccNum(e.target.value)} placeholder="Ví dụ: 1029384756" />
                      </div>

                      {/* Account Name */}
                      <div className="caro-field">
                        <label className="caro-label">Tên chủ tài khoản <span style={{ color: "#ef4444" }}>*</span></label>
                        <input type="text" className="caro-input" value={accName} onChange={e => setAccName(e.target.value)} placeholder="Ví dụ: NGUYEN VAN A" />
                      </div>

                      {err && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 14, color: "#ef4444" }}>{err}</div>}

                      <button onClick={handleSubmit} disabled={!canSubmit}
                        className={`caro-btn ${canSubmit ? "caro-btn-danger" : "caro-btn-ghost"}`}
                        style={{ width: "100%", padding: "14px 20px", fontSize: 15 }}>
                        {submitting ? "Đang xử lý..." : `Rút ${vndAmount ? formatVND(Number(vndAmount)) : "VND"}`}
                      </button>
                    </div>
                  )}

                  {/* ── STEP 2: Processing ── */}
                  {wdStep === 'processing' && (
                    <ProcessingScreen
                      amount={Number(vndAmount)}
                      bankName={bankName}
                      loading={simulateWithdrawMut.isPending || simulateWithdrawMut.isLoading}
                      error={simulateWithdrawMut.isError ? (simulateWithdrawMut.error?.response?.data?.message || 'Lỗi xử lý') : null}
                      onAutoSubmit={() => simulateWithdrawMut.mutate({ amount: vndAmount, bank_name: bankName, account_number: accNum, account_name: accName })}
                    />
                  )}

                  {/* ── STEP 3: Success ── */}
                  {wdStep === 'success' && wdResult && (
                    <SuccessScreen
                      result={wdResult}
                      onDone={() => {
                        setWdStep('input');
                        setVndAmount('');
                        setBankName('');
                        setAccNum('');
                        setAccName('');
                        setWdResult(null);
                        switchTab('history');
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <h3 className="caro-section-title" style={{ margin: 0 }}>📋 Lịch Sử Rút</h3>
              <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                {[
                  { key: "all",   label: "Tất cả" },
                  { key: "vnd",   label: "VND" },
                  { key: "token", label: "Token" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setHistoryFilter(opt.key)}
                    className={`caro-btn caro-btn-xs ${historyFilter === opt.key ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                    style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {wdLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Đang tải...</div>
            ) : withdraws.length === 0 ? (
              <div className="caro-empty">
                <div className="caro-empty-icon">📭</div>
                <div className="caro-empty-title">Chưa có yêu cầu rút nào</div>
              </div>
            ) : (
              <div>
                {withdraws
                  .filter(w => {
                    if (historyFilter === "vnd") return !w.token_type;
                    if (historyFilter === "token") return !!w.token_type;
                    return true;
                  })
                  .map(w => (
                    <div key={w.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", fontFamily: "monospace" }}>
                          {w.token_type ? `-${w.amount} ${w.token_type}` : `-${formatVND(w.amount)}`}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                          {new Date(w.created_at).toLocaleString("vi-VN")}
                          {w.token_type && <span style={{ marginLeft: 10, color: "#f0b90b", fontFamily: "monospace", fontSize: 12 }}>• Nhận: {w.destination_address?.slice(0, 10)}...</span>}
                          {!w.token_type && w.bank_name && <span style={{ marginLeft: 10, color: "#408A71", fontWeight: 600 }}>• {w.bank_name} ({w.account_number})</span>}
                          {w.note && <span style={{ marginLeft: 10, color: "#64748b" }}>• {w.note}</span>}
                        </div>
                      </div>
                      <span className={`caro-badge ${STATUS_COLOR[w.status] || "caro-badge-muted"}`}>
                        {STATUS_LABEL[w.status] || w.status}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Guide ───────────────────────────────────────────────────── */}
        {tab === "guide" && (
          <div className="caro-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <h3 className="caro-section-title" style={{ margin: 0 }}>Hướng Dẫn Rút</h3>
              <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                {[
                  { key: "vnd",   label: "Rút VND" },
                  { key: "token", label: "Rút Token (MetaMask)" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setGuideFilter(opt.key)}
                    className={`caro-btn caro-btn-xs ${guideFilter === opt.key ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                    style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6 }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {guideFilter === "vnd" ? (
              <div style={{ display: "grid", gap: 24 }}>
                {[
                  { n: "1", icon: "💵", title: "Nhập thông tin tài khoản ngân hàng", desc: "Nhập số tiền muốn rút, tên ngân hàng, số tài khoản và họ tên chủ tài khoản thụ hưởng chính xác." },
                  { n: "2", icon: "⏳", title: "Gửi yêu cầu & Xác nhận", desc: "Hệ thống giả lập cổng thanh toán sẽ tự động xác minh thông tin tài khoản ngân hàng trong vòng 30 giây." },
                  { n: "3", icon: "✅", title: "Hoàn tất chuyển khoản", desc: "Sau khi xử lý thành công, tiền sẽ được trừ trực tiếp từ số dư VND khả dụng của bạn và gửi về tài khoản ngân hàng." },
                ].map(s => (
                  <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(64, 138, 113,0.1)", border: "1px solid rgba(64, 138, 113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 24 }}>
                {[
                  { n: "1", icon: "🪙", title: "Chọn Token & Số lượng", desc: "Chọn loại token CR1, CR2 hoặc CR3 muốn rút và nhập số lượng (tối đa số dư khả dụng)." },
                  { n: "2", icon: "🦊", title: "Kết nối ví nhận MetaMask", desc: "Đảm bảo bạn đã kết nối ví MetaMask cá nhân của mình để hệ thống tự động điền địa chỉ nhận." },
                  { n: "3", icon: "📤", title: "Gửi yêu cầu rút token", desc: "Kiểm tra kỹ các thông tin (miễn phí rút token) và nhấn nút Gửi yêu cầu rút để hoàn tất." },
                  { n: "4", icon: "✅", title: "Xác nhận & Nhận Token", desc: "Hệ thống kiểm tra và thực hiện chuyển on-chain từ ví tổng sang ví cá nhân của bạn trong vòng vài phút." },
                ].map(s => (
                  <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(64, 138, 113,0.1)", border: "1px solid rgba(64, 138, 113,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button onClick={() => nav("/farmer/wallet")} className="caro-btn caro-btn-ghost" style={{ fontSize: 14 }}>
            ← Quay lại ví
          </button>
        </div>

      </div>
    </FarmerLayout>
  );
}
