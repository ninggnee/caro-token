/**
 * mockMarketController — reads exclusively from in-memory MockMarketEngine.
 * No database access. All data is generated at runtime (MARKET_MODE=MOCK).
 */

import {
  getStats,
  getPrices,
  getOrderBook,
  getTrades,
  getChart,
  getCandles,
  isReady,
  getAllTradingBands,
} from '../services/MockMarketEngine.js';

const TOKEN_ALIAS = {
  caro1: 'CR1', caro2: 'CR2', caro3: 'CR3',
  cr1:   'CR1', cr2:   'CR2', cr3:   'CR3',
};

function resolveToken(raw) {
  const s = (raw || '').toLowerCase().trim();
  return TOKEN_ALIAS[s] || s.toUpperCase();
}

function notReady(res) {
  return res.status(503).json({ success: false, message: 'MockMarketEngine is initializing, please retry in a moment.' });
}

// ── GET /api/market/stats ─────────────────────────────────────────────────────

export async function getMarketStats(req, res) {
  if (!isReady()) return notReady(res);
  try {
    res.json({ success: true, stats: getStats() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/market/prices ────────────────────────────────────────────────────

export async function getMarketPrices(req, res) {
  if (!isReady()) return notReady(res);
  try {
    res.json({ success: true, prices: getPrices() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/market/chart?token=all|caro1|caro2|caro3&time=1h|24h|7d|30d|90d|1y ──

export async function getChartHandler(req, res) {
  if (!isReady()) return notReady(res);
  const tokenParam = (req.query.token || 'all').toLowerCase();
  const timeParam  = (req.query.time  || '24h').toLowerCase();
  try {
    const result = getChart(tokenParam, timeParam);
    res.json({ success: true, token: tokenParam, time: timeParam, interval: result.interval, data: result.data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/market/orderbook?token=CR1|all&depth=20 ─────────────────────────

export async function getOrderbook(req, res) {
  if (!isReady()) return notReady(res);
  const rawToken = (req.query.token || 'CR1').toLowerCase();
  const depth    = Math.min(50, Math.max(1, parseInt(req.query.depth) || 20));
  const token    = rawToken === 'all' ? 'CR1' : resolveToken(rawToken);
  try {
    const { bids, asks } = getOrderBook(token, depth);
    res.json({ success: true, token, bids, asks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/market/trades?token=CR1|all&limit=50 ────────────────────────────

export async function getRecentTrades(req, res) {
  if (!isReady()) return notReady(res);
  const rawToken = (req.query.token || 'all').toLowerCase();
  const limit    = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const token    = rawToken === 'all' ? 'all' : resolveToken(rawToken);
  try {
    const trades = getTrades(token, limit);
    res.json({ success: true, token, trades });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/market/band — reference price, floor, ceiling for all tokens (Rule 1 & 2) ──

export async function getTradingBandHandler(req, res) {
  if (!isReady()) return notReady(res);
  try {
    res.json({ success: true, bands: getAllTradingBands() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── GET /api/market/candles?token=CR1&interval=1h&limit=100 ──────────────────

export async function getCandlesHandler(req, res) {
  if (!isReady()) return notReady(res);
  const token    = resolveToken(req.query.token || 'CR1');
  const interval = req.query.interval || '1h';
  const limit    = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
  const valid    = ['1m', '5m', '15m', '1h', '1d'];
  if (!valid.includes(interval)) {
    return res.status(400).json({ success: false, message: `interval must be one of: ${valid.join(', ')}` });
  }
  try {
    const candles = getCandles(token, interval, limit);
    res.json({ success: true, token, interval, candles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}