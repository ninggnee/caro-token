import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  createCollateralLoan,
  listCollateralLoans,
  cancelCollateralLoan,
  reviewCollateralLoan,
  createTokenDiscounting,
  listTokenDiscountings,
  reviewTokenDiscounting,
} from '../controllers/financeController.js';

const router = Router();

// ── Trader + Farmer endpoints ─────────────────────────────────
router.use(verifyToken);

// Collateral Loans
router.get('/collateral-loans',        requireRole('trader', 'farmer'), listCollateralLoans);
router.post('/collateral-loans',       requireRole('trader', 'farmer'), createCollateralLoan);
router.delete('/collateral-loans/:id', requireRole('trader', 'farmer'), cancelCollateralLoan);

// Token Discounting
router.get('/token-discounting',       requireRole('trader', 'farmer'), listTokenDiscountings);
router.post('/token-discounting',      requireRole('trader', 'farmer'), createTokenDiscounting);

// ── Admin endpoints ──────────────────────────────────────────
router.patch('/admin/collateral-loans/:id', requireRole('admin'), reviewCollateralLoan);
router.patch('/admin/token-discounting/:id', requireRole('admin'), reviewTokenDiscounting);

export default router;
