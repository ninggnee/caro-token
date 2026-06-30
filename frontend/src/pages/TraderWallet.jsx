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
  accent: "#487573", muted: "#6b7a99", green: "#0ecb81", red: "#f6465d",
  card: "#172524", border: "rgba(72,117,115,0.15)", tealLight: "#7fe0c9",
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

// ── Fake QR component (decorative, 21×21) ───────────────────────────────────

function FakeQR({ color = '#005BAC', size = 148 }) {
  const cells = [
    [1,1,1,1,1,1,1,0,0,1,0,1,0,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,1,1,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,0,0,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,0,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1,0,0,1,0,1],
    [0,1,1,0,0,1,0,0,1,0,1,0,0,0,1,0,1,1,0,1,0],
    [1,0,0,1,1,0,1,1,0,1,0,1,1,0,0,1,0,1,0,0,1],
    [0,1,0,1,0,0,0,0,1,1,0,0,1,0,1,0,1,0,1,0,0],
    [1,0,1,0,0,1,1,0,0,0,1,1,0,1,0,1,0,1,0,1,1],
    [0,0,0,0,0,0,0,1,1,0,1,0,1,0,1,0,0,0,1,0,0],
    [1,1,1,1,1,1,1,0,0,1,0,1,0,0,0,1,0,1,0,0,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,1,1,1,0,0,0,1,1,0],
    [1,0,1,1,1,0,1,1,0,0,1,1,0,0,0,1,1,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,0,1,1,0,0,1,0,1,1,0],
    [1,0,1,1,1,0,1,0,0,1,0,1,0,0,1,0,0,1,1,0,1],
    [1,0,0,0,0,0,1,1,1,0,1,0,1,1,0,1,0,1,0,1,0],
    [1,1,1,1,1,1,1,0,0,1,0,0,1,0,1,0,1,0,0,1,1],
  ];
  const N = 21;
  const cellPx = Math.floor((size - 16) / N);
  return (
    <div style={{ background: '#fff', padding: 8, display: 'inline-block', borderRadius: 8, boxShadow: '0 2px 16px rgba(0,0,0,0.18)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, ${cellPx}px)`, gap: 0, lineHeight: 0 }}>
        {cells.flatMap((row, r) =>
          row.map((bit, c) => (
            <div key={`${r}-${c}`} style={{ width: cellPx, height: cellPx, background: bit ? '#000' : '#fff' }} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Simulate-payment confirmation screen ─────────────────────────────────────

function PaymentScreen({ method, amount, onConfirm, onBack, loading }) {
  const m = PAYMENT_METHODS.find(x => x.key === method) || PAYMENT_METHODS[0];
  const amtFmt = formatVND(amount);

  const boxStyle = {
    background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
    overflow: 'hidden', maxWidth: 480,
  };
  const hdrStyle = {
    background: m.bg, borderBottom: `2px solid ${m.color}`,
    padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
  };
  const badgeStyle = {
    width: 40, height: 40, borderRadius: 8, background: m.color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 12, fontWeight: 900, flexShrink: 0,
  };
  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: `1px solid ${C.border}`,
  };
  const labelStyle = { fontSize: 12, color: C.muted };
  const valueStyle = { fontSize: 13, fontWeight: 700, color: '#e2e8f0', textAlign: 'right', maxWidth: 220 };

  const infoRows = [
    { label: 'Số tiền', value: <span style={{ color: C.green, fontSize: 16 }}>{amtFmt}</span> },
    { label: 'Phương thức', value: m.label },
    { label: 'Trạng thái', value: <span style={{ color: C.gold }}>Chờ xác nhận</span> },
  ];

  const confirmBtn = (
    <div style={{ padding: '16px 20px', display: 'grid', gap: 10 }}>
      <button
        onClick={onConfirm}
        disabled={loading}
        style={{
          padding: '13px 0', background: loading ? 'rgba(72,117,115,0.4)' : m.color,
          color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800,
          fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.15s',
        }}>
        {loading ? '⏳ Đang xử lý...' : '✓ Xác nhận đã thanh toán'}
      </button>
      <button onClick={onBack} disabled={loading}
        style={{ padding: '9px 0', background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
        ← Quay lại
      </button>
    </div>
  );

  // ── VietQR ──
  if (method === 'vietqr') {
    return (
      <div style={boxStyle}>
        <div style={hdrStyle}>
          <div style={badgeStyle}>{m.badge}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>VietQR – Quét mã QR</div>
            <div style={{ fontSize: 11, color: C.muted }}>Mở ứng dụng ngân hàng → Quét mã → Xác nhận</div>
          </div>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <FakeQR color={m.color} size={140} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'center' }}>Mã QR có hiệu lực 15 phút</div>
          </div>
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            {[
              ['Ngân hàng', 'Vietcombank'],
              ['Số tài khoản', '1234 5678 9012'],
              ['Tên tài khoản', 'CARO TOKEN EXCHANGE'],
              ['Số tiền', amtFmt],
              ['Nội dung CK', 'NAPTIEN CAROEX'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, color: C.muted }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {confirmBtn}
      </div>
    );
  }

  // ── Bank Transfer ──
  if (method === 'bank_transfer') {
    return (
      <div style={boxStyle}>
        <div style={hdrStyle}>
          <div style={badgeStyle}>{m.badge}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>Chuyển khoản ngân hàng</div>
            <div style={{ fontSize: 11, color: C.muted }}>Chuyển đúng số tiền và nội dung bên dưới</div>
          </div>
        </div>
        <div style={{ padding: '0 20px' }}>
          {[
            ['Ngân hàng', 'Vietcombank – NH TMCP Ngoại Thương Việt Nam'],
            ['Số tài khoản', '1234 5678 9012'],
            ['Tên tài khoản', 'CONG TY CARO TOKEN'],
            ['Chi nhánh', 'Hồ Chí Minh'],
            ['Số tiền', amtFmt],
            ['Nội dung', 'NAPTIEN CAROEX [tên của bạn]'],
          ].map(([k, v]) => (
            <div key={k} style={rowStyle}>
              <span style={labelStyle}>{k}</span>
              <span style={valueStyle}>{k === 'Số tiền' ? <span style={{ color: C.green }}>{v}</span> : v}</span>
            </div>
          ))}
          <div style={{ padding: '10px 0', fontSize: 11, color: C.gold }}>
            ⚠ Giao dịch được xử lý trong 1–3 phút làm việc. Hệ thống sẽ xác nhận tự động.
          </div>
        </div>
        {confirmBtn}
      </div>
    );
  }

  // ── VNPay ──
  if (method === 'vnpay') {
    return (
      <div style={boxStyle}>
        <div style={{ background: '#e40000', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: 1 }}>VNPAY</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Cổng thanh toán trực tuyến</div>
        </div>
        <div style={{ padding: '16px 20px', background: 'rgba(228,0,0,0.04)' }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Thông tin đơn hàng</div>
          {[
            ['Mã đơn hàng', 'CAROEX-' + Date.now().toString().slice(-8)],
            ['Tên dịch vụ', 'Nạp VND – CaRo Token Exchange'],
            ['Số tiền thanh toán', amtFmt],
            ['Thời hạn thanh toán', '15 phút'],
          ].map(([k, v]) => (
            <div key={k} style={rowStyle}>
              <span style={labelStyle}>{k}</span>
              <span style={valueStyle}>{k === 'Số tiền thanh toán' ? <span style={{ color: '#e40000', fontWeight: 800 }}>{v}</span> : v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Chọn phương thức thanh toán:</div>
          {['Ví VNPay', 'Thẻ tín dụng/ghi nợ quốc tế', 'Thẻ ATM nội địa'].map(opt => (
            <div key={opt} style={{ padding: '8px 12px', marginBottom: 6, border: `1px solid ${opt === 'Ví VNPay' ? '#e40000' : C.border}`, borderRadius: 6, fontSize: 12, color: opt === 'Ví VNPay' ? '#e40000' : C.muted, background: opt === 'Ví VNPay' ? 'rgba(228,0,0,0.06)' : 'transparent', cursor: 'pointer' }}>
              {opt === 'Ví VNPay' ? '● ' : '○ '}{opt}
            </div>
          ))}
        </div>
        {confirmBtn}
      </div>
    );
  }

  // ── MoMo ──
  if (method === 'momo') {
    return (
      <div style={boxStyle}>
        <div style={{ background: 'linear-gradient(135deg, #ae2070, #d4368e)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>MoMo</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Ví điện tử MoMo</div>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <FakeQR color="#ae2070" size={130} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'center' }}>Quét bằng app MoMo</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Hoặc nhập số điện thoại</div>
            <div style={{ padding: '10px 12px', background: 'rgba(174,32,112,0.08)', border: '1px solid rgba(174,32,112,0.3)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#ae2070', marginBottom: 12 }}>
              0909 123 456
            </div>
            {[
              ['Số tiền', amtFmt],
              ['Nội dung', 'CARO TOKEN NAP TIEN'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: k === 'Số tiền' ? C.green : '#e2e8f0' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {confirmBtn}
      </div>
    );
  }

  // ── ZaloPay ──
  if (method === 'zalopay') {
    return (
      <div style={boxStyle}>
        <div style={{ background: 'linear-gradient(135deg, #0068ff, #0095ff)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>ZaloPay</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>Thanh toán qua ZaloPay</div>
        </div>
        <div style={{ padding: '20px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <FakeQR color="#0068ff" size={130} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'center' }}>Quét bằng app ZaloPay</div>
          </div>
          <div style={{ flex: 1 }}>
            {[
              ['Người nhận', 'CaRo Token Exchange'],
              ['Số tiền', amtFmt],
              ['Ghi chú', 'NAP VND CAROEX'],
              ['Thời hạn', '15 phút'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: C.muted }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: k === 'Số tiền' ? C.green : '#e2e8f0' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        {confirmBtn}
      </div>
    );
  }

  // ── ATM Card ──
  if (method === 'atm_card') {
    return (
      <div style={boxStyle}>
        <div style={hdrStyle}>
          <div style={badgeStyle}>{m.badge}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>Thẻ ATM nội địa</div>
            <div style={{ fontSize: 11, color: C.muted }}>Nhập thông tin thẻ ngân hàng nội địa</div>
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gap: 14 }}>
          {/* Visual card */}
          <div style={{ background: 'linear-gradient(135deg, #1e3a5f, #2c7a4b)', borderRadius: 12, padding: '16px 20px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 16 }}>NGÂN HÀNG TMCP NỘI ĐỊA</div>
            <div style={{ fontSize: 16, fontFamily: 'monospace', letterSpacing: 4, marginBottom: 12 }}>•••• •••• •••• ••••</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <div><div style={{ opacity: 0.6, marginBottom: 2 }}>TÊN CHỦ THẺ</div><div style={{ fontWeight: 700 }}>NGUYEN VAN A</div></div>
              <div><div style={{ opacity: 0.6, marginBottom: 2 }}>HẾT HẠN</div><div style={{ fontWeight: 700 }}>12/28</div></div>
            </div>
          </div>
          {/* Form fields */}
          {[
            { label: 'Số thẻ', placeholder: '1234 5678 9012 3456', type: 'text' },
            { label: 'Tên chủ thẻ', placeholder: 'NGUYEN VAN A', type: 'text' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>{f.label}</label>
              <input readOnly placeholder={f.placeholder} type={f.type}
                style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Ngày hết hạn', placeholder: 'MM/YY' },
              { label: 'CVV / OTP', placeholder: '•••' },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>{f.label}</label>
                <input readOnly placeholder={f.placeholder} type="text"
                  style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 12, color: C.muted }}>Số tiền thanh toán</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.green }}>{amtFmt}</span>
          </div>
        </div>
        {confirmBtn}
      </div>
    );
  }

  // Fallback
  return (
    <div style={boxStyle}>
      <div style={{ padding: 20 }}>
        {infoRows.map(r => (
          <div key={r.label} style={rowStyle}>
            <span style={labelStyle}>{r.label}</span>
            <span style={valueStyle}>{r.value}</span>
          </div>
        ))}
      </div>
      {confirmBtn}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────

function SuccessScreen({ result, onDone }) {
  const m = PAYMENT_METHODS.find(x => x.key === result.payment_method) || PAYMENT_METHODS[0];
  return (
    <div style={{ maxWidth: 480, display: 'grid', gap: 16 }}>
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

      {/* Disclaimer */}
      <div style={{ padding: '12px 16px', background: 'rgba(240,185,11,0.07)', border: '1px solid rgba(240,185,11,0.3)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 3 }}>Lưu ý quan trọng</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            <b style={{ color: '#e2e8f0' }}>Mô phỏng thành công.</b> Không có giao dịch ngân hàng thực nào được thực hiện. Đây là hệ thống demo — số dư VND chỉ có giá trị nội bộ trong hệ thống CaRo Token Exchange.
          </div>
        </div>
      </div>

      <button onClick={onDone}
        style={{ padding: '13px 0', background: C.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Quay lại ví
      </button>
    </div>
  );
}

// ── AmountInput (VND) ────────────────────────────────────────────────────────

function AmountInput({ value, onChange, max }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
        Số tiền nạp (VND)
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="number" min="0" step="1000" value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Nhập số tiền..."
          style={{ width: '100%', padding: '12px 60px 12px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: '#e2e8f0', fontSize: 16, boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
        />
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

  // Deposit wizard state
  const [depStep,   setDepStep]   = useState('input');   // 'input' | 'confirm' | 'success'
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('');
  const [depResult, setDepResult] = useState(null);

  // Withdraw state
  const [wdAmount,  setWdAmount]  = useState('');
  const [wdBank,    setWdBank]    = useState('');
  const [wdAccNum,  setWdAccNum]  = useState('');
  const [wdAccName, setWdAccName] = useState('');
  const [wdMsg,     setWdMsg]     = useState(null);

  const { data: walletData, isLoading } = useQuery({
    queryKey: TRADER_KEYS.wallet,
    queryFn:  () => axios.get('/wallet/balance').then(r => r.data),
    staleTime: 10_000, refetchInterval: 20_000,
  });

  const vndAvailable = Number(walletData?.vnd_available ?? walletData?.vnd_balance ?? walletData?.balance ?? 0);
  const vndBalance   = Number(walletData?.vnd_balance   ?? walletData?.balance ?? 0);

  const { data: txData, refetch: refetchTx } = useQuery({
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

  const withdrawMutation = useMutation({
    mutationFn: ({ amount, bank_name, account_number, account_name }) =>
      axios.post('/wallet/withdraw', { amount: Number(amount), bank_name, account_number, account_name }).then(r => r.data),
    onSuccess: () => {
      setWdMsg({ ok: true, text: 'Yêu cầu rút tiền đã được gửi. Admin sẽ duyệt trong thời gian sớm nhất.' });
      setWdAmount(''); setWdBank(''); setWdAccNum(''); setWdAccName('');
      qc.invalidateQueries({ queryKey: TRADER_KEYS.wallet });
      qc.invalidateQueries({ queryKey: ['trader-wallet-tx'] });
    },
    onError: (e) => setWdMsg({ ok: false, text: e?.response?.data?.message || 'Rút tiền thất bại.' }),
  });

  const tabStyle = (t) => ({
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderRadius: 7, transition: 'all 0.15s',
    background: activeTab === t ? C.accent : 'rgba(255,255,255,0.04)',
    color: activeTab === t ? '#fff' : C.muted,
  });

  const PRESET_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

  // Reset deposit wizard when switching away from deposit tab
  const switchTab = (t) => {
    setActiveTab(t);
    if (t !== 'deposit') { setDepStep('input'); setDepAmount(''); setDepMethod(''); setDepResult(null); }
  };

  const txTypeLabel = (tx) => {
    if (tx.type === 'withdraw') return 'Rút tiền';
    if (tx.payment_method) return `Nạp – ${METHOD_LABEL[tx.payment_method] || tx.payment_method}`;
    return 'Nạp tiền';
  };

  return (
    <TraderLayout title="Ví tài khoản">
      <div style={{ display: 'grid', gap: 18, maxWidth: 900 }}>

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
          <div>
            {/* ── STEP 1: Input ── */}
            {depStep === 'input' && (
              <div style={{ display: 'grid', gap: 20, maxWidth: 560 }}>
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

                {/* Continue button */}
                <button
                  onClick={() => {
                    if (!depAmount || Number(depAmount) < 1000) return;
                    if (!depMethod) return;
                    setDepStep('confirm');
                  }}
                  disabled={!depAmount || Number(depAmount) < 1000 || !depMethod}
                  style={{ padding: '14px 0', background: depAmount && Number(depAmount) >= 1000 && depMethod ? C.accent : 'rgba(72,117,115,0.25)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 15, cursor: depAmount && Number(depAmount) >= 1000 && depMethod ? 'pointer' : 'not-allowed' }}>
                  {!depMethod ? 'Chọn phương thức thanh toán' : !depAmount || Number(depAmount) < 1000 ? 'Nhập số tiền (tối thiểu 1.000 VND)' : `Tiếp tục → Nạp ${formatVND(Number(depAmount))}`}
                </button>

                {/* Security note */}
                <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.6 }}>
                  🔒 Mô phỏng an toàn · Không có giao dịch thực · Số dư chỉ có giá trị nội bộ
                </div>
              </div>
            )}

            {/* ── STEP 2: Confirm ── */}
            {depStep === 'confirm' && (
              <div style={{ display: 'grid', gap: 16 }}>
                {/* Step indicator */}
                <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, maxWidth: 480 }}>
                  {[['1', 'Nhập số tiền'], ['2', 'Xác nhận'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
                    <div key={n} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: i === 1 ? 'rgba(72,117,115,0.18)' : 'transparent', borderRight: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: i === 1 ? C.tealLight : C.muted }}>{n}. {lbl}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 12, color: C.muted }}>
                  Xác nhận thanh toán <b style={{ color: C.green }}>{formatVND(Number(depAmount))}</b> qua <b style={{ color: '#e2e8f0' }}>{METHOD_LABEL[depMethod]}</b>
                </div>

                <PaymentScreen
                  method={depMethod}
                  amount={Number(depAmount)}
                  loading={simulateMut.isPending || simulateMut.isLoading}
                  onConfirm={() => simulateMut.mutate({ amount: depAmount, payment_method: depMethod })}
                  onBack={() => setDepStep('input')}
                />
              </div>
            )}

            {/* ── STEP 3: Success ── */}
            {depStep === 'success' && depResult && (
              <div style={{ display: 'grid', gap: 16 }}>
                {/* Step indicator */}
                <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}`, maxWidth: 480 }}>
                  {[['1', 'Nhập số tiền'], ['2', 'Xác nhận'], ['3', 'Hoàn tất']].map(([n, lbl], i) => (
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
        )}

        {/* ══ Tab: Withdraw ══ */}
        {activeTab === 'withdraw' && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📤 Rút tiền VND</div>
              <div style={{ fontSize: 12, color: C.muted }}>Số dư khả dụng: <strong style={{ color: C.tealLight }}>{formatVND(vndAvailable)}</strong></div>
            </div>
            <div style={{ display: 'grid', gap: 16, maxWidth: 420 }}>
              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Số tiền rút (VND)</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" min="0" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                    placeholder="Nhập số tiền..."
                    style={{ width: '100%', padding: '10px 55px 10px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', outline: 'none' }} />
                  <button type="button" onClick={() => setWdAmount(String(vndAvailable))}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: C.tealLight, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    MAX
                  </button>
                </div>
                {wdAmount && Number(wdAmount) > 0 && (
                  <div style={{ marginTop: 4, fontSize: 13, color: C.tealLight, fontWeight: 600 }}>= {formatVND(Number(wdAmount))}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[100_000, 500_000, 1_000_000].filter(a => a <= vndAvailable).map(amt => (
                  <button key={amt} onClick={() => setWdAmount(String(amt))}
                    style={{ padding: '6px 14px', fontSize: 12, background: wdAmount === String(amt) ? 'rgba(246,70,93,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${wdAmount === String(amt) ? C.red : C.border}`, borderRadius: 6, cursor: 'pointer', color: '#e2e8f0', fontWeight: 600 }}>
                    {formatVND(amt)}
                  </button>
                ))}
              </div>
              {/* Bank info */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600 }}>Thông tin tài khoản ngân hàng nhận tiền</div>
                {[
                  { label: 'Tên ngân hàng', value: wdBank,    set: setWdBank,    ph: 'Vietcombank, Techcombank...' },
                  { label: 'Số tài khoản',  value: wdAccNum,  set: setWdAccNum,  ph: '1234567890' },
                  { label: 'Tên chủ tài khoản', value: wdAccName, set: setWdAccName, ph: 'NGUYEN VAN A' },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>{f.label}</label>
                    <input type="text" value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                      style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 7, color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                ))}
              </div>
              {wdMsg && (
                <div style={{ padding: '10px 14px', background: wdMsg.ok ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)', border: `1px solid ${wdMsg.ok ? 'rgba(14,203,129,0.3)' : 'rgba(246,70,93,0.3)'}`, borderRadius: 8, fontSize: 13, color: wdMsg.ok ? C.green : C.red }}>
                  {wdMsg.text}
                </div>
              )}
              <button
                onClick={() => { setWdMsg(null); withdrawMutation.mutate({ amount: wdAmount, bank_name: wdBank, account_number: wdAccNum, account_name: wdAccName }); }}
                disabled={!wdAmount || Number(wdAmount) <= 0 || Number(wdAmount) > vndAvailable || !wdBank || !wdAccNum || !wdAccName || withdrawMutation.isPending}
                style={{ padding: '12px 0', background: wdAmount && Number(wdAmount) > 0 && Number(wdAmount) <= vndAvailable && wdBank && wdAccNum && wdAccName ? C.red : 'rgba(246,70,93,0.25)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {withdrawMutation.isPending ? 'Đang xử lý...' : `Gửi yêu cầu rút ${wdAmount ? formatVND(Number(wdAmount)) : 'tiền'}`}
              </button>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                ⚠ Yêu cầu rút tiền sẽ được admin xem xét và xử lý. Thời gian xử lý 1–3 ngày làm việc.
              </div>
            </div>
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
                      {['Loại', 'Số tiền', 'Mã giao dịch', 'Phương thức', 'Trạng thái', 'Thời gian'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', fontSize: 11, color: C.muted, fontWeight: 600, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txList.map((tx, i) => {
                      const isIn = tx.type === 'deposit';
                      const statusColor = tx.status === 'approved' ? C.green : tx.status === 'rejected' ? C.red : C.gold;
                      const statusLabel = tx.status === 'approved' ? 'Thành công' : tx.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt';
                      const m = PAYMENT_METHODS.find(x => x.key === tx.payment_method);
                      return (
                        <tr key={tx.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: isIn ? C.green : C.red }}>
                              {isIn ? '↓ Nạp' : '↑ Rút'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: isIn ? C.green : C.red, whiteSpace: 'nowrap' }}>
                            {isIn ? '+' : '−'}{formatVND(Math.abs(Number(tx.amount || 0)))}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'monospace', color: C.tealLight }}>
                            {tx.transaction_code || '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12 }}>
                            {m ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 4, background: m.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 900, flexShrink: 0 }}>{m.badge}</span>
                                <span style={{ color: '#e2e8f0' }}>{m.label}</span>
                              </span>
                            ) : '—'}
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
