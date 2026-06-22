import { useState, useEffect, useCallback } from 'react';
import TraderLayout from '../components/layout/TraderLayout';
import OrderBook from '../components/trading/OrderBook';
import { API_URL } from '../config/api';

const PAIRS = ['CR1/VND', 'CR2/VND', 'CR3/VND'];

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
  const [pair,       setPair]       = useState('CR1/VND');
  const [bids,       setBids]       = useState([]);
  const [asks,       setAsks]       = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [tradeHist,  setTradeHist]  = useState([]);
  const [tickers,    setTickers]    = useState({});

  // Order form
  const [side,    setSide]    = useState('buy');
  const [price,   setPrice]   = useState('');
  const [amount,  setAmount]  = useState('');
  const [placing, setPlacing] = useState(false);
  const [msg,     setMsg]     = useState('');

  const loadOrderbook = useCallback(async () => {
    const data = await apiFetch(`/orders/orderbook?pair=${encodeURIComponent(pair)}`);
    if (data.success) {
      setBids(data.data.bids || []);
      setAsks(data.data.asks || []);
    }
  }, [pair]);

  const loadOpenOrders = useCallback(async () => {
    const data = await apiFetch(`/orders/open?pair=${encodeURIComponent(pair)}`);
    if (data.success) setOpenOrders(data.data || []);
  }, [pair]);

  const loadTradeHistory = useCallback(async () => {
    const data = await apiFetch(`/orders/trades?pair=${encodeURIComponent(pair)}`);
    if (data.success) setTradeHist(data.data || []);
  }, [pair]);

  const loadTickers = useCallback(async () => {
    const data = await apiFetch('/orders/tickers');
    if (data.success) {
      const map = {};
      data.data.forEach(t => { map[t.pair] = t; });
      setTickers(map);
    }
  }, []);

  useEffect(() => {
    loadOrderbook();
    loadOpenOrders();
    loadTradeHistory();
    loadTickers();
    const iv = setInterval(() => { loadOrderbook(); loadTickers(); }, 5000);
    return () => clearInterval(iv);
  }, [pair, loadOrderbook, loadOpenOrders, loadTradeHistory, loadTickers]);

  const placeOrder = async () => {
    if (!price || !amount) return setMsg('Vui lòng nhập Price và Amount');
    setPlacing(true);
    setMsg('');
    try {
      const data = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({ pair, side, price: Number(price), amount: Number(amount) }),
      });
      if (data.success) {
        setMsg(`✅ Đặt lệnh thành công. Status: ${data.status}. Khớp: ${data.trades} lệnh.`);
        setPrice(''); setAmount('');
        loadOpenOrders(); loadOrderbook(); loadTradeHistory();
      } else {
        setMsg(`❌ ${data.message}`);
      }
    } catch (e) {
      setMsg('❌ Lỗi kết nối server');
    }
    setPlacing(false);
  };

  const cancelOrder = async (id) => {
    const data = await apiFetch(`/orders/${id}`, { method: 'DELETE' });
    if (data.success) { loadOpenOrders(); loadOrderbook(); }
    else alert(data.message);
  };

  const ticker = tickers[pair];
  const lastPrice = ticker?.last_price ? Number(ticker.last_price).toLocaleString() : '—';

  return (
    <TraderLayout title={`Giao dịch — ${pair}`}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {PAIRS.map(p => (
          <button
            key={p}
            onClick={() => setPair(p)}
            style={{
              padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              background: pair === p ? '#4caf50' : 'rgba(255,255,255,0.08)',
              color: '#fff', border: 'none',
            }}
          >{p}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        {/* Price info */}
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 8px' }}>{pair}</h3>
          <div>Giá cuối: <b>{lastPrice} VNĐ</b></div>
          {ticker && (
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>
              High: {Number(ticker.high).toLocaleString()} &nbsp;|&nbsp;
              Low: {Number(ticker.low).toLocaleString()} &nbsp;|&nbsp;
              Volume: {Number(ticker.volume).toLocaleString()}
            </div>
          )}
        </div>

        {/* Order book */}
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
          <h4 style={{ margin: '0 0 6px' }}>Order Book</h4>
          <OrderBook bids={bids.slice(0,8)} asks={asks.slice(0,8)} />
        </div>
      </div>

      {/* Place order */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        {['buy','sell'].map(s => (
          <div key={s} style={{ padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 8px', color: s === 'buy' ? '#4caf50' : '#f44336' }}>
              {s === 'buy' ? 'Mua (BUY)' : 'Bán (SELL)'}
            </h4>
            <div style={{ display: 'grid', gap: 6 }}>
              <input
                placeholder="Price (VNĐ)"
                value={side === s ? price : ''}
                onChange={e => { setSide(s); setPrice(e.target.value); }}
                onClick={() => setSide(s)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #555', background: '#1a1a2e', color: '#fff' }}
              />
              <input
                placeholder="Amount (token)"
                value={side === s ? amount : ''}
                onChange={e => { setSide(s); setAmount(e.target.value); }}
                onClick={() => setSide(s)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #555', background: '#1a1a2e', color: '#fff' }}
              />
              <button
                onClick={() => { setSide(s); setTimeout(placeOrder, 0); }}
                disabled={placing}
                style={{
                  padding: '8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: s === 'buy' ? '#4caf50' : '#f44336', color: '#fff', fontWeight: 600,
                }}
              >
                {placing && side === s ? 'Đang đặt...' : s === 'buy' ? 'Đặt lệnh MUA' : 'Đặt lệnh BÁN'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {msg && <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: 'rgba(255,255,255,0.06)' }}>{msg}</div>}

      {/* Open Orders */}
      <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 8px' }}>Lệnh đang mở ({openOrders.length})</h4>
        {openOrders.length === 0
          ? <div style={{ color: '#888' }}>Không có lệnh mở</div>
          : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>ID</th>
                <th>Loại</th><th>Giá</th><th>Số lượng</th><th>Còn lại</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {openOrders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '4px 8px' }}>#{o.id}</td>
                  <td style={{ color: o.side === 'buy' ? '#4caf50' : '#f44336' }}>
                    {o.side.toUpperCase()}
                  </td>
                  <td>{Number(o.price).toLocaleString()}</td>
                  <td>{Number(o.amount).toFixed(4)}</td>
                  <td>{Number(o.remaining).toFixed(4)}</td>
                  <td>{o.status}</td>
                  <td>
                    <button
                      onClick={() => cancelOrder(o.id)}
                      style={{ padding: '2px 8px', background: '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >Hủy</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Trade History */}
      <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
        <h4 style={{ margin: '0 0 8px' }}>Lịch sử giao dịch</h4>
        {tradeHist.length === 0
          ? <div style={{ color: '#888' }}>Chưa có giao dịch</div>
          : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px' }}>ID</th>
                <th>Giá</th><th>Số lượng</th><th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {tradeHist.slice(0, 20).map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '4px 8px' }}>#{t.id}</td>
                  <td>{Number(t.price).toLocaleString()} VNĐ</td>
                  <td>{Number(t.amount).toFixed(4)}</td>
                  <td style={{ color: '#888', fontSize: 12 }}>
                    {new Date(t.created_at).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </TraderLayout>
  );
}
