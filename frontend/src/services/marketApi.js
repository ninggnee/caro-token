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