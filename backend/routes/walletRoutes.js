import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  uploadProof,
  getWallet,
  directDeposit, simulateDeposit, simulateWithdraw, getTransactions,
  createDeposit, createTokenDeposit, listDepositsForUser, listAllDeposits, reviewDeposit,
  createWithdraw, listWithdrawsForUser, listAllWithdraws, reviewWithdraw,
} from '../controllers/walletController.js';

const router = express.Router();

// ── Wallet balance ───────────────────────────────────────────────────────────
router.get('/balance',      verifyToken, getWallet);
router.get('/transactions', verifyToken, getTransactions);

// ── Deposits ─────────────────────────────────────────────────────────────────
router.post  ('/simulate-deposit',      verifyToken,                      simulateDeposit);
router.post  ('/direct-deposit',        verifyToken,                      directDeposit);
router.post  ('/deposit',               verifyToken,                      uploadProof, createDeposit);
router.post  ('/deposit-token',         verifyToken,                      createTokenDeposit);
router.get   ('/deposit',               verifyToken,                      listDepositsForUser);
router.get   ('/deposit/all',           verifyToken, requireRole('admin'), listAllDeposits);
router.post  ('/deposit/:id/review',    verifyToken, requireRole('admin'), reviewDeposit);

// ── Withdrawals ───────────────────────────────────────────────────────────────
router.post  ('/simulate-withdraw',     verifyToken,                      simulateWithdraw);
router.post  ('/withdraw',              verifyToken,                      createWithdraw);
router.get   ('/withdraw',              verifyToken,                      listWithdrawsForUser);
router.get   ('/withdraw/all',          verifyToken, requireRole('admin'), listAllWithdraws);
router.post  ('/withdraw/:id/review',   verifyToken, requireRole('admin'), reviewWithdraw);

export default router;
