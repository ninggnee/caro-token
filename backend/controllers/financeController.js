/**
 * financeController — Trader Finance: Collateral Loan + Token Discounting
 *
 * Two completely independent products:
 *
 * 1. Collateral Loan  — trader retains ownership, tokens become PLEDGED.
 *    Balance: available → locked  (lockBalance)
 *    Reversal on reject/repay: locked → available  (unlockBalance)
 *
 * 2. Token Discounting — true sale, trader permanently loses ownership.
 *    Balance: available removed    (deductAvailable)
 *    Irreversible unless separate repurchase agreement exists.
 */

import db from '../config/db.js';
import { lockBalance, unlockBalance, deductAvailable } from '../services/BalanceService.js';
import { logAction, auditMeta } from '../services/AuditService.js';
import { getRiskProfile } from '../services/RiskProfileService.js';

const VALID_TOKENS = ['CR1', 'CR2', 'CR3'];

// ══════════════════════════════════════════════════════════════
//  COLLATERAL LOANS
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/finance/collateral-loans
 * Submit a new collateral loan request.
 * Tokens: AVAILABLE → PLEDGED (locked_balance).
 */
export const createCollateralLoan = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const {
      token_type,
      batch_id,
      quantity,
      market_price,
      requested_amount,
      loan_term_months = 3,
    } = req.body;

    if (!VALID_TOKENS.includes(token_type))
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    if (!quantity || Number(quantity) <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0' });
    if (!market_price || Number(market_price) <= 0)
      return res.status(400).json({ success: false, message: 'market_price must be > 0' });
    if (!requested_amount || Number(requested_amount) <= 0)
      return res.status(400).json({ success: false, message: 'requested_amount must be > 0' });

    const qty             = Number(quantity);
    const price           = Number(market_price);
    const reqAmt          = Number(requested_amount);
    const LTV             = 0.70;
    const INTEREST_RATE   = 0.08;
    const collateralValue = qty * price;
    const maxLoan         = collateralValue * LTV;

    if (reqAmt > maxLoan) {
      return res.status(422).json({
        success: false,
        message: `Requested amount (${reqAmt.toLocaleString('vi-VN')} VND) exceeds maximum loan (${maxLoan.toLocaleString('vi-VN')} VND)`,
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Lock tokens → PLEDGED state
      await lockBalance(userId, token_type, qty, conn);

      const [result] = await conn.execute(
        `INSERT INTO collateral_loans
           (user_id, batch_id, token_type, quantity, market_price, collateral_value,
            ltv, max_loan_amount, requested_amount, interest_rate, loan_term_months, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, batch_id || null, token_type, qty, price, collateralValue,
         LTV, maxLoan, reqAmt, INTEREST_RATE, Number(loan_term_months)]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'finance:collateral_loan:create',
        entityType: 'collateral_loan', entityId: result.insertId,
        newData: { token_type, quantity: qty, requested_amount: reqAmt },
        ...auditMeta(req),
      });

      res.status(201).json({ success: true, id: result.insertId });
    } catch (err) {
      await conn.rollback();
      if (err.message?.includes('Insufficient')) {
        return res.status(422).json({ success: false, message: err.message });
      }
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('createCollateralLoan error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/finance/collateral-loans
 * List collateral loans for the authenticated trader.
 */
export const listCollateralLoans = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await db.execute(
      `SELECT * FROM collateral_loans WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listCollateralLoans error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * DELETE /api/finance/collateral-loans/:id
 * Cancel a pending loan (before admin review). Unlocks tokens.
 */
export const cancelCollateralLoan = async (req, res) => {
  try {
    const userId = req.user?.id;
    const id     = Number(req.params.id);

    const [[loan]] = await db.execute(
      `SELECT * FROM collateral_loans WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Cannot cancel a loan in '${loan.status}' status` });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await unlockBalance(userId, loan.token_type, Number(loan.quantity), conn);
      await conn.execute(
        `UPDATE collateral_loans SET status = 'rejected', admin_note = 'Cancelled by trader' WHERE id = ?`,
        [id]
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({ success: true, message: 'Loan cancelled and tokens unlocked' });
  } catch (err) {
    console.error('cancelCollateralLoan error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: update collateral loan status ─────────────────────
export const reviewCollateralLoan = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const id      = Number(req.params.id);
    const { action, note } = req.body;  // action: 'approve' | 'reject' | 'disburse'

    const [[loan]] = await db.execute(
      `SELECT * FROM collateral_loans WHERE id = ? LIMIT 1`, [id]
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Not found' });

    if (action === 'reject') {
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await unlockBalance(loan.user_id, loan.token_type, Number(loan.quantity), conn);
        await conn.execute(
          `UPDATE collateral_loans SET status='rejected', admin_note=?, processed_by=? WHERE id=?`,
          [note || null, adminId, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
      return res.json({ success: true, message: 'Loan rejected, tokens unlocked' });
    }

    if (action === 'approve') {
      await db.execute(
        `UPDATE collateral_loans SET status='approved', admin_note=?, processed_by=?, approved_at=NOW() WHERE id=?`,
        [note || null, adminId, id]
      );
      return res.json({ success: true });
    }

    if (action === 'disburse') {
      await db.execute(
        `UPDATE collateral_loans SET status='disbursed', disbursed_at=NOW() WHERE id=?`, [id]
      );
      return res.json({ success: true });
    }

    res.status(400).json({ success: false, message: 'action must be approve | reject | disburse' });
  } catch (err) {
    console.error('reviewCollateralLoan error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════════════
//  TOKEN DISCOUNTING  (true sale — permanent ownership transfer)
// ══════════════════════════════════════════════════════════════

const HAIRCUT_BY_RISK = { low: 0.10, medium: 0.20, high: 0.30 };

/**
 * POST /api/finance/token-discounting
 * Submit a token discounting request (true sale).
 * Tokens: AVAILABLE → DISCOUNTED (deducted from trader immediately).
 */
export const createTokenDiscounting = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const {
      token_type,
      batch_id,
      quantity,
      market_price,
      bank_name,
      risk_level = 'medium',
    } = req.body;

    if (!VALID_TOKENS.includes(token_type))
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    if (!quantity || Number(quantity) <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0' });
    if (!market_price || Number(market_price) <= 0)
      return res.status(400).json({ success: false, message: 'market_price must be > 0' });
    if (!bank_name?.trim())
      return res.status(400).json({ success: false, message: 'bank_name is required' });
    if (!['low', 'medium', 'high'].includes(risk_level))
      return res.status(400).json({ success: false, message: 'risk_level must be low | medium | high' });

    const qty           = Number(quantity);
    const price         = Number(market_price);
    const haircut       = HAIRCUT_BY_RISK[risk_level];
    const discountRatio = 1 - haircut;
    const nominalValue  = qty * price;
    const paymentAmount = nominalValue * discountRatio;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Permanently deduct tokens — true sale, ownership transfers to bank
      await deductAvailable(userId, token_type, qty, conn);

      const [result] = await conn.execute(
        `INSERT INTO token_discounting
           (user_id, bank_name, batch_id, token_type, quantity, market_price,
            nominal_value, haircut, discount_ratio, payment_amount, risk_level, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, bank_name.trim(), batch_id || null, token_type, qty, price,
         nominalValue, haircut, discountRatio, paymentAmount, risk_level]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'finance:token_discounting:create',
        entityType: 'token_discounting', entityId: result.insertId,
        newData: { token_type, quantity: qty, bank_name, payment_amount: paymentAmount },
        ...auditMeta(req),
      });

      res.status(201).json({ success: true, id: result.insertId, payment_amount: paymentAmount });
    } catch (err) {
      await conn.rollback();
      if (err.message?.includes('Insufficient')) {
        return res.status(422).json({ success: false, message: err.message });
      }
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('createTokenDiscounting error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/finance/token-discounting
 * List token discounting requests for the authenticated trader.
 */
export const listTokenDiscountings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await db.execute(
      `SELECT * FROM token_discounting WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listTokenDiscountings error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: review token discounting ─────────────────────────
export const reviewTokenDiscounting = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const id      = Number(req.params.id);
    const { action, note } = req.body;

    const [[td]] = await db.execute(
      `SELECT * FROM token_discounting WHERE id = ? LIMIT 1`, [id]
    );
    if (!td) return res.status(404).json({ success: false, message: 'Not found' });

    if (action === 'reject') {
      // For discounting, rejection requires crediting tokens back (tokens were already deducted)
      // This is unusual for a true-sale but handled as admin override
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute(
          `INSERT INTO user_balances (user_id, token_type, balance, available_balance, locked_balance)
           VALUES (?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE
             balance           = balance           + VALUES(balance),
             available_balance = available_balance + VALUES(available_balance)`,
          [td.user_id, td.token_type, td.quantity, td.quantity]
        );
        await conn.execute(
          `UPDATE token_discounting SET status='rejected', admin_note=?, processed_by=? WHERE id=?`,
          [note || null, adminId, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
      return res.json({ success: true, message: 'Discounting rejected, tokens returned to trader' });
    }

    if (action === 'approve') {
      await db.execute(
        `UPDATE token_discounting SET status='approved', admin_note=?, processed_by=? WHERE id=?`,
        [note || null, adminId, id]
      );
      return res.json({ success: true });
    }

    if (action === 'complete') {
      await db.execute(
        `UPDATE token_discounting SET status='completed', completed_at=NOW() WHERE id=?`, [id]
      );
      return res.json({ success: true });
    }

    res.status(400).json({ success: false, message: 'action must be approve | reject | complete' });
  } catch (err) {
    console.error('reviewTokenDiscounting error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════════════
//  TRADER-ONLY — dynamic LTV / Haircut (RiskProfileService)
//
//  Farmer keeps using the fixed-constant functions above untouched.
//  These endpoints serve TraderFinancing.jsx exclusively (see
//  financeRoutes.js — requireRole('trader')).
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/finance/trader/risk-profile/:tokenType
 */
export const getTraderRiskProfile = async (req, res) => {
  try {
    const tokenType = req.params.tokenType;
    if (!VALID_TOKENS.includes(tokenType)) {
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    }
    const profile = await getRiskProfile(tokenType);
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('getTraderRiskProfile error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/finance/trader/collateral-loans
 * Same product/state-machine as createCollateralLoan, but LTV comes from
 * RiskProfileService instead of a fixed 0.70 constant.
 */
export const createTraderCollateralLoan = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const {
      token_type,
      batch_id,
      quantity,
      market_price,
      requested_amount,
      loan_term_months = 3,
    } = req.body;

    if (!VALID_TOKENS.includes(token_type))
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    if (!quantity || Number(quantity) <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0' });
    if (!market_price || Number(market_price) <= 0)
      return res.status(400).json({ success: false, message: 'market_price must be > 0' });
    if (!requested_amount || Number(requested_amount) <= 0)
      return res.status(400).json({ success: false, message: 'requested_amount must be > 0' });

    const qty           = Number(quantity);
    const price          = Number(market_price);
    const reqAmt         = Number(requested_amount);
    const INTEREST_RATE  = 0.08;

    const profile          = await getRiskProfile(token_type);
    const collateralValue  = qty * price;
    const maxLoan          = collateralValue * profile.ltv;

    if (reqAmt > maxLoan) {
      return res.status(422).json({
        success: false,
        message: `Requested amount (${reqAmt.toLocaleString('vi-VN')} VND) exceeds maximum loan (${maxLoan.toLocaleString('vi-VN')} VND) at current LTV ${(profile.ltv * 100).toFixed(0)}%`,
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await lockBalance(userId, token_type, qty, conn);

      const [result] = await conn.execute(
        `INSERT INTO collateral_loans
           (user_id, batch_id, token_type, quantity, market_price, collateral_value,
            ltv, max_loan_amount, requested_amount, interest_rate, loan_term_months, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, batch_id || null, token_type, qty, price, collateralValue,
         profile.ltv, maxLoan, reqAmt, INTEREST_RATE, Number(loan_term_months)]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'finance:collateral_loan:create:dynamic',
        entityType: 'collateral_loan', entityId: result.insertId,
        newData: { token_type, quantity: qty, requested_amount: reqAmt, ltv: profile.ltv },
        ...auditMeta(req),
      });

      res.status(201).json({ success: true, id: result.insertId, risk_profile: profile });
    } catch (err) {
      await conn.rollback();
      if (err.message?.includes('Insufficient')) {
        return res.status(422).json({ success: false, message: err.message });
      }
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('createTraderCollateralLoan error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/finance/trader/token-discounting
 * Same product/state-machine as createTokenDiscounting, but haircut comes from
 * RiskProfileService instead of a manually chosen low/medium/high risk_level.
 */
export const createTraderTokenDiscounting = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const {
      token_type,
      batch_id,
      quantity,
      market_price,
      bank_name,
    } = req.body;

    if (!VALID_TOKENS.includes(token_type))
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    if (!quantity || Number(quantity) <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0' });
    if (!market_price || Number(market_price) <= 0)
      return res.status(400).json({ success: false, message: 'market_price must be > 0' });
    if (!bank_name?.trim())
      return res.status(400).json({ success: false, message: 'bank_name is required' });

    const qty   = Number(quantity);
    const price = Number(market_price);

    const profile        = await getRiskProfile(token_type);
    const discountRatio  = 1 - profile.haircut;
    const nominalValue   = qty * price;
    const paymentAmount  = nominalValue * discountRatio;
    // Bucket the computed haircut into the existing low/medium/high column so
    // history views (shared with the farmer flow) can still render a label.
    const riskLevel = profile.haircut <= 0.15 ? 'low' : profile.haircut <= 0.25 ? 'medium' : 'high';

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Permanently deduct tokens — true sale, ownership transfers to bank
      await deductAvailable(userId, token_type, qty, conn);

      const [result] = await conn.execute(
        `INSERT INTO token_discounting
           (user_id, bank_name, batch_id, token_type, quantity, market_price,
            nominal_value, haircut, discount_ratio, payment_amount, risk_level, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, bank_name.trim(), batch_id || null, token_type, qty, price,
         nominalValue, profile.haircut, discountRatio, paymentAmount, riskLevel]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'finance:token_discounting:create:dynamic',
        entityType: 'token_discounting', entityId: result.insertId,
        newData: { token_type, quantity: qty, bank_name, payment_amount: paymentAmount, haircut: profile.haircut },
        ...auditMeta(req),
      });

      res.status(201).json({ success: true, id: result.insertId, payment_amount: paymentAmount, risk_profile: profile });
    } catch (err) {
      await conn.rollback();
      if (err.message?.includes('Insufficient')) {
        return res.status(422).json({ success: false, message: err.message });
      }
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('createTraderTokenDiscounting error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
