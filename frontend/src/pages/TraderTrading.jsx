import { useState, useEffect, useCallback } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';
import { formatNumber, formatVND } from '../utils/formatters';

const PAIRS = ['CR1/VND', 'CR2/VND', 'CR3/VND'];

const ORDER_TYPES = [
  { key: 'limit',  label: 'LIMIT'  },
  { key: 'market', label: 'MARKET' },
  { key: 'ato',    label: 'ATO',   comingSoon: true },
  { key: 'atc',    label: 'ATC',   comingSoon: true },
];

const C = {
  card:    '#0f1e20',
  border:  'rgba(255,255,255,0.08)',
  green:   '#0ecb81',
  red:     '#f6465d',
  text:    '#eaecef',
  muted:   '#848e9c',
  dim:     '#1e2d2f',
  input:   '#162020',
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


function Stepper({ label, value, onChange, step = 1, disabled = false }) {
  const adj = (delta) => {
    const cur = parseFloat(value) || 0;
    const nxt = Math.max(0, cur + delta * step);
    onChange(nxt % 1 === 0 ? String(nxt) : nxt.toFixed(2));
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
        <button
          onClick={() => adj(-1)}
          disabled={disabled}
          style={{ width: 34, height: 38, background: C.dim, border: 'none', color: '#bbb', cursor: disabled ? 'default' : 'pointer', fontSize: 20, flexShrink: 0, lineHeight: 1 }}
        >−</button>
        <input
          type="number"
          value={value}
          onChange={e => !disabled && onChange(e.target.value)}
          readOnly={disabled}
          placeholder="0"
          style={{ flex: 1, height: 38, padding: '0 6px', background: C.input, border: 'none', color: disabled ? C.muted : C.text, textAlign: 'center', fontSize: 13, outline: 'none' }}
        />
        <button
          onClick={() => adj(1)}
          disabled={disabled}
          style={{ width: 34, height: 38, background: C.dim, border: 'none', color: '#bbb', cursor: disabled ? 'default' : 'pointer', fontSize: 20, flexShrink: 0, lineHeight: 1 }}
        >+</button>
      </div>
    </div>
  );
}

export default function TraderTrading() {
  const [pair, setPair]             = useState('CR1/VND');
  const [bids, setBids]             = useState([]);
  const [asks, setAsks]             = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [tradeHist,  setTradeHist]  = useState([]);
  const [tickers,    setTickers]    = useState({});
  const [vndWallet,  setVndWallet]  = useState({});
  const [tokenBals,  setTokenBals]  = useState({});

  const [orderType,  setOrderType]  = useState('limit');
  const [buyPrice,   setBuyPrice]   = useState('');
  const [buyAmount,  setBuyAmount]  = useState('');
  const [sellPrice,  setSellPrice]  = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [placing,    setPlacing]    = useState(null);
  const [msg,        setMsg]        = useState(null);
  const [bottomTab,  setBottomTab]  = useState('open');

  // ── data loaders ──────────────────────────────────────────────────────────

  const loadOrderbook = useCallback(async () => {
    const d = await apiFetch(`/orders/orderbook?pair=${encodeURIComponent(pair)}`);
    if (d.success) { setBids(d.data.bids || []); setAsks(d.data.asks || []); }
  }, [pair]);

  const loadOpenOrders = useCallback(async () => {
    const d = await apiFetch(`/orders/open?pair=${encodeURIComponent(pair)}`);
    if (d.success) setOpenOrders(d.data || []);
  }, [pair]);

  const loadTradeHistory = useCallback(async () => {
    const d = await apiFetch(`/orders/trades?pair=${encodeURIComponent(pair)}`);
    if (d.success) setTradeHist(d.data || []);
  }, [pair]);

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

  useEffect(() => {
    loadOrderbook(); loadOpenOrders(); loadTradeHistory();
    loadTickers(); loadWallet(); loadTokenBals();
    const iv = setInterval(() => {
      loadOrderbook(); loadTickers(); loadWallet(); loadTokenBals();
    }, 5000);
    return () => clearInterval(iv);
  }, [pair, loadOrderbook, loadOpenOrders, loadTradeHistory, loadTickers, loadWallet, loadTokenBals]);

  // Auto-fill market price when MARKET type selected or order book updates
  useEffect(() => {
    if (orderType === 'market') {
      const tk = tickers[pair] || {};
      setBuyPrice(asks[0] ? String(asks[0].price) : (tk.last_price ? String(tk.last_price) : ''));
      setSellPrice(bids[0] ? String(bids[0].price) : (tk.last_price ? String(tk.last_price) : ''));
    }
  }, [orderType, asks, bids, tickers, pair]);

  // ── derived values ────────────────────────────────────────────────────────

  const ticker    = tickers[pair] || {};
  const lastPrice = Number(ticker.last_price || 0);
  const token     = pair.split('/')[0];
  const vndAvail  = Number(vndWallet.vnd_available || 0);
  const tokAvail  = Number(tokenBals[token]?.available || 0);

  const buyPriceN  = parseFloat(buyPrice)   || 0;
  const buyAmtN    = parseFloat(buyAmount)  || 0;
  const sellPriceN = parseFloat(sellPrice)  || 0;
  const sellAmtN   = parseFloat(sellAmount) || 0;
  const maxBuyQty  = buyPriceN > 0 ? vndAvail / buyPriceN : 0;

  const maxBid = Math.max(...bids.map(b => b.amount), 1);
  const maxAsk = Math.max(...asks.map(a => a.amount), 1);
  const dispBids = bids.slice(0, 8);
  const dispAsks = asks.slice(0, 8);
  const levels   = Math.max(dispBids.length, dispAsks.length, 5);

  // ── actions ───────────────────────────────────────────────────────────────

  const selectPrice = (price) => {
    if (orderType !== 'market') {
      setBuyPrice(String(price));
      setSellPrice(String(price));
    }
  };

  const placeOrder = async (side) => {
    const p = side === 'buy' ? buyPrice  : sellPrice;
    const a = side === 'buy' ? buyAmount : sellAmount;
    if (!p || !a || Number(p) <= 0 || Number(a) <= 0) {
      return setMsg({ ok: false, text: 'Vui lòng nhập Giá và Số lượng hợp lệ' });
    }
    setPlacing(side); setMsg(null);
    try {
      const d = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({ pair, side, price: Number(p), amount: Number(a) }),
      });
      if (d.success) {
        setMsg({ ok: true, text: `Đặt lệnh thành công · Trạng thái: ${d.status} · Khớp: ${d.trades} lệnh` });
        if (side === 'buy')  { setBuyAmount('');  if (orderType !== 'market') setBuyPrice('');  }
        else                 { setSellAmount(''); if (orderType !== 'market') setSellPrice(''); }
        loadOpenOrders(); loadOrderbook(); loadTradeHistory(); loadWallet(); loadTokenBals();
      } else {
        setMsg({ ok: false, text: d.message || 'Lỗi đặt lệnh' });
      }
    } catch { setMsg({ ok: false, text: 'Lỗi kết nối server' }); }
    setPlacing(null);
  };

  const cancelOrder = async (id) => {
    const d = await apiFetch(`/orders/${id}`, { method: 'DELETE' });
    if (d.success) { loadOpenOrders(); loadOrderbook(); loadWallet(); loadTokenBals(); }
    else alert(d.message);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <TraderLayout title={`Giao dịch — ${pair}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: C.text, fontSize: 13 }}>

        {/* ── PAIR TABS ── */}
        <div style={{ display: 'flex', gap: 6 }}>
          {PAIRS.map(p => (
            <button key={p} onClick={() => setPair(p)} style={{
              padding: '7px 20px', borderRadius: 5, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              background: p === pair ? 'rgba(14,203,129,0.12)' : 'rgba(255,255,255,0.05)',
              color: p === pair ? C.green : C.muted,
              border: p === pair ? '1px solid rgba(14,203,129,0.4)' : `1px solid ${C.border}`,
              transition: 'all 0.15s',
            }}>{p}</button>
          ))}
        </div>

        {/* ── TICKER BAR ── */}
        <div style={{ display: 'flex', gap: 24, padding: '10px 18px', background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>
              {lastPrice ? formatNumber(lastPrice) : '—'}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>VNĐ</div>
          </div>
          <div style={{ width: 1, height: 36, background: C.border, flexShrink: 0 }} />
          {[
            { l: 'Giá cao nhất',   v: ticker.high   ? formatNumber(ticker.high)   : '—', c: C.green },
            { l: 'Giá thấp nhất',  v: ticker.low    ? formatNumber(ticker.low)    : '—', c: C.red   },
            { l: 'Khối lượng 24h', v: ticker.volume ? formatNumber(ticker.volume) : '—', c: C.text  },
          ].map(x => (
            <div key={x.l}>
              <div style={{ fontSize: 11, color: C.muted }}>{x.l}</div>
              <div style={{ fontWeight: 600, color: x.c, fontFamily: 'monospace' }}>{x.v}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN: ORDER BOOK + ORDER PANEL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12, alignItems: 'start' }}>

          {/* ORDER BOOK */}
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, fontSize: 13 }}>
              Sổ lệnh
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '5px 10px', color: C.muted, fontSize: 10, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>
              <span>KL (Mua)</span>
              <span style={{ textAlign: 'right' }}>Giá Mua</span>
              <span style={{ paddingLeft: 10 }}>Giá Bán</span>
              <span style={{ textAlign: 'right' }}>KL (Bán)</span>
            </div>

            {/* Order rows */}
            {Array.from({ length: levels }, (_, i) => {
              const bid = dispBids[i];
              const ask = dispAsks[i];
              const bPct = bid ? (bid.amount / maxBid) * 100 : 0;
              const aPct = ask ? (ask.amount / maxAsk) * 100 : 0;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', height: 26 }}>

                  {/* BID qty */}
                  <div
                    onClick={() => bid && selectPrice(bid.price)}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 10px', cursor: bid ? 'pointer' : 'default', overflow: 'hidden' }}
                  >
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${bPct}%`, background: 'rgba(14,203,129,0.1)', transition: 'width 0.3s' }} />
                    <span style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
                      {bid ? formatNumber(bid.amount) : ''}
                    </span>
                  </div>

                  {/* BID price */}
                  <div
                    onClick={() => bid && selectPrice(bid.price)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 10px', cursor: bid ? 'pointer' : 'default' }}
                  >
                    <span style={{ color: C.green, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                      {bid ? formatNumber(bid.price) : ''}
                    </span>
                  </div>

                  {/* ASK price */}
                  <div
                    onClick={() => ask && selectPrice(ask.price)}
                    style={{ display: 'flex', alignItems: 'center', padding: '0 10px', paddingLeft: 12, cursor: ask ? 'pointer' : 'default', borderLeft: `1px solid ${C.border}` }}
                  >
                    <span style={{ color: C.red, fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                      {ask ? formatNumber(ask.price) : ''}
                    </span>
                  </div>

                  {/* ASK qty */}
                  <div
                    onClick={() => ask && selectPrice(ask.price)}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 10px', cursor: ask ? 'pointer' : 'default', overflow: 'hidden' }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${aPct}%`, background: 'rgba(246,70,93,0.1)', transition: 'width 0.3s' }} />
                    <span style={{ color: C.muted, fontSize: 11, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
                      {ask ? formatNumber(ask.amount) : ''}
                    </span>
                  </div>

                </div>
              );
            })}

            {/* Last price strip */}
            <div style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.02)', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: C.text }}>
                {lastPrice ? formatNumber(lastPrice) : '—'} <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>VNĐ</span>
              </span>
              <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                <span style={{ color: C.muted }}>H: <b style={{ color: C.green }}>{ticker.high ? formatNumber(ticker.high) : '—'}</b></span>
                <span style={{ color: C.muted }}>L: <b style={{ color: C.red }}>{ticker.low ? formatNumber(ticker.low) : '—'}</b></span>
              </div>
            </div>

            <div style={{ padding: '6px 12px', fontSize: 10, color: C.muted, textAlign: 'center' }}>
              Nhấn vào giá để điền vào form đặt lệnh
            </div>
          </div>

          {/* ── ORDER PANEL ── */}
          <div style={{ background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>

            {/* Order type tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
              {ORDER_TYPES.map(ot => (
                <div key={ot.key} style={{ position: 'relative' }}>
                  <button
                    onClick={() => !ot.comingSoon && setOrderType(ot.key)}
                    title={ot.comingSoon ? 'Tính năng sắp ra mắt' : ''}
                    style={{
                      padding: '8px 15px', background: 'transparent', border: 'none',
                      cursor: ot.comingSoon ? 'default' : 'pointer',
                      color: orderType === ot.key ? C.text : C.muted,
                      fontWeight: orderType === ot.key ? 700 : 400,
                      fontSize: 13,
                      borderBottom: orderType === ot.key ? `2px solid ${C.green}` : '2px solid transparent',
                      marginBottom: -1,
                      opacity: ot.comingSoon ? 0.45 : 1,
                      transition: 'color 0.15s',
                    }}
                  >{ot.label}</button>
                  {ot.comingSoon && (
                    <span style={{
                      position: 'absolute', top: 4, right: 1,
                      background: 'rgba(132,142,156,0.2)', color: C.muted,
                      fontSize: 8, padding: '1px 3px', borderRadius: 3, lineHeight: 1.5,
                      pointerEvents: 'none',
                    }}>Soon</span>
                  )}
                </div>
              ))}
              {orderType === 'market' && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, alignSelf: 'center', paddingRight: 4 }}>
                  Lệnh khớp ngay theo giá tốt nhất
                </span>
              )}
            </div>

            {/* BUY + SELL forms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* ─── BUY FORM ─── */}
              <div>
                <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(14,203,129,0.05)', borderRadius: 6, border: '1px solid rgba(14,203,129,0.15)' }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Sức mua tối đa (VNĐ)</div>
                  <div style={{ fontWeight: 700, color: C.green, fontSize: 15, fontFamily: 'monospace' }}>
                    {formatNumber(maxBuyQty)} {token}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    {formatVND(vndAvail)} khả dụng
                    {buyPriceN > 0 && (
                      <span> ÷ {formatNumber(buyPriceN)}</span>
                    )}
                  </div>
                </div>

                <Stepper
                  label={orderType === 'market' ? 'Giá thị trường (VNĐ)' : 'Giá (VNĐ)'}
                  value={buyPrice}
                  onChange={setBuyPrice}
                  step={1}
                  disabled={orderType === 'market'}
                />

                <Stepper
                  label="Số lượng (token)"
                  value={buyAmount}
                  onChange={setBuyAmount}
                  step={1}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderTop: `1px solid ${C.border}`, marginBottom: 12 }}>
                  <span style={{ color: C.muted }}>Giá trị lệnh</span>
                  <span style={{ color: C.text, fontWeight: 700, fontFamily: 'monospace' }}>{formatVND(buyPriceN * buyAmtN)}</span>
                </div>

                <button
                  onClick={() => placeOrder('buy')}
                  disabled={placing === 'buy'}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 6, border: 'none',
                    background: placing === 'buy' ? '#1a5c3c' : C.green,
                    color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                    letterSpacing: '1px', transition: 'background 0.15s',
                  }}
                >{placing === 'buy' ? 'Đang đặt…' : 'MUA'}</button>
              </div>

              {/* ─── SELL FORM ─── */}
              <div>
                <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(246,70,93,0.05)', borderRadius: 6, border: '1px solid rgba(246,70,93,0.15)' }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>KL có thể bán ({token})</div>
                  <div style={{ fontWeight: 700, color: C.red, fontSize: 15, fontFamily: 'monospace' }}>
                    {formatNumber(tokAvail)} {token}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    {token} khả dụng trong tài khoản
                  </div>
                </div>

                <Stepper
                  label={orderType === 'market' ? 'Giá thị trường (VNĐ)' : 'Giá (VNĐ)'}
                  value={sellPrice}
                  onChange={setSellPrice}
                  step={1}
                  disabled={orderType === 'market'}
                />

                <Stepper
                  label="Số lượng (token)"
                  value={sellAmount}
                  onChange={setSellAmount}
                  step={1}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '8px 0', borderTop: `1px solid ${C.border}`, marginBottom: 12 }}>
                  <span style={{ color: C.muted }}>Giá trị lệnh</span>
                  <span style={{ color: C.text, fontWeight: 700, fontFamily: 'monospace' }}>{formatVND(sellPriceN * sellAmtN)}</span>
                </div>

                <button
                  onClick={() => placeOrder('sell')}
                  disabled={placing === 'sell'}
                  style={{
                    width: '100%', padding: '12px 0', borderRadius: 6, border: 'none',
                    background: placing === 'sell' ? '#6b1a2a' : C.red,
                    color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                    letterSpacing: '1px', transition: 'background 0.15s',
                  }}
                >{placing === 'sell' ? 'Đang đặt…' : 'BÁN'}</button>
              </div>

            </div>

            {/* Status message */}
            {msg && (
              <div style={{
                marginTop: 14, padding: '9px 12px', borderRadius: 6, fontSize: 12,
                background: msg.ok ? 'rgba(14,203,129,0.07)' : 'rgba(246,70,93,0.07)',
                border: `1px solid ${msg.ok ? 'rgba(14,203,129,0.25)' : 'rgba(246,70,93,0.25)'}`,
                color: msg.ok ? C.green : C.red,
              }}>{msg.text}</div>
            )}
          </div>

        </div>

        {/* ── BOTTOM TABS ── */}
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
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['#ID', 'Cặp', 'Loại', 'Giá (VNĐ)', 'Số lượng', 'Còn lại', 'Trạng thái', ''].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.map(o => (
                        <tr key={o.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                          <td style={{ padding: '8px 10px', color: C.muted }}>#{o.id}</td>
                          <td style={{ padding: '8px 10px' }}>{o.pair}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: o.side === 'buy' ? C.green : C.red }}>
                            {o.side === 'buy' ? 'MUA' : 'BÁN'}
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{formatNumber(o.price)}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{Number(o.amount).toFixed(4)}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{Number(o.remaining).toFixed(4)}</td>
                          <td style={{ padding: '8px 10px', color: C.muted }}>{o.status}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <button onClick={() => cancelOrder(o.id)} style={{
                              padding: '3px 10px', background: 'rgba(246,70,93,0.1)', color: C.red,
                              border: '1px solid rgba(246,70,93,0.3)', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                            }}>Hủy</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {bottomTab === 'history' && (
              tradeHist.length === 0
                ? <div style={{ color: C.muted, textAlign: 'center', padding: '24px 0' }}>Chưa có lịch sử giao dịch</div>
                : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['#ID', 'Giá (VNĐ)', 'Số lượng', 'Thời gian'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHist.slice(0, 30).map(t => (
                        <tr key={t.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                          <td style={{ padding: '8px 10px', color: C.muted }}>#{t.id}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{formatNumber(t.price)}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{Number(t.amount).toFixed(4)}</td>
                          <td style={{ padding: '8px 10px', color: C.muted, fontSize: 11 }}>
                            {new Date(t.created_at).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
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
