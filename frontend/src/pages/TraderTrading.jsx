import { useState, useEffect, useCallback } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import { API_URL } from '../config/api';
import { formatNumber, formatVND } from '../utils/formatters';
import { toast } from 'react-toastify';

const PAIRS = ['CR1/VND', 'CR2/VND', 'CR3/VND'];

const ORDER_TYPES = [
  { key: 'limit',  label: 'LIMIT'  },
  { key: 'market', label: 'MARKET' },
  { key: 'ato',    label: 'ATO',   comingSoon: true },
  { key: 'atc',    label: 'ATC',   comingSoon: true },
];

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
    <div className="caro-field" style={{ marginBottom: 12 }}>
      <label className="caro-label">{label}</label>
      <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
        <button
          onClick={() => adj(-1)}
          disabled={disabled}
          style={{ width: 36, background: 'rgba(0,0,0,0.2)', border: 'none', color: '#94a3b8', cursor: disabled ? 'default' : 'pointer', fontSize: 20, flexShrink: 0, transition: 'background 0.2s' }}
          onMouseEnter={e => !disabled && (e.target.style.background = 'rgba(0,0,0,0.4)')}
          onMouseLeave={e => !disabled && (e.target.style.background = 'rgba(0,0,0,0.2)')}
        >−</button>
        <input
          type="number"
          className="caro-input"
          value={value}
          onChange={e => !disabled && onChange(e.target.value)}
          readOnly={disabled}
          placeholder="0"
          style={{ flex: 1, border: 'none', background: 'transparent', textAlign: 'center', borderRadius: 0, padding: '8px 12px' }}
        />
        <button
          onClick={() => adj(1)}
          disabled={disabled}
          style={{ width: 36, background: 'rgba(0,0,0,0.2)', border: 'none', color: '#94a3b8', cursor: disabled ? 'default' : 'pointer', fontSize: 20, flexShrink: 0, transition: 'background 0.2s' }}
          onMouseEnter={e => !disabled && (e.target.style.background = 'rgba(0,0,0,0.4)')}
          onMouseLeave={e => !disabled && (e.target.style.background = 'rgba(0,0,0,0.2)')}
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
  const dispBids = bids.slice(0, 10);
  const dispAsks = asks.slice(0, 10);
  const levels   = Math.max(dispBids.length, dispAsks.length, 6);

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
      toast.warning('Vui lòng nhập Giá và Số lượng hợp lệ');
      return;
    }
    setPlacing(side);
    try {
      const d = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({ pair, side, price: Number(p), amount: Number(a) }),
      });
      if (d.success) {
        toast.success(`Đặt lệnh thành công · Trạng thái: ${d.status} · Khớp: ${d.trades} lệnh`);
        if (side === 'buy')  { setBuyAmount('');  if (orderType !== 'market') setBuyPrice('');  }
        else                 { setSellAmount(''); if (orderType !== 'market') setSellPrice(''); }
        loadOpenOrders(); loadOrderbook(); loadTradeHistory(); loadWallet(); loadTokenBals();
      } else {
        toast.error(d.message || 'Lỗi đặt lệnh');
      }
    } catch { toast.error('Lỗi kết nối server'); }
    setPlacing(null);
  };

  const cancelOrder = async (id) => {
    const d = await apiFetch(`/orders/${id}`, { method: 'DELETE' });
    if (d.success) {
      toast.success(`Hủy lệnh #${id} thành công`);
      loadOpenOrders(); loadOrderbook(); loadWallet(); loadTokenBals();
    }
    else toast.error(d.message);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <TraderLayout title={`Giao dịch — ${pair}`}>
      <div className="caro-page">

        {/* ── PAIR TABS ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PAIRS.map(p => (
            <button key={p} onClick={() => setPair(p)} className={`caro-btn caro-btn-sm ${p === pair ? 'caro-btn-secondary' : 'caro-btn-ghost'}`}>
              {p}
            </button>
          ))}
        </div>

        {/* ── TICKER BAR ── */}
        <div className="caro-card" style={{ display: 'flex', gap: 24, padding: '16px 24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1, color: "#f8fafc" }}>
              {lastPrice ? formatNumber(lastPrice) : '—'}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>VNĐ</div>
          </div>
          <div style={{ width: 1, height: 40, background: "var(--border)", flexShrink: 0 }} />
          {[
            { l: 'Giá cao nhất',   v: ticker.high   ? formatNumber(ticker.high)   : '—', c: "#B0E4CC" },
            { l: 'Giá thấp nhất',  v: ticker.low    ? formatNumber(ticker.low)    : '—', c: "#ef4444"   },
            { l: 'Khối lượng 24h', v: ticker.volume ? formatNumber(ticker.volume) : '—', c: "#e2e8f0"  },
          ].map(x => (
            <div key={x.l}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{x.l}</div>
              <div style={{ fontWeight: 700, color: x.c, fontFamily: 'monospace', fontSize: 15, marginTop: 2 }}>{x.v}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN: ORDER BOOK + ORDER PANEL ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 24, alignItems: 'start' }}>

          {/* ORDER BOOK */}
          <div className="caro-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="caro-section-header">
              <h3 className="caro-section-title">Sổ lệnh</h3>
            </div>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '8px 12px', color: "#94a3b8", fontSize: 11, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <span>KL (Mua)</span>
              <span style={{ textAlign: 'right' }}>Giá Mua</span>
              <span style={{ paddingLeft: 12 }}>Giá Bán</span>
              <span style={{ textAlign: 'right' }}>KL (Bán)</span>
            </div>

            {/* Order rows */}
            {Array.from({ length: levels }, (_, i) => {
              const bid = dispBids[i];
              const ask = dispAsks[i];
              const bPct = bid ? (bid.amount / maxBid) * 100 : 0;
              const aPct = ask ? (ask.amount / maxAsk) * 100 : 0;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', height: 28 }}>

                  {/* BID qty */}
                  <div
                    onClick={() => bid && selectPrice(bid.price)}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 12px', cursor: bid ? 'pointer' : 'default', overflow: 'hidden' }}
                  >
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${bPct}%`, background: 'rgba(176, 228, 204,0.15)', transition: 'width 0.3s' }} />
                    <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
                      {bid ? formatNumber(bid.amount) : ''}
                    </span>
                  </div>

                  {/* BID price */}
                  <div
                    onClick={() => bid && selectPrice(bid.price)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px', cursor: bid ? 'pointer' : 'default' }}
                  >
                    <span style={{ color: "#B0E4CC", fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
                      {bid ? formatNumber(bid.price) : ''}
                    </span>
                  </div>

                  {/* ASK price */}
                  <div
                    onClick={() => ask && selectPrice(ask.price)}
                    style={{ display: 'flex', alignItems: 'center', padding: '0 12px', paddingLeft: 14, cursor: ask ? 'pointer' : 'default', borderLeft: '1px solid var(--border)' }}
                  >
                    <span style={{ color: "#ef4444", fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
                      {ask ? formatNumber(ask.price) : ''}
                    </span>
                  </div>

                  {/* ASK qty */}
                  <div
                    onClick={() => ask && selectPrice(ask.price)}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 12px', cursor: ask ? 'pointer' : 'default', overflow: 'hidden' }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${aPct}%`, background: 'rgba(239,68,68,0.15)', transition: 'width 0.3s' }} />
                    <span style={{ color: "#94a3b8", fontSize: 12, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
                      {ask ? formatNumber(ask.amount) : ''}
                    </span>
                  </div>

                </div>
              );
            })}

            {/* Last price strip */}
            <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: "#f8fafc" }}>
                {lastPrice ? formatNumber(lastPrice) : '—'} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>VNĐ</span>
              </span>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 600 }}>
                <span style={{ color: "#94a3b8" }}>H: <b style={{ color: "#B0E4CC" }}>{ticker.high ? formatNumber(ticker.high) : '—'}</b></span>
                <span style={{ color: "#94a3b8" }}>L: <b style={{ color: "#ef4444" }}>{ticker.low ? formatNumber(ticker.low) : '—'}</b></span>
              </div>
            </div>

            <div style={{ padding: '8px 16px', fontSize: 11, color: "#64748b", textAlign: 'center', fontStyle: 'italic' }}>
              * Nhấn vào một mức giá để tự điền vào form đặt lệnh
            </div>
          </div>

          {/* ── ORDER PANEL ── */}
          <div className="caro-card">

            {/* Order type tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              {ORDER_TYPES.map(ot => (
                <div key={ot.key} style={{ position: 'relative' }}>
                  <button
                    onClick={() => !ot.comingSoon && setOrderType(ot.key)}
                    title={ot.comingSoon ? 'Tính năng sắp ra mắt' : ''}
                    style={{
                      padding: '10px 18px', background: 'transparent', border: 'none',
                      cursor: ot.comingSoon ? 'default' : 'pointer',
                      color: orderType === ot.key ? "#f8fafc" : "#94a3b8",
                      fontWeight: orderType === ot.key ? 700 : 500,
                      fontSize: 13,
                      borderBottom: orderType === ot.key ? '2px solid #B0E4CC' : '2px solid transparent',
                      marginBottom: -1,
                      opacity: ot.comingSoon ? 0.45 : 1,
                      transition: 'color 0.15s',
                    }}
                  >{ot.label}</button>
                  {ot.comingSoon && (
                    <span className="caro-badge caro-badge-muted" style={{ position: 'absolute', top: 4, right: 2, padding: "2px 4px", fontSize: 9 }}>Soon</span>
                  )}
                </div>
              ))}
              {orderType === 'market' && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: "#64748b", alignSelf: 'center', paddingRight: 4 }}>
                  Lệnh khớp ngay theo giá tốt nhất
                </span>
              )}
            </div>

            {/* BUY + SELL forms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* ─── BUY FORM ─── */}
              <div>
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(176, 228, 204,0.05)', borderRadius: 8, border: '1px solid rgba(176, 228, 204,0.15)' }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>SỨC MUA TỐI ĐA</div>
                  <div style={{ fontWeight: 800, color: "#B0E4CC", fontSize: 16, fontFamily: 'monospace' }}>
                    {formatNumber(maxBuyQty)} <span style={{ fontSize: 12 }}>{token}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {formatVND(vndAvail)} khả dụng
                    {buyPriceN > 0 && (
                      <span> ÷ {formatNumber(buyPriceN)}</span>
                    )}
                  </div>
                </div>

                <Stepper
                  label={orderType === 'market' ? 'Giá thị trường (VNĐ)' : 'Giá Mua (VNĐ)'}
                  value={buyPrice}
                  onChange={setBuyPrice}
                  step={1}
                  disabled={orderType === 'market'}
                />

                <Stepper
                  label={`Số lượng (${token})`}
                  value={buyAmount}
                  onChange={setBuyAmount}
                  step={1}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: 16 }}>
                  <span style={{ color: "#94a3b8" }}>Tổng giá trị lệnh</span>
                  <span style={{ color: "#f8fafc", fontWeight: 700, fontFamily: 'monospace' }}>{formatVND(buyPriceN * buyAmtN)}</span>
                </div>

                <button
                  onClick={() => placeOrder('buy')}
                  disabled={placing === 'buy'}
                  className="caro-btn caro-btn-success"
                  style={{ width: '100%', padding: '12px 0', fontSize: 15 }}
                >{placing === 'buy' ? 'Đang đặt…' : 'MUA'}</button>
              </div>

              {/* ─── SELL FORM ─── */}
              <div>
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>SỐ LƯỢNG CÓ THỂ BÁN</div>
                  <div style={{ fontWeight: 800, color: "#ef4444", fontSize: 16, fontFamily: 'monospace' }}>
                    {formatNumber(tokAvail)} <span style={{ fontSize: 12 }}>{token}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {token} khả dụng trong ví
                  </div>
                </div>

                <Stepper
                  label={orderType === 'market' ? 'Giá thị trường (VNĐ)' : 'Giá Bán (VNĐ)'}
                  value={sellPrice}
                  onChange={setSellPrice}
                  step={1}
                  disabled={orderType === 'market'}
                />

                <Stepper
                  label={`Số lượng (${token})`}
                  value={sellAmount}
                  onChange={setSellAmount}
                  step={1}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginBottom: 16 }}>
                  <span style={{ color: "#94a3b8" }}>Tổng thu về</span>
                  <span style={{ color: "#f8fafc", fontWeight: 700, fontFamily: 'monospace' }}>{formatVND(sellPriceN * sellAmtN)}</span>
                </div>

                <button
                  onClick={() => placeOrder('sell')}
                  disabled={placing === 'sell'}
                  className="caro-btn caro-btn-danger"
                  style={{ width: '100%', padding: '12px 0', fontSize: 15 }}
                >{placing === 'sell' ? 'Đang đặt…' : 'BÁN'}</button>
              </div>

            </div>

          </div>

        </div>

        {/* ── BOTTOM TABS ── */}
        <div className="caro-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px', background: "rgba(255,255,255,0.02)" }}>
            {[
              { key: 'open',    label: `Lệnh đang mở (${openOrders.length})` },
              { key: 'history', label: 'Lịch sử khớp lệnh' },
            ].map(t => (
              <button key={t.key} onClick={() => setBottomTab(t.key)} style={{
                padding: '14px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
                color: bottomTab === t.key ? "#f8fafc" : "#94a3b8",
                fontWeight: bottomTab === t.key ? 700 : 500, fontSize: 14,
                borderBottom: bottomTab === t.key ? '2px solid #B0E4CC' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
              }}>{t.label}</button>
            ))}
          </div>

          <div>

            {bottomTab === 'open' && (
              openOrders.length === 0
                ? <div className="caro-empty" style={{ padding: "40px" }}><div className="caro-empty-icon">📂</div><div className="caro-empty-title">Không có lệnh mở</div></div>
                : (
                <div className="caro-table-wrap">
                  <table className="caro-table">
                    <thead>
                      <tr>
                        <th>#ID</th>
                        <th>Cặp</th>
                        <th>Loại</th>
                        <th>Giá (VNĐ)</th>
                        <th>Số lượng</th>
                        <th>Còn lại</th>
                        <th>Trạng thái</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {openOrders.map(o => (
                        <tr key={o.id}>
                          <td style={{ color: "#94a3b8" }}>#{o.id}</td>
                          <td><span className="caro-badge caro-badge-muted">{o.pair}</span></td>
                          <td style={{ fontWeight: 800, color: o.side === 'buy' ? "#B0E4CC" : "#ef4444" }}>
                            {o.side === 'buy' ? 'MUA' : 'BÁN'}
                          </td>
                          <td style={{ fontFamily: 'monospace', color: "#f8fafc" }}>{formatNumber(o.price)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{Number(o.amount).toFixed(4)}</td>
                          <td style={{ fontFamily: 'monospace' }}>{Number(o.remaining).toFixed(4)}</td>
                          <td>
                            <span className={`caro-badge ${o.status === "partial" ? "caro-badge-warning" : "caro-badge-info"}`}>
                              {o.status === "partial" ? "Khớp 1 phần" : "Mở"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button onClick={() => cancelOrder(o.id)} className="caro-btn caro-btn-ghost caro-btn-sm" style={{ color: "#ef4444" }}>
                              Hủy lệnh
                            </button>
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
                ? <div className="caro-empty" style={{ padding: "40px" }}><div className="caro-empty-icon">⏳</div><div className="caro-empty-title">Chưa có lịch sử khớp lệnh</div></div>
                : (
                <div className="caro-table-wrap">
                  <table className="caro-table">
                    <thead>
                      <tr>
                        <th>#ID</th>
                        <th>Giá (VNĐ)</th>
                        <th>Số lượng</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHist.slice(0, 30).map(t => (
                        <tr key={t.id}>
                          <td style={{ color: "#94a3b8" }}>#{t.id}</td>
                          <td style={{ fontFamily: 'monospace', color: "#f8fafc", fontWeight: 600 }}>{formatNumber(t.price)}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{Number(t.amount).toFixed(4)}</td>
                          <td style={{ color: "#94a3b8" }}>
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
