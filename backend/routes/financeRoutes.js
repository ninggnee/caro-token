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
  getTraderRiskProfile,
  createTraderCollateralLoan,
  createTraderTokenDiscounting,
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

// ── Trader-only: dynamic LTV/Haircut risk profile (see RiskProfileService) ──
// Farmer keeps using the fixed-constant routes above, untouched.
router.get('/trader/risk-profile/:tokenType', requireRole('trader'), getTraderRiskProfile);
router.post('/trader/collateral-loans',       requireRole('trader'), createTraderCollateralLoan);
router.post('/trader/token-discounting',      requireRole('trader'), createTraderTokenDiscounting);

export default router;
