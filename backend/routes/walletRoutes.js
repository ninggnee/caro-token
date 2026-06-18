import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  uploadProof,
  getWallet,
  createDeposit, listDepositsForUser, listAllDeposits, reviewDeposit,
  createWithdraw, listWithdrawsForUser, listAllWithdraws, reviewWithdraw,
} from '../controllers/walletController.js';

const router = express.Router();

// ── Wallet balance ───────────────────────────────────────────────────────────
router.get('/balance', verifyToken, getWallet);

// ── Deposits ─────────────────────────────────────────────────────────────────
router.post  ('/deposit',               verifyToken,                      uploadProof, createDeposit);
router.get   ('/deposit',               verifyToken,                      listDepositsForUser);
router.get   ('/deposit/all',           verifyToken, requireRole('admin'), listAllDeposits);
router.post  ('/deposit/:id/review',    verifyToken, requireRole('admin'), reviewDeposit);

// ── Withdrawals ───────────────────────────────────────────────────────────────
router.post  ('/withdraw',              verifyToken,                      createWithdraw);
router.get   ('/withdraw',              verifyToken,                      listWithdrawsForUser);
router.get   ('/withdraw/all',          verifyToken, requireRole('admin'), listAllWithdraws);
router.post  ('/withdraw/:id/review',   verifyToken, requireRole('admin'), reviewWithdraw);

export default router;
