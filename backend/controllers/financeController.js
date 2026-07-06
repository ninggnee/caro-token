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
import { generateLoanTerms } from '../services/LoanRiskService.js';
import { listBanks, getBankHaircut } from '../services/BankHaircutService.js';
import { ensureWallet } from './walletController.js';
import { LOAN_STATUS, LOAN_REPAYABLE_STATUSES, DISCOUNT_STATUS } from '../constants/financeStatus.js';

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
      loan_term_months = 3,
    } = req.body;

    if (!VALID_TOKENS.includes(token_type))
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    if (!quantity || Number(quantity) <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0' });
    if (!market_price || Number(market_price) <= 0)
      return res.status(400).json({ success: false, message: 'market_price must be > 0' });

    const qty   = Number(quantity);
    const price = Number(market_price);

    // Interest rate and LTV are generated ONCE here, at loan creation, based
    // on the pledged token quantity (more collateral → lower risk → better
    // terms). They are persisted below and must never be regenerated —
    // every later calculation for this loan reuses these exact figures.
    const { interestRate, ltv } = generateLoanTerms(qty);
    const collateralValue = qty * price;
    const maxLoan          = collateralValue * ltv;
    // Farmer collateral loans always borrow the full eligible amount.
    const reqAmt           = maxLoan;

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
         ltv, maxLoan, reqAmt, interestRate, Number(loan_term_months)]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'finance:collateral_loan:create',
        entityType: 'collateral_loan', entityId: result.insertId,
        newData: { token_type, quantity: qty, ltv, interest_rate: interestRate, max_loan_amount: maxLoan },
        ...auditMeta(req),
      });

      res.status(201).json({
        success: true,
        id: result.insertId,
        ltv,
        interest_rate: interestRate,
        max_loan_amount: maxLoan,
      });
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

/**
 * POST /api/finance/collateral-loans/:id/repay
 * Farmer/Trader settles (tất toán) their own approved loan: pays back
 * principal + interest from their CaRo VND wallet in one shot. Token
 * unlocks PLEDGED → AVAILABLE. This completes the loan lifecycle
 * (pending → approved → repaid), independent of the Admin bank-simulation
 * screens — the borrower initiates this, not the bank.
 */
export const repayCollateralLoan = async (req, res) => {
  try {
    const userId = req.user?.id;
    const id = Number(req.params.id);

    const [[loan]] = await db.execute(
      `SELECT * FROM collateral_loans WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (!LOAN_REPAYABLE_STATUSES.includes(loan.status)) {
      return res.status(409).json({ success: false, message: `Cannot repay a loan in '${loan.status}' status` });
    }

    // Same formula used everywhere else this loan's totals are shown
    // (FarmerFinancing.jsx preview, Admin detail page) — never re-derives
    // the interest rate itself, only multiplies out the already-saved figures.
    const annualInterest = Number(loan.max_loan_amount) * Number(loan.interest_rate);
    const termInterest   = annualInterest * (Number(loan.loan_term_months) / 12);
    const totalRepay     = Number(loan.max_loan_amount) + termInterest;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[wallet]] = await conn.execute(
        `SELECT vnd_balance FROM wallets WHERE user_id = ? LIMIT 1 FOR UPDATE`,
        [userId]
      );
      const available = Number(wallet?.vnd_balance || 0);
      if (available < totalRepay) {
        await conn.rollback();
        return res.status(422).json({
          success: false,
          message: `Số dư ví VND không đủ để tất toán. Cần ${totalRepay.toLocaleString('vi-VN')} VND, hiện có ${available.toLocaleString('vi-VN')} VND`,
        });
      }

      await conn.execute(
        `UPDATE wallets SET vnd_balance = vnd_balance - ? WHERE user_id = ?`,
        [totalRepay, userId]
      );
      // PLEDGED → AVAILABLE
      await unlockBalance(userId, loan.token_type, Number(loan.quantity), conn);
      await conn.execute(
        `UPDATE collateral_loans SET status=?, repaid_at=NOW() WHERE id=?`,
        [LOAN_STATUS.REPAID, id]
      );

      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    await logAction({
      actorId: userId, action: 'finance:collateral_loan:repay',
      entityType: 'collateral_loan', entityId: id,
      oldData: { status: loan.status },
      newData: { status: LOAN_STATUS.REPAID, total_repaid: totalRepay, actor_role: req.user?.role },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Đã tất toán khoản vay, token đã được mở khóa', total_repaid: totalRepay });
  } catch (err) {
    console.error('repayCollateralLoan error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: update collateral loan status ─────────────────────
// NOTE — Prototype scope: this endpoint is called from the Admin "Mô phỏng
// Ngân hàng" screens. Admin here simulates the receiving Bank's back-office
// decision only; it is not a CaRo administrative function. In production
// this action would be performed by the Bank itself via its own API
// integration with the CaRo platform.
export const reviewCollateralLoan = async (req, res) => {
  try {
    const adminId   = req.user?.id;
    const actorRole = req.user?.role;
    const id        = Number(req.params.id);
    const { action, note } = req.body;  // action: 'approve' | 'reject' | 'disburse'

    const [[loan]] = await db.execute(
      `SELECT * FROM collateral_loans WHERE id = ? LIMIT 1`, [id]
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Not found' });

    if (action === 'reject') {
      if (loan.status !== LOAN_STATUS.PENDING) {
        return res.status(409).json({ success: false, message: `Cannot reject a loan in '${loan.status}' status` });
      }
      if (!note || !String(note).trim()) {
        return res.status(400).json({ success: false, message: 'rejection reason (note) is required' });
      }
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        // Token unlocks back to AVAILABLE — reject means the bank never took
        // the collateral, so the farmer keeps full, unencumbered ownership.
        await unlockBalance(loan.user_id, loan.token_type, Number(loan.quantity), conn);
        await conn.execute(
          `UPDATE collateral_loans SET status=?, admin_note=?, rejection_reason=?, processed_by=? WHERE id=?`,
          [LOAN_STATUS.REJECTED, note, note, adminId, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

      await logAction({
        actorId: adminId, action: 'finance:collateral_loan:reject',
        entityType: 'collateral_loan', entityId: id,
        oldData: { status: loan.status },
        newData: { status: LOAN_STATUS.REJECTED, rejection_reason: note, actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Loan rejected, tokens unlocked' });
    }

    if (action === 'approve') {
      // Step 1 of 2 — credit decision only. No money moves and the token
      // stays PLEDGED; disbursement is a distinct, separate bank action
      // (see 'disburse' below), matching a real lending back-office where
      // credit approval and treasury payout are different operational steps.
      if (loan.status !== LOAN_STATUS.PENDING) {
        return res.status(409).json({ success: false, message: `Cannot approve a loan in '${loan.status}' status` });
      }
      await db.execute(
        `UPDATE collateral_loans SET status=?, admin_note=?, processed_by=?, approved_at=NOW() WHERE id=?`,
        [LOAN_STATUS.APPROVED, note || null, adminId, id]
      );

      await logAction({
        actorId: adminId, action: 'finance:collateral_loan:approve',
        entityType: 'collateral_loan', entityId: id,
        oldData: { status: loan.status },
        newData: { status: LOAN_STATUS.APPROVED, note: note || null, actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Loan approved — awaiting disbursement' });
    }

    if (action === 'disburse') {
      // Step 2 of 2 — the bank actually pays out. Token remains PLEDGED
      // throughout (it only unlocks on repay or on an earlier reject).
      if (loan.status !== LOAN_STATUS.APPROVED) {
        return res.status(409).json({ success: false, message: `Cannot disburse a loan in '${loan.status}' status — must be approved first` });
      }
      const disbursementId = `DISB-${id}-${Date.now()}`;

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await ensureWallet(loan.user_id, conn);
        await conn.execute(
          `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
          [loan.max_loan_amount, loan.user_id]
        );
        await conn.execute(
          `UPDATE collateral_loans
           SET status=?, disbursed_at=NOW(), disbursement_id=?
           WHERE id=?`,
          [LOAN_STATUS.ACTIVE, disbursementId, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

      await logAction({
        actorId: adminId, action: 'finance:collateral_loan:disburse',
        entityType: 'collateral_loan', entityId: id,
        oldData: { status: loan.status },
        newData: { status: LOAN_STATUS.ACTIVE, disbursed_amount: Number(loan.max_loan_amount), disbursement_id: disbursementId, actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Loan disbursed — now active', disbursed_amount: Number(loan.max_loan_amount), disbursement_id: disbursementId });
    }

    res.status(400).json({ success: false, message: 'action must be approve | reject | disburse' });
  } catch (err) {
    console.error('reviewCollateralLoan error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/finance/admin/collateral-loans
 * Admin (bank-simulation) view of ALL collateral loans across every farmer.
 */
export const adminListCollateralLoans = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.*, u.full_name AS farmer_name, u.email AS farmer_email, u.phone AS farmer_phone
       FROM collateral_loans c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('adminListCollateralLoans error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/finance/admin/collateral-loans/:id
 * Full detail + processing history (audit_logs) for one loan.
 */
export const adminGetCollateralLoanDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[loan]] = await db.execute(
      `SELECT c.*, u.full_name AS farmer_name, u.email AS farmer_email, u.phone AS farmer_phone,
              u.farm_location AS farmer_farm_location,
              p.full_name AS processed_by_name
       FROM collateral_loans c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN users p ON c.processed_by = p.id
       WHERE c.id = ? LIMIT 1`,
      [id]
    );
    if (!loan) return res.status(404).json({ success: false, message: 'Not found' });

    const [history] = await db.execute(
      `SELECT a.id, a.actor_id, u.full_name AS actor_name, u.email AS actor_email,
              a.action, a.old_data, a.new_data, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity_type = 'collateral_loan' AND a.entity_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
      [id]
    );

    res.json({ success: true, data: loan, history });
  } catch (err) {
    console.error('adminGetCollateralLoanDetail error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ══════════════════════════════════════════════════════════════
//  TOKEN DISCOUNTING  (true sale — permanent ownership transfer)
// ══════════════════════════════════════════════════════════════

/**
 * GET /api/finance/banks
 * Partner banks and their current Haircut policy for Token Discounting.
 * The customer picks a bank from this list only — the Haircut itself is
 * never client-supplied.
 */
export const listBankHaircuts = async (req, res) => {
  try {
    res.json({ success: true, data: listBanks() });
  } catch (err) {
    console.error('listBankHaircuts error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/finance/token-discounting
 * Submit a token discounting request (true sale).
 * Tokens: AVAILABLE → DISCOUNTED (deducted from trader immediately).
 * Haircut is determined solely by the selected bank's policy — never by
 * customer choice, never client-supplied.
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
    } = req.body;

    if (!VALID_TOKENS.includes(token_type))
      return res.status(400).json({ success: false, message: 'token_type must be CR1, CR2, or CR3' });
    if (!quantity || Number(quantity) <= 0)
      return res.status(400).json({ success: false, message: 'quantity must be > 0' });
    if (!market_price || Number(market_price) <= 0)
      return res.status(400).json({ success: false, message: 'market_price must be > 0' });

    const bank = getBankHaircut(bank_name);
    if (!bank)
      return res.status(400).json({ success: false, message: 'bank_name must be one of the supported partner banks' });

    const qty           = Number(quantity);
    const price         = Number(market_price);
    const haircut       = bank.haircut;
    const discountRatio = bank.disbursementRatio;
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
            nominal_value, haircut, discount_ratio, payment_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, bank.name, batch_id || null, token_type, qty, price,
         nominalValue, haircut, discountRatio, paymentAmount]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'finance:token_discounting:create',
        entityType: 'token_discounting', entityId: result.insertId,
        newData: { token_type, quantity: qty, bank_name: bank.name, haircut, payment_amount: paymentAmount },
        ...auditMeta(req),
      });

      res.status(201).json({
        success: true,
        id: result.insertId,
        bank: bank.name,
        haircut,
        disbursement_ratio: discountRatio,
        payment_amount: paymentAmount,
      });
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
// NOTE — Prototype scope: same "Bank simulation" caveat as
// reviewCollateralLoan above — this is not a CaRo admin function.
export const reviewTokenDiscounting = async (req, res) => {
  try {
    const adminId   = req.user?.id;
    const actorRole = req.user?.role;
    const id        = Number(req.params.id);
    const { action, note } = req.body;

    const [[td]] = await db.execute(
      `SELECT * FROM token_discounting WHERE id = ? LIMIT 1`, [id]
    );
    if (!td) return res.status(404).json({ success: false, message: 'Not found' });

    if (action === 'reject') {
      if (td.status !== DISCOUNT_STATUS.PENDING) {
        return res.status(409).json({ success: false, message: `Cannot reject a discounting request in '${td.status}' status` });
      }
      if (!note || !String(note).trim()) {
        return res.status(400).json({ success: false, message: 'rejection reason (note) is required' });
      }
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
          `UPDATE token_discounting SET status=?, admin_note=?, rejection_reason=?, processed_by=? WHERE id=?`,
          [DISCOUNT_STATUS.REJECTED, note, note, adminId, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

      await logAction({
        actorId: adminId, action: 'finance:token_discounting:reject',
        entityType: 'token_discounting', entityId: id,
        oldData: { status: td.status },
        newData: { status: DISCOUNT_STATUS.REJECTED, rejection_reason: note, actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Discounting rejected, tokens returned to trader' });
    }

    if (action === 'approve') {
      if (td.status !== DISCOUNT_STATUS.PENDING) {
        return res.status(409).json({ success: false, message: `Cannot approve a discounting request in '${td.status}' status` });
      }
      // Simulated on-chain/off-chain reference for "ownership transferred to
      // the Bank (Simulation)" — no real bank counterparty exists in this
      // Prototype, so this is a labelled placeholder, not a real tx hash.
      const simulatedTransferRef = `SIM-BANK-${String(td.bank_name || '').replace(/\s+/g, '').toUpperCase()}-${id}-${Date.now()}`;

      // Approval, payment, and token-ownership transfer are atomic here (a
      // true-sale settlement has no meaningful manual gap between those
      // sub-steps) — but each still gets its own audit_logs entry below so
      // the System Log narrates "approved" then "token transferred" as two
      // distinct events, matching how a real settlement would be logged.
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        await ensureWallet(td.user_id, conn);
        await conn.execute(
          `UPDATE wallets SET vnd_balance = vnd_balance + ? WHERE user_id = ?`,
          [td.payment_amount, td.user_id]
        );
        await conn.execute(
          `UPDATE token_discounting
           SET status=?, admin_note=?, processed_by=?, completed_at=NOW(), ownership_transfer_tx=?
           WHERE id=?`,
          [DISCOUNT_STATUS.COMPLETED, note || null, adminId, simulatedTransferRef, id]
        );
        await conn.commit();
      } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

      await logAction({
        actorId: adminId, action: 'finance:token_discounting:approve',
        entityType: 'token_discounting', entityId: id,
        oldData: { status: td.status },
        newData: { status: DISCOUNT_STATUS.COMPLETED, payment_amount: Number(td.payment_amount), note: note || null, actor_role: actorRole },
        ...auditMeta(req),
      });
      await logAction({
        actorId: adminId, action: 'finance:token_discounting:token_transfer',
        entityType: 'token_discounting', entityId: id,
        oldData: { token_owner: 'farmer' },
        newData: { token_owner: 'bank_simulation', ownership_transfer_tx: simulatedTransferRef, actor_role: actorRole },
        ...auditMeta(req),
      });
      return res.json({ success: true, message: 'Discounting approved, token ownership transferred (simulation) and payment disbursed', payment_amount: Number(td.payment_amount) });
    }

    res.status(400).json({ success: false, message: 'action must be approve | reject' });
  } catch (err) {
    console.error('reviewTokenDiscounting error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/finance/admin/token-discounting
 * Admin (bank-simulation) view of ALL discounting requests across every farmer.
 */
export const adminListTokenDiscountings = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT t.*, u.full_name AS farmer_name, u.email AS farmer_email, u.phone AS farmer_phone
       FROM token_discounting t
       JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('adminListTokenDiscountings error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/finance/admin/token-discounting/:id
 * Full detail + processing history (audit_logs) for one discounting request.
 */
export const adminGetTokenDiscountingDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [[td]] = await db.execute(
      `SELECT t.*, u.full_name AS farmer_name, u.email AS farmer_email, u.phone AS farmer_phone,
              u.farm_location AS farmer_farm_location,
              p.full_name AS processed_by_name
       FROM token_discounting t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN users p ON t.processed_by = p.id
       WHERE t.id = ? LIMIT 1`,
      [id]
    );
    if (!td) return res.status(404).json({ success: false, message: 'Not found' });

    const [history] = await db.execute(
      `SELECT a.id, a.actor_id, u.full_name AS actor_name, u.email AS actor_email,
              a.action, a.old_data, a.new_data, a.created_at
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.entity_type = 'token_discounting' AND a.entity_id = ?
       ORDER BY a.created_at DESC, a.id DESC`,
      [id]
    );

    res.json({ success: true, data: td, history });
  } catch (err) {
    console.error('adminGetTokenDiscountingDetail error', err);
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
