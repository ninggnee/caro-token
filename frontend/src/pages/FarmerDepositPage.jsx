import { useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import FarmerLayout from "../components/layout/FarmerLayout";
import { useAuth } from "../context/AuthContext";
import { getMyDeposits } from "../services/walletApi";
import { formatVND, formatToken } from '../utils/formatters';
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { CA_RO_CONTRACTS, ABI } from "../config/config";
import axios from "../utils/axiosClient";

const STATUS_COLOR = { pending: "caro-badge-warning", approved: "caro-badge-success", rejected: "caro-badge-danger" };
const STATUS_LABEL = { pending: "⏳ Chờ duyệt", approved: "✓ Đã duyệt", rejected: "✗ Từ chối" };

const C = {
  accent: "#408A71", muted: "#6b7a99", green: "#B0E4CC", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#B0E4CC",
  gold: "#f0b90b",
};

const PAYMENT_METHODS = [
  { key: 'vietqr',       label: 'VietQR',      color: '#005BAC', bg: 'rgba(0,91,172,0.08)',    badge: 'QR',  desc: 'Quét mã QR qua ứng dụng ngân hàng' },
  { key: 'bank_transfer',label: 'Chuyển khoản',color: '#1a73e8', bg: 'rgba(26,115,232,0.08)', badge: 'CK',  desc: 'Chuyển khoản ngân hàng trực tiếp' },
  { key: 'vnpay',        label: 'VNPay',        color: '#e40000', bg: 'rgba(228,0,0,0.08)',     badge: 'VN',  desc: 'Ví điện tử & cổng thanh toán VNPay' },
  { key: 'momo',         label: 'MoMo',         color: '#ae2070', bg: 'rgba(174,32,112,0.08)', badge: 'MM',  desc: 'Ví MoMo – Thanh toán siêu tốc' },
  { key: 'zalopay',      label: 'ZaloPay',      color: '#0068ff', bg: 'rgba(0,104,255,0.08)',   badge: 'ZP',  desc: 'Ví ZaloPay – Thanh toán dễ dàng' },
  { key: 'atm_card',     label: 'Thẻ ATM',      color: '#2c7a4b', bg: 'rgba(44,122,75,0.08)',   badge: 'ATM', desc: 'Thẻ ATM / nội địa ngân hàng Việt Nam' },
];

const METHOD_LABEL = Object.fromEntries(PAYMENT_METHODS.map(m => [m.key, m.label]));

// ── Processing screen — 30-second auto-countdown ─────────────────────────────
function ProcessingScreen({ amount, method, onAutoSubmit, loading, error, title }) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [fired, setFired] = useState(false);
  const m = PAYMENT_METHODS.find(x => x.key === method) || PAYMENT_METHODS[0];

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
        <div style={{ width: 44, height: 44, borderRadius: 10, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{m.badge}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{m.label}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Số tiền: <strong style={{ color: C.green }}>{formatVND(amount)}</strong></div>
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
          {loading ? 'Đang xác nhận...' : (title || 'Đang xử lý thanh toán...')}
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#e2e8f0', letterSpacing: 0, marginBottom: 8 }}>
            {'█'.repeat(filled) + '░'.repeat(BARS - filled)} {pct}%
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${m.color}, ${C.tealLight})`, borderRadius: 4, transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {secondsLeft > 0 ? `${secondsLeft} giây còn lại...` : 'Hoàn tất — đang xác nhận...'}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
          Vui lòng không tắt trang trong khi đang xử lý
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
  const m = PAYMENT_METHODS.find(x => x.key === result.payment_method) || PAYMENT_METHODS[0];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid rgba(14,203,129,0.3)`, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginBottom: 6 }}>Giao dịch thành công!</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#e2e8f0', marginBottom: 4 }}>
          +{formatVND(result.amount)}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>đã được cộng vào số dư VND</div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Chi tiết giao dịch
        </div>
        <div style={{ padding: '0 18px' }}>
          {[
            ['Mã giao dịch', result.transaction_code],
            ['Số tiền nạp', formatVND(result.amount)],
            ['Phương thức', m.label],
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
        Quay lại ví
      </button>
    </div>
  );
}

export default function FarmerDepositPage() {
  const nav = useNavigate();
  const qc  = useQueryClient();
  const { user } = useAuth();
  const { account, connect, provider } = useWallet();

  const [depType, setDepType] = useState("vnd"); // "vnd" | "token"
  const [tab,    setTab]    = useState("form"); // "form" | "history" | "guide"
  const [historyFilter, setHistoryFilter] = useState("all"); // "all" | "vnd" | "token"
  const [guideFilter, setGuideFilter] = useState("vnd"); // "vnd" | "token"

  // VND simulation state
  const [depStep,   setDepStep]   = useState('input');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('');
  const [depResult, setDepResult] = useState(null);

  // Token fields
  const [token, setToken] = useState("CR1");
  const [tokAmount, setTokAmount] = useState("");
  const [tokSubmitting, setTokSubmitting] = useState(false);
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
  const amt = Number(tokAmount) || 0;
  const canSubmitToken = amt > 0 && amt <= avail && account && !tokSubmitting;

  // Fetch deposit history
  const { data: depData, isLoading: depLoading } = useQuery({
    queryKey: ["my-deposits"],
    queryFn: getMyDeposits,
    enabled: tab === "history",
  });
  const deposits = depData?.data || [];

  // Simulate deposit mutation
  const simulateMut = useMutation({
    mutationFn: ({ amount, payment_method }) =>
      axios.post('/wallet/simulate-deposit', { amount: Number(amount), payment_method }).then(r => r.data),
    onSuccess: (data) => {
      setDepResult(data);
      setDepStep('success');
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
      qc.invalidateQueries({ queryKey: ["vnd-wallet"] });
    },
    onError: (e) => {
      alert(e?.response?.data?.message || 'Lỗi xử lý. Vui lòng thử lại.');
    },
  });

  const handleTokenDeposit = async () => {
    if (!account) { toast.error("Vui lòng kết nối ví MetaMask"); return; }
    const amt = Number(tokAmount);
    if (!amt || amt <= 0) { toast.error("Số lượng phải lớn hơn 0"); return; }
    if (amt > Number(metaMaskBal)) { toast.error("Số dư MetaMask không đủ"); return; }

    setTokSubmitting(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CA_RO_CONTRACTS[token], ABI, signer);
      const decimals = await contract.decimals().catch(() => 18);
      const amountWei = ethers.utils.parseUnits(String(tokAmount), decimals);

      const treasuryAddress = "0x0EcBEcFDb336A1B56D8f9cFD634844d0Efd70Cf4";
      const tx = await contract.transfer(treasuryAddress, amountWei);
      toast.info("Đang xử lý giao dịch trên blockchain...");
      
      const receipt = await tx.wait();
      if (receipt.status === 0) {
        throw new Error("Giao dịch blockchain bị đảo ngược (reverted).");
      }

      await axios.post("/wallet/deposit-token", {
        token_type: token,
        amount: amt,
        tx_hash: tx.hash
      });

      toast.success(`Nạp ${tokAmount} ${token} thành công!`);
      setTokAmount("");
      qc.invalidateQueries({ queryKey: ["my-deposits"] });
      qc.invalidateQueries({ queryKey: ["farmer-token-holdings-wallet"] });
      qc.invalidateQueries({ queryKey: ["vnd-wallet"] });
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || e.message || "Nạp token thất bại");
    } finally {
      setTokSubmitting(false);
    }
  };

  const switchTab = (t) => {
    setTab(t);
    if (t !== 'form') {
      setDepStep('input');
      setDepAmount('');
      setDepMethod('');
      setDepResult(null);
    }
  };

  const PRESET_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

  return (
    <FarmerLayout title="Nạp">
      <div className="caro-page" style={{ maxWidth: 900 }}>

        <div className="caro-page-header" style={{ marginBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="caro-page-title">⬇️ Nạp</h2>
            <p className="caro-page-subtitle" style={{ margin: 0 }}>Nạp VND hoặc Token vào ví nội bộ</p>
          </div>
          <div style={{ display: "flex", gap: 8, background: "var(--card-bg)", borderRadius: 12, padding: 6, border: "1px solid var(--border)" }}>
            {[
              { key: "form",    label: "Nạp" },
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
          <div style={{ display: "grid", gap: 24 }}>
            {/* Sub-tabs for selecting Token or VND deposit */}
            <div style={{ display: "flex", gap: 12, background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 12, width: "fit-content" }}>
              <button 
                onClick={() => setDepType("vnd")} 
                className={`caro-btn caro-btn-sm ${depType === "vnd" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                style={{ padding: "10px 24px", fontSize: 13 }}
              >
                💵 Nạp VND
              </button>
              <button 
                onClick={() => setDepType("token")} 
                className={`caro-btn caro-btn-sm ${depType === "token" ? "caro-btn-secondary" : "caro-btn-ghost"}`}
                style={{ padding: "10px 24px", fontSize: 13 }}
              >
                🪙 Nạp Token
              </button>
            </div>

            {depType === "vnd" ? (
              <div>
                {/* ── STEP 1: Input ── */}
                {depStep === 'input' && (
                  <div style={{ display: 'grid', gap: 20 }}>
                    {/* Step indicator */}
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      {[['1', 'Nhập số tiền'], ['2', 'Xác nhận'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                        <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 0 ? 'rgba(72,117,115,0.18)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? C.tealLight : C.muted }}>{n}. {lbl}</div>
                        </div>
                      ))}
                    </div>

                    {/* Amount Input */}
                    <div className="caro-card" style={{ display: 'grid', gap: 14 }}>
                      <h3 className="caro-section-title">💵 Số tiền nạp</h3>
                      <div className="caro-field">
                        <input
                          type="number" min="0" step="1000" value={depAmount}
                          onChange={e => setDepAmount(e.target.value)}
                          placeholder="Nhập số tiền..."
                          className="caro-input"
                          style={{ fontSize: 16, fontWeight: 600 }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Nạp nhanh:</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {PRESET_AMOUNTS.map(amt => (
                            <button key={amt} onClick={() => setDepAmount(String(amt))}
                              className="caro-btn caro-btn-sm"
                              style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600,
                                background: depAmount === String(amt) ? 'rgba(72,117,115,0.2)' : 'rgba(255,255,255,0.05)',
                                borderColor: depAmount === String(amt) ? C.accent : 'var(--border)',
                                color: depAmount === String(amt) ? C.tealLight : '#e2e8f0' }}>
                              {formatVND(amt)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Payment methods */}
                    <div className="caro-card">
                      <h3 className="caro-section-title" style={{ marginBottom: 14 }}>🏦 Phương thức nạp tiền</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {PAYMENT_METHODS.map(m => {
                          const sel = depMethod === m.key;
                          return (
                            <button key={m.key} onClick={() => setDepMethod(m.key)}
                              style={{ padding: '14px 10px', border: `2px solid ${sel ? m.color : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: sel ? m.bg : 'rgba(255,255,255,0.03)', transition: 'all 0.15s', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900 }}>
                                {m.badge}
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: sel ? m.color : '#e2e8f0' }}>{m.label}</div>
                              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{m.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!depAmount || Number(depAmount) < 1000) return;
                        if (!depMethod) return;
                        setDepStep('processing');
                      }}
                      disabled={!depAmount || Number(depAmount) < 1000 || !depMethod}
                      className="caro-btn caro-btn-primary"
                      style={{ padding: '14px 0', width: '100%', fontSize: 15 }}>
                      {!depMethod ? 'Chọn phương thức thanh toán' : !depAmount || Number(depAmount) < 1000 ? 'Nhập số tiền (tối thiểu 1.000 VND)' : `Nạp tiền ${formatVND(Number(depAmount))}`}
                    </button>
                  </div>
                )}

                {/* ── STEP 2: Processing ── */}
                {depStep === 'processing' && (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      {[['1', 'Nhập số tiền'], ['2', 'Đang xử lý'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                        <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 1 ? 'rgba(72,117,115,0.18)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: i === 1 ? C.tealLight : C.muted }}>{n}. {lbl}</div>
                        </div>
                      ))}
                    </div>
                    <ProcessingScreen
                      amount={Number(depAmount)}
                      method={depMethod}
                      loading={simulateMut.isPending || simulateMut.isLoading}
                      error={simulateMut.isError ? (simulateMut.error?.response?.data?.message || 'Lỗi xử lý') : null}
                      onAutoSubmit={() => simulateMut.mutate({ amount: depAmount, payment_method: depMethod })}
                    />
                  </div>
                )}

                {/* ── STEP 3: Success ── */}
                {depStep === 'success' && depResult && (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      {[['1', 'Nhập số tiền'], ['2', 'Đang xử lý'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                        <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 2 ? 'rgba(14,203,129,0.12)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: i === 2 ? C.green : C.muted }}>{n}. {lbl}</div>
                        </div>
                      ))}
                    </div>
                    <SuccessScreen
                      result={depResult}
                      onDone={() => {
                        setDepStep('input');
                        setDepAmount('');
                        setDepMethod('');
                        setDepResult(null);
                        switchTab('history');
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="caro-card" style={{ display: "grid", gap: 24 }}>
                <div>
                  <h3 className="caro-section-title">Nạp Token từ MetaMask</h3>
                  <p className="caro-section-subtitle">Chuyển token từ ví MetaMask cá nhân của bạn vào ví sàn giao dịch nội bộ CaRo.</p>
                </div>

                <div style={{ display: "grid", gap: 20 }}>
                  {/* Token selector */}
                  <div className="caro-field">
                    <label className="caro-label">Chọn loại Token</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      {["CR1", "CR2", "CR3"].map(t => (
                        <button key={t} onClick={() => setToken(t)}
                          className={`caro-btn ${token === t ? 'caro-btn-secondary' : 'caro-btn-ghost'}`}
                          style={{ flex: 1, padding: "12px", fontSize: 14 }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* MetaMask balance */}
                  <div style={{ background: "rgba(176, 228, 204,0.05)", border: "1px solid rgba(176, 228, 204,0.2)", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Số dư trong ví MetaMask:</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#B0E4CC", fontFamily: "monospace" }}>{formatToken(avail, token)}</span>
                  </div>

                  {/* MetaMask link status */}
                  <div className="caro-field">
                    <label className="caro-label">Nạp về tài khoản sàn</label>
                    <input
                      className="caro-input"
                      value={account ? `Ví MetaMask liên kết: ${account.slice(0,10)}...${account.slice(-4)}` : ""}
                      readOnly disabled placeholder="Chưa kết nối ví MetaMask"
                      style={{ opacity: 0.7, fontFamily: "monospace" }}
                    />
                    {!account && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8, fontWeight: 600 }}>⚠️ Vui lòng kết nối ví MetaMask để thực hiện nạp token</div>}
                  </div>

                  {/* Amount input */}
                  <div className="caro-field">
                    <label className="caro-label">Số lượng nạp <span style={{ color: "#ef4444" }}>*</span></label>
                    <input type="number" className="caro-input" value={tokAmount} onChange={e => setTokAmount(e.target.value)} placeholder="Ví dụ: 50.0" />
                  </div>

                  {!account ? (
                    <button onClick={connect} className="caro-btn" style={{ width: "100%", padding: "14px 20px", background: "#f0b90b", color: "#000", fontSize: 15 }}>
                      🦊 Kết nối ví MetaMask
                    </button>
                  ) : (
                    <button onClick={handleTokenDeposit} disabled={!canSubmitToken}
                      className={`caro-btn ${canSubmitToken ? 'caro-btn-primary' : 'caro-btn-ghost'}`}
                      style={{ width: "100%", padding: "14px 20px", fontSize: 15 }}>
                      {tokSubmitting ? "Đang xử lý..." : `Nạp ${tokAmount ? `${tokAmount} ${token}` : "Token"}`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: History ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="caro-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <h3 className="caro-section-title" style={{ margin: 0 }}>📋 Lịch Sử Nạp</h3>
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
            {depLoading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Đang tải...</div>
            ) : deposits.length === 0 ? (
              <div className="caro-empty">
                <div className="caro-empty-icon">📭</div>
                <div className="caro-empty-title">Chưa có yêu cầu nạp nào</div>
              </div>
            ) : (
              <div>
                {deposits
                  .filter(d => {
                    if (historyFilter === "vnd") return !d.token_type;
                    if (historyFilter === "token") return !!d.token_type;
                    return true;
                  })
                  .map(d => (
                    <div key={d.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#B0E4CC", fontFamily: "monospace" }}>
                          {d.token_type ? `+${d.amount} ${d.token_type}` : `+${formatVND(d.amount)}`}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                          {new Date(d.created_at).toLocaleString("vi-VN")}
                          {d.token_type && <span style={{ marginLeft: 10, color: "#f0b90b", fontFamily: "monospace", fontSize: 12 }}>• Tx: {d.tx_hash?.slice(0, 10)}...</span>}
                          {!d.token_type && d.payment_method && <span style={{ marginLeft: 10, color: "#408A71", fontWeight: 600 }}>• {METHOD_LABEL[d.payment_method]}</span>}
                          {d.note && <span style={{ marginLeft: 10, color: "#64748b" }}>• {d.note}</span>}
                        </div>
                      </div>
                      <span className={`caro-badge ${STATUS_COLOR[d.status] || "caro-badge-muted"}`}>
                        {STATUS_LABEL[d.status] || d.status}
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
              <h3 className="caro-section-title" style={{ margin: 0 }}>Hướng Dẫn Nạp</h3>
              <div style={{ display: "flex", gap: 6, background: "rgba(0,0,0,0.15)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
                {[
                  { key: "vnd",   label: "Nạp VND" },
                  { key: "token", label: "Nạp Token (MetaMask)" },
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
                  { n: "1", icon: "💵", title: "Nhập số tiền & chọn phương thức", desc: "Nhập số tiền muốn nạp (tối thiểu 1,000 VND) và chọn phương thức thanh toán VietQR, Momo, v.v." },
                  { n: "2", icon: "⏳", title: "Xác nhận & Chờ đếm ngược", desc: "Hệ thống sẽ tiến hành kết nối cổng thanh toán mô phỏng trong vòng 30 giây." },
                  { n: "3", icon: "✅", title: "Nạp tiền thành công", desc: "Giao dịch mô phỏng hoàn tất ngay lập tức, số dư VND của bạn sẽ tự động được cộng vào ví." },
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
                  { n: "1", icon: "🦊", title: "Kết nối MetaMask", desc: "Đảm bảo bạn đã kết nối ví MetaMask cá nhân và chuyển sang mạng thử nghiệm Sepolia." },
                  { n: "2", icon: "🪙", title: "Chọn loại Token & Số lượng", desc: "Chọn CR1, CR2 hoặc CR3, nhập số lượng token muốn chuyển vào ví sàn giao dịch nội bộ." },
                  { n: "3", icon: "🔑", title: "Ký giao dịch", desc: "Nhấn nút 'Nạp Token', cửa sổ MetaMask sẽ xuất hiện để bạn ký xác nhận chuyển token đến địa chỉ kho bạc." },
                  { n: "4", icon: "⚡", title: "Xử lý on-chain & Cập nhật số dư", desc: "Sau khi giao dịch được xác nhận trên blockchain, hệ thống sẽ tự động cập nhật số dư khả dụng nội bộ ngay lập tức." },
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
