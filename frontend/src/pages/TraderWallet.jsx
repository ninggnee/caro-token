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

const C = {
  accent: "#408A71", muted: "#6b7a99", green: "#408A71", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#B0E4CC",
  gold: "#f0b90b",
};
const TOKEN_COLORS = { CR1: "#f0b90b", CR2: "#00d4aa", CR3: "#9b87f5" };
const TOKEN_LABELS = { CR1: "CaRo1 (CR1)", CR2: "CaRo2 (CR2)", CR3: "CaRo3 (CR3)" };
const TOKEN_GRADE  = { CR1: "Grade A", CR2: "Grade B", CR3: "Grade C" };

// ── Payment methods ──────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  {
    key: 'vietqr',
    label: 'VietQR',
    color: '#005BAC',
    bg: 'rgba(0,91,172,0.08)',
    badge: 'QR',
    desc: 'Quét mã QR qua ứng dụng ngân hàng',
  },
  {
    key: 'bank_transfer',
    label: 'Chuyển khoản',
    color: '#1a73e8',
    bg: 'rgba(26,115,232,0.08)',
    badge: 'CK',
    desc: 'Chuyển khoản ngân hàng trực tiếp',
  },
  {
    key: 'vnpay',
    label: 'VNPay',
    color: '#e40000',
    bg: 'rgba(228,0,0,0.08)',
    badge: 'VN',
    desc: 'Ví điện tử & cổng thanh toán VNPay',
  },
  {
    key: 'momo',
    label: 'MoMo',
    color: '#ae2070',
    bg: 'rgba(174,32,112,0.08)',
    badge: 'MM',
    desc: 'Ví MoMo – Thanh toán siêu tốc',
  },
  {
    key: 'zalopay',
    label: 'ZaloPay',
    color: '#0068ff',
    bg: 'rgba(0,104,255,0.08)',
    badge: 'ZP',
    desc: 'Ví ZaloPay – Thanh toán dễ dàng',
  },
  {
    key: 'atm_card',
    label: 'Thẻ ATM',
    color: '#2c7a4b',
    bg: 'rgba(44,122,75,0.08)',
    badge: 'ATM',
    desc: 'Thẻ ATM / nội địa ngân hàng Việt Nam',
  },
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
      {/* Method badge */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{m.badge}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{m.label}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Số tiền: <strong style={{ color: C.green }}>{formatVND(amount)}</strong></div>
        </div>
      </div>

      {/* Progress card */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>
          {loading ? 'Đang xác nhận...' : (title || 'Đang xử lý thanh toán...')}
        </div>

        {/* Progress bar */}
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


// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ result, onDone }) {
  const m = PAYMENT_METHODS.find(x => x.key === result.payment_method) || PAYMENT_METHODS[0];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Success card */}
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid rgba(14,203,129,0.3)`, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginBottom: 6 }}>Giao dịch thành công!</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#e2e8f0', marginBottom: 4 }}>
          +{formatVND(result.amount)}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>đã được cộng vào số dư VND</div>
      </div>

      {/* Transaction details */}
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

      <button onClick={onDone}
        style={{ padding: '13px 0', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Quay lại ví
      </button>
    </div>
  );
}

// ── Withdraw success screen ───────────────────────────────────────────────────

function WithdrawSuccessScreen({ result, onDone }) {
  const m = PAYMENT_METHODS.find(x => x.key === result.payment_method) || PAYMENT_METHODS[0];
  return (
    <div style={{ maxWidth: 480, display: 'grid', gap: 16 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid rgba(14,203,129,0.3)`, padding: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.green, marginBottom: 6 }}>Rút tiền thành công!</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#e2e8f0', marginBottom: 4 }}>
          -{formatVND(result.amount)}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>đã được trừ khỏi số dư VND</div>
      </div>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chi tiết giao dịch</div>
        <div style={{ padding: '0 18px' }}>
          {[
            ['Mã giao dịch', result.transaction_code],
            ['Số tiền rút',  formatVND(result.amount)],
            ['Phương thức',  m.label],
            ['Trạng thái',   'Thành công'],
            ['Thời gian',    new Date().toLocaleString('vi-VN')],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.muted }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: k === 'Mã giao dịch' ? C.tealLight : k === 'Trạng thái' ? C.green : '#e2e8f0', fontFamily: k === 'Mã giao dịch' ? 'monospace' : 'inherit' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onDone} style={{ padding: '13px 0', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Quay lại ví
      </button>
    </div>
  );
}

// ── AmountInput (VND) ────────────────────────────────────────────────────────

function AmountInput({ value, onChange, max, label }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
        {label || 'Số tiền nạp (VND)'}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="number" min="0" step="1000" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Nhập số tiền..."
          style={{ width: '100%', padding: '12px 60px 12px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: '#e2e8f0', fontSize: 16, boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
        />
        {max != null ? (
          <button type="button" onClick={() => onChange(String(max))}
            style={{ position: 'absolute', right: 45, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.tealLight, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            MAX
          </button>
        ) : null}
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted, fontWeight: 600 }}>VND</span>
      </div>
      {value && Number(value) > 0 && (
        <div style={{ marginTop: 6, fontSize: 13, color: C.tealLight, fontWeight: 600 }}>
          = {formatVND(Number(value))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TraderWallet() {
  const { account, provider, connect } = useWallet();
  const nav = useNavigate();
  const qc  = useQueryClient();

  const [tokenBals, setTokenBals] = useState({ CR1: '0', CR2: '0', CR3: '0' });
  const [activeTab, setActiveTab] = useState('overview');
  const [depType,   setDepType]   = useState('vnd'); // 'vnd' | 'token'
  const [wdType,    setWdType]    = useState('vnd'); // 'vnd' | 'token'

  // Deposit wizard state
  const [depStep,   setDepStep]   = useState('input');   // 'input' | 'processing' | 'success'
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('');
  const [depResult, setDepResult] = useState(null);

  // Withdraw wizard state
  const [wdStep,   setWdStep]   = useState('input');
  const [wdAmount, setWdAmount] = useState('');
  const [wdMethod, setWdMethod] = useState('');
  const [wdResult, setWdResult] = useState(null);

  const { data: exchangeBalsData } = useQuery({
    queryKey: ["exchange-token-balances"],
    queryFn: () => axios.get("/token/balances").then(r => r.data),
    staleTime: 10_000,
  });
  const exchangeBals = exchangeBalsData?.balances || {};

  const { data: walletData, isLoading } = useQuery({
    queryKey: TRADER_KEYS.wallet,
    queryFn:  () => axios.get('/wallet/balance').then(r => r.data),
    staleTime: 10_000, refetchInterval: 20_000,
  });

  const vndAvailable = Number(walletData?.vnd_available ?? walletData?.vnd_balance ?? walletData?.balance ?? 0);

  const { data: txData } = useQuery({
    queryKey: ['trader-wallet-tx'],
    queryFn:  () => axios.get('/wallet/transactions?limit=30').then(r => r.data),
    staleTime: 15_000, refetchInterval: 30_000,
  });
  const txList = txData?.data || txData?.transactions || [];

  useEffect(() => {
    if (!account || !provider) return;
    (async () => {
      try {
        const results = await Promise.all(
          ['CR1', 'CR2', 'CR3'].map(async key => {
            const c = new ethers.Contract(CA_RO_CONTRACTS[key], ABI, provider);
            const [b, d] = await Promise.all([c.balanceOf(account), c.decimals()]);
            return [key, ethers.utils.formatUnits(b, d)];
          })
        );
        setTokenBals(Object.fromEntries(results));
      } catch {}
    })();
  }, [account, provider]);

  // Simulate deposit mutation
  const simulateMut = useMutation({
    mutationFn: ({ amount, payment_method }) =>
      axios.post('/wallet/simulate-deposit', { amount: Number(amount), payment_method }).then(r => r.data),
    onSuccess: (data) => {
      setDepResult(data);
      setDepStep('success');
      qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
      qc.invalidateQueries({ queryKey: ['trader-wallet-tx'] });
    },
    onError: (e) => {
      alert(e?.response?.data?.message || 'Lỗi xử lý. Vui lòng thử lại.');
    },
  });

  const simulateWithdrawMut = useMutation({
    mutationFn: ({ amount, payment_method }) =>
      axios.post('/wallet/simulate-withdraw', { amount: Number(amount), payment_method }).then(r => r.data),
    onSuccess: (data) => {
      setWdResult(data);
      setWdStep('success');
      qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
      qc.invalidateQueries({ queryKey: ['trader-wallet-tx'] });
    },
    onError: (e) => {
      alert(e?.response?.data?.message || 'Lỗi rút tiền. Vui lòng thử lại.');
    },
  });

  const tabStyle = (t) => ({
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderRadius: 7, transition: 'all 0.15s',
    background: activeTab === t ? C.accent : 'rgba(255,255,255,0.04)',
    color: activeTab === t ? '#fff' : C.muted,
  });

  const PRESET_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
  const PRESET_WD = [100_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

  const switchTab = (t) => {
    setActiveTab(t);
    if (t !== 'deposit')  { setDepStep('input'); setDepAmount(''); setDepMethod(''); setDepResult(null); }
    if (t !== 'withdraw') { setWdStep('input');  setWdAmount('');  setWdMethod('');  setWdResult(null);  }
  };

  return (
    <TraderLayout title="Ví tài khoản">
      <div style={{ display: 'grid', gap: 18, width: '100%', maxWidth: 900 }}>

        {/* ── VND Balance hero ── */}
        <div style={{ background: 'linear-gradient(135deg, #172524 0%, #1e302f 100%)', borderRadius: 14, border: `1px solid ${C.border}`, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Số dư VND khả dụng</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.tealLight, letterSpacing: '-0.5px' }}>
              {isLoading ? '...' : formatVND(vndAvailable)}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Cập nhật tự động mỗi 20 giây</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => switchTab('deposit')}
              style={{ padding: '10px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Nạp tiền
            </button>
            <button onClick={() => switchTab('withdraw')}
              style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0', border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              − Rút tiền
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            ['overview', '📊 Tổng quan'],
            ['deposit',  '💵 Nạp tiền'],
            ['withdraw', '📤 Rút tiền'],
            ['history',  '📋 Lịch sử'],
          ].map(([t, label]) => (
            <button key={t} onClick={() => switchTab(t)} style={tabStyle(t)}>{label}</button>
          ))}
        </div>

        {/* ══ Tab: Overview ══ */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gap: 14 }}>
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

            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>🪙 Số dư Token on-chain (MetaMask)</span>
                {!account && (
                  <button onClick={connect}
                    style={{ padding: '6px 14px', background: '#f0b90b', color: '#000', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Kết nối MetaMask
                  </button>
                )}
              </div>
              {!account ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🦊</div>
                  Kết nối MetaMask để xem số dư CR1, CR2, CR3
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {['CR1', 'CR2', 'CR3'].map((key, idx) => {
                    const qty = Number(tokenBals[key] || 0);
                    return (
                      <div key={key} style={{ padding: 18, borderRight: idx < 2 ? `1px solid ${C.border}` : 'none' }}>
                        <div style={{ fontSize: 11, color: TOKEN_COLORS[key], fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{TOKEN_LABELS[key]}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{TOKEN_GRADE[key]}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: qty > 0 ? C.green : C.muted }}>{formatNumber(qty, 4)}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>token</div>
                        <button onClick={() => nav('/trader/trading')}
                          style={{ marginTop: 12, padding: '6px 12px', fontSize: 11, background: 'rgba(72,117,115,0.12)', color: C.tealLight, border: `1px solid rgba(72,117,115,0.3)`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                          Giao dịch →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {account && (
                <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                  Ví: {account.slice(0, 6)}...{account.slice(-4)}
                </div>
              )}
            </div>
            <button onClick={() => nav('/trader/portfolio')}
              style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(72,117,115,0.07)'; e.currentTarget.style.borderColor = C.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = C.border; }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>📊 Xem danh mục đầu tư đầy đủ</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Phân tích hiệu suất, phân bổ tài sản theo thời gian thực</div>
              </div>
              <span style={{ color: C.tealLight, fontSize: 18 }}>→</span>
            </button>
          </div>
        )}

        {/* ══ Tab: Deposit ══ */}
        {activeTab === 'deposit' && (
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

                    {/* Amount */}
                    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, display: 'grid', gap: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>💵 Số tiền nạp</div>
                      <AmountInput value={depAmount} onChange={setDepAmount} />
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Nạp nhanh:</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {PRESET_AMOUNTS.map(amt => (
                            <button key={amt} onClick={() => setDepAmount(String(amt))}
                              style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6, transition: 'all 0.12s',
                                background: depAmount === String(amt) ? 'rgba(72,117,115,0.2)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${depAmount === String(amt) ? C.accent : C.border}`,
                                color: depAmount === String(amt) ? C.tealLight : '#e2e8f0' }}>
                              {formatVND(amt)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Payment method selection */}
                    <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏦 Phương thức nạp tiền</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {PAYMENT_METHODS.map(m => {
                          const sel = depMethod === m.key;
                          return (
                            <button key={m.key} onClick={() => setDepMethod(m.key)}
                              style={{ padding: '14px 10px', border: `2px solid ${sel ? m.color : C.border}`, borderRadius: 10, cursor: 'pointer', background: sel ? m.bg : 'rgba(255,255,255,0.03)', transition: 'all 0.15s', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
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

                    {/* Deposit button */}
                    <button
                      onClick={() => {
                        if (!depAmount || Number(depAmount) < 1000) return;
                        if (!depMethod) return;
                        setDepStep('processing');
                      }}
                      disabled={!depAmount || Number(depAmount) < 1000 || !depMethod}
                      style={{ padding: '14px 0', background: depAmount && Number(depAmount) >= 1000 && depMethod ? C.accent : 'rgba(72,117,115,0.25)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: depAmount && Number(depAmount) >= 1000 && depMethod ? 'pointer' : 'not-allowed' }}>
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
              <TraderTokenDepositForm account={account} provider={provider} connect={connect} qc={qc} />
            )}
          </div>
        )}

        {/* ══ Tab: Withdraw ══ */}
        {activeTab === 'withdraw' && (
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
              <div>
                {/* ── STEP 1: Input ── */}
                {wdStep === 'input' && (() => {
                  const wdCanProceed = wdAmount && Number(wdAmount) >= 1000 && wdMethod && Number(wdAmount) <= vndAvailable;
                  return (
                    <div style={{ display: 'grid', gap: 20 }}>
                      <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                        {[['1', 'Nhập số tiền'], ['2', 'Đang xử lý'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                          <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 0 ? 'rgba(246,70,93,0.12)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? C.red : C.muted }}>{n}. {lbl}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20, display: 'grid', gap: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>📤 Số tiền rút</div>
                        <AmountInput value={wdAmount} onChange={setWdAmount} max={vndAvailable} label="Số tiền rút (VND)" />
                        <div>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Rút nhanh:</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {PRESET_WD.filter(a => a <= vndAvailable).map(amt => (
                              <button key={amt} onClick={() => setWdAmount(String(amt))}
                                style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
                                  background: wdAmount === String(amt) ? 'rgba(246,70,93,0.15)' : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${wdAmount === String(amt) ? C.red : C.border}`,
                                  color: wdAmount === String(amt) ? C.red : '#e2e8f0' }}>
                                {formatVND(amt)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🏦 Phương thức rút tiền</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {PAYMENT_METHODS.map(m => {
                            const sel = wdMethod === m.key;
                            return (
                              <button key={m.key} onClick={() => setWdMethod(m.key)}
                                style={{ padding: '14px 10px', border: `2px solid ${sel ? m.color : C.border}`, borderRadius: 10, cursor: 'pointer', background: sel ? m.bg : 'rgba(255,255,255,0.03)', transition: 'all 0.15s', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900 }}>{m.badge}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: sel ? m.color : '#e2e8f0' }}>{m.label}</div>
                                <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{m.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button onClick={() => { if (wdCanProceed) setWdStep('processing'); }} disabled={!wdCanProceed}
                        style={{ padding: '14px 0', background: wdCanProceed ? C.red : 'rgba(246,70,93,0.25)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: wdCanProceed ? 'pointer' : 'not-allowed' }}>
                        {!wdMethod ? 'Chọn phương thức rút tiền'
                          : !wdAmount || Number(wdAmount) < 1000 ? 'Nhập số tiền (tối thiểu 1.000 VND)'
                          : Number(wdAmount) > vndAvailable ? 'Số tiền vượt quá số dư khả dụng'
                          : `Rút tiền ${formatVND(Number(wdAmount))}`}
                      </button>
                    </div>
                  );
                })()}

                {/* ── STEP 2: Processing ── */}
                {wdStep === 'processing' && (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      {[['1', 'Nhập số tiền'], ['2', 'Đang xử lý'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                        <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 1 ? 'rgba(246,70,93,0.12)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: i === 1 ? C.red : C.muted }}>{n}. {lbl}</div>
                        </div>
                      ))}
                    </div>
                    <ProcessingScreen
                      amount={Number(wdAmount)} method={wdMethod}
                      title="Đang xử lý rút tiền..."
                      loading={simulateWithdrawMut.isPending || simulateWithdrawMut.isLoading}
                      error={simulateWithdrawMut.isError ? (simulateWithdrawMut.error?.response?.data?.message || 'Lỗi rút tiền') : null}
                      onAutoSubmit={() => simulateWithdrawMut.mutate({ amount: wdAmount, payment_method: wdMethod })}
                    />
                  </div>
                )}

                {/* ── STEP 3: Success ── */}
                {wdStep === 'success' && wdResult && (
                  <div style={{ display: 'grid', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                      {[['1', 'Nhập số tiền'], ['2', 'Đang xử lý'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                        <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 2 ? 'rgba(14,203,129,0.12)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: i === 2 ? C.green : C.muted }}>{n}. {lbl}</div>
                        </div>
                      ))}
                    </div>
                    <WithdrawSuccessScreen
                      result={wdResult}
                      onDone={() => { setWdStep('input'); setWdAmount(''); setWdMethod(''); setWdResult(null); switchTab('history'); }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <TraderTokenWithdrawForm exchangeBals={exchangeBals} account={account} connect={connect} qc={qc} />
            )}
          </div>
        )}

        {/* ══ Tab: History ══ */}
        {activeTab === 'history' && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700 }}>
              📋 Lịch sử giao dịch ví
            </div>
            {txList.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Chưa có giao dịch nào
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      {['Loại', 'Số tiền', 'Mã giao dịch', 'Ghi chú', 'Trạng thái', 'Thời gian'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', fontSize: 11, color: C.muted, fontWeight: 600, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txList.map((tx, i) => {
                      const isToken = !!tx.token_type;
                      const isIn = tx.type === 'deposit' || (Number(tx.amount) > 0 && !isToken);
                      const statusColor = tx.status === 'approved' ? C.green : tx.status === 'rejected' ? C.red : C.gold;
                      const statusLabel = tx.status === 'approved' ? 'Thành công' : tx.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
                      const m = PAYMENT_METHODS.find(x => x.key === tx.payment_method);
                      return (
                        <tr key={tx.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: isIn ? C.green : C.red }}>
                              {isToken ? `${tx.type === 'deposit' ? '↓ Nạp' : '↑ Rút'} ${tx.token_type}` : (isIn ? '↓ Nạp' : '↑ Rút')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: isIn ? C.green : C.red, whiteSpace: 'nowrap' }}>
                            {isIn ? '+' : '−'}{isToken ? `${Math.abs(Number(tx.amount))} ${tx.token_type}` : formatVND(Math.abs(Number(tx.amount || tx.value || 0)))}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: C.tealLight }}>
                            {tx.transaction_code || tx.tx_hash || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>
                            {isToken ? (tx.note || tx.description || '—') : (
                              m ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ width: 18, height: 18, borderRadius: 4, background: m.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 900, flexShrink: 0 }}>{m.badge}</span>
                                  <span style={{ color: '#e2e8f0' }}>{m.label}</span>
                                </span>
                              ) : (tx.note || tx.description || '—')
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${statusColor}18`, color: statusColor, fontWeight: 600 }}>
                              {statusLabel}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                            {tx.created_at ? new Date(tx.created_at).toLocaleString('vi-VN') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
      setMsg({ ok: true, text: `Rút thành công! Giao dịch đang được xử lý (Mã: ${res.data.txHash || "Thành công"})` });
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
