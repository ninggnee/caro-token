import axios from '../utils/axiosClient';

/** GET /api/market/stats — all tokens' 24h stats */
export const getMarketStats = () =>
  axios.get('/market/stats').then(r => r.data);

/** GET /api/market/prices — { CR1: { price, change24h, volume24h }, ... } */
export const getMarketPrices = () =>
  axios.get('/market/prices').then(r => r.data);

/**
 * GET /api/market/chart
 * @param {string} token  "all" | "caro1" | "caro2" | "caro3"
 * @param {string} time   "1h" | "24h" | "7d" | "30d" | "90d" | "1y"
 * Returns { data: { CR1: [...candles], CR2: [...], CR3: [...] } }
 */
export const getChart = (token = 'all', time = '24h') =>
  axios.get('/market/chart', { params: { token, time } }).then(r => r.data);

/**
 * GET /api/market/orderbook?token=CR1|all&depth=20
 * Returns { bids: [{price,qty}], asks: [{price,qty}] }
 */
export const getMockOrderbook = (token, depth = 20) =>
  axios.get('/market/orderbook', { params: { token, depth } }).then(r => r.data);

/**
 * GET /api/market/trades?token=CR1|all&limit=50
 * Returns { trades: [{id,token,price,quantity,value,side,executedAt}] }
 */
export const getMockTrades = (token, limit = 50) =>
  axios.get('/market/trades', { params: { token, limit } }).then(r => r.data);

/**
 * GET /api/market/candles?token=CR1&interval=1h&limit=100
 * Returns { candles: [{openTime,closeTime,open,high,low,close,volume,tradeCount}] }
 */
export const getCandles = (token, interval = '1h', limit = 100) =>
  axios.get('/market/candles', { params: { token, interval, limit } }).then(r => r.data);

/**
 * GET /api/market/band — reference price, floor, ceiling per token (Rules 1 & 2)
 * Returns { bands: { CR1: { ref, floor, ceiling, tickSize }, ... } }
 */
export const getTradingBand = () =>
  axios.get('/market/band').then(r => r.data);

// ── Real-data equivalents (sync with Trader activity via orders DB) ──────────

/** GET /api/orders/tickers — live 24h stats from real trades */
export const getOrdersTickers = () =>
  axios.get('/orders/tickers').then(r => r.data);

/**
 * GET /api/orders/orderbook — live order book from open orders
 * Returns { bids:[{price,qty}], asks:[{price,qty}] } (mapped from DB {amount} field)
 */
export const getOrdersOrderbook = (token, depth = 20) => {
  const pair = token === 'all' ? 'CR1/VND' : `${token}/VND`;
  return axios.get('/orders/orderbook', { params: { pair } })
    .then(r => {
      const { bids = [], asks = [] } = r.data?.data || {};
      return {
        bids: bids.map(b => ({ price: b.price, qty: b.amount })).slice(0, depth),
        asks: asks.map(a => ({ price: a.price, qty: a.amount })).slice(0, depth),
      };
    });
};

/**
 * GET /api/orders/trades — recent trades from real order matching
 * Maps to { trades:[{id,token,price,quantity,value,side,executedAt}] }
 */
export const getOrdersTrades = (token, limit = 50) => {
  const params = token === 'all' ? {} : { pair: `${token}/VND` };
  return axios.get('/orders/trades', { params })
    .then(r => {
      const trades = (r.data?.data || []).slice(0, limit).map(t => ({
        id:         t.id,
        token:      t.pair?.split('/')[0],
        price:      Number(t.price),
        quantity:   Number(t.amount),
        value:      Number(t.price) * Number(t.amount),
        side:       t.side,
        executedAt: t.created_at,
      }));
      return { trades };
    });
};

/**
 * GET /api/orders/pub-chart — OHLC chart built from real trades
 * Returns { data: { CR1:[{open,high,low,close,volume}], ... } }
 */
export const getOrdersChart = (token = 'all', time = '24h') =>
  axios.get('/orders/pub-chart', { params: { token, time } }).then(r => r.data);