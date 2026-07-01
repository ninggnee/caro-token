import express from 'express';
import { getSyncStatus, applySyncBalances } from '../controllers/adminSyncController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET  /api/admin/sync/status  — compare on-chain vs DB (non-destructive)
router.get('/status', verifyToken, requireRole('admin'), getSyncStatus);

// POST /api/admin/sync/apply   — write on-chain balances to DB
router.post('/apply', verifyToken, requireRole('admin'), applySyncBalances);

export default router;
