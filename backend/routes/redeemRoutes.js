import express from 'express';
import { createRedeem, listRedeemsForUser, listRedeems, reviewRedeem } from '../controllers/redeemController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.post('/', verifyToken, createRedeem);
router.get('/', verifyToken, listRedeemsForUser);

// admin
router.get('/admin', verifyToken, requireRole('admin'), listRedeems);
router.post('/admin/:id/review', verifyToken, requireRole('admin'), reviewRedeem);

export default router;
