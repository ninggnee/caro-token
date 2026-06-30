/**
 * MockMarketEngine — pure in-memory market simulation.
 *
 * MARKET_MODE=MOCK:
 *   All data lives only in process memory.
 *   No database reads or writes whatsoever.
 *   Resets completely on server restart.
 *
 * Architecture (provider pattern — swap for LiveMarketProvider in future):
 *
 *   MarketService
 *   ├── MockMarketProvider  ← this file (MARKET_MODE=MOCK)
 *   └── LiveMarketProvider  ← future (MARKET_MODE=LIVE)
 *
 * Exports (named):
 *   initialize()   — seed in-memory data (call once on startup)
 *   start()        — begin periodic price ticks
 *   stop()         — stop ticks
 *   getStats()     — [{token, lastPrice, change24h, high24h, low24h, volume24h, marketCap, ...}]
 *   getPrices()    — { CR1: { price, change24h, volume24h }, ... }
 *   getOrderBook(token, depth) — { bids, asks }
 *   getTrades(token, limit)    — [{id,token,price,quantity,value,side,executedAt}...]
 *   getChart(token, time)      — { data: { CR1: [...candles] }, interval }
 *   getCandles(token, interval, limit) — [...candles]
 *   isReady()      — boolean
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const TOKENS      = ['CR1', 'CR2', 'CR3'];
const BASE_PRICES = { CR1: 88_000, CR2: 86_500, CR3: 85_000 };
const SUPPLY      = { CR1: 1_000_000, CR2: 800_000, CR3: 600_000 };

// Rule 6: prices stay in 85,000–92,000 VND range
// Rule 7: intraday ±0.1%–0.5% per update, max ±3% daily
const MEAN_REVERT    = 0.06;   // pull-back toward base price per tick
const NOISE_PER_TICK = 0.003;  // random noise ±0.3% per tick (Rule 7: 0.1%–0.5%)
const MAX_DRIFT      = 0.03;   // price never drifts more than ±3% from base (Rule 7)
const ORDER_SPREAD   = 0.02;   // ±2% spread for order book levels
const BOOK_DEPTH     = 20;     // order book levels per side
const TRADE_BUFFER   = 200;    // trades kept per token

// Rule 3: tick size 100 VND
const TICK_SIZE = 100;
// Rule 2: daily trading band ±7%
const BAND_PCT  = 0.07;

const TICK_MIN_MS = 10_000;
const TICK_MAX_MS = 30_000;

// Max candles kept per interval in memory
const CANDLE_MAX = { '1m': 120, '5m': 288, '15m': 96, '1h': 720, '1d': 365 };
const INTERVAL_S = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 };

// time param → interval + limit for chart API
const TIME_MAP = {
  '1h':  { interval: '1m',  limit: 60  },
  '24h': { interval: '5m',  limit: 288 },
  '7d':  { interval: '1h',  limit: 168 },
  '30d': { interval: '1h',  limit: 720 },
  '90d': { interval: '1d',  limit: 90  },
  '1y':  { interval: '1d',  limit: 365 },
};

const TOKEN_ALIAS = {
  caro1: 'CR1', caro2: 'CR2', caro3: 'CR3',
  cr1:   'CR1', cr2:   'CR2', cr3:   'CR3',
};

// ── Math helpers ──────────────────────────────────────────────────────────────

const rand    = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

function movePrice(current, token) {
  const base      = BASE_PRICES[token];
  const deviation = (current - base) / base;
  const step      = -deviation * MEAN_REVERT + (Math.random() - 0.5) * 2 * NOISE_PER_TICK;
  const next      = Math.round(current * (1 + step));
  return Math.max(Math.round(base * (1 - MAX_DRIFT)),
         Math.min(Math.round(base * (1 + MAX_DRIFT)), next));
}

/** Floor a Date to the start of a candle interval. Returns new Date. */
function floorToInterval(date, secs) {
  const ms = secs * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

// ── In-memory state ───────────────────────────────────────────────────────────
// All data is module-level variables — only accessible via getter functions.

let _prices     = {};  // { CR1: number }
let _refPrices  = {};  // { CR1: number } — previous day's closing price (Rule 1: T-1 reference)
let _stats      = {};  // { CR1: StatObject }
let _orderBooks = {};  // { CR1: { bids:[{price,qty}], asks:[{price,qty}] } }
let _trades     = {};  // { CR1: TradeObject[] }
let _candles    = {};  // { CR1: { '1m':[...], '5m':[...], '1h':[...], '1d':[...] } }

let _ready   = false;
let _timer   = null;
let _tradeId = 1;

// ── Seed functions (run once at initialize) ───────────────────────────────────

function seedHistoricalCandles() {
  const now = new Date();

  for (const token of TOKENS) {
    _candles[token] = {};
    let price = BASE_PRICES[token];

    // ── 1d: 365 candles ────────────────────────────────────────────────────
    const c1d = [];
    for (let d = 365; d >= 1; d--) {
      price = movePrice(price, token);
      const ts = new Date(now); ts.setDate(ts.getDate() - d); ts.setHours(0, 0, 0, 0);
      const o = price, c = movePrice(o, token);
      const h = Math.max(o, c) + randInt(200, Math.round(price * 0.018));
      const l = Math.max(1, Math.min(o, c) - randInt(200, Math.round(price * 0.018)));
      c1d.push({ openTime: ts.toISOString(), open: o, high: h, low: l, close: c, volume: randInt(5000, 60000), tradeCount: randInt(30, 250) });
    }
    _candles[token]['1d'] = c1d;

    // ── 1h: 720 candles ────────────────────────────────────────────────────
    const c1h = [];
    price = BASE_PRICES[token];
    for (let h = 720; h >= 1; h--) {
      price = movePrice(price, token);
      const ts = floorToInterval(new Date(now.getTime() - h * 3600_000), 3600);
      const o = price, c = movePrice(o, token);
      const hi = Math.max(o, c) + randInt(50, Math.round(price * 0.008));
      const lo = Math.max(1, Math.min(o, c) - randInt(50, Math.round(price * 0.008)));
      c1h.push({ openTime: ts.toISOString(), open: o, high: hi, low: lo, close: c, volume: randInt(500, 8000), tradeCount: randInt(5, 60) });
    }
    _candles[token]['1h'] = c1h;

    // ── 15m: 96 candles ────────────────────────────────────────────────────
    const c15m = [];
    price = BASE_PRICES[token];
    for (let i = 96; i >= 1; i--) {
      price = movePrice(price, token);
      const ts = floorToInterval(new Date(now.getTime() - i * 900_000), 900);
      const o = price, c = movePrice(o, token);
      const hi = Math.max(o, c) + randInt(20, Math.round(price * 0.004));
      const lo = Math.max(1, Math.min(o, c) - randInt(20, Math.round(price * 0.004)));
      c15m.push({ openTime: ts.toISOString(), open: o, high: hi, low: lo, close: c, volume: randInt(100, 1500), tradeCount: randInt(2, 25) });
    }
    _candles[token]['15m'] = c15m;

    // ── 5m: 288 candles ────────────────────────────────────────────────────
    const c5m = [];
    price = BASE_PRICES[token];
    for (let i = 288; i >= 1; i--) {
      price = movePrice(price, token);
      const ts = floorToInterval(new Date(now.getTime() - i * 300_000), 300);
      const o = price, c = movePrice(o, token);
      const hi = Math.max(o, c) + randInt(10, Math.round(price * 0.002));
      const lo = Math.max(1, Math.min(o, c) - randInt(10, Math.round(price * 0.002)));
      c5m.push({ openTime: ts.toISOString(), open: o, high: hi, low: lo, close: c, volume: randInt(50, 500), tradeCount: randInt(1, 10) });
    }
    _candles[token]['5m'] = c5m;

    // ── 1m: 120 candles ────────────────────────────────────────────────────
    const c1m = [];
    price = BASE_PRICES[token];
    for (let i = 120; i >= 1; i--) {
      price = movePrice(price, token);
      const ts = floorToInterval(new Date(now.getTime() - i * 60_000), 60);
      const o = price, c = movePrice(o, token);
      const hi = Math.max(o, c) + randInt(5, Math.round(price * 0.001));
      const lo = Math.max(1, Math.min(o, c) - randInt(5, Math.round(price * 0.001)));
      c1m.push({ openTime: ts.toISOString(), open: o, high: hi, low: lo, close: c, volume: randInt(10, 200), tradeCount: randInt(1, 8) });
    }
    _candles[token]['1m'] = c1m;

    // Set live price from last 1h candle
    const lastHour = _candles[token]['1h'][_candles[token]['1h'].length - 1];
    _prices[token] = lastHour.close;

    // Rule 1: reference price = previous day's closing price
    const lastDay = _candles[token]['1d'][_candles[token]['1d'].length - 1];
    _refPrices[token] = lastDay.close;
  }
}

function seedStats() {
  const now = new Date();
  for (const token of TOKENS) {
    const price   = _prices[token];
    const since   = now.getTime() - 24 * 3600_000;
    const recent  = (_candles[token]['1h'] || []).filter(c => new Date(c.openTime).getTime() >= since);
    const high24  = recent.length ? Math.max(...recent.map(c => c.high))           : price;
    const low24   = recent.length ? Math.min(...recent.map(c => c.low))            : price;
    const vol24   = recent.length ? recent.reduce((s, c) => s + c.volume, 0)        : 0;
    const open24  = recent.length ? recent[0].open                                  : price;
    const trades24= recent.length ? recent.reduce((s, c) => s + c.tradeCount, 0)    : 0;
    const change  = open24 > 0 ? ((price - open24) / open24) * 100 : 0;

    _stats[token] = {
      token,
      last_price:       price,
      open_price:       open24,
      high_24h:         high24,
      low_24h:          low24,
      volume_24h:       vol24,
      change_24h:       parseFloat(change.toFixed(4)),
      trade_count_24h:  trades24,
      market_cap:       Math.round(price * SUPPLY[token]),
      dayStart:         new Date(now).setHours(0, 0, 0, 0),
    };
  }
}

function seedOrderBook(token) {
  const price = _prices[token];
  const bids  = [], asks = [];
  for (let i = 0; i < BOOK_DEPTH; i++) {
    bids.push({ price: Math.max(1, Math.round(price * (1 - rand(0.001, ORDER_SPREAD)))), qty: randInt(10, 500) });
    asks.push({ price: Math.round(price * (1 + rand(0.001, ORDER_SPREAD))), qty: randInt(10, 500) });
  }
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);
  _orderBooks[token] = { bids, asks };
}

// ── Tick — runs every 10–30s ─────────────────────────────────────────────────

function tickToken(token) {
  const now      = new Date();
  const newPrice = movePrice(_prices[token], token);
  _prices[token] = newPrice;

  // Simulate 1–4 trades
  const numTrades = randInt(1, 4);
  let tickVol = 0;
  for (let i = 0; i < numTrades; i++) {
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const qty  = randInt(10, 500);
    const px   = Math.round(newPrice * (1 + (Math.random() - 0.5) * 0.004));
    _trades[token].unshift({
      id: _tradeId++, token,
      price: px, quantity: qty,
      value: Math.round(px * qty),
      side,
      executedAt: now.toISOString(),
    });
    tickVol += qty;
  }
  if (_trades[token].length > TRADE_BUFFER) _trades[token].length = TRADE_BUFFER;

  // Update stats
  const st = _stats[token];
  st.last_price       = newPrice;
  st.high_24h         = Math.max(st.high_24h, newPrice);
  st.low_24h          = Math.min(st.low_24h, newPrice);
  st.volume_24h      += tickVol;
  st.trade_count_24h += numTrades;
  st.change_24h       = st.open_price > 0
    ? parseFloat(((newPrice - st.open_price) / st.open_price * 100).toFixed(4))
    : 0;
  st.market_cap       = Math.round(newPrice * SUPPLY[token]);

  // Reset 24h window at midnight
  if (now.getTime() - st.dayStart >= 24 * 3600_000) {
    // Rule 1: today's closing price becomes tomorrow's reference price
    _refPrices[token]  = newPrice;
    st.open_price      = newPrice;
    st.high_24h        = newPrice;
    st.low_24h         = newPrice;
    st.volume_24h      = 0;
    st.trade_count_24h = 0;
    st.change_24h      = 0;
    st.dayStart        = new Date(now).setHours(0, 0, 0, 0);
  }

  // Update candles
  updateCandle(token, newPrice, tickVol, now);

  // Refresh order book
  refreshOrderBook(token, newPrice);
}

function updateCandle(token, price, volume, now) {
  for (const [iv, secs] of Object.entries(INTERVAL_S)) {
    const openT   = floorToInterval(now, secs);
    const openStr = openT.toISOString();
    const cs      = _candles[token][iv];

    if (cs.length > 0 && cs[cs.length - 1].openTime === openStr) {
      const c = cs[cs.length - 1];
      c.high   = Math.max(c.high, price);
      c.low    = Math.min(c.low, price);
      c.close  = price;
      c.volume = (c.volume || 0) + volume;
      c.tradeCount++;
    } else {
      cs.push({ openTime: openStr, open: price, high: price, low: price, close: price, volume, tradeCount: 1 });
      if (cs.length > CANDLE_MAX[iv]) cs.shift();
    }
  }
}

function refreshOrderBook(token, price) {
  const ob = _orderBooks[token];
  if (!ob) return;

  // Expire stale levels that crossed price
  ob.bids = ob.bids.filter(b => b.price < price);
  ob.asks = ob.asks.filter(a => a.price > price);

  // Refill to BOOK_DEPTH
  while (ob.bids.length < BOOK_DEPTH)
    ob.bids.push({ price: Math.max(1, Math.round(price * (1 - rand(0.001, ORDER_SPREAD)))), qty: randInt(10, 500) });
  while (ob.asks.length < BOOK_DEPTH)
    ob.asks.push({ price: Math.round(price * (1 + rand(0.001, ORDER_SPREAD))), qty: randInt(10, 500) });

  ob.bids.sort((a, b) => b.price - a.price);
  ob.asks.sort((a, b) => a.price - b.price);
  ob.bids = ob.bids.slice(0, BOOK_DEPTH);
  ob.asks = ob.asks.slice(0, BOOK_DEPTH);
}

// ── Public getters ────────────────────────────────────────────────────────────

// Rule 2: trading band = reference price ±7%
export function getTradingBand(token) {
  const ref     = _refPrices[token] || BASE_PRICES[token];
  const floor   = Math.round(ref * (1 - BAND_PCT));
  const ceiling = Math.round(ref * (1 + BAND_PCT));
  return { ref, floor, ceiling, tickSize: TICK_SIZE };
}

export function getAllTradingBands() {
  const out = {};
  for (const t of TOKENS) out[t] = getTradingBand(t);
  return out;
}

export function getStats() {
  return TOKENS.map(t => {
    const band = getTradingBand(t);
    return { ..._stats[t], reference_price: band.ref, floor_price: band.floor, ceiling_price: band.ceiling, tick_size: TICK_SIZE };
  });
}

export function getPrices() {
  const out = {};
  for (const t of TOKENS) {
    out[t] = { price: _prices[t], change24h: _stats[t]?.change_24h || 0, volume24h: _stats[t]?.volume_24h || 0 };
  }
  return out;
}

export function getOrderBook(token, depth = 20) {
  const ob = _orderBooks[token];
  if (!ob) return { bids: [], asks: [] };
  return { bids: ob.bids.slice(0, depth), asks: ob.asks.slice(0, depth) };
}

export function getTrades(token, limit = 50) {
  if (token === 'all') {
    const merged = TOKENS.flatMap(t => _trades[t] || []);
    merged.sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
    return merged.slice(0, limit);
  }
  return (_trades[token] || []).slice(0, limit);
}

export function getChart(tokenParam = 'all', timeParam = '24h') {
  const cfg    = TIME_MAP[timeParam.toLowerCase()] || TIME_MAP['24h'];
  const tokens = tokenParam.toLowerCase() === 'all'
    ? TOKENS
    : [TOKEN_ALIAS[tokenParam.toLowerCase()] || tokenParam.toUpperCase()];

  const data = {};
  for (const t of tokens) {
    const cs = _candles[t]?.[cfg.interval] || [];
    data[t]  = cs.slice(-cfg.limit);
  }
  return { data, interval: cfg.interval };
}

export function getCandles(token, interval, limit) {
  const cs = _candles[token]?.[interval] || [];
  return cs.slice(-limit);
}

export function isReady() { return _ready; }

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export async function initialize() {
  // Reset all state
  _prices = {}; _refPrices = {}; _stats = {}; _orderBooks = {}; _trades = {}; _candles = {};
  _tradeId = 1; _ready = false;

  for (const t of TOKENS) {
    _prices[t] = BASE_PRICES[t];
    _trades[t] = [];
  }

  // Generate all in-memory data (synchronous, no DB)
  seedHistoricalCandles();
  seedStats();
  for (const t of TOKENS) seedOrderBook(t);

  _ready = true;
  console.log('✅ MockMarketEngine (in-memory, no DB): initialized');
}

export async function start() {
  if (_timer) return;
  const run = () => {
    if (_ready) {
      for (const t of TOKENS) {
        try { tickToken(t); } catch (e) { console.warn(`MockMarket tick [${t}]:`, e.message); }
      }
    }
    _timer = setTimeout(run, randInt(TICK_MIN_MS, TICK_MAX_MS));
  };
  _timer = setTimeout(run, 5_000);
  console.log(`🚀 MockMarketEngine: ticking every ${TICK_MIN_MS / 1000}–${TICK_MAX_MS / 1000}s`);
}

export async function stop() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
  _ready = false;
  console.log('🛑 MockMarketEngine stopped');
}

export default { initialize, start, stop, getStats, getPrices, getOrderBook, getTrades, getChart, getCandles, isReady };