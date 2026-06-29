import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import {
  placeOrder, cancelOrder, getOpenOrders, getAllBuyOrders,
  getOrderbook, getTradeHistory, getTickers,
  getMyTokenBalances, getPublicMarketChart,
} from '../controllers/orderController.js';

const router = express.Router();

router.post  ('/',             verifyToken, placeOrder);
router.delete('/:id',         verifyToken, cancelOrder);
router.get   ('/open',        verifyToken, getOpenOrders);
router.get   ('/buy-orders',  verifyToken, getAllBuyOrders);
router.get   ('/orderbook',               getOrderbook);
router.get   ('/trades',      verifyToken, getTradeHistory);
router.get   ('/tickers',                 getTickers);
router.get   ('/my-balances', verifyToken, getMyTokenBalances);
router.get   ('/pub-chart',               getPublicMarketChart);

export default router;
