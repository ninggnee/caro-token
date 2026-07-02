import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import FarmerLayout from "../components/layout/FarmerLayout";
import axios from "../utils/axiosClient";
import { formatVND } from '../utils/formatters';
import { sanitizeNonNegative } from '../utils/validation';

const C = {
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
  gold: "#f0b90b",
};

const PAYMENT_METHODS = [
  { key: 'vietqr',        label: 'VietQR',      color: '#005BAC', bg: 'rgba(0,91,172,0.08)',    badge: 'QR',  desc: 'Quét mã QR qua ứng dụng ngân hàng' },
  { key: 'bank_transfer', label: 'Chuyển khoản',color: '#1a73e8', bg: 'rgba(26,115,232,0.08)', badge: 'CK',  desc: 'Chuyển khoản ngân hàng trực tiếp' },
  { key: 'vnpay',         label: 'VNPay',        color: '#e40000', bg: 'rgba(228,0,0,0.08)',     badge: 'VN',  desc: 'Ví điện tử & cổng thanh toán VNPay' },
  { key: 'momo',          label: 'MoMo',         color: '#ae2070', bg: 'rgba(174,32,112,0.08)', badge: 'MM',  desc: 'Ví MoMo – Thanh toán siêu tốc' },
  { key: 'zalopay',       label: 'ZaloPay',      color: '#0068ff', bg: 'rgba(0,104,255,0.08)',   badge: 'ZP',  desc: 'Ví ZaloPay – Thanh toán dễ dàng' },
  { key: 'atm_card',      label: 'Thẻ ATM',      color: '#2c7a4b', bg: 'rgba(44,122,75,0.08)',   badge: 'ATM', desc: 'Thẻ ATM / nội địa ngân hàng Việt Nam' },
];

const PRESETS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000];

// ── 30-second processing screen ──────────────────────────────────────────────

function ProcessingScreen({ amount, method, onAutoSubmit, loading, error }) {
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

  const pct    = Math.min(100, Math.round(((30 - secondsLeft) / 30) * 100));
  const BARS   = 24;
  const filled = Math.round((pct / 100) * BARS);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
          {m.badge}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{m.label}</div>
          <div style={{ fontSize: 12, color: C.muted }}>Số tiền: <strong style={{ color: C.green }}>{formatVND(amount)}</strong></div>
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#e2e8f0', marginBottom: 24 }}>
          {loading ? 'Đang xác nhận...' : 'Đang xử lý thanh toán...'}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#e2e8f0', letterSpacing: 0, marginBottom: 10 }}>
            {'█'.repeat(filled) + '░'.repeat(BARS - filled)} {pct}%
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${m.color}, ${C.tealLight})`, borderRadius: 4, transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: 14, color: C.muted }}>
            {secondsLeft > 0 ? `${secondsLeft} giây còn lại...` : 'Hoàn tất — đang xác nhận...'}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 14 }}>
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

function SuccessScreen({ result, onViewHistory, onNewDeposit }) {
  const m = PAYMENT_METHODS.find(x => x.key === result.payment_method) || PAYMENT_METHODS[0];
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ background: C.card, borderRadius: 12, border: '1px solid rgba(14,203,129,0.3)', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 60, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginBottom: 8 }}>Giao dịch thành công!</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#e2e8f0', marginBottom: 6 }}>
          +{formatVND(result.amount)}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>đã được cộng vào số dư VND của bạn</div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Chi tiết giao dịch
        </div>
        <div style={{ padding: '0 18px' }}>
          {[
            ['Mã giao dịch', result.transaction_code],
            ['Phương thức',  m.label],
            ['Số tiền nạp',  formatVND(result.amount)],
            ['Trạng thái',   'Thành công'],
            ['Thời gian',    new Date().toLocaleString('vi-VN')],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.muted }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 700,
                color: k === 'Mã giao dịch' ? C.tealLight : k === 'Trạng thái' ? C.green : '#e2e8f0',
                fontFamily: k === 'Mã giao dịch' ? 'monospace' : 'inherit' }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px', background: 'rgba(240,185,11,0.07)', border: '1px solid rgba(240,185,11,0.3)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          <b style={{ color: C.gold }}>Mô phỏng an toàn.</b> Không có giao dịch ngân hàng thực nào được thực hiện. Số dư VND đã được cộng vào ví nội bộ của bạn.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onViewHistory}
          style={{ flex: 1, padding: '13px 0', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          📋 Xem lịch sử
        </button>
        <button onClick={onNewDeposit}
          style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.07)', color: '#e2e8f0', border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Nạp thêm
        </button>
      </div>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ active }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      {[['1', 'Nhập số tiền'], ['2', 'Đang xử lý'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
        <div key={n} style={{
          flex: 1, padding: '9px 0', textAlign: 'center',
          borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
          background: active === i ? 'rgba(72,117,115,0.18)' : 'transparent',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: active === i ? C.tealLight : C.muted }}>
            {n}. {lbl}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FarmerDepositPage() {
  const nav = useNavigate();
  const qc  = useQueryClient();

  const [step,   setStep]   = useState('input');     // 'input' | 'processing' | 'success'
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [result, setResult] = useState(null);

  const simulateMut = useMutation({
    mutationFn: ({ amount: amt, payment_method }) =>
      axios.post('/wallet/simulate-deposit', { amount: Number(amt), payment_method }).then(r => r.data),
    onSuccess: (data) => {
      setResult(data);
      setStep('success');
      // Invalidate all dashboard/balance/history queries so every page updates immediately
      qc.invalidateQueries({ queryKey: ['farmer-dashboard-wallet'] });
      qc.invalidateQueries({ queryKey: ['farmer-vnd-wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      qc.invalidateQueries({ queryKey: ['farmer-wallet-tx'] });
    },
    onError: (e) => {
      alert(e?.response?.data?.message || 'Lỗi xử lý thanh toán. Vui lòng thử lại.');
      setStep('input');
    },
  });

  const canProceed = amount && Number(amount) >= 1000 && method;

  const reset = () => {
    setStep('input');
    setAmount('');
    setMethod('');
    setResult(null);
  };

  return (
    <FarmerLayout title="Nạp tiền VND">
      <div style={{ display: 'grid', gap: 20, width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => nav('/farmer/wallet')}
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
            ← Ví
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>💵 Nạp Tiền VND</h2>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Nạp tiền vào ví nội bộ sàn CaRo</div>
          </div>
        </div>

        {/* Step 1: Input */}
        {step === 'input' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <StepBar active={0} />

            {/* Amount */}
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>💵 Số tiền nạp</div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
                  Số tiền (VND)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number" min="1000" step="1000" value={amount}
                    onChange={e => setAmount(sanitizeNonNegative(e.target.value))}
                    placeholder="Nhập số tiền..."
                    style={{ width: '100%', padding: '13px 60px 13px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: '#e2e8f0', fontSize: 17, boxSizing: 'border-box', outline: 'none', fontWeight: 700 }}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted, fontWeight: 600 }}>VND</span>
                </div>
                {amount && Number(amount) > 0 && (
                  <div style={{ marginTop: 8, fontSize: 14, color: C.tealLight, fontWeight: 700 }}>
                    = {formatVND(Number(amount))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>Nạp nhanh:</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESETS.map(p => (
                    <button key={p} onClick={() => setAmount(String(p))}
                      style={{ padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6, transition: 'all 0.12s',
                        background: amount === String(p) ? 'rgba(72,117,115,0.2)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${amount === String(p) ? C.accent : C.border}`,
                        color: amount === String(p) ? C.tealLight : '#e2e8f0' }}>
                      {formatVND(p)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>🏦 Phương thức nạp tiền</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {PAYMENT_METHODS.map(m => {
                  const sel = method === m.key;
                  return (
                    <button key={m.key} onClick={() => setMethod(m.key)}
                      style={{ padding: '14px 10px', border: `2px solid ${sel ? m.color : C.border}`, borderRadius: 10, cursor: 'pointer',
                        background: sel ? m.bg : 'rgba(255,255,255,0.03)', transition: 'all 0.15s',
                        textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 900 }}>
                        {m.badge}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: sel ? m.color : '#e2e8f0' }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proceed button */}
            <button
              disabled={!canProceed}
              onClick={() => { if (canProceed) setStep('processing'); }}
              style={{ padding: '15px 0', background: canProceed ? C.accent : 'rgba(72,117,115,0.25)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: canProceed ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
              {!method
                ? 'Chọn phương thức thanh toán'
                : !amount || Number(amount) < 1000
                  ? 'Nhập số tiền (tối thiểu 1.000 VND)'
                  : `Nạp ${formatVND(Number(amount))}`}
            </button>

            <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.7 }}>
              🔒 Mô phỏng an toàn · Không có giao dịch thực · Số dư chỉ có giá trị nội bộ
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <StepBar active={1} />
            <ProcessingScreen
              amount={Number(amount)}
              method={method}
              loading={simulateMut.isPending}
              error={simulateMut.isError ? (simulateMut.error?.response?.data?.message || 'Lỗi xử lý') : null}
              onAutoSubmit={() => simulateMut.mutate({ amount, payment_method: method })}
            />
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && result && (
          <div style={{ display: 'grid', gap: 16 }}>
            <StepBar active={2} />
            <SuccessScreen
              result={result}
              onViewHistory={() => nav('/farmer/wallet/history')}
              onNewDeposit={reset}
            />
          </div>
        )}

      </div>
    </FarmerLayout>
  );
}
