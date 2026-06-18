/**
 * redeemController — safe token redemption (Part 2 + 9).
 *
 * Flow:
 *  1. createRedeem:  check available_balance ≥ amount → lock tokens → insert pending request
 *  2. reviewRedeem (approve):
 *       a. Call BlockchainService.burnToken() (blockchain FIRST)
 *       b. Only on success: deductLocked() in DB + update status
 *  3. reviewRedeem (reject):
 *       a. unlockBalance() → restore available
 *       b. Update status to 'rejected'
 *
 * No double-redeem possible because locking happens atomically
 * before the record is created.
 */

import db                  from '../config/db.js';
import { burnToken }       from '../services/BlockchainService.js';
import { lockBalance, unlockBalance, deductLocked } from '../services/BalanceService.js';
import { logAction, auditMeta } from '../services/AuditService.js';

// ── Create redeem request ───────────────────────────────────────────────────

export const createRedeem = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { kg_amount, token_type = 'CR1' } = req.body;
    if (!kg_amount || Number(kg_amount) <= 0) {
      return res.status(400).json({ message: 'kg_amount must be > 0' });
    }
    if (!['CR1', 'CR2', 'CR3'].includes(token_type)) {
      return res.status(400).json({ message: 'token_type must be CR1, CR2, or CR3' });
    }

    const amount = Number(kg_amount);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Lock tokens — will throw if insufficient available balance
      await lockBalance(userId, token_type, amount, conn);

      const [result] = await conn.execute(
        `INSERT INTO redeem_requests
           (user_id, kg_amount, token_amount, token_type, status, locked_at, created_at)
         VALUES (?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [userId, amount, amount, token_type]
      );

      await conn.commit();

      await logAction({
        actorId: userId, action: 'redeem:create',
        entityType: 'redeem', entityId: result.insertId,
        newData: { kg_amount: amount, token_type },
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
    console.error('createRedeem error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── List redeems for user ───────────────────────────────────────────────────

export const listRedeemsForUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    const [rows] = await db.execute(
      `SELECT * FROM redeem_requests WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: list all redeems ─────────────────────────────────────────────────

export const listRedeems = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT rr.*, u.email, u.full_name
       FROM redeem_requests rr
       JOIN users u ON rr.user_id = u.id
       ORDER BY rr.created_at DESC LIMIT 500`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: approve or reject ────────────────────────────────────────────────

export const reviewRedeem = async (req, res) => {
  try {
    const id      = req.params.id;
    const adminId = req.user?.id;
    const { action, note } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const [[rr]] = await db.execute(
      `SELECT rr.*, uw.wallet_address AS user_wallet
       FROM redeem_requests rr
       LEFT JOIN user_wallets uw ON uw.user_id = rr.user_id AND uw.role != 'admin'
       WHERE rr.id = ? LIMIT 1`,
      [id]
    );
    if (!rr) return res.status(404).json({ message: 'Not found' });
    if (rr.status !== 'pending') {
      return res.status(409).json({ message: `Redeem already ${rr.status}` });
    }

    const userId     = rr.user_id;
    const tokenType  = rr.token_type || 'CR1';
    const amount     = Number(rr.token_amount);

    if (action === 'approve') {
      if (!rr.user_wallet) {
        return res.status(422).json({ message: 'User has no registered wallet — cannot burn on-chain' });
      }

      // ── STEP 1: Burn on blockchain (MUST succeed before DB update) ────
      let txHash, blockNumber;
      try {
        ({ txHash, blockNumber } = await burnToken({
          tokenType,
          fromAddress: rr.user_wallet,
          amount,
          lotCode:   '',
          redeemId:  String(id),
        }));
      } catch (chainErr) {
        console.error('Blockchain burn failed:', chainErr);
        return res.status(502).json({
          success: false,
          message: `Blockchain burn failed: ${chainErr.message}. Redeem not processed.`,
        });
      }

      // ── STEP 2: Update DB after successful burn ───────────────────────
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // Deduct from locked balance (will also reduce total `balance`)
        await deductLocked(userId, tokenType, amount, conn);

        await conn.execute(
          `UPDATE redeem_requests
           SET status = 'approved', processed_by = ?, processed_at = NOW(), tx_hash = ?
           WHERE id = ?`,
          [adminId, txHash, id]
        );

        await conn.commit();
      } catch (dbErr) {
        await conn.rollback();
        console.error(`CRITICAL: Burn txHash=${txHash} succeeded but DB update failed:`, dbErr);
        return res.status(500).json({
          success: false,
          message: 'On-chain burn succeeded but DB update failed. Contact support.',
          txHash,
        });
      } finally {
        conn.release();
      }

      await logAction({
        actorId: adminId, action: 'redeem:approve',
        entityType: 'redeem', entityId: Number(id),
        newData: { txHash, blockNumber, tokenType, amount },
        ...auditMeta(req),
      });

      return res.json({ success: true, txHash, blockNumber });
    }

    // ── Reject: unlock tokens ────────────────────────────────────────────
    await unlockBalance(userId, tokenType, amount);

    await db.execute(
      `UPDATE redeem_requests
       SET status = 'rejected', processed_by = ?, processed_at = NOW()
       WHERE id = ?`,
      [adminId, id]
    );

    await logAction({
      actorId: adminId, action: 'redeem:reject',
      entityType: 'redeem', entityId: Number(id),
      newData: { note },
      ...auditMeta(req),
    });

    res.json({ success: true, message: 'Redeem rejected and tokens unlocked' });
  } catch (err) {
    console.error('reviewRedeem error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
