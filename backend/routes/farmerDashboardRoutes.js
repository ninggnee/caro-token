import express from 'express';
import { getDashboard, getTokenHoldings } from '../controllers/farmerDashboardController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Single aggregated call: token balances (DB) + batch stats + VND wallet
router.get('/dashboard',       verifyToken, requireRole('farmer'), getDashboard);

// Token holdings with minted batch provenance
router.get('/token-holdings',  verifyToken, requireRole('farmer'), getTokenHoldings);

export default router;
