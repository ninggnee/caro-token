import express from 'express';
import { createTokenRequest, listTokenRequestsForUser, listTokenRequests, getTokenRequest, reviewTokenRequest, mintToken, getUserBalances, getOnChainBalances } from '../controllers/tokenController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/requests', verifyToken, requireRole('farmer'), createTokenRequest);
router.get('/requests', verifyToken, requireRole('farmer'), listTokenRequestsForUser);

// balances
router.get('/balances', verifyToken, requireRole('farmer'), getUserBalances);
router.get('/balances/onchain', verifyToken, requireRole('farmer'), getOnChainBalances);

// admin
router.get('/admin/requests', verifyToken, requireRole('admin'), listTokenRequests);
router.get('/admin/requests/:id', verifyToken, requireRole('admin'), getTokenRequest);
router.post('/admin/requests/:id/review', verifyToken, requireRole('admin'), reviewTokenRequest);
router.post('/admin/requests/:id/mint', verifyToken, requireRole('admin'), mintToken);

export default router;
