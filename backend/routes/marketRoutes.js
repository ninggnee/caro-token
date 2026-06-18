import express from 'express';
import { getTickers, getOrderbook, listTrades } from '../controllers/marketController.js';

const router = express.Router();
router.get('/tickers', getTickers);
router.get('/orderbook', getOrderbook);
router.get('/trades', listTrades);
export default router;
