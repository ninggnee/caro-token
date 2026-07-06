import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import {
  createCollateralLoan,
  listCollateralLoans,
  cancelCollateralLoan,
  repayCollateralLoan,
  reviewCollateralLoan,
  adminListCollateralLoans,
  adminGetCollateralLoanDetail,
  createTokenDiscounting,
  listTokenDiscountings,
  reviewTokenDiscounting,
  adminListTokenDiscountings,
  adminGetTokenDiscountingDetail,
  listBankHaircuts,
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
router.post('/collateral-loans/:id/repay', requireRole('trader', 'farmer'), repayCollateralLoan);

// Token Discounting
router.get('/banks',                   requireRole('trader', 'farmer'), listBankHaircuts);
router.get('/token-discounting',       requireRole('trader', 'farmer'), listTokenDiscountings);
router.post('/token-discounting',      requireRole('trader', 'farmer'), createTokenDiscounting);

// ── Admin endpoints — "Mô phỏng Ngân hàng" (Bank simulation), Prototype only.
// Admin here plays the role of the receiving Bank's back-office; this is not
// a CaRo administrative function. See financeController.js notes.
router.get('/admin/collateral-loans',        requireRole('admin'), adminListCollateralLoans);
router.get('/admin/collateral-loans/:id',    requireRole('admin'), adminGetCollateralLoanDetail);
router.patch('/admin/collateral-loans/:id',  requireRole('admin'), reviewCollateralLoan);
router.get('/admin/token-discounting',       requireRole('admin'), adminListTokenDiscountings);
router.get('/admin/token-discounting/:id',   requireRole('admin'), adminGetTokenDiscountingDetail);
router.patch('/admin/token-discounting/:id', requireRole('admin'), reviewTokenDiscounting);

// ── Trader-only: dynamic LTV/Haircut risk profile (see RiskProfileService) ──
// Farmer keeps using the fixed-constant routes above, untouched.
router.get('/trader/risk-profile/:tokenType', requireRole('trader'), getTraderRiskProfile);
router.post('/trader/collateral-loans',       requireRole('trader'), createTraderCollateralLoan);
router.post('/trader/token-discounting',      requireRole('trader'), createTraderTokenDiscounting);

export default router;
