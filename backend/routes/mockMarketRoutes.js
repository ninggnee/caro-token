import express from 'express';
import {
  getMarketStats,
  getMarketPrices,
  getChartHandler,
  getOrderbook,
  getRecentTrades,
  getCandlesHandler,
  getTradingBandHandler,
} from '../controllers/mockMarketController.js';

const router = express.Router();

// All data served from in-memory MockMarketEngine (MARKET_MODE=MOCK)
// No database reads or writes
router.get('/stats',     getMarketStats);
router.get('/prices',    getMarketPrices);
router.get('/chart',     getChartHandler);    // ?token=all|caro1|caro2|caro3  &time=1h|24h|7d|30d|90d|1y
router.get('/orderbook', getOrderbook);        // ?token=CR1|all  &depth=20
router.get('/trades',    getRecentTrades);     // ?token=CR1|all  &limit=50
router.get('/candles',   getCandlesHandler);   // ?token=CR1  &interval=1h  &limit=100
router.get('/band',      getTradingBandHandler); // Rule 1 & 2: reference price + floor/ceiling for all tokens

export default router;