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

// ── Trader endpoints ─────────────────────────────────────────
router.use(verifyToken);

// Collateral Loans
router.get('/collateral-loans',       requireRole('trader'), listCollateralLoans);
router.post('/collateral-loans',      requireRole('trader'), createCollateralLoan);
router.delete('/collateral-loans/:id', requireRole('trader'), cancelCollateralLoan);

// Token Discounting
router.get('/token-discounting',      requireRole('trader'), listTokenDiscountings);
router.post('/token-discounting',     requireRole('trader'), createTokenDiscounting);

// ── Admin endpoints ──────────────────────────────────────────
router.patch('/admin/collateral-loans/:id', requireRole('admin'), reviewCollateralLoan);
router.patch('/admin/token-discounting/:id', requireRole('admin'), reviewTokenDiscounting);

export default router;
