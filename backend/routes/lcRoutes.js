import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  listLCPartnerBanks,
  createLCContract,
  listMyLCContracts,
  getMyLCContractDetail,
  selectPaymentMethod,
  adminListLCContracts,
  adminGetLCContractDetail,
  reviewLCContract,
  gatherAndLockLCContract,
  addLCOracleEvent,
  adminSettleCredit,
  completeLCContract,
} from '../controllers/lcController.js';

const router = Router();

router.use(verifyToken);

// ── Shared reference data ─────────────────────────────────────
router.get('/partner-banks', requireRole('trader', 'admin'), listLCPartnerBanks);

// ── Trader — "Nhận nông sản thực tế" ──────────────────────────
router.get('/contracts',                     requireRole('trader'), listMyLCContracts);
router.post('/contracts',                    requireRole('trader'), createLCContract);
router.get('/contracts/:id',                 requireRole('trader'), getMyLCContractDetail);
router.patch('/contracts/:id/payment-method',requireRole('trader'), selectPaymentMethod);

// ── Admin — "Mô phỏng Ngân hàng" back-office + Oracle simulation ──
router.get('/admin/contracts',                    requireRole('admin'), adminListLCContracts);
router.get('/admin/contracts/:id',                requireRole('admin'), adminGetLCContractDetail);
router.patch('/admin/contracts/:id/review',       requireRole('admin'), reviewLCContract);
router.post('/admin/contracts/:id/gather-lock',   requireRole('admin'), gatherAndLockLCContract);
router.post('/admin/contracts/:id/oracle-events', requireRole('admin'), addLCOracleEvent);
router.post('/admin/contracts/:id/settle-credit', requireRole('admin'), adminSettleCredit);
router.post('/admin/contracts/:id/complete',      requireRole('admin'), completeLCContract);

export default router;
