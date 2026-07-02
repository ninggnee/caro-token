import { useState, useEffect, useCallback } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';
import { formatNumber, formatVND, formatKg, formatToken } from '../utils/formatters';
import { sanitizeNonNegative } from '../utils/validation';
import { getTradingBand } from '../services/marketApi';
import { useAuth } from '../context/AuthContext';

const PAIRS = [
  { key: 'CR1/VND', label: 'CaRo1/VND', token: 'CR1', tokenLabel: 'CaRo1', color: '#f0b90b' },
  { key: 'CR2/VND', label: 'CaRo2/VND', token: 'CR2', tokenLabel: 'CaRo2', color: '#0ecb81' },
  { key: 'CR3/VND', label: 'CaRo3/VND', token: 'CR3', tokenLabel: 'CaRo3', color: '#9b87f5' },
];

const ORDER_TYPES = [
  { key: 'limit',  label: 'Limit'  },
  { key: 'market', label: 'Market' },
];

const C = {
  card:   '#0f1e20',
  border: 'rgba(255,255,255,0.08)',
  green:  '#0ecb81',
  red:    '#f6465d',
  text:   '#eaecef',
  muted:  '#848e9c',
  dim:    '#1e2d2f',
  input:  '#162020',
  gold:   '#f0b90b',
  teal:   '#00d4aa',
};

function authHeader() {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...(opts.headers || {}) },
  });
  return res.json();
}

export default function TraderTrading() {
  const { user } = useAuth();
  const myId     = user?.id;

  const [pairKey, setPairKey]       = useState('CR1/VND');
  const [bids, setBids]             = useState([]);
  const [asks, setAsks]             = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [tradeHist, setTradeHist]   = useState([]);
  const [tickers, setTickers]       = useState({});
  const [vndWallet, setVndWallet]   = useState({});
  const [tokenBals, setTokenBals]   = useState({});

  const [orderType, setOrderType] = useState('limit');
  const [side, setSide]           = useState('buy');
  const [price, setPrice]         = useState('');
  const [amount, setAmount]       = useState('');
  const [placing, setPlacing]     = useState(false);
  const [msg, setMsg]             = useState(null);
  const [bottomTab, setBottomTab] = useState('open');
  const [band, setBand]           = useState(null); // { ref, floor, ceiling, tickSize }

  const pairInfo   = PAIRS.find(p => p.key === pairKey) || PAIRS[0];
  const token      = pairInfo.token;
  const tokenLabel = pairInfo.tokenLabel;
  const isMarket   = orderType === 'market';

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadOrderbook = useCallback(async () => {
    const d = await apiFetch(`/orders/orderbook?pair=${encodeURIComponent(pairKey)}`);
    if (d.success) { setBids(d.data.bids || []); setAsks(d.data.asks || []); }
  }, [pairKey]);

  const loadOpenOrders = useCallback(async () => {
    const d = await apiFetch(`/orders/open?pair=${encodeURIComponent(pairKey)}`);
    if (d.success) setOpenOrders(d.data || []);
  }, [pairKey]);

  const loadTradeHistory = useCallback(async () => {
    const d = await apiFetch(`/orders/trades?pair=${encodeURIComponent(pairKey)}&mine=true`);
    if (d.success) setTradeHist(d.data || []);
  }, [pairKey]);

  const loadTickers = useCallback(async () => {
    const d = await apiFetch('/orders/tickers');
    if (d.success) {
      const m = {};
      d.data.forEach(t => { m[t.pair] = t; });
      setTickers(m);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    const d = await apiFetch('/wallet/balance');
    if (d.success !== false) setVndWallet(d);
  }, []);

  const loadTokenBals = useCallback(async () => {
    const d = await apiFetch('/orders/my-balances');
    if (d.success) setTokenBals(d.data || {});
  }, []);

  const loadBand = useCallback(async () => {
    try {
      const d = await getTradingBand();
      if (d.success) setBand(d.bands[token] || null);
    } catch {}
  }, [token]);

  useEffect(() => {
    loadOrderbook(); loadOpenOrders(); loadTradeHistory();
    loadTickers(); loadWallet(); loadTokenBals(); loadBand();
    const iv = setInterval(() => {
      loadOrderbook(); loadTickers(); loadWallet(); loadTokenBals(); loadBand();
    }, 10000);
    return () => clearInterval(iv);
  }, [pairKey, loadOrderbook, loadOpenOrders, loadTradeHistory, loadTickers, loadWallet, loadTokenBals, loadBand]);

  // Clear price field when switching to market order type
  useEffect(() => {
    if (isMarket) setPrice('');
  }, [isMarket]);

  // ── derived ────────────────────────────────────────────────────────────────

  const ticker    = tickers[pairKey] || {};
  const lastPrice = Number(ticker.last_price || 0);
  const chg24h    = Number(ticker.change_24h || 0);
  const vndAvail  = Number(vndWallet.vnd_available || 0);
  const tokAvail  = Number(tokenBals[token]?.available || 0);
  const priceN    = isMarket ? (asks[0]?.price || bids[0]?.price || lastPrice) : (parseFloat(price) || 0);
  const amtN      = parseFloat(amount) || 0;
  const total     = isMarket ? 0 : priceN * amtN; // market orders: total shown as 0 (unknown until execution)
  const maxBuyQty = priceN > 0 ? vndAvail / priceN : 0;

  const maxBid   = Math.max(...bids.map(b => b.amount), 1);
  const maxAsk   = Math.max(...asks.map(a => a.amount), 1);
  const dispBids = bids.slice(0, 10);
  const dispAsks = asks.slice(0, 10);

  // ── actions ────────────────────────────────────────────────────────────────

  const selectPrice = (p) => {
    if (!isMarket) { setPrice(String(p)); }
  };

  const applyPct = (pct) => {
    if (side === 'buy') {
      if (priceN <= 0) return;
      const qty = (vndAvail * pct / 100) / priceN;
      setAmount(qty > 0 ? String(Math.round(qty)) : '');
    } else {
      const qty = tokAvail * pct / 100;
      setAmount(qty > 0 ? String(Math.round(qty)) : '');
    }
  };

  const placeOrder = async () => {
    if (!amount || amtN <= 0) {
      return setMsg({ ok: false, text: 'Vui lòng nhập Số lượng hợp lệ' });
    }
    if (side === 'sell' && amtN > tokAvail) {
      return setMsg({ ok: false, text: `Không đủ số dư ${tokenLabel}. Khả dụng: ${formatNumber(tokAvail)} kg` });
    }
    if (!isMarket) {
      if (!price || priceN <= 0) {
        return setMsg({ ok: false, text: 'Vui lòng nhập Giá hợp lệ' });
      }
      // Rule 3: tick size = 100 VND
      if (priceN % 100 !== 0) {
        return setMsg({ ok: false, text: 'Giá phải là bội số của 100 VND (Tick Size). Ví dụ: 88.000, 88.100, ...' });
      }
      // Rule 2: floor/ceiling
      if (band && (priceN < band.floor || priceN > band.ceiling)) {
        return setMsg({ ok: false, text: `Giá nằm ngoài biên độ hôm nay [${formatNumber(band.floor)} – ${formatNumber(band.ceiling)} VND/kg]` });
      }
    }
    setPlacing(true); setMsg(null);
    try {
      const body = { pair: pairKey, side, amount: amtN, type: orderType };
      if (!isMarket) body.price = priceN;
      const d = await apiFetch('/orders', { method: 'POST', body: JSON.stringify(body) });
      if (d.success) {
        setMsg({ ok: true, text: `Đặt lệnh thành công · ${d.status} · Khớp: ${d.trades} lệnh` });
        setAmount('');
        if (!isMarket) setPrice('');
        loadOpenOrders(); loadOrderbook(); loadTradeHistory(); loadWallet(); loadTokenBals();
      } else {
        setMsg({ ok: false, text: d.message || 'Lỗi đặt lệnh' });
      }
    } catch { setMsg({ ok: false, text: 'Lỗi kết nối server' }); }
    setPlacing(false);
  };

  const cancelOrder = async (id) => {
    const d = await apiFetch(`/orders/${id}`, { method: 'DELETE' });
    if (d.success) { loadOpenOrders(); loadOrderbook(); loadWallet(); loadTokenBals(); }
    else alert(d.message);
  };

  const switchPair = (key) => {
    setPairKey(key);
    setPrice(''); setAmount(''); setMsg(null);
  };

  const switchSide = (s) => {
    setSide(s); setMsg(null);
  };

  // ── shared styles ─────────────────────────────────────────────────────────

  const inputStyle = {
    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
    border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, fontSize: 14, outline: 'none',
  };

  const accentColor = side === 'buy' ? C.green : C.red;

  return (
    <TraderLayout title={`Giao dịch — ${pairInfo.label}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: C.text, fontSize: 13 }}>

        {/* ── PAIR TABS ── */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PAIRS.map(p => (
            <button key={p.key} onClick={() => switchPair(p.key)} style={{
              padding: '7px 18px', borderRadius: 6, cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: p.key === pairKey ? `${p.color}18` : 'rgba(255,255,255,0.04)',
              color: p.key === pairKey ? p.color : C.muted,
              border: p.key === pairKey ? `1px solid ${p.color}55` : `1px solid ${C.border}`,
              transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>

        {/* ── TICKER BAR ── */}
        <div style={{ display: 'flex', gap: 24, padding: '10px 18px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1, color: chg24h >= 0 ? C.green : C.red }}>
              {lastPrice ? formatVND(lastPrice) : '—'}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>VND/kg</div>
          </div>
          <div style={{ width: 1, height: 36, background: C.border, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: C.muted }}>Thay đổi 24H</div>
            <div style={{ fontWeight: 700, color: chg24h >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>
              {chg24h >= 0 ? '+' : ''}{formatNumber(Math.abs(chg24h), 2)}%
            </div>
          </div>
          {[
            { l: 'Cao nhất 24H',  v: ticker.high   ? formatVND(ticker.high)                  : '—', c: C.green },
            { l: 'Thấp nhất 24H', v: ticker.low    ? formatVND(ticker.low)                   : '—', c: C.red   },
            { l: 'KL 24H',        v: ticker.volume ? `${formatNumber(ticker.volume)} kg`      : '—', c: C.text  },
          ].map(x => (
            <div key={x.l}>
              <div style={{ fontSize: 11, color: C.muted }}>{x.l}</div>
              <div style={{ fontWeight: 600, color: x.c, fontFamily: 'monospace', fontSize: 12 }}>{x.v}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN: ORDER BOOK LEFT + ORDER PANEL RIGHT ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 12, alignItems: 'start' }}>

          {/* ORDER BOOK */}
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13 }}>
              Sổ lệnh
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px 10px', color: C.muted, fontSize: 10, fontWeight: 600, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
              <span>Giá (VND/kg)</span>
              <span style={{ textAlign: 'right' }}>SL (kg)</span>
            </div>

            {/* ASK rows — reversed so lowest ask is near the mid price */}
            <div style={{ padding: '3px 0 0' }}>
              {[...dispAsks].reverse().map((ask, i) => {
                const pct = (ask.amount / maxAsk) * 65;
                return (
                  <div key={i} onClick={() => selectPrice(ask.price)}
                    style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', height: 24, alignItems: 'center', padding: '0 10px', cursor: isMarket ? 'default' : 'pointer' }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(246,70,93,0.08)' }} />
                    <span style={{ color: C.red, fontSize: 11, fontFamily: 'monospace', fontWeight: 600, position: 'relative' }}>{formatNumber(ask.price)}</span>
                    <span style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', textAlign: 'right', position: 'relative' }}>{formatNumber(ask.amount, 1)}</span>
                  </div>
                );
              })}
            </div>

            {/* Last price mid */}
            <div style={{ textAlign: 'center', padding: '6px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', color: chg24h >= 0 ? C.green : C.red }}>
                {lastPrice ? formatVND(lastPrice) : '—'}
              </span>
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>VND/kg</span>
            </div>

            {/* BID rows */}
            <div style={{ padding: '0 0 3px' }}>
              {dispBids.map((bid, i) => {
                const pct = (bid.amount / maxBid) * 65;
                return (
                  <div key={i} onClick={() => selectPrice(bid.price)}
                    style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', height: 24, alignItems: 'center', padding: '0 10px', cursor: isMarket ? 'default' : 'pointer' }}>
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${pct}%`, background: 'rgba(14,203,129,0.08)' }} />
                    <span style={{ color: C.green, fontSize: 11, fontFamily: 'monospace', fontWeight: 600, position: 'relative' }}>{formatNumber(bid.price)}</span>
                    <span style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', textAlign: 'right', position: 'relative' }}>{formatNumber(bid.amount, 1)}</span>
                  </div>
                );
              })}
            </div>

            {!isMarket && (
              <div style={{ padding: '5px 10px', fontSize: 10, color: C.muted, textAlign: 'center', borderTop: `1px solid ${C.border}` }}>
                Nhấn vào giá để điền nhanh
              </div>
            )}
          </div>

          {/* ── ORDER PANEL (Binance-style single column) ── */}
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

            {/* Buy / Sell tab switch */}
            <div style={{ display: 'flex' }}>
              <button onClick={() => switchSide('buy')} style={{
                flex: 1, padding: '13px 0', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14, letterSpacing: '0.3px',
                background: side === 'buy' ? 'rgba(14,203,129,0.1)' : C.dim,
                color: side === 'buy' ? C.green : C.muted,
                borderBottom: side === 'buy' ? `2px solid ${C.green}` : `2px solid transparent`,
                transition: 'all 0.15s',
              }}>
                Mua {tokenLabel}
              </button>
              <button onClick={() => switchSide('sell')} style={{
                flex: 1, padding: '13px 0', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 14, letterSpacing: '0.3px',
                background: side === 'sell' ? 'rgba(246,70,93,0.1)' : C.dim,
                color: side === 'sell' ? C.red : C.muted,
                borderBottom: side === 'sell' ? `2px solid ${C.red}` : `2px solid transparent`,
                transition: 'all 0.15s',
              }}>
                Bán {tokenLabel}
              </button>
            </div>

            <div style={{ padding: '16px 20px 20px' }}>

              {/* Order type sub-tabs */}
              <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                {ORDER_TYPES.map(ot => (
                  <button key={ot.key} onClick={() => setOrderType(ot.key)} style={{
                    padding: '7px 14px', background: 'transparent', border: 'none',
                    cursor: 'pointer',
                    color: orderType === ot.key ? C.text : C.muted,
                    fontWeight: orderType === ot.key ? 700 : 400, fontSize: 13,
                    borderBottom: orderType === ot.key ? `2px solid ${accentColor}` : '2px solid transparent',
                    marginBottom: -1, transition: 'color 0.15s',
                  }}>{ot.label}</button>
                ))}
                {isMarket && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, alignSelf: 'center' }}>
                    Khớp theo giá tốt nhất
                  </span>
                )}
              </div>

              {/* Available balance */}
              <div style={{
                marginBottom: 14, padding: '10px 12px', borderRadius: 6,
                background: side === 'buy' ? 'rgba(14,203,129,0.05)' : 'rgba(246,70,93,0.05)',
                border: `1px solid ${side === 'buy' ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)'}`,
              }}>
                {side === 'buy' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Số dư VND</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{formatVND(vndAvail)}</span>
                    </div>
                    {priceN > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Có thể mua tối đa</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, fontFamily: 'monospace' }}>{formatKg(maxBuyQty)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Số dư {tokenLabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pairInfo.color, fontFamily: 'monospace' }}>{formatToken(tokAvail, tokenLabel)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Có thể bán tối đa</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.red, fontFamily: 'monospace' }}>{formatKg(tokAvail)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Trading band info (Rule 1 & 2) */}
              {band && (
                <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(240,185,11,0.06)', borderRadius: 6, border: '1px solid rgba(240,185,11,0.2)', fontSize: 11 }}>
                  <div style={{ color: C.gold, fontWeight: 700, marginBottom: 4 }}>Biên độ giao dịch hôm nay (±7%)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}>
                    <span>Tham chiếu: <b style={{ color: C.text }}>{formatNumber(band.ref)}</b></span>
                    <span>Sàn: <b style={{ color: C.red }}>{formatNumber(band.floor)}</b></span>
                    <span>Trần: <b style={{ color: C.green }}>{formatNumber(band.ceiling)}</b></span>
                  </div>
                  {!isMarket && <div style={{ marginTop: 3, color: C.muted }}>Bước giá: <b style={{ color: C.text }}>100 VND</b></div>}
                </div>
              )}

              {/* Price input — hidden for market orders */}
              {!isMarket && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>
                    GIÁ (VND/kg)
                  </div>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(sanitizeNonNegative(e.target.value))}
                    placeholder="0"
                    min="0"
                    step="100"
                    style={{ ...inputStyle, background: C.input }}
                  />
                </div>
              )}
              {isMarket && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: C.dim, borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, textAlign: 'center' }}>
                  Khớp tự động tại giá tốt nhất trong sổ lệnh
                </div>
              )}

              {/* Amount input */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 600 }}>
                  SỐ LƯỢNG (kg)
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(sanitizeNonNegative(e.target.value))}
                  min="0"
                  placeholder={
                    side === 'sell' && tokAvail > 0
                      ? `Nhập số lượng (Khả dụng: ${formatNumber(tokAvail)} kg)`
                      : side === 'buy' && priceN > 0
                      ? `Nhập số lượng (Tối đa: ${formatNumber(maxBuyQty)} kg)`
                      : '0'
                  }
                  style={{ ...inputStyle, background: C.input }}
                />
                {/* Balance info below input */}
                {side === 'sell' ? (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Khả dụng:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pairInfo.color, fontFamily: 'monospace' }}>
                      {formatToken(tokAvail, tokenLabel)} ({formatKg(tokAvail)})
                    </span>
                  </div>
                ) : priceN > 0 ? (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: C.muted }}>Có thể mua tối đa:</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>
                      {formatKg(maxBuyQty)}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Percentage quick-fill buttons */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct} onClick={() => applyPct(pct)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 4,
                      border: `1px solid ${C.border}`,
                      background: 'rgba(255,255,255,0.03)',
                      color: C.muted, fontSize: 11, cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = accentColor;
                      e.currentTarget.style.borderColor = side === 'buy' ? 'rgba(14,203,129,0.4)' : 'rgba(246,70,93,0.4)';
                      e.currentTarget.style.background = side === 'buy' ? 'rgba(14,203,129,0.06)' : 'rgba(246,70,93,0.06)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = C.muted;
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                <span style={{ color: C.muted, fontSize: 12 }}>Tổng giá trị</span>
                <span style={{ color: C.text, fontWeight: 700, fontFamily: 'monospace', fontSize: 14 }}>
                  {isMarket ? <span style={{ color: C.muted, fontSize: 12 }}>Theo giá khớp lệnh</span> : (total > 0 ? formatVND(total) : '—')}
                </span>
              </div>

              {/* Submit button */}
              <button
                onClick={placeOrder}
                disabled={placing}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 6, border: 'none',
                  background: placing
                    ? (side === 'buy' ? '#1a5c3c' : '#6b1a2a')
                    : accentColor,
                  color: '#fff', fontWeight: 800, fontSize: 15,
                  cursor: placing ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px', transition: 'background 0.15s',
                }}>
                {placing ? 'Đang đặt…' : (side === 'buy' ? `Mua ${tokenLabel}` : `Bán ${tokenLabel}`)}
              </button>

              {/* Status message */}
              {msg && (
                <div style={{
                  marginTop: 12, padding: '9px 12px', borderRadius: 6, fontSize: 12,
                  background: msg.ok ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
                  border: `1px solid ${msg.ok ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                  color: msg.ok ? C.green : C.red,
                }}>{msg.text}</div>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM TABS: open orders + trade history ── */}
        <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 16px' }}>
            {[
              { key: 'open',    label: `Lệnh đang mở (${openOrders.length})` },
              { key: 'history', label: 'Lịch sử khớp lệnh' },
            ].map(t => (
              <button key={t.key} onClick={() => setBottomTab(t.key)} style={{
                padding: '11px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                color: bottomTab === t.key ? C.text : C.muted,
                fontWeight: bottomTab === t.key ? 700 : 400, fontSize: 13,
                borderBottom: bottomTab === t.key ? `2px solid ${C.green}` : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: 16 }}>

            {bottomTab === 'open' && (
              openOrders.length === 0
                ? <div style={{ color: C.muted, textAlign: 'center', padding: '24px 0' }}>Không có lệnh đang mở</div>
                : (
                <div style={{ overflowX: 'auto', borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {[
                          { l: 'Cặp',          align: 'left'  },
                          { l: 'Loại',         align: 'left'  },
                          { l: 'Giá (VND)',    align: 'right' },
                          { l: 'Số lượng (kg)', align: 'right' },
                          { l: 'Còn lại (kg)', align: 'right' },
                          { l: 'Trạng thái',   align: 'right' },
                          { l: '',             align: 'right' },
                        ].map(h => (
                          <th key={h.l} style={{
                            padding: '6px 12px', textAlign: h.align, fontWeight: 400, fontSize: 11,
                            color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                          }}>{h.l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.map((o, i) => {
                        const isPartial = o.status === 'partial' || o.status === 'partially_filled';
                        const isLast    = i === openOrders.length - 1;
                        return (
                          <tr key={o.id}
                            style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '7px 12px', color: C.text, whiteSpace: 'nowrap' }}>{o.pair}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 600, color: o.side === 'buy' ? C.green : C.red }}>
                              {o.side === 'buy' ? 'Mua' : 'Bán'}
                            </td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: C.text, textAlign: 'right' }}>{formatVND(o.price)}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: C.text, textAlign: 'right' }}>{formatKg(o.amount)}</td>
                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: C.muted, textAlign: 'right' }}>{formatKg(o.remaining)}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', fontSize: 11.5, color: isPartial ? C.gold : C.muted, whiteSpace: 'nowrap' }}>
                              {isPartial ? 'Khớp một phần' : 'Đang mở'}
                            </td>
                            <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                              <button onClick={() => cancelOrder(o.id)} style={{
                                padding: '3px 10px', background: 'transparent', color: C.muted,
                                border: `1px solid ${C.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11,
                              }}
                                onMouseEnter={e => { e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = 'rgba(246,70,93,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                              >Hủy</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {bottomTab === 'history' && (
              tradeHist.length === 0
                ? <div style={{ color: C.muted, textAlign: 'center', padding: '24px 0' }}>Chưa có lịch sử giao dịch</div>
                : (
                <div style={{ overflowX: 'auto', borderRadius: 4 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {[
                          { l: 'Thời gian',    align: 'left'  },
                          { l: 'Giá (VND)',    align: 'right' },
                          { l: 'Số lượng (kg)', align: 'right' },
                          { l: 'Tổng (VND)',   align: 'right' },
                        ].map(h => (
                          <th key={h.l} style={{
                            padding: '6px 12px', textAlign: h.align, fontWeight: 400, fontSize: 11,
                            color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                          }}>{h.l}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHist.slice(0, 30).map((t, i) => {
                        const isMyBuy = myId && t.buyer_id === myId;
                        const rowSide = isMyBuy ? 'buy' : 'sell';
                        const isLast  = i === Math.min(tradeHist.length, 30) - 1;
                        return (
                          <tr key={t.id}
                            style={{ borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.035)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '6px 12px', color: C.muted, fontFamily: 'monospace', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                              {new Date(t.created_at).toLocaleTimeString('vi-VN')}
                            </td>
                            <td style={{
                              padding: '6px 12px', fontFamily: 'monospace', fontWeight: 600, textAlign: 'right',
                              color: rowSide === 'buy' ? C.green : C.red,
                            }}>
                              {formatVND(t.price)}
                            </td>
                            <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: C.text, textAlign: 'right' }}>
                              {formatKg(t.amount)}
                            </td>
                            <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: C.text, textAlign: 'right' }}>
                              {formatVND(t.price * t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>

      </div>
    </TraderLayout>
  );
}
